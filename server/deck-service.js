const fs = require('fs');
const path = require('path');

const LIMITLESS_DECKS_URL = 'https://limitlesstcg.com/decks';
const LIMITLESS_POKEMON_IMAGE_PREFIX = 'https://r2.limitlesstcg.net/pokemon/';
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

function parseImages(html, publicBaseUrl) {
  return Array.from(String(html || '').matchAll(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*>/g))
    .map((match) => ({
      src: proxiedImage(decodeHtml(match[1]), publicBaseUrl),
      remote: decodeHtml(match[1]),
      name: decodeHtml(match[2] || '')
    }))
    .filter((item) => item.src);
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
      url: href ? new URL(href, LIMITLESS_DECKS_URL).toString() : '',
      images,
      image: images[0] ? images[0].src : '',
      source: 'Limitless TCG'
    };
  }).filter((item) => item && item.name);
}

class HotDeckService {
  constructor(options = {}) {
    this.publicBaseUrl = options.publicBaseUrl || '';
    this.dataDir = options.dataDir || path.join(__dirname, '.data');
    this.cacheFile = options.cacheFile || path.join(this.dataDir, 'hot-decks-cache.json');
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

  cacheFresh(cache) {
    const time = new Date(cache && cache.fetchedAt).getTime();
    return Number.isFinite(time) && Date.now() - time < this.ttlMs && (cache.items || []).length;
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
}

module.exports = {
  HotDeckService,
  parseDeckRows
};
