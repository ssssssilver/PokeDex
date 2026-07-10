const fs = require('fs');
const path = require('path');

const LIMITLESS_DECKS_URL = 'https://limitlesstcg.com/decks';
const LIMITLESS_HOST = 'limitlesstcg.com';
const LIMITLESS_POKEMON_IMAGE_PREFIX = 'https://r2.limitlesstcg.net/pokemon/';
const LIMITLESS_CARD_IMAGE_PREFIX = 'https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.floor(number), max));
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function remoteImagePath(src) {
  if (!src || !src.startsWith(LIMITLESS_POKEMON_IMAGE_PREFIX)) return '';
  return src.slice(LIMITLESS_POKEMON_IMAGE_PREFIX.length).replace(/^\/+/, '');
}

function proxiedImage(src, publicBaseUrl) {
  const imagePath = remoteImagePath(src);
  if (!imagePath) return src || '';
  if (!publicBaseUrl) return src;
  return `${publicBaseUrl}/assets/limitless/pokemon/${imagePath.split('/').map(encodeURIComponent).join('/')}`;
}

function normalizedCardNumber(value) {
  const number = String(value || '').trim();
  return /^\d+$/.test(number) ? number.padStart(3, '0') : number;
}

function cardImagePath(set, number) {
  const setCode = String(set || '').trim().toUpperCase();
  const cardNumber = normalizedCardNumber(number);
  if (!/^[A-Z0-9-]+$/.test(setCode) || !/^[A-Z0-9-]+$/i.test(cardNumber)) return '';
  return `${setCode}/${setCode}_${cardNumber}_R_EN_LG.png`;
}

function proxiedCardImage(set, number, publicBaseUrl) {
  const imagePath = cardImagePath(set, number);
  if (!imagePath) return '';
  if (!publicBaseUrl) return `${LIMITLESS_CARD_IMAGE_PREFIX}${imagePath}`;
  return `${publicBaseUrl}/assets/limitless/cards/${imagePath.split('/').map(encodeURIComponent).join('/')}`;
}

function decorateCardImages(sections, publicBaseUrl) {
  return (sections || []).map((section) => Object.assign({}, section, {
    cards: (section.cards || []).map((card) => Object.assign({}, card, {
      image: card.image || proxiedCardImage(card.set, card.number, publicBaseUrl)
    }))
  }));
}

function parseImages(html, publicBaseUrl) {
  return Array.from(String(html || '').matchAll(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g))
    .map((match) => ({
      src: proxiedImage(decodeHtml(match[1]), publicBaseUrl),
      remote: decodeHtml(match[1]),
      name: decodeHtml(match[2] || '')
    }))
    .filter((item) => item.src);
}

function parseAttributes(value) {
  const attrs = {};
  String(value || '').replace(/([a-zA-Z0-9:-]+)(?:\s*=\s*"([^"]*)")?/g, (match, key, rawValue) => {
    attrs[key] = decodeHtml(rawValue || '');
    return match;
  });
  return attrs;
}

function normalizeLimitlessDeckUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let url;
  try {
    url = new URL(raw, LIMITLESS_DECKS_URL);
  } catch (error) {
    return '';
  }

  const host = url.hostname.replace(/^www\./, '');
  if (host !== LIMITLESS_HOST || !/^\/decks(\/|$)/.test(url.pathname)) {
    return '';
  }

  url.protocol = 'https:';
  url.hostname = LIMITLESS_HOST;
  url.hash = '';
  return url.toString();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDeckRows(html, publicBaseUrl) {
  const table = String(html || '').match(/<table class="data-table striped">([\s\S]*?)<\/table>/);
  if (!table) return [];
  const rows = Array.from(table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)).map((match) => match[1]);
  return rows.map((row) => {
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((match) => match[1]);
    if (cells.length < 5) return null;
    const link = cells[2].match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    const href = link ? decodeHtml(link[1]) : '';
    const name = link ? stripTags(link[2]) : stripTags(cells[2]);
    const images = parseImages(cells[1], publicBaseUrl);
    const points = Number(stripTags(cells[3]).replace(/,/g, '')) || 0;
    const share = stripTags(cells[4]);
    const shareValue = Number(share.replace('%', '')) || 0;
    return {
      rank: Number(stripTags(cells[0])) || 0,
      name,
      points,
      share,
      share_value: shareValue,
      url: href ? normalizeLimitlessDeckUrl(href) : '',
      images,
      image: images[0] ? images[0].src : '',
      source: 'Limitless TCG'
    };
  }).filter((item) => item && item.name);
}

function parsePageTitle(html) {
  const h1 = String(html || '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);

  const decklistTitle = String(html || '').match(/<div class="decklist-title">([\s\S]*?)(?:<a\b|<\/div>)/i);
  if (decklistTitle) return stripTags(decklistTitle[1]);

  const ogTitle = String(html || '').match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
  if (ogTitle) return stripTags(ogTitle[1].replace(/\s+by\s+.+$/i, ''));

  const title = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? stripTags(title[1].replace(/\s+[-|]\s+Limitless.*$/i, '')) : '';
}

function parseMetaContent(html, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)="${escapeRegExp(name)}"[^>]+content="([^"]*)"`, 'i');
  const match = String(html || '').match(pattern);
  return match ? stripTags(match[1]) : '';
}

function displayDeckCategory(category) {
  if (/^pok/i.test(category)) return '宝可梦';
  if (/^trainer/i.test(category)) return '训练家';
  if (/^energy/i.test(category)) return '能量';
  return category;
}

function parseDeckHeading(label) {
  const clean = stripTags(label);
  const match = clean.match(/^(.+?)\s*\((\d+)\)$/);
  return {
    title: match ? match[1].trim() : clean,
    displayTitle: displayDeckCategory(match ? match[1].trim() : clean),
    count: match ? Number(match[2]) || 0 : 0
  };
}

function parseDeckList(html, publicBaseUrl) {
  const source = String(html || '');
  const headings = Array.from(source.matchAll(/<div class="decklist-column-heading">([\s\S]*?)<\/div>/gi));
  const sections = headings.map((heading, index) => {
    const meta = parseDeckHeading(heading[1]);
    const start = heading.index + heading[0].length;
    const end = index + 1 < headings.length ? headings[index + 1].index : source.indexOf('</div>\n            </div>\n        </div>', start);
    const sectionHtml = source.slice(start, end > start ? end : undefined);
    const cards = Array.from(sectionHtml.matchAll(/<div class="decklist-card"([^>]*)>([\s\S]*?)<\/div>/gi)).map((match) => {
      const attrs = parseAttributes(match[1]);
      const body = match[2];
      const countMatch = body.match(/<span class="card-count">([\s\S]*?)<\/span>/i);
      const nameMatch = body.match(/<span class="card-name">([\s\S]*?)<\/span>/i);
      const linkMatch = body.match(/<a class="card-link" href="([^"]+)"/i);
      const count = Number(stripTags(countMatch ? countMatch[1] : '')) || 0;
      const name = stripTags(nameMatch ? nameMatch[1] : '');
      const set = attrs['data-set'] || '';
      const number = attrs['data-number'] || '';
      return {
        count,
        name,
        set,
        number,
        lang: attrs['data-lang'] || '',
        cardUrl: linkMatch ? new URL(decodeHtml(linkMatch[1]), LIMITLESS_DECKS_URL).toString() : '',
        image: proxiedCardImage(set, number, publicBaseUrl),
        line: `${count} ${name}${set ? ` ${set}` : ''}${number ? ` ${number}` : ''}`.trim()
      };
    }).filter((card) => card.count && card.name);

    return Object.assign({}, meta, {
      cards,
      count: meta.count || cards.reduce((sum, card) => sum + card.count, 0)
    });
  }).filter((section) => section.cards.length);

  const copyText = sections.map((section) => [
    `${section.title}: ${section.count}`,
    ...section.cards.map((card) => card.line)
  ].join('\n')).join('\n\n');

  return {
    title: parsePageTitle(source),
    description: parseMetaContent(source, 'description') || parseMetaContent(source, 'og:description'),
    sections,
    totalCards: sections.reduce((sum, section) => sum + section.cards.reduce((count, card) => count + card.count, 0), 0),
    copyText
  };
}

function findFirstDeckListUrl(html) {
  const match = String(html || '').match(/href="(\/decks\/list\/\d+)"/i);
  return match ? normalizeLimitlessDeckUrl(match[1]) : '';
}

function parseLatestResult(html, deckListUrl, publicBaseUrl) {
  const normalized = normalizeLimitlessDeckUrl(deckListUrl);
  if (!normalized) return null;
  const pathname = new URL(normalized).pathname;
  const rowPattern = new RegExp(`<tr>([\\s\\S]*?href="${escapeRegExp(pathname)}"[\\s\\S]*?)<\\/tr>`, 'i');
  const row = String(html || '').match(rowPattern);
  if (!row) return null;

  const cells = Array.from(row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((match) => match[1]);
  if (!cells.length) return null;

  return {
    place: stripTags(cells[1] || ''),
    player: stripTags(cells[3] || ''),
    variants: parseImages(cells[2] || '', publicBaseUrl).map((image) => image.name).filter(Boolean),
    images: parseImages(cells[2] || '', publicBaseUrl)
  };
}

class HotDeckService {
  constructor(options = {}) {
    this.publicBaseUrl = options.publicBaseUrl || '';
    this.dataDir = options.dataDir || path.join(__dirname, '.data');
    this.cacheFile = options.cacheFile || path.join(this.dataDir, 'hot-decks-cache.json');
    this.detailCacheFile = options.detailCacheFile || path.join(this.dataDir, 'hot-deck-details-cache.json');
    this.ttlMs = Number(options.ttlMs || CACHE_TTL_MS);
  }

  readCache() {
    return readJson(this.cacheFile, {
      items: [],
      fetchedAt: '',
      sourceUrl: LIMITLESS_DECKS_URL
    });
  }

  writeCache(payload) {
    writeJson(this.cacheFile, payload);
  }

  readDetailCache() {
    return readJson(this.detailCacheFile, {
      items: {}
    });
  }

  writeDetailCache(payload) {
    writeJson(this.detailCacheFile, payload);
  }

  cacheFresh(cache) {
    const time = new Date(cache && cache.fetchedAt).getTime();
    return Number.isFinite(time) && Date.now() - time < this.ttlMs && (cache.items || []).length;
  }

  detailFresh(detail) {
    const time = new Date(detail && detail.fetchedAt).getTime();
    return Number.isFinite(time) && Date.now() - time < this.ttlMs && detail.item;
  }

  async fetchHtml(url) {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'PokeChill/1.0 (+local development)'
      }
    });
    if (!response.ok) {
      throw new Error(`Limitless request failed: ${response.status}`);
    }
    return response.text();
  }

  findCachedDeckSummary(url, options = {}) {
    const normalized = normalizeLimitlessDeckUrl(url);
    const cached = this.readCache();
    const item = (cached.items || []).find((deck) => normalizeLimitlessDeckUrl(deck.url) === normalized) || {};
    return Object.assign({}, item, {
      rank: Number(options.rank || item.rank || 0),
      name: options.name || item.name || '',
      points: Number(options.points || item.points || 0),
      share: options.share || item.share || '',
      url: normalized || item.url || ''
    });
  }

  async fetchHotDecks() {
    const response = await fetch(LIMITLESS_DECKS_URL, {
      headers: {
        Accept: 'text/html',
        'User-Agent': 'PokeChill/1.0 (+local development)'
      }
    });
    if (!response.ok) {
      throw new Error(`Limitless decks request failed: ${response.status}`);
    }
    const html = await response.text();
    const items = parseDeckRows(html, this.publicBaseUrl);
    if (!items.length) {
      throw new Error('Limitless decks table was not found');
    }
    const payload = {
      items,
      fetchedAt: new Date().toISOString(),
      sourceUrl: LIMITLESS_DECKS_URL
    };
    this.writeCache(payload);
    return payload;
  }

  async listHotDecks(options = {}) {
    const limit = boundedInteger(options.limit, 8, 1, 25);
    const refresh = options.refresh === true || options.refresh === 'true';
    let payload = this.readCache();
    let stale = !this.cacheFresh(payload);

    if (refresh || stale) {
      try {
        payload = await this.fetchHotDecks();
        stale = false;
      } catch (error) {
        payload = Object.assign({}, payload, {
          message: error.message || 'Unable to refresh hot decks'
        });
      }
    }

    return {
      items: (payload.items || []).slice(0, limit),
      total: (payload.items || []).length,
      source: 'limitless-tcg',
      sourceUrl: payload.sourceUrl || LIMITLESS_DECKS_URL,
      fetchedAt: payload.fetchedAt || '',
      stale
    };
  }

  async fetchDeckDetail(url, options = {}) {
    const normalized = normalizeLimitlessDeckUrl(url);
    if (!normalized) {
      throw new Error('Invalid Limitless deck URL');
    }

    const summary = this.findCachedDeckSummary(normalized, options);
    let overviewUrl = normalized;
    let decklistUrl = normalized;
    let overviewTitle = summary.name || '';
    let latestResult = null;
    let html = await this.fetchHtml(normalized);

    if (!/\/decks\/list\/\d+/.test(new URL(normalized).pathname)) {
      overviewUrl = normalized;
      overviewTitle = parsePageTitle(html) || overviewTitle;
      decklistUrl = findFirstDeckListUrl(html);
      latestResult = parseLatestResult(html, decklistUrl, this.publicBaseUrl);
      if (!decklistUrl) {
        throw new Error('No concrete decklist found for this archetype');
      }
      html = await this.fetchHtml(decklistUrl);
    }

    const detail = parseDeckList(html, this.publicBaseUrl);
    if (!detail.sections.length) {
      throw new Error('Limitless decklist cards were not found');
    }

    const item = Object.assign({}, summary, {
      name: detail.title || overviewTitle || summary.name,
      overviewName: overviewTitle || summary.name || detail.title,
      overviewUrl,
      decklistUrl,
      source: 'Limitless TCG',
      sourceUrl: decklistUrl,
      latestResult,
      description: detail.description,
      sections: detail.sections,
      totalCards: detail.totalCards,
      copyText: detail.copyText,
      fetchedAt: new Date().toISOString()
    });

    return {
      item,
      source: 'limitless-tcg',
      sourceUrl: decklistUrl,
      fetchedAt: item.fetchedAt
    };
  }

  async getDeckDetail(options = {}) {
    const url = normalizeLimitlessDeckUrl(options.url || options.deckUrl);
    const refresh = options.refresh === true || options.refresh === 'true';
    if (!url) {
      throw new Error('Missing or invalid deck URL');
    }

    const cache = this.readDetailCache();
    const cached = cache.items[url];
    if (!refresh && this.detailFresh(cached)) {
      const item = Object.assign({}, cached.item, {
        sections: decorateCardImages(cached.item.sections, this.publicBaseUrl)
      });
      return Object.assign({}, cached, {
        item,
        stale: false
      });
    }

    try {
      const payload = await this.fetchDeckDetail(url, options);
      cache.items[url] = payload;
      this.writeDetailCache(cache);
      return Object.assign({}, payload, {
        stale: false
      });
    } catch (error) {
      if (cached && cached.item) {
        return Object.assign({}, cached, {
          stale: true,
          message: error.message || 'Unable to refresh deck detail'
        });
      }
      throw error;
    }
  }

  getPokemonImageInfo(assetPath) {
    const cleanPath = String(assetPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath || cleanPath.includes('..') || !/^[a-zA-Z0-9_./-]+\.png$/.test(cleanPath)) {
      return null;
    }
    return {
      remote: `${LIMITLESS_POKEMON_IMAGE_PREFIX}${cleanPath}`,
      filePath: path.join(this.dataDir, 'limitless-images', 'pokemon', cleanPath)
    };
  }

  getCardImageInfo(assetPath) {
    const cleanPath = String(assetPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = cleanPath.split('/');
    if (parts.length !== 2 || !/^[A-Z0-9-]+$/.test(parts[0]) || !/^[A-Z0-9_-]+\.png$/i.test(parts[1])) {
      return null;
    }
    const expectedPath = cardImagePath(parts[0], parts[1].replace(new RegExp(`^${parts[0]}_|_R_EN_LG\\.png$`, 'gi'), ''));
    if (expectedPath !== cleanPath) return null;
    return {
      remote: `${LIMITLESS_CARD_IMAGE_PREFIX}${cleanPath}`,
      filePath: path.join(this.dataDir, 'limitless-images', 'cards', ...parts)
    };
  }
}

module.exports = {
  HotDeckService,
  parseDeckRows,
  parseDeckList,
  normalizeLimitlessDeckUrl
};
