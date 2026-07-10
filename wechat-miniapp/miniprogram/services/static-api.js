const config = require('../config');

const responseCache = {};
const datasetCache = {};
let manifestPromise = null;

const POKEDEX_GROUPS = {
  national: ['national'],
  kanto: ['kanto', 'letsgo-kanto'],
  johto: ['original-johto', 'updated-johto'],
  hoenn: ['hoenn', 'updated-hoenn'],
  sinnoh: ['original-sinnoh', 'extended-sinnoh'],
  unova: ['original-unova', 'updated-unova'],
  kalos: ['kalos-central', 'kalos-coastal', 'kalos-mountain'],
  alola: ['original-alola', 'original-melemele', 'original-akala', 'original-ulaula', 'original-poni', 'updated-alola'],
  galar: ['galar', 'isle-of-armor', 'crown-tundra'],
  hisui: ['hisui'],
  paldea: ['paldea']
};

function baseUrl() {
  return String(config.staticBaseUrl || '').replace(/\/+$/, '');
}

function absoluteUrl(relativePath) {
  return `${baseUrl()}/${String(relativePath || '').replace(/^\/+/, '')}`;
}

function resolveAssets(value) {
  if (Array.isArray(value)) return value.map(resolveAssets);
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((result, key) => {
      result[key] = resolveAssets(value[key]);
      return result;
    }, {});
  }
  if (typeof value !== 'string') return value;
  if (value.indexOf('__OSS_BASE__') === 0) return `${baseUrl()}${value.slice('__OSS_BASE__'.length)}`;
  if (value.indexOf('/assets/') === 0) return `${baseUrl()}${value}`;
  return value;
}

function requestJson(relativePath, options) {
  const url = absoluteUrl(relativePath);
  const useCache = !options || options.cache !== false;
  if (useCache && responseCache[url]) return responseCache[url];
  const promise = new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.request) {
      reject(new Error('wx.request is unavailable'));
      return;
    }
    wx.request({
      url,
      method: 'GET',
      timeout: config.requestTimeoutMs || 15000,
      header: options && options.fresh ? { 'Cache-Control': 'no-cache' } : {},
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.data) {
          resolve(resolveAssets(response.data));
          return;
        }
        reject(new Error(`OSS request failed: ${response.statusCode}`));
      },
      fail: reject
    });
  });
  if (useCache) responseCache[url] = promise.catch((error) => {
    delete responseCache[url];
    throw error;
  });
  return promise;
}

function getManifest() {
  if (!manifestPromise) {
    manifestPromise = requestJson(`manifest.json?v=${Date.now()}`, { cache: false, fresh: true })
      .then((manifest) => {
        if (Number(manifest.schemaVersion) !== 1) throw new Error('Unsupported OSS schema');
        return manifest;
      }).catch((error) => {
        manifestPromise = null;
        throw error;
      });
  }
  return manifestPromise;
}

function releasePath(manifest, relativePath) {
  return `${manifest.releaseBase}/${relativePath}`;
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function hashBucket(value, bucketCount) {
  const input = unescape(encodeURIComponent(String(value)));
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash % bucketCount;
}

function getListChunk(manifest, name, index) {
  const dataset = manifest.datasets[name];
  const path = dataset.listPath.replace('{chunk}', pad(index, 4));
  return requestJson(releasePath(manifest, path)).then((result) => result.items || []);
}

function getAllRows(manifest, name) {
  const key = `${manifest.version}:${name}`;
  if (!datasetCache[key]) {
    const count = manifest.datasets[name].listChunks;
    datasetCache[key] = Promise.all(Array.from({ length: count }, (unused, index) =>
      getListChunk(manifest, name, index))).then((chunks) => [].concat(...chunks));
  }
  return datasetCache[key];
}

function getDefaultPage(manifest, name, page, pageSize) {
  const dataset = manifest.datasets[name];
  const start = (page - 1) * pageSize;
  const end = Math.min(dataset.count, start + pageSize);
  if (start >= dataset.count) return Promise.resolve([]);
  const firstChunk = Math.floor(start / dataset.listChunkSize);
  const lastChunk = Math.floor((end - 1) / dataset.listChunkSize);
  const requests = [];
  for (let index = firstChunk; index <= lastChunk; index += 1) requests.push(getListChunk(manifest, name, index));
  return Promise.all(requests).then((chunks) => {
    const offset = start - firstChunk * dataset.listChunkSize;
    return [].concat(...chunks).slice(offset, offset + pageSize);
  });
}

function paginated(items, options, source) {
  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.max(1, Number(options.pageSize || options.limit || 30));
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    hasMore: offset + pageSize < items.length,
    source: source || 'oss-static'
  };
}

function defaultPage(manifest, name, options) {
  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.max(1, Number(options.pageSize || options.limit || 30));
  return getDefaultPage(manifest, name, page, pageSize).then((items) => ({
    items,
    total: manifest.datasets[name].count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(manifest.datasets[name].count / pageSize)),
    hasMore: page * pageSize < manifest.datasets[name].count,
    source: 'oss-static'
  }));
}

function getDetail(manifest, name, id) {
  const dataset = manifest.datasets[name];
  const bucket = hashBucket(id, dataset.detailBuckets);
  const path = dataset.detailPath.replace('{bucket}', pad(bucket, 3));
  return requestJson(releasePath(manifest, path)).then((items) => ({
    item: items[String(id)] || null,
    source: 'oss-static'
  }));
}

function listPokemon(manifest, options) {
  const filters = options || {};
  const keyword = String(filters.keyword || '').trim().toLowerCase();
  const types = String(filters.type || filters.types || '').split(',').map((item) => item.trim()).filter(Boolean);
  const generation = Number(filters.generation || 0);
  const pokedex = String(filters.pokedex || filters.region || 'national');
  const sort = String(filters.sort || 'id');
  const isDefault = !keyword && !types.length && !generation && pokedex === 'national' && sort === 'id';
  const requestedPagination = filters.page !== undefined || filters.pageSize !== undefined || filters.limit !== undefined;
  if (isDefault && !requestedPagination) {
    return getAllRows(manifest, 'pokemon').then((items) => ({
      items,
      total: items.length,
      page: 1,
      pageSize: items.length,
      totalPages: 1,
      hasMore: false,
      source: 'oss-static'
    }));
  }
  if (isDefault) return defaultPage(manifest, 'pokemon', filters);
  return getAllRows(manifest, 'pokemon').then((rows) => {
    const keys = POKEDEX_GROUPS[pokedex] || [pokedex];
    const items = rows.filter((item) => {
      if (keyword && ![item.id, item.name_en, item.name_zh, item.name_ja].join(' ').toLowerCase().includes(keyword)) return false;
      if (types.length && !types.every((type) => (item.types || []).includes(type))) return false;
      if (generation && Number(item.generation) !== generation) return false;
      if (pokedex !== 'national' && !keys.some((key) => (item.regional_dex_keys || []).includes(key))) return false;
      return true;
    });
    if (sort === 'name') items.sort((a, b) => String(a.name_zh || a.name_en).localeCompare(String(b.name_zh || b.name_en), 'zh'));
    if (sort === 'power') items.sort((a, b) => Number(b.stat_total || 0) - Number(a.stat_total || 0));
    return paginated(items, filters);
  });
}

function listCards(manifest, options) {
  const filters = options || {};
  const keyword = String(filters.keyword || filters.q || '').trim().toLowerCase();
  const type = String(filters.type || '').trim();
  const setId = String(filters.setId || '').trim().toLowerCase();
  const supertype = String(filters.supertype || '').trim().toLowerCase();
  const rarity = String(filters.rarity || '').trim().toLowerCase();
  const pokemonId = Number(filters.pokemonId || 0);
  const sort = String(filters.sort || 'releaseDate');
  const isDefault = !keyword && !type && !setId && !supertype && !rarity && !pokemonId && sort === 'releaseDate';
  if (isDefault) return defaultPage(manifest, 'ptcg', filters);
  return getAllRows(manifest, 'ptcg').then((rows) => {
    const items = rows.filter((item) => {
      if (keyword && ![item.id, item.name, item.name_zh, item.display_name, item.set_name, item.set_series, item.number, item.artist]
        .concat(item.type_names || [], item.subtype_names || []).join(' ').toLowerCase().includes(keyword)) return false;
      if (type && !(item.types || []).includes(type)) return false;
      if (setId && String(item.set_id || '').toLowerCase() !== setId) return false;
      if (supertype && String(item.supertype || '').toLowerCase() !== supertype) return false;
      if (rarity && String(item.rarity || '').toLowerCase() !== rarity) return false;
      if (pokemonId && !(item.national_pokedex_numbers || []).map(Number).includes(pokemonId)) return false;
      return true;
    });
    if (sort === 'releaseDateAsc') items.reverse();
    if (sort === 'name') items.sort((a, b) => String(a.display_name || a.name).localeCompare(String(b.display_name || b.name), 'zh'));
    if (sort === 'number') items.sort((a, b) => String(a.set_id).localeCompare(String(b.set_id)) || Number(a.number || 0) - Number(b.number || 0));
    if (sort === 'rarity') items.sort((a, b) => String(a.rarity_name || a.rarity).localeCompare(String(b.rarity_name || b.rarity), 'zh'));
    return paginated(items, filters);
  });
}

function listPocketCards(manifest, options) {
  const filters = options || {};
  const keyword = String(filters.keyword || filters.q || '').trim().toLowerCase();
  const expansion = String(filters.expansion || '').trim().toUpperCase();
  const rarity = String(filters.rarity || '').trim().toUpperCase();
  const type = String(filters.type || '').trim().toLowerCase();
  const pokemonId = Number(filters.pokemonId || 0);
  const sort = String(filters.sort || 'number');
  const isDefault = !keyword && !expansion && !rarity && !type && !pokemonId && sort === 'number';
  if (isDefault) return defaultPage(manifest, 'pocket', filters);
  return getAllRows(manifest, 'pocket').then((rows) => {
    const items = rows.filter((item) => {
      const collections = item.collections || [];
      if (keyword && ![item.id, item.name_zh, item.name_en, item.artist, item.pack_name_en]
        .concat(collections.map((entry) => `${entry.expansion_id} ${entry.expansion_name_zh} ${entry.number}`))
        .join(' ').toLowerCase().includes(keyword)) return false;
      if (expansion && !collections.some((entry) => String(entry.expansion_id).toUpperCase() === expansion)) return false;
      if (rarity && String(item.rarity || '').toUpperCase() !== rarity) return false;
      if (type && String(item.card_type || '').toLowerCase() !== type) return false;
      if (pokemonId && Number(item.national_pokedex_number || 0) !== pokemonId) return false;
      return true;
    });
    if (sort === 'name') items.sort((a, b) => String(a.name_zh || a.name_en).localeCompare(String(b.name_zh || b.name_en), 'zh'));
    if (sort === 'rarity') items.sort((a, b) => String(a.rarity || '').localeCompare(String(b.rarity || '')));
    return paginated(items, filters);
  });
}

function getFile(manifest, name) {
  return requestJson(releasePath(manifest, manifest.files[name]));
}

function seededRandom(seed) {
  let state = 2166136261;
  const input = String(seed);
  for (let index = 0; index < input.length; index += 1) {
    state ^= input.charCodeAt(index);
    state = Math.imul(state, 16777619) >>> 0;
  }
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function dailyKey() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function dailyQuiz(manifest, name, seed) {
  const dataset = manifest.datasets[name];
  const quizKey = seed || dailyKey();
  const random = seededRandom(`${name}-${quizKey}`);
  const indices = [];
  while (indices.length < 4 && indices.length < dataset.count) {
    const index = Math.floor(random() * dataset.count);
    if (!indices.includes(index)) indices.push(index);
  }
  const byChunk = {};
  indices.forEach((index) => {
    const chunkIndex = Math.floor(index / dataset.listChunkSize);
    if (!byChunk[chunkIndex]) byChunk[chunkIndex] = [];
    byChunk[chunkIndex].push(index);
  });
  return Promise.all(Object.keys(byChunk).map((chunkIndex) =>
    getListChunk(manifest, name, Number(chunkIndex)).then((rows) => ({ chunkIndex: Number(chunkIndex), rows }))
  )).then((chunks) => {
    const lookup = {};
    chunks.forEach((entry) => {
      byChunk[entry.chunkIndex].forEach((absoluteIndex) => {
        lookup[absoluteIndex] = entry.rows[absoluteIndex - entry.chunkIndex * dataset.listChunkSize];
      });
    });
    const items = indices.map((index) => lookup[index]).filter(Boolean);
    const random = seededRandom(`${name}-${quizKey}`);
    const answer = items[0];
    const choices = items.slice();
    choices.sort(() => random() - 0.5);
    if (name === 'pokemon') {
      return { item: {
        quizId: `pokemon-random-${quizKey}-${answer.id}`,
        answerId: answer.id,
        silhouette: answer.image,
        hints: [`属性：${(answer.typeNames || answer.types || []).join(' / ')}`, `世代：第 ${answer.generation || 1} 世代`, `种族值总和：${answer.stat_total || '-'}`, `分类：${answer.category || '未知'}`],
        options: choices.map((item) => ({ id: item.id, name_zh: item.name_zh, name_en: item.name_en }))
      }, source: 'oss-static' };
    }
    return { item: {
      quizId: `card-daily-${dailyKey()}-${answer.id}`,
      answerId: answer.id,
      image: answer.image,
      hints: [`Set: ${answer.set_name}`, `Type: ${(answer.type_names || []).join(' / ')}`, `Rarity: ${answer.rarity_name || answer.rarity}`, `No: ${answer.set_id} #${answer.number}`],
      options: choices.map((item) => ({ id: item.id, name: item.name, name_zh: item.name_zh, display_name: item.display_name, number: item.number }))
    }, source: 'oss-static' };
  });
}

function answer(payload) {
  const correct = String(payload.selectedId) === String(payload.answerId);
  return Promise.resolve({ item: { correct, message: correct ? '\u56de\u7b54\u6b63\u786e' : '\u518d\u8bd5\u4e00\u6b21' }, source: 'oss-static' });
}

function randomItem(items) {
  return items.length ? items[Math.floor(Math.random() * items.length)] : null;
}

function weightedKey(weights) {
  const entries = Object.entries(weights || {}).filter((entry) => Number(entry[1]) > 0);
  let target = Math.random() * entries.reduce((sum, entry) => sum + Number(entry[1]), 0);
  for (const entry of entries) {
    target -= Number(entry[1]);
    if (target <= 0) return entry[0];
  }
  return entries.length ? entries[entries.length - 1][0] : '';
}

function openCardPack(manifest, payload) {
  return getAllRows(manifest, 'ptcg').then((rows) => {
    const candidates = rows.filter((item) => !payload.setId || String(item.set_id) === String(payload.setId));
    const count = Math.max(1, Number(payload.count || 10));
    const cards = Array.from({ length: count }, (unused, index) => Object.assign({ slot: index + 1 }, randomItem(candidates))).filter(Boolean);
    return { item: { id: `oss-pack-${Date.now()}`, count: cards.length, cards }, source: 'oss-static' };
  });
}

function openPocketPack(manifest, payload) {
  return Promise.all([getAllRows(manifest, 'pocket'), getFile(manifest, 'pocketPacks'), getFile(manifest, 'pocketPullRates'), getFile(manifest, 'pocketRarities')])
    .then(([cards, packResult, ratesResult, rarityResult]) => {
      const packs = packResult.items || [];
      const pack = packs.find((item) => String(item.id) === String(payload.packId || payload.id || '')) || packs.find((item) => item.is_regular) || packs[0];
      if (!pack) return { item: null, source: 'oss-static' };
      const allowed = new Set(pack.card_ids || []);
      const candidates = cards.filter((card) => allowed.size ? allowed.has(card.id) : (card.collections || []).some((item) => item.expansion_id === pack.expansion_id));
      if (pack.is_promo) {
        const card = randomItem(candidates);
        return { item: { id: `oss-pocket-${Date.now()}`, pack, pack_type: '\u7279\u5178\u5305', is_promo: true, is_rare_pack: false, cards: card ? [Object.assign({ slot: 1 }, card)] : [], count: card ? 1 : 0 }, source: 'oss-static' };
      }
      const allRates = ratesResult.item || {};
      const expansionRates = allRates[pack.expansion_id] || {};
      const packWeights = Object.keys(expansionRates).reduce((result, name) => {
        result[name] = expansionRates[name].appearance_rate || 0;
        return result;
      }, {});
      const packType = weightedKey(packWeights) || 'Regular Pack';
      const rate = expansionRates[packType] || {};
      const count = Number(rate.cards || 5);
      const rarities = rarityResult.item || {};
      const pulled = Array.from({ length: count }, (unused, index) => {
        const rarity = weightedKey((rate.slots || {})[String(index + 1)] || {});
        const pool = rarity ? candidates.filter((card) => card.rarity === rarity) : candidates;
        const card = randomItem(pool.length ? pool : candidates);
        return card ? Object.assign({ slot: index + 1, rarity_meta: rarities[card.rarity] || null }, card) : null;
      }).filter(Boolean);
      return { item: { id: `oss-pocket-${Date.now()}`, pack, pack_type: packType, is_rare_pack: /rare/i.test(packType), cards: pulled, count: pulled.length }, source: 'oss-static' };
    });
}

function analyzeTeam(manifest, payload) {
  return Promise.all([getAllRows(manifest, 'pokemon'), getFile(manifest, 'typeRelations'), getFile(manifest, 'types')]).then(([rows, relations, typeResult]) => {
    const members = (payload.ids || []).map((id) => rows.find((item) => Number(item.id) === Number(id))).filter(Boolean);
    const weaknesses = [];
    const resistances = [];
    const immunities = [];
    const names = (typeResult.items || []).reduce((result, item) => {
      result[item.id] = item.name;
      return result;
    }, {});
    const typeCounts = {};
    const relationIds = (values) => (values || []).map((entry) => typeof entry === 'string' ? entry : entry.id);
    members.forEach((member) => (member.types || []).forEach((type) => { typeCounts[type] = (typeCounts[type] || 0) + 1; }));
    Object.keys(relations).forEach((type) => {
      let count = 0;
      let resistCount = 0;
      let immuneCount = 0;
      members.forEach((member) => {
        const multiplier = (member.types || []).reduce((value, defender) => {
          const relation = (relations[defender] || {}).item || {};
          if (relationIds(relation.immuneTo).includes(type)) return 0;
          if (relationIds(relation.weakTo).includes(type)) return value * 2;
          if (relationIds(relation.resists).includes(type)) return value * 0.5;
          return value;
        }, 1);
        if (multiplier >= 2) count += 1;
        if (multiplier > 0 && multiplier < 1) resistCount += 1;
        if (multiplier === 0) immuneCount += 1;
      });
      if (count) weaknesses.push({ id: type, name: names[type] || type, count });
      if (resistCount) resistances.push({ id: type, name: names[type] || type, count: resistCount });
      if (immuneCount) immunities.push({ id: type, name: names[type] || type, count: immuneCount });
    });
    weaknesses.sort((a, b) => b.count - a.count);
    resistances.sort((a, b) => b.count - a.count);
    immunities.sort((a, b) => b.count - a.count);
    const primaryTypes = Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]).slice(0, 3).map((type) => names[type] || type);
    const leadingWeaknesses = weaknesses.slice(0, 3).map((item) => item.name).join('、');
    const summary = members.length
      ? `当前队伍以${primaryTypes.join('、') || '混合'}属性为主，主要风险来自${leadingWeaknesses || '暂无明显共同弱点'}。`
      : '先选择 1 到 6 只宝可梦，再查看队伍属性分析。';
    return { item: { members, score: Math.max(40, Math.min(95, 82 - weaknesses.length * 3 + resistances.length * 2 + immunities.length * 2)), primaryTypes, weaknesses: weaknesses.slice(0, 6), resistances: resistances.slice(0, 6), immunities: immunities.slice(0, 6), summary }, source: 'oss-static' };
  });
}

function listMetaCollection(manifest, fileName, options, nestedName) {
  return getFile(manifest, fileName).then((result) => {
    const items = nestedName ? (result[nestedName] || []) : (result.items || []);
    return paginated(items, options || {});
  });
}

function callWithManifest(manifest, action, data) {
  const payload = data || {};
  if (action === 'listPokemon') return listPokemon(manifest, payload);
  if (action === 'getPokemon') return getDetail(manifest, 'pokemon', payload.id);
  if (action === 'listCards') return listCards(manifest, payload);
  if (action === 'getCard') return getDetail(manifest, 'ptcg', payload.id);
  if (action === 'getPokemonCards') return listCards(manifest, Object.assign({}, payload, { pokemonId: payload.id }));
  if (action === 'listPocketCards') return listPocketCards(manifest, payload);
  if (action === 'getPocketCard') return getDetail(manifest, 'pocket', payload.id);
  if (action === 'getTypes') return getFile(manifest, 'types');
  if (action === 'getTypeRelations') return getFile(manifest, 'typeRelations').then((items) => items[payload.type] || { item: null, source: 'oss-static' });
  if (action === 'getEvolutionChain') return getAllRows(manifest, 'pokemon').then((items) => ({ items: items.filter((item) => (payload.ids || []).map(Number).includes(Number(item.id))), source: 'oss-static' }));
  if (action === 'getDailyQuiz') return dailyQuiz(manifest, 'pokemon', payload.seed);
  if (action === 'submitDailyQuiz' || action === 'submitDailyCardQuiz') return answer(payload);
  if (action === 'getDailyCardQuiz') return dailyQuiz(manifest, 'ptcg');
  if (action === 'analyzeTeam') return analyzeTeam(manifest, payload);
  if (action === 'getSyncStatus') return getFile(manifest, 'pokemonStatus').then((result) => Object.assign({}, result, { item: Object.assign({}, result.item, { mode: 'oss-static', label: 'OSS static snapshot', cacheReady: true }), source: 'oss-static' }));
  if (action === 'getPtcgMeta') return getFile(manifest, 'ptcgMeta');
  if (action === 'getPtcgSyncStatus') return getFile(manifest, 'ptcgStatus').then((result) => Object.assign({}, result, { item: Object.assign({}, result.item, { mode: 'oss-static', label: 'OSS static snapshot', cacheReady: true }), source: 'oss-static' }));
  if (action === 'getPocketMeta') return getFile(manifest, 'pocketMeta');
  if (action === 'listPocketExpansions') return listMetaCollection(manifest, 'pocketExpansions', payload);
  if (action === 'listPocketPacks') return getFile(manifest, 'pocketPacks').then((result) => paginated((result.items || []).filter((item) => !payload.expansion || String(item.expansion_id).toUpperCase() === String(payload.expansion).toUpperCase()), payload));
  if (action === 'getPocketRarities') return getFile(manifest, 'pocketRarities');
  if (action === 'getPocketPullRates') return getFile(manifest, 'pocketPullRates').then((result) => {
    if (!payload.expansion) return result;
    return { item: (result.item || {})[payload.expansion] || null, expansion: payload.expansion, source: 'oss-static' };
  });
  if (action === 'listPocketEvents') return listMetaCollection(manifest, 'pocketEvents', payload);
  if (action === 'listPocketMissions') return listMetaCollection(manifest, 'pocketCollections', payload, 'missions');
  if (action === 'listPocketBattles') return listMetaCollection(manifest, 'pocketCollections', payload, 'battles');
  if (action === 'listPocketShops') return listMetaCollection(manifest, 'pocketCollections', payload, 'shops');
  if (action === 'listPocketWonderPicks') return listMetaCollection(manifest, 'pocketCollections', payload, 'wonder_picks');
  if (action === 'listPocketHotDecks') return listMetaCollection(manifest, 'pocketCollections', payload, 'hot_decks');
  if (action === 'openCardPack') return openCardPack(manifest, payload);
  if (action === 'openPocketPack') return openPocketPack(manifest, payload);
  if (action === 'getHotDecks') return getFile(manifest, 'ptcgDecks').then((result) => Object.assign({}, result, { items: (result.items || []).slice(0, Number(payload.limit || 8)), source: 'oss-static' }));
  if (action === 'getHotDeckDetail') return getFile(manifest, 'ptcgDeckDetails').then((result) => result.items[payload.url] || { item: null, source: 'oss-static' });
  if (action === 'getPocketHotDeck') return getFile(manifest, 'pocketDeckDetails').then((result) => result.items[payload.id] || { item: null, source: 'oss-static' });
  if (action === 'getSyncRuns' || action === 'getPtcgSyncRuns') return Promise.resolve({ items: [], total: 0, source: 'oss-static' });
  if (action === 'validateCache') return Promise.resolve({ ok: true, checks: { remoteReady: true, actualCount: manifest.datasets.pokemon.count, countOk: manifest.datasets.pokemon.count >= Number(payload.expectedCount || 1025) }, status: { mode: 'oss-static', cacheReady: true }, source: 'oss-static' });
  return Promise.reject(new Error(`Unsupported OSS action: ${action}`));
}

function call(action, data) {
  if (!config.useStaticApi || !config.staticBaseUrl) return Promise.reject(new Error('OSS static API is disabled'));
  return getManifest().then((manifest) => callWithManifest(manifest, action, data));
}

module.exports = {
  call,
  hashBucket
};
