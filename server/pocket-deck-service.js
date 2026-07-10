const fs = require('fs');
const path = require('path');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const LIMITLESS_ORIGIN = 'https://play.limitlesstcg.com';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, filePath);
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function safeLimitlessUrl(value, expectedPath) {
  let url;
  try {
    url = new URL(value, LIMITLESS_ORIGIN);
  } catch (error) {
    return '';
  }
  if (url.protocol !== 'https:' || url.hostname !== 'play.limitlesstcg.com' || !expectedPath.test(url.pathname)) return '';
  return url.toString();
}

function cardCollectionKey(set, number) {
  const normalizedSet = String(set || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `${normalizedSet}-${String(Number(number) || number || '').padStart(3, '0')}`;
}

function proxiedPokemonImages(images, publicBaseUrl) {
  return (images || []).map((image) => {
    if (!image || !publicBaseUrl) return image || '';
    try {
      const url = new URL(image);
      const marker = '/pokemon/';
      const index = url.pathname.indexOf(marker);
      if (index < 0) return image;
      return `${publicBaseUrl}/assets/limitless/pokemon/${url.pathname.slice(index + marker.length).split('/').map(encodeURIComponent).join('/')}`;
    } catch (error) {
      return image;
    }
  }).filter(Boolean);
}

function parseRepresentative(archetypeHtml) {
  const row = String(archetypeHtml || '').match(/<tr([^>]*data-player="[^"]+"[^>]*)>([\s\S]*?)<\/tr>/i);
  if (!row) throw new Error('No representative Pocket tournament deck was found');
  const attrs = {};
  row[1].replace(/([a-z-]+)="([^"]*)"/gi, (match, key, value) => {
    attrs[key] = decodeHtml(value);
    return match;
  });
  const deckLink = row[2].match(/href="([^"]+\/decklist)"/i);
  const cells = Array.from(row[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);
  const url = deckLink ? safeLimitlessUrl(decodeHtml(deckLink[1]), /^\/tournament\/.+\/decklist$/) : '';
  if (!url) throw new Error('Representative Pocket deck URL is invalid');
  return {
    url,
    player: attrs['data-player'] || stripTags(cells[0]),
    tournament: attrs['data-tournament'] || stripTags(cells[1]),
    date: attrs['data-date'] || '',
    place: Number(attrs['data-place'] || 0),
    score: stripTags(cells[4] || '')
  };
}

function parseDeckCards(deckHtml) {
  const input = String(deckHtml || '').match(/<input type="hidden" name="input" value="([^"]*)"/i);
  if (!input) throw new Error('Pocket tournament deck card data was not found');
  const cards = JSON.parse(decodeHtml(input[1]));
  const energyMatch = String(deckHtml || '').match(/Energy:\s*([^`\r\n<]+)/i);
  return {
    cards,
    energy: energyMatch ? energyMatch[1].trim() : '',
    totalCards: cards.reduce((sum, card) => sum + Number(card.count || 0), 0)
  };
}

class PocketDeckService {
  constructor(store, options = {}) {
    this.store = store;
    this.publicBaseUrl = options.publicBaseUrl || '';
    this.cacheFile = options.cacheFile || path.join(options.dataDir || path.join(__dirname, '.data'), 'pocket-deck-details.json');
    this.ttlMs = Number(options.ttlMs || CACHE_TTL_MS);
  }

  cardIndex() {
    const index = new Map();
    this.store.getCards().forEach((card) => {
      (card.collections || []).forEach((collection) => index.set(collection.key, card));
    });
    return index;
  }

  async fetchHtml(url) {
    const response = await fetch(url, {
      headers: { Accept: 'text/html', 'User-Agent': 'PokeChill/1.0 (+local Pocket data cache)' }
    });
    if (!response.ok) throw new Error(`Limitless Pocket request failed: ${response.status}`);
    return response.text();
  }

  cached(id) {
    const cache = readJson(this.cacheFile, { items: {} });
    const item = cache.items[String(id)];
    if (!item) return null;
    const fetchedAt = new Date(item.fetchedAt).getTime();
    return Number.isFinite(fetchedAt) && Date.now() - fetchedAt < this.ttlMs ? item : null;
  }

  decorateDetail(item) {
    if (!item) return item;
    return Object.assign({}, item, {
      archetype: item.archetype ? Object.assign({}, item.archetype, {
        images: proxiedPokemonImages(item.archetype.images, this.publicBaseUrl)
      }) : null,
      cards: (item.cards || []).map((card) => Object.assign({}, card, {
        image: card.id && this.publicBaseUrl
          ? `${this.publicBaseUrl}/assets/pocket/cards/${encodeURIComponent(card.id)}`
          : card.image || ''
      }))
    });
  }

  write(id, value) {
    const cache = readJson(this.cacheFile, { items: {} });
    cache.items[String(id)] = value;
    writeJson(this.cacheFile, cache);
  }

  async getDetail(id, options = {}) {
    const archetype = this.store.getCollection('hot_decks').find((deck) => deck.id === String(id));
    if (!archetype) return { item: null, source: 'empty-cache' };
    const cached = options.refresh ? null : this.cached(id);
    if (cached) return { item: this.decorateDetail(cached.item), source: 'pocket-deck-cache' };

    const archetypeUrl = safeLimitlessUrl(archetype.url, /^\/decks\//);
    if (!archetypeUrl) throw new Error('Pocket archetype URL is invalid');
    const representative = parseRepresentative(await this.fetchHtml(archetypeUrl));
    const parsed = parseDeckCards(await this.fetchHtml(representative.url));
    const cardIndex = this.cardIndex();
    const cards = parsed.cards.map((card) => {
      const local = cardIndex.get(cardCollectionKey(card.set, card.number));
      return Object.assign({}, card, {
        id: local ? local.id : '',
        name_zh: local ? local.name_zh : '',
        image: local && local.image && this.publicBaseUrl
          ? `${this.publicBaseUrl}/assets/pocket/cards/${encodeURIComponent(local.id)}`
          : local ? local.image : ''
      });
    });
    const copyText = [
      ...cards.map((card) => `${card.count} ${card.name} ${card.set} ${card.number}`),
      '',
      `Energy: ${parsed.energy}`
    ].join('\n');
    const item = this.decorateDetail({
      id: archetype.id,
      name: archetype.name,
      archetype,
      representative,
      cards,
      total_cards: parsed.totalCards,
      energy: parsed.energy,
      copy_text: copyText,
      source_url: representative.url,
      fetched_at: new Date().toISOString()
    });
    this.write(id, { item, fetchedAt: item.fetched_at });
    return { item, source: 'limitless-pocket' };
  }
}

module.exports = {
  PocketDeckService,
  parseDeckCards,
  parseRepresentative
};
