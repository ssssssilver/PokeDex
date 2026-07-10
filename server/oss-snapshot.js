const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { CacheStore } = require('./cache-store');
const { PokedexService } = require('./pokedex-service');
const { PokemonModel3dService } = require('./projectpokemon-3d-service');
const { PtcgCacheStore } = require('./ptcg-cache-store');
const { PtcgService, decorateCard } = require('./ptcg-service');
const { PocketCacheStore } = require('./pocket-cache-store');
const { PocketService } = require('./pocket-service');

const SCHEMA_VERSION = 1;
const DEFAULT_BUCKETS = 128;

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(staticSafeUrls(value))}\n`, 'utf8');
}

function staticSafeUrls(value) {
  if (Array.isArray(value)) return value.map(staticSafeUrls);
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((result, key) => {
      result[key] = staticSafeUrls(value[key]);
      return result;
    }, {});
  }
  if (typeof value !== 'string') return value;
  const localAsset = value.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(\/assets\/.+)$/i);
  return localAsset ? localAsset[1] : value;
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function hashBucket(value, bucketCount) {
  const input = Buffer.from(String(value), 'utf8');
  let hash = 2166136261;
  for (const byte of input) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % bucketCount;
}

function chunk(items, size) {
  const rows = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function bucketDetails(items, bucketCount) {
  const buckets = Array.from({ length: bucketCount }, () => ({}));
  items.forEach((item) => {
    if (!item || item.id === undefined || item.id === null) return;
    buckets[hashBucket(item.id, bucketCount)][String(item.id)] = item;
  });
  return buckets;
}

function remoteCardImages(item, raw) {
  if (!item) return item;
  const source = raw || item;
  const small = source.image_small_remote || (source.images && source.images.small) || '';
  const large = source.image_large_remote || (source.images && source.images.large) || small;
  return Object.assign({}, item, {
    image: small || item.image,
    image_small: small || item.image_small,
    image_large: large || item.image_large,
    images: Object.assign({}, item.images || {}, small ? { small } : {}, large ? { large } : {})
  });
}

function mirroredAsset(dataDir, relativePath) {
  const filePath = path.join(dataDir, 'oss-assets', ...relativePath.split('/'));
  return fs.existsSync(filePath) ? `/assets/${relativePath.replace(/\\/g, '/')}` : '';
}

function remoteSetImages(item, raw) {
  if (!item) return item;
  const source = raw || item;
  return Object.assign({}, item, {
    symbol: source.image_symbol_remote || item.symbol || '',
    logo: source.image_logo_remote || item.logo || ''
  });
}

function remotePokemonImage(item, raw) {
  if (!item) return item;
  const source = raw || item;
  return Object.assign({}, item, {
    image: source.image_remote || item.image || ''
  });
}

function remotePocketImage(item, raw) {
  if (!item) return item;
  const source = raw || item;
  return Object.assign({}, item, {
    image: source.image_remote || item.image_remote || item.image || ''
  });
}

function remoteDeckImages(value) {
  if (Array.isArray(value)) return value.map(remoteDeckImages);
  if (typeof value === 'string') {
    const limitlessPokemon = value.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/assets\/limitless\/pokemon\/(.+)$/i);
    if (limitlessPokemon) return `https://r2.limitlesstcg.net/pokemon/${limitlessPokemon[1]}`;
    const limitlessCard = value.match(/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/assets\/limitless\/cards\/(.+)$/i);
    if (limitlessCard) return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${limitlessCard[1]}`;
    return value;
  }
  if (!value || typeof value !== 'object') return value;
  const next = {};
  Object.keys(value).forEach((key) => {
    next[key] = remoteDeckImages(value[key]);
  });
  if (next.remote && (next.src || next.image)) {
    if (next.src) next.src = next.remote;
    if (next.image) next.image = next.remote;
  }
  if (Array.isArray(next.images) && next.images.length) {
    const first = next.images[0];
    if (typeof first === 'object' && first.remote) next.image = first.remote;
  }
  return next;
}

function writeDataset(releaseDir, name, items, options = {}) {
  const listChunkSize = Number(options.listChunkSize || 100);
  const bucketCount = Number(options.detailBuckets || DEFAULT_BUCKETS);
  const listChunks = chunk(items.list, listChunkSize);
  listChunks.forEach((rows, index) => {
    writeJson(path.join(releaseDir, name, 'list', `${String(index).padStart(4, '0')}.json`), {
      items: rows,
      source: 'oss-static'
    });
  });
  const detailBuckets = bucketDetails(items.details, bucketCount);
  detailBuckets.forEach((rows, index) => {
    writeJson(path.join(releaseDir, name, 'details', `${String(index).padStart(3, '0')}.json`), rows);
  });
  return {
    count: items.list.length,
    listChunkSize,
    listChunks: listChunks.length,
    detailBuckets: bucketCount,
    listPath: `${name}/list/{chunk}.json`,
    detailPath: `${name}/details/{bucket}.json`
  };
}

function collectPokemon(context) {
  const summaries = context.pokemonStore.getSummaries();
  const summaryMap = new Map(summaries.map((item) => [Number(item.id), item]));
  const list = context.pokedexService.listPokemon({ sort: 'id' }).items.map((item) => {
    const raw = summaryMap.get(Number(item.id)) || {};
    const next = Object.assign(remotePokemonImage(item, raw), {
      regional_dexes: raw.regional_dexes || [],
      regional_dex_keys: raw.regional_dex_keys || []
    });
    next.image = mirroredAsset(context.dataDir, `pokemon/artwork/${item.id}.png`) || next.image;
    return next;
  });
  const details = list.map((summary) => {
    const raw = context.pokemonStore.getDetail(summary.id);
    const item = remotePokemonImage(context.pokedexService.getPokemon(summary.id).item, raw);
    if (item) {
      item.image = mirroredAsset(context.dataDir, `pokemon/artwork/${item.id}.png`) || item.image;
      item.model3d = context.modelService.getModelForPokemon(item);
    }
    return item;
  }).filter(Boolean);
  return { list, details };
}

function collectPtcg(context) {
  const rawSummaries = context.ptcgStore.getCardSummaries();
  const serviceContext = context.ptcgService.context();
  context.ptcgService.context = () => serviceContext;
  const list = rawSummaries.map((raw) => {
    const card = decorateCard(raw, serviceContext);
    const item = remoteCardImages({
      id: card.id,
      name: card.name,
      name_zh: card.name_zh,
      display_name: card.display_name,
      supertype: card.supertype,
      supertype_name: card.supertype_name,
      subtypes: card.subtypes,
      subtype_names: card.subtype_names,
      hp: card.hp,
      types: card.types,
      type_names: card.type_names,
      type_energy: card.type_energy,
      set_id: card.set_id,
      set_name: card.set_name,
      set_series: card.set_series,
      set_symbol: card.set_symbol,
      set_logo: card.set_logo,
      set_release_date: card.set_release_date,
      number: card.number,
      artist: card.artist,
      rarity: card.rarity,
      rarity_name: card.rarity_name,
      regulation_mark: card.regulation_mark,
      legalities_text: card.legalities_text,
      national_pokedex_numbers: card.national_pokedex_numbers,
      pokemon_refs: card.pokemon_refs,
      image: card.image,
      image_small: card.image_small
    }, raw);
    item.image = mirroredAsset(context.dataDir, `ptcg/cards/${encodeURIComponent(item.id)}/small.png`) || item.image;
    item.image_small = item.image;
    return item;
  }).sort((a, b) => String(b.set_release_date || '').localeCompare(String(a.set_release_date || '')) ||
    String(a.set_id || '').localeCompare(String(b.set_id || '')) ||
    String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true }));
  const details = list.map((summary) => {
    const raw = context.ptcgStore.getCardDetail(summary.id);
    const item = remoteCardImages(context.ptcgService.getCard(summary.id).item, raw);
    const small = mirroredAsset(context.dataDir, `ptcg/cards/${encodeURIComponent(item.id)}/small.png`);
    const large = mirroredAsset(context.dataDir, `ptcg/cards/${encodeURIComponent(item.id)}/large.png`);
    if (small) item.image = item.image_small = small;
    if (large) item.image_large = large;
    if (item.images) item.images = Object.assign({}, item.images, small ? { small } : {}, large ? { large } : {});
    return item;
  }).filter(Boolean);
  return { list, details };
}

function collectPocket(context) {
  const rawCards = context.pocketStore.getCards();
  const rawMap = new Map(rawCards.map((item) => [String(item.id), item]));
  const list = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const result = context.pocketService.listCards({ page, pageSize: 100 });
    result.items.forEach((item) => {
      const next = remotePocketImage(item, rawMap.get(String(item.id)));
      next.image = mirroredAsset(context.dataDir, `pocket/cards/${encodeURIComponent(next.id)}.png`) || next.image;
      list.push(next);
    });
    hasMore = result.hasMore;
    page += 1;
  }
  const details = list.map((summary) => {
    const item = remotePocketImage(context.pocketService.getCard(summary.id).item, rawMap.get(String(summary.id)));
    item.image = mirroredAsset(context.dataDir, `pocket/cards/${encodeURIComponent(item.id)}.png`) || item.image;
    return item;
  }).filter(Boolean);
  return { list, details };
}

function dataFingerprint(files) {
  const hash = crypto.createHash('sha256');
  files.forEach((filePath) => {
    const stat = fs.statSync(filePath);
    hash.update(path.basename(filePath));
    hash.update(String(stat.size));
    hash.update(String(Math.floor(stat.mtimeMs)));
  });
  return hash.digest('hex').slice(0, 12);
}

function createContext(options = {}) {
  const dataDir = path.resolve(options.dataDir || path.join(__dirname, '.data'));
  const publicBaseUrl = '';
  const pokemonStore = new CacheStore({ filePath: path.join(dataDir, 'pokedex-cache.json') });
  const ptcgStore = new PtcgCacheStore({ filePath: path.join(dataDir, 'ptcg-cache.json') });
  const pocketStore = new PocketCacheStore({ filePath: path.join(dataDir, 'pocket-cache.json') });
  return {
    dataDir,
    pokemonStore,
    ptcgStore,
    pocketStore,
    pokedexService: new PokedexService(pokemonStore, { publicBaseUrl }),
    ptcgService: new PtcgService(ptcgStore, { publicBaseUrl, pokemonStore }),
    pocketService: new PocketService(pocketStore, { publicBaseUrl, dataDir }),
    modelService: new PokemonModel3dService({ dataDir, publicBaseUrl: '__OSS_BASE__' })
  };
}

function buildOssSnapshot(options = {}) {
  const context = createContext(options);
  const outputDir = path.resolve(options.outputDir || path.join(__dirname, '..', 'dist', 'oss'));
  const sourceFiles = ['pokedex-cache.json', 'ptcg-cache.json', 'pocket-cache.json']
    .map((name) => path.join(context.dataDir, name));
  sourceFiles.forEach((filePath) => {
    if (!fs.existsSync(filePath)) throw new Error(`Missing cache file: ${filePath}`);
  });
  const fingerprint = dataFingerprint(sourceFiles);
  const version = options.version || `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')}-${fingerprint}`;
  const releaseDir = path.join(outputDir, 'releases', version);
  fs.rmSync(releaseDir, { recursive: true, force: true });
  ensureDir(releaseDir);

  const pokemon = collectPokemon(context);
  const ptcg = collectPtcg(context);
  const pocket = collectPocket(context);
  const datasets = {
    pokemon: writeDataset(releaseDir, 'pokemon', pokemon, { listChunkSize: 500 }),
    ptcg: writeDataset(releaseDir, 'ptcg', ptcg, { listChunkSize: 500 }),
    pocket: writeDataset(releaseDir, 'pocket', pocket, { listChunkSize: 500 })
  };

  const ptcgMeta = context.ptcgService.getMeta();
  if (ptcgMeta.item && Array.isArray(ptcgMeta.item.sets)) {
    const setMap = new Map(context.ptcgStore.getSets().map((item) => [String(item.id), item]));
    ptcgMeta.item.sets = ptcgMeta.item.sets.map((item) => {
      const next = remoteSetImages(item, setMap.get(String(item.id)));
      next.symbol = mirroredAsset(context.dataDir, `ptcg/sets/${encodeURIComponent(item.id)}/symbol.png`) || next.symbol;
      next.logo = mirroredAsset(context.dataDir, `ptcg/sets/${encodeURIComponent(item.id)}/logo.png`) || next.logo;
      return next;
    });
  }
  const pocketCollections = {};
  Object.keys(context.pocketStore.load().collections || {}).forEach((name) => {
    pocketCollections[name] = remoteDeckImages(context.pocketStore.getCollection(name));
  });
  const staticData = {
    types: context.pokedexService.getTypes(),
    typeRelations: Object.fromEntries(context.pokedexService.getTypes().items.map((type) => [
      type.id,
      context.pokedexService.getTypeRelations(type.id)
    ])),
    pokemonStatus: context.pokedexService.getSyncStatus(),
    ptcgMeta,
    ptcgStatus: context.ptcgService.getSyncStatus(),
    pocketMeta: context.pocketService.getMeta(),
    pocketExpansions: context.pocketService.listExpansions({ page: 1, pageSize: 100 }),
    pocketPacks: Object.assign({}, context.pocketService.listPacks({ page: 1, pageSize: 100 }), {
      items: context.pocketService.listPacks({ page: 1, pageSize: 100 }).items.map((item) => {
        const next = remotePocketImage(item);
        next.image = mirroredAsset(context.dataDir, `pocket/packs/${encodeURIComponent(item.id)}.png`) || next.image;
        return next;
      })
    }),
    pocketRarities: context.pocketService.getRarities(),
    pocketPullRates: context.pocketService.getPullRates(),
    pocketEvents: context.pocketService.listEvents({ page: 1, pageSize: 100 }),
    pocketCollections
  };
  Object.entries(staticData).forEach(([name, value]) => writeJson(path.join(releaseDir, 'meta', `${name}.json`), value));

  const hotDecks = remoteDeckImages(readJson(path.join(context.dataDir, 'hot-decks-cache.json'), { items: [] }));
  const hotDeckDetails = remoteDeckImages(readJson(path.join(context.dataDir, 'hot-deck-details-cache.json'), { items: {} }));
  const pocketDeckDetails = remoteDeckImages(readJson(path.join(context.dataDir, 'pocket-deck-details.json'), { items: {} }));
  writeJson(path.join(releaseDir, 'decks', 'ptcg.json'), hotDecks);
  writeJson(path.join(releaseDir, 'decks', 'ptcg-details.json'), hotDeckDetails);
  writeJson(path.join(releaseDir, 'decks', 'pocket-details.json'), pocketDeckDetails);

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    version,
    generatedAt: new Date().toISOString(),
    releaseBase: `releases/${version}`,
    sourceFingerprint: fingerprint,
    datasets,
    files: {
      types: 'meta/types.json',
      typeRelations: 'meta/typeRelations.json',
      pokemonStatus: 'meta/pokemonStatus.json',
      ptcgMeta: 'meta/ptcgMeta.json',
      ptcgStatus: 'meta/ptcgStatus.json',
      pocketMeta: 'meta/pocketMeta.json',
      pocketExpansions: 'meta/pocketExpansions.json',
      pocketPacks: 'meta/pocketPacks.json',
      pocketRarities: 'meta/pocketRarities.json',
      pocketPullRates: 'meta/pocketPullRates.json',
      pocketEvents: 'meta/pocketEvents.json',
      pocketCollections: 'meta/pocketCollections.json',
      ptcgDecks: 'decks/ptcg.json',
      ptcgDeckDetails: 'decks/ptcg-details.json',
      pocketDeckDetails: 'decks/pocket-details.json'
    },
    assets: {
      pokemon3d: 'assets/pokemon/3d',
      note: 'Image records prefer upstream URLs. ProjectPokemon GIF files are published separately.'
    }
  };
  writeJson(path.join(releaseDir, 'manifest.json'), manifest);
  writeJson(path.join(outputDir, 'manifest.json'), manifest);
  return { outputDir, releaseDir, manifest };
}

module.exports = {
  buildOssSnapshot,
  hashBucket
};
