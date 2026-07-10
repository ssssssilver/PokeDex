const config = require('../config');
const local = require('../utils/pokemon');
const ptcgSample = require('../data/ptcg-sample');

function hasWx() {
  return typeof wx !== 'undefined';
}

function withLocalEvolution(pokemon) {
  if (!pokemon) return null;
  return Object.assign({}, pokemon, {
    evolution: local.getEvolutionChain(pokemon.evolution_chain)
  });
}

function localSyncStatus() {
  const snapshot = local.SNAPSHOT_META || {};
  const usingGenerated = Boolean(snapshot.usingGenerated);
  const mode = usingGenerated ? 'local-snapshot' : 'local-seed';
  const label = usingGenerated ? '本地 PokeAPI 快照' : '本地种子数据';

  return {
    item: {
      mode: config.useRemoteApi ? 'remote-fallback' : (config.useCloudApi ? 'cloud-fallback' : mode),
      label: (config.useRemoteApi || config.useCloudApi) ? `${label}（兜底）` : label,
      healthLabel: '本地',
      healthTone: 'local',
      cacheReady: false,
      total: local.POKEMON.length,
      syncedCount: 0,
      imageCachedCount: 0,
      imageUploadedCount: 0,
      imageReusedCount: 0,
      imageCacheFailedCount: 0,
      failedCount: 0,
      missingImageCount: 0,
      missingCachedImageCount: 0,
      lastRunSyncedCount: 0,
      lastRunImageCachedCount: 0,
      lastRunImageUploadedCount: 0,
      lastRunImageReusedCount: 0,
      lastRunImageCacheFailedCount: 0,
      lastRunFailedCount: 0,
      cacheImages: false,
      strictImageCache: false,
      maxSyncAgeHours: 30,
      syncAgeHours: null,
      syncAgeText: '-',
      syncFresh: false,
      syncStale: Boolean(config.useRemoteApi || config.useCloudApi),
      syncedAtText: snapshot.generatedAt || '尚未同步',
      cloudEnv: config.cloudEnv || '未配置',
      apiBaseUrl: config.apiBaseUrl || '未配置'
    },
    source: 'local'
  };
}

function localValidateCache(options) {
  const payload = Object.assign({
    expectedCount: 1025,
    sampleIds: [1, 4, 7, 25, 1025],
    maxSyncAgeHours: 30
  }, options || {});
  const total = local.POKEMON.length;
  const status = localSyncStatus().item;

  return {
    ok: false,
    checks: {
      cloudReady: false,
      remoteReady: false,
      expectedCount: payload.expectedCount,
      maxSyncAgeHours: payload.maxSyncAgeHours,
      actualCount: total,
      countOk: total >= payload.expectedCount,
      missingSummaryIds: [],
      missingDetailIds: [],
      invalidEvolutionIds: [],
      missingImageIds: [],
      missingCachedImageIds: [],
      syncFailedCount: 0,
      syncFresh: false,
      syncStale: Boolean(config.useRemoteApi || config.useCloudApi),
      syncAgeHours: null,
      imageCacheFailedCount: 0,
      sampleDetails: []
    },
    status,
    repair: {
      needed: true,
      ids: [],
      dataIds: [],
      imageIds: [],
      payloads: [],
      note: config.useRemoteApi
        ? 'Remote API validation is unavailable. Check apiBaseUrl and the self-hosted server.'
        : 'Local mode does not generate repair payloads.'
    },
    source: 'local'
  };
}

function buildQuery(params) {
  return Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function remoteRoute(action, data) {
  const payload = data || {};
  if (action === 'listPokemon') {
    return { method: 'GET', path: `/api/pokemon?${buildQuery(payload)}` };
  }
  if (action === 'getPokemon') {
    return { method: 'GET', path: `/api/pokemon/${encodeURIComponent(payload.id)}` };
  }
  if (action === 'getTypes') {
    return { method: 'GET', path: '/api/types' };
  }
  if (action === 'getTypeRelations') {
    return { method: 'GET', path: `/api/types/${encodeURIComponent(payload.type || 'fire')}/relations` };
  }
  if (action === 'getEvolutionChain') {
    return { method: 'GET', path: `/api/evolution?${buildQuery({ ids: (payload.ids || []).join(',') })}` };
  }
  if (action === 'getDailyQuiz') {
    return { method: 'GET', path: '/api/quiz/daily' };
  }
  if (action === 'submitDailyQuiz') {
    return { method: 'POST', path: '/api/quiz/daily/answer', data: payload };
  }
  if (action === 'analyzeTeam') {
    return { method: 'POST', path: '/api/team/analyze', data: payload };
  }
  if (action === 'getSyncStatus') {
    return { method: 'GET', path: `/api/sync/status?${buildQuery(payload)}` };
  }
  if (action === 'getSyncRuns') {
    return { method: 'GET', path: `/api/sync/runs?${buildQuery(payload)}` };
  }
  if (action === 'validateCache') {
    return { method: 'POST', path: '/api/cache/validate', data: payload };
  }
  if (action === 'listCards') {
    return { method: 'GET', path: `/api/cards?${buildQuery(payload)}` };
  }
  if (action === 'getCard') {
    return { method: 'GET', path: `/api/cards/${encodeURIComponent(payload.id)}` };
  }
  if (action === 'getPokemonCards') {
    return { method: 'GET', path: `/api/pokemon/${encodeURIComponent(payload.id)}/cards?${buildQuery(payload)}` };
  }
  if (action === 'getPtcgMeta') {
    return { method: 'GET', path: '/api/ptcg/meta' };
  }
  if (action === 'getPtcgSyncStatus') {
    return { method: 'GET', path: '/api/ptcg/sync-status' };
  }
  if (action === 'getPtcgSyncRuns') {
    return { method: 'GET', path: `/api/ptcg/sync-runs?${buildQuery(payload)}` };
  }
  if (action === 'getDailyCardQuiz') {
    return { method: 'GET', path: '/api/card-quiz/daily' };
  }
  if (action === 'submitDailyCardQuiz') {
    return { method: 'POST', path: '/api/card-quiz/daily/answer', data: payload };
  }
  if (action === 'openCardPack') {
    return { method: 'POST', path: '/api/card-pack/open', data: payload };
  }
  if (action === 'getHotDecks') {
    return { method: 'GET', path: `/api/decks/hot?${buildQuery(payload)}` };
  }
  return null;
}

function normalizeRemoteUrl(path) {
  const baseUrl = String(config.apiBaseUrl || '').replace(/\/+$/, '');
  if (!baseUrl) return '';
  if (!path || path === '?') return baseUrl;
  if (path.charAt(0) === '/') return `${baseUrl}${path}`;
  return `${baseUrl}/${path}`;
}

function remoteCall(action, data, fallback) {
  if (!config.useRemoteApi || !config.apiBaseUrl || !hasWx() || !wx.request) {
    return Promise.resolve(fallback());
  }

  const route = remoteRoute(action, data);
  if (!route) {
    return Promise.resolve(fallback());
  }

  return new Promise((resolve) => {
    wx.request({
      url: normalizeRemoteUrl(route.path),
      method: route.method,
      data: route.data || {},
      timeout: config.requestTimeoutMs || 10000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300 && response.data) {
          resolve(response.data);
          return;
        }
        resolve(fallback());
      },
      fail() {
        resolve(fallback());
      }
    });
  });
}

function cloudCall(action, data, fallback) {
  if (!config.useCloudApi || !hasWx() || !wx.cloud) {
    return Promise.resolve(fallback());
  }

  return wx.cloud.callFunction({
    name: 'pokedex',
    data: Object.assign({ action }, data || {})
  }).then((response) => {
    if (response && response.result) {
      return response.result;
    }
    return fallback();
  }).catch(() => fallback());
}

function apiCall(action, data, fallback) {
  if (config.useRemoteApi) {
    return remoteCall(action, data, fallback);
  }
  return cloudCall(action, data, fallback);
}

function listPokemon(filters) {
  return apiCall('listPokemon', filters, () => {
    const options = filters || {};
    const items = local.listPokemon(options);
    const shouldPaginate = options.page !== undefined || options.pageSize !== undefined || options.limit !== undefined;
    const page = Math.max(1, Number(options.page || 1));
    const pageSize = Math.max(1, Number(options.pageSize || options.limit || 40));
    const offset = (page - 1) * pageSize;
    const pageItems = shouldPaginate ? items.slice(offset, offset + pageSize) : items;
    return {
      items: pageItems,
      total: items.length,
      page: shouldPaginate ? page : 1,
      pageSize: shouldPaginate ? pageSize : items.length,
      totalPages: shouldPaginate ? Math.max(1, Math.ceil(items.length / pageSize)) : 1,
      hasMore: shouldPaginate ? offset + pageSize < items.length : false,
      source: 'local'
    };
  });
}

function getPokemonById(id) {
  return apiCall('getPokemon', { id }, () => ({
    item: withLocalEvolution(local.getPokemonById(id)),
    source: 'local'
  }));
}

function getTypes() {
  return apiCall('getTypes', {}, () => ({
    items: local.getAllTypes(),
    source: 'local'
  }));
}

function getTypeRelations(type) {
  return apiCall('getTypeRelations', { type }, () => ({
    item: local.getTypeRelations(type),
    source: 'local'
  }));
}

function getEvolutionChain(ids) {
  return apiCall('getEvolutionChain', { ids }, () => ({
    items: local.getEvolutionChain(ids),
    source: 'local'
  }));
}

function getDailyQuiz() {
  return apiCall('getDailyQuiz', {}, () => ({
    item: local.getDailyQuiz(),
    source: 'local'
  }));
}

function submitDailyQuiz(payload) {
  return apiCall('submitDailyQuiz', payload, () => ({
    item: local.submitDailyQuiz(payload),
    source: 'local'
  }));
}

function analyzeTeam(ids) {
  return apiCall('analyzeTeam', { ids }, () => ({
    item: local.analyzeTeam(ids),
    source: 'local'
  }));
}

function getSyncStatus() {
  return apiCall('getSyncStatus', {}, () => localSyncStatus());
}

function getSyncRuns(options) {
  return apiCall('getSyncRuns', Object.assign({ limit: 3 }, options || {}), () => ({
    items: [],
    total: 0,
    source: 'local'
  }));
}

function validateCache(options) {
  const payload = Object.assign({
    expectedCount: 1025,
    sampleIds: [1, 4, 7, 25, 1025],
    maxSyncAgeHours: 30
  }, options || {});
  return apiCall('validateCache', payload, () => localValidateCache(payload));
}

function cardSearchText(card) {
  return [
    card.id,
    card.name,
    card.name_zh,
    card.display_name,
    card.set_name,
    card.set_series,
    card.number,
    card.artist,
    ...(card.type_names || []),
    ...(card.subtype_names || [])
  ].join(' ').toLowerCase();
}

function listLocalCards(filters) {
  const options = filters || {};
  const keyword = String(options.keyword || options.q || '').trim().toLowerCase();
  const ids = String(options.ids || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const setId = String(options.setId || '').trim().toLowerCase();
  const supertype = String(options.supertype || '').trim().toLowerCase();
  const type = String(options.type || '').trim();
  const rarity = String(options.rarity || '').trim().toLowerCase();
  const pokemonId = Number(options.pokemonId || 0);
  const filtered = ptcgSample.CARDS.filter((card) => {
    if (ids.length && !ids.includes(String(card.id))) return false;
    if (keyword && !cardSearchText(card).includes(keyword)) return false;
    if (setId && String(card.set_id || '').toLowerCase() !== setId) return false;
    if (supertype && String(card.supertype || '').toLowerCase() !== supertype) return false;
    if (type && !(card.types || []).includes(type)) return false;
    if (rarity && String(card.rarity || '').toLowerCase() !== rarity) return false;
    if (pokemonId && !(card.national_pokedex_numbers || []).map(Number).includes(pokemonId)) return false;
    return true;
  });
  const sorted = filtered.slice().sort((a, b) => String(b.set_release_date || '').localeCompare(String(a.set_release_date || '')));
  const page = Math.max(1, Number(options.page || 1));
  const pageSize = Math.max(1, Number(options.pageSize || options.limit || 30));
  const offset = (page - 1) * pageSize;
  return {
    items: sorted.slice(offset, offset + pageSize),
    total: sorted.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
    hasMore: offset + pageSize < sorted.length,
    source: 'local-card-seed'
  };
}

function listCards(filters) {
  return apiCall('listCards', filters, () => listLocalCards(filters));
}

function getCardById(id) {
  return apiCall('getCard', { id }, () => ({
    item: ptcgSample.CARDS.find((card) => String(card.id) === String(id)) || null,
    source: 'local-card-seed'
  }));
}

function getPokemonCards(id, options) {
  return apiCall('getPokemonCards', Object.assign({ id }, options || {}), () => listLocalCards(Object.assign({}, options || {}, {
    pokemonId: id
  })));
}

function getPtcgMeta() {
  return apiCall('getPtcgMeta', {}, () => {
    const cards = ptcgSample.CARDS;
    return {
      item: {
        types: [
          { id: 'Grass', name: '草', color: '#2f9e44' },
          { id: 'Fire', name: '火', color: '#e85d3f' },
          { id: 'Water', name: '水', color: '#2f80ed' },
          { id: 'Lightning', name: '电', color: '#d99a00' },
          { id: 'Psychic', name: '超能力', color: '#db2777' },
          { id: 'Fighting', name: '斗', color: '#c2410c' },
          { id: 'Colorless', name: '无色', color: '#8a8f98' }
        ],
        supertypes: [
          { id: 'Pokémon', name: '宝可梦' },
          { id: 'Trainer', name: '训练家' },
          { id: 'Energy', name: '能量' }
        ],
        rarities: Array.from(new Set(cards.map((card) => card.rarity))).map((id) => ({
          id,
          name: (cards.find((card) => card.rarity === id) || {}).rarity_name || id
        })),
        sets: ptcgSample.SETS,
        series: Array.from(new Set(ptcgSample.SETS.map((set) => set.series))).map((id) => ({ id, name: id })),
        regulationMarks: []
      },
      source: 'local-card-seed'
    };
  });
}

function getPtcgSyncStatus() {
  return apiCall('getPtcgSyncStatus', {}, () => ({
    item: {
      mode: 'local-card-seed',
      label: '本地卡牌样例',
      healthLabel: '本地',
      healthTone: 'local',
      cacheReady: false,
      total: ptcgSample.CARDS.length,
      setTotal: ptcgSample.SETS.length,
      syncedCount: 0,
      setSyncedCount: 0,
      lastRunCardSyncedCount: 0,
      lastRunSetSyncedCount: 0,
      failedCount: 0,
      syncedAtText: '尚未同步'
    },
    source: 'local-card-seed'
  }));
}

function getPtcgSyncRuns(options) {
  return apiCall('getPtcgSyncRuns', Object.assign({ limit: 3 }, options || {}), () => ({
    items: [],
    total: 0,
    source: 'local-card-seed'
  }));
}

function getDailyCardQuiz() {
  return apiCall('getDailyCardQuiz', {}, () => {
    const cards = ptcgSample.CARDS;
    const answer = cards[Math.floor(Math.random() * cards.length)];
    const options = [answer];
    while (options.length < 4 && options.length < cards.length) {
      const candidate = cards[Math.floor(Math.random() * cards.length)];
      if (!options.find((card) => card.id === candidate.id)) {
        options.push(candidate);
      }
    }
    return {
      item: {
        quizId: `card-random-local-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        answerId: answer.id,
        image: answer.image,
        hints: [
          `系列：${answer.set_name}`,
          `属性：${(answer.type_names || []).join(' / ')}`,
          `稀有度：${answer.rarity_name || answer.rarity}`,
          `编号：${answer.set_id} #${answer.number}`
        ],
        options: options.sort(() => Math.random() - 0.5).map((card) => ({
          id: card.id,
          name: card.name,
          name_zh: card.name_zh,
          display_name: card.display_name,
          set_name: card.set_name,
          number: card.number,
          image: card.image
        }))
      },
      source: 'local-card-seed'
    };
  });
}

function submitDailyCardQuiz(payload) {
  return apiCall('submitDailyCardQuiz', payload, () => ({
    item: {
      correct: String(payload.selectedId) === String(payload.answerId),
      message: String(payload.selectedId) === String(payload.answerId)
        ? '猜对了，今天的卡牌灵感到手。'
        : '差一点，看看卡牌详情再熟悉一下。'
    },
    source: 'local-card-seed'
  }));
}

function openCardPack(payload) {
  return apiCall('openCardPack', payload || {}, () => {
    const cards = listLocalCards({ page: 1, pageSize: Number((payload && payload.count) || 10) }).items;
    return {
      item: {
        packId: `local-pack-${Date.now()}`,
        set: ptcgSample.SETS[0] || null,
        count: cards.length,
        cards: cards.map((card, index) => Object.assign({ slot: index + 1 }, card))
      },
      source: 'local-card-seed'
    };
  });
}

function getHotDecks(options) {
  return apiCall('getHotDecks', Object.assign({ limit: 6 }, options || {}), () => ({
    items: [
      { rank: 1, name: 'Dragapult ex', points: 2227, share: '49.22%', image: '', source: 'Limitless TCG' },
      { rank: 2, name: "N's Zoroark ex", points: 363, share: '8.02%', image: '', source: 'Limitless TCG' },
      { rank: 3, name: 'Crustle Mysterious Rock Inn', points: 278, share: '6.14%', image: '', source: 'Limitless TCG' }
    ].slice(0, Number((options && options.limit) || 6)),
    total: 3,
    source: 'local-hot-deck-seed',
    stale: true
  }));
}

module.exports = {
  listPokemon,
  getPokemonById,
  getEvolutionChain,
  getTypes,
  getTypeRelations,
  getDailyQuiz,
  submitDailyQuiz,
  analyzeTeam,
  getSyncStatus,
  getSyncRuns,
  validateCache,
  listCards,
  getCardById,
  getPokemonCards,
  getPtcgMeta,
  getPtcgSyncStatus,
  getPtcgSyncRuns,
  getDailyCardQuiz,
  submitDailyCardQuiz,
  openCardPack,
  getHotDecks
};
