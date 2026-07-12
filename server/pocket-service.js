const path = require('path');

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.floor(number), max));
}

function paginate(items, options = {}) {
  const page = boundedInteger(options.page, 1, 1, 100000);
  const pageSize = boundedInteger(options.pageSize || options.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    hasMore: offset + pageSize < items.length,
    source: items.length ? 'pocket-cache' : 'empty-cache'
  };
}

function searchText(value) {
  return JSON.stringify(value || {}).toLowerCase();
}

function currentEventStatus(event, nowEpoch) {
  if (event.start_epoch && nowEpoch < event.start_epoch) return 'upcoming';
  if (event.end_epoch && nowEpoch >= event.end_epoch) return 'expired';
  if (!event.end_epoch) return event.start_epoch && nowEpoch >= event.start_epoch ? 'permanent' : 'current';
  return 'current';
}

function weightedKey(weights) {
  const entries = Object.entries(weights || {}).filter((entry) => Number(entry[1]) > 0);
  const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0);
  if (!total) return '';
  let target = Math.random() * total;
  for (const [key, weight] of entries) {
    target -= Number(weight);
    if (target <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function randomItem(items) {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null;
}

function proxiedPokemonImages(images, publicBaseUrl) {
  return (images || []).map((image) => {
    const remote = typeof image === 'string' ? image : image.src || image.remote || '';
    if (!remote || !publicBaseUrl) return remote;
    try {
      const url = new URL(remote);
      const marker = '/pokemon/';
      const index = url.pathname.indexOf(marker);
      if (index < 0) return remote;
      const assetPath = url.pathname.slice(index + marker.length).split('/').map(encodeURIComponent).join('/');
      return `${publicBaseUrl}/assets/limitless/pokemon/${assetPath}`;
    } catch (error) {
      return remote;
    }
  }).filter(Boolean);
}

class PocketService {
  constructor(store, options = {}) {
    this.store = store;
    this.publicBaseUrl = options.publicBaseUrl || '';
    this.dataDir = options.dataDir || path.join(__dirname, '.data');
  }

  decorateCard(card) {
    if (!card) return null;
    return Object.assign({}, card, {
      image_remote: card.image || '',
      image: card.image && this.publicBaseUrl
        ? `${this.publicBaseUrl}/assets/pocket/cards/${encodeURIComponent(card.id)}`
        : card.image || ''
    });
  }

  decoratePack(pack) {
    if (!pack) return null;
    return Object.assign({}, pack, {
      image_remote: pack.image || '',
      image: pack.image && this.publicBaseUrl
        ? `${this.publicBaseUrl}/assets/pocket/packs/${encodeURIComponent(pack.id)}`
        : pack.image || ''
    });
  }

  getImageInfo(id) {
    const card = this.store.getCard(id);
    if (!card || !card.image) return null;
    return {
      remote: card.image,
      filePath: path.join(this.dataDir, 'pocket-assets', 'cards', `${String(id).replace(/[^a-z0-9_-]/gi, '_')}.png`)
    };
  }

  getPackImageInfo(id) {
    const pack = this.store.getPacks().find((item) => item.id === String(id));
    if (!pack || !pack.image) return null;
    return {
      remote: pack.image,
      filePath: path.join(this.dataDir, 'pocket-assets', 'packs', `${String(id).replace(/[^a-z0-9_-]/gi, '_')}.png`)
    };
  }

  listCards(options = {}) {
    const keyword = String(options.keyword || options.q || '').trim().toLowerCase();
    const expansion = String(options.expansion || options.set || '').trim().toUpperCase();
    const rarity = String(options.rarity || '').trim().toUpperCase();
    const type = String(options.type || '').trim().toLowerCase();
    const pokemonId = boundedInteger(options.pokemonId || options.pokedexNumber, 0, 0, 100000);
    const items = this.store.getCards().filter((card) => {
      if (keyword && !searchText([
        card.id, card.name_zh, card.name_en, card.artist, card.pack_name_en,
        (card.collections || []).map((entry) => [entry.expansion_id, entry.expansion_name_zh, entry.number])
      ]).includes(keyword)) return false;
      if (expansion && !(card.collections || []).some((entry) => String(entry.expansion_id).toUpperCase() === expansion)) return false;
      if (rarity && String(card.rarity).toUpperCase() !== rarity) return false;
      if (type && String(card.card_type).toLowerCase() !== type) return false;
      if (pokemonId && Number(card.national_pokedex_number || 0) !== pokemonId) return false;
      return true;
    }).sort((a, b) => {
      const aCollection = (a.collections || [])[0] || {};
      const bCollection = (b.collections || [])[0] || {};
      if (options.sort === 'name') return String(a.name_zh || a.name_en).localeCompare(String(b.name_zh || b.name_en), 'zh');
      if (options.sort === 'rarity') return String(a.rarity || '').localeCompare(String(b.rarity || '')) || Number(aCollection.number || 0) - Number(bCollection.number || 0);
      if (options.sort === 'number') return Number(aCollection.number || 0) - Number(bCollection.number || 0);
      return String(aCollection.expansion_id || '').localeCompare(String(bCollection.expansion_id || '')) ||
        Number(aCollection.number || 0) - Number(bCollection.number || 0);
    });
    const result = paginate(items, options);
    result.items = result.items.map((card) => this.decorateCard(card));
    return result;
  }

  getCard(id) {
    const item = this.decorateCard(this.store.getCard(id));
    return { item, source: item ? 'pocket-cache' : 'empty-cache' };
  }

  listExpansions(options = {}) {
    return paginate(this.store.getExpansions().sort((a, b) => String(b.release_date).localeCompare(String(a.release_date))), options);
  }

  listPacks(options = {}) {
    const expansion = String(options.expansion || '').toUpperCase();
    const items = this.store.getPacks()
      .filter((pack) => !expansion || String(pack.expansion_id).toUpperCase() === expansion)
      .sort((a, b) => String(b.released_at).localeCompare(String(a.released_at)));
    const result = paginate(items, options);
    result.items = result.items.map((pack) => this.decoratePack(pack));
    return result;
  }

  getPack(id) {
    const item = this.decoratePack(this.store.getPacks().find((pack) => pack.id === String(id)) || null);
    return { item, source: item ? 'pocket-cache' : 'empty-cache' };
  }

  getRarities() {
    const item = this.store.getAuxiliary('rarities');
    return { item, source: item ? 'pocket-cache' : 'empty-cache' };
  }

  getPullRates(options = {}) {
    const rates = this.store.getAuxiliary('pull_rates') || {};
    const expansion = String(options.expansion || options.set || '').trim();
    if (expansion) {
      const key = Object.keys(rates).find((item) => item.toLowerCase() === expansion.toLowerCase());
      const item = key ? rates[key] : null;
      return { item, expansion: key || expansion, source: item ? 'pocket-cache' : 'empty-cache' };
    }
    return { item: rates, source: Object.keys(rates).length ? 'pocket-cache' : 'empty-cache' };
  }

  openPack(options = {}) {
    const packs = this.store.getPacks();
    const pack = packs.find((item) => item.id === String(options.packId || options.id || '')) ||
      packs.find((item) => item.is_regular) || packs[0] || null;
    if (!pack) return { item: null, source: 'empty-cache' };

    const availableIds = new Set(pack.card_ids || []);
    const cards = this.store.getCards().filter((card) => {
      if (availableIds.size && availableIds.has(card.id)) return true;
      return !availableIds.size && (card.collections || []).some((entry) => entry.expansion_id === pack.expansion_id);
    });
    if (pack.is_promo) {
      const card = randomItem(cards);
      const pulled = card ? [Object.assign({}, this.decorateCard(card), { slot: 1, rarity_meta: null })] : [];
      return {
        item: {
          id: `pocket-pack-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          pack: this.decoratePack(pack),
          pack_type: '特典包',
          is_promo: true,
          is_rare_pack: false,
          cards: pulled,
          count: pulled.length
        },
        source: 'pocket-cache'
      };
    }

    const rates = this.store.getAuxiliary('pull_rates') || {};
    const expansionRates = rates[pack.expansion_id] || {};
    const rateEntries = Object.entries(expansionRates);
    const packTypeName = weightedKey(Object.fromEntries(rateEntries.map(([name, value]) => [name, value.appearance_rate || 0]))) ||
      (expansionRates['Regular Pack'] ? 'Regular Pack' : (rateEntries[0] && rateEntries[0][0]));
    const packRate = expansionRates[packTypeName] || {};
    const rarities = this.store.getAuxiliary('rarities') || {};
    const slots = Object.keys(packRate.slots || {}).sort((a, b) => Number(a) - Number(b));
    const count = Number(packRate.cards || slots.length || 5);
    const pulled = Array.from({ length: count }, (unused, index) => {
      const slotWeights = (packRate.slots || {})[String(index + 1)] || {};
      const rarity = weightedKey(slotWeights);
      const candidates = rarity ? cards.filter((card) => card.rarity === rarity) : cards;
      const card = randomItem(candidates.length ? candidates : cards);
      return card ? Object.assign({}, this.decorateCard(card), {
        slot: index + 1,
        rarity_meta: rarities[card.rarity] || null
      }) : null;
    }).filter(Boolean);
    return {
      item: {
        id: `pocket-pack-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        pack: this.decoratePack(pack),
        pack_type: packTypeName || 'Regular Pack',
        is_rare_pack: /rare/i.test(packTypeName || ''),
        cards: pulled,
        count: pulled.length
      },
      source: 'pocket-cache'
    };
  }

  listEvents(options = {}) {
    const nowEpoch = Math.floor(Date.now() / 1000);
    const type = String(options.type || '').trim();
    const status = String(options.status || '').trim();
    const items = this.store.getEvents().map((event) => Object.assign({}, event, {
      status: currentEventStatus(event, nowEpoch)
    })).filter((event) => (!type || event.type === type) && (!status || event.status === status))
      .sort((a, b) => Number(a.start_epoch || 0) - Number(b.start_epoch || 0));
    return paginate(items, options);
  }

  listCollection(name, options = {}) {
    const keyword = String(options.keyword || options.q || '').trim().toLowerCase();
    const nowEpoch = Math.floor(Date.now() / 1000);
    const items = this.store.getCollection(name)
      .map((item) => (item.start_epoch || item.end_epoch ? Object.assign({}, item, {
        status: currentEventStatus(item, nowEpoch)
      }) : item))
      .filter((item) => !keyword || searchText(item).includes(keyword))
      .map((item) => name === 'hot_decks' ? Object.assign({}, item, {
        images: proxiedPokemonImages(item.images, this.publicBaseUrl)
      }) : item);
    return paginate(items, options);
  }

  getMeta() {
    return {
      item: this.store.getMeta('pocket'),
      release: this.store.getRelease(),
      sources: this.store.getSourceMeta(),
      counts: {
        cards: this.store.getCards().length,
        expansions: this.store.getExpansions().length,
        packs: this.store.getPacks().length,
        events: this.store.getEvents().length,
        missions: this.store.getCollection('missions').length,
        battles: this.store.getCollection('battles').length,
        shops: this.store.getCollection('shops').length,
        wonder_picks: this.store.getCollection('wonder_picks').length,
        hot_decks: this.store.getCollection('hot_decks').length
      },
      source: 'pocket-cache'
    };
  }

  getRuns(options = {}) {
    const limit = boundedInteger(options.limit, 20, 1, 100);
    const items = this.store.getRuns().sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return { items: items.slice(0, limit), total: items.length, source: 'pocket-cache' };
  }
}

module.exports = {
  PocketService
};
