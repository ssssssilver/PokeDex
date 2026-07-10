const config = require('../config');
const local = require('../utils/pokemon');
const ptcgSample = require('../data/ptcg-sample');
const pocketSample = require('../data/pocket-sample');
const staticApi = require('./static-api');

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
  if (action === 'getHotDeckDetail') {
    return { method: 'GET', path: `/api/decks/detail?${buildQuery(payload)}` };
  }
  if (action === 'listPocketCards') {
    return { method: 'GET', path: `/api/pocket/cards?${buildQuery(payload)}` };
  }
  if (action === 'getPocketCard') {
    return { method: 'GET', path: `/api/pocket/cards/${encodeURIComponent(payload.id)}` };
  }
  if (action === 'getPocketMeta') {
    return { method: 'GET', path: '/api/pocket/meta' };
  }
  if (action === 'listPocketExpansions') {
    return { method: 'GET', path: `/api/pocket/expansions?${buildQuery(payload)}` };
  }
  if (action === 'listPocketPacks') {
    return { method: 'GET', path: `/api/pocket/packs?${buildQuery(payload)}` };
  }
  if (action === 'getPocketPullRates') {
    return { method: 'GET', path: `/api/pocket/pull-rates?${buildQuery(payload)}` };
  }
  if (action === 'getPocketRarities') {
    return { method: 'GET', path: '/api/pocket/rarities' };
  }
  if (action === 'openPocketPack') {
    return { method: 'POST', path: '/api/pocket/open-pack', data: payload };
  }
  if (action === 'listPocketEvents') {
    return { method: 'GET', path: `/api/pocket/events?${buildQuery(payload)}` };
  }
  if (action === 'listPocketMissions') {
    return { method: 'GET', path: `/api/pocket/missions?${buildQuery(payload)}` };
  }
  if (action === 'listPocketBattles') {
    return { method: 'GET', path: `/api/pocket/battles?${buildQuery(payload)}` };
  }
  if (action === 'listPocketShops') {
    return { method: 'GET', path: `/api/pocket/shops?${buildQuery(payload)}` };
  }
  if (action === 'listPocketWonderPicks') {
    return { method: 'GET', path: `/api/pocket/wonder-picks?${buildQuery(payload)}` };
  }
  if (action === 'listPocketHotDecks') {
    return { method: 'GET', path: `/api/pocket/hot-decks?${buildQuery(payload)}` };
  }
  if (action === 'getPocketHotDeck') {
    return { method: 'GET', path: `/api/pocket/hot-decks/${encodeURIComponent(payload.id)}` };
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
  if (config.useStaticApi) {
    return staticApi.call(action, data).catch(() => fallback());
  }
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
      { rank: 1, name: 'Dragapult ex', points: 2227, share: '49.22%', url: 'https://limitlesstcg.com/decks/284', image: '', images: [], source: 'Limitless TCG' },
      { rank: 2, name: "N's Zoroark ex", points: 363, share: '8.02%', url: 'https://limitlesstcg.com/decks/268', image: '', images: [], source: 'Limitless TCG' },
      { rank: 3, name: 'Crustle Mysterious Rock Inn', points: 278, share: '6.14%', url: 'https://limitlesstcg.com/decks/283', image: '', images: [], source: 'Limitless TCG' }
    ].slice(0, Number((options && options.limit) || 6)),
    total: 3,
    source: 'local-hot-deck-seed',
    stale: true
  }));
}

function buildDeckCopyText(sections) {
  return (sections || []).map((section) => [
    `${section.title}: ${section.count}`,
    ...(section.cards || []).map((card) => card.line || `${card.count} ${card.name} ${card.set} ${card.number}`.trim())
  ].join('\n')).join('\n\n');
}

function sampleDeckCardImage(set, number) {
  const setCode = String(set || '').toUpperCase();
  const rawNumber = String(number || '');
  const cardNumber = /^\d+$/.test(rawNumber) ? rawNumber.padStart(3, '0') : rawNumber;
  if (!setCode || !cardNumber) return '';
  return normalizeRemoteUrl(`/assets/limitless/cards/${encodeURIComponent(setCode)}/${encodeURIComponent(`${setCode}_${cardNumber}_R_EN_LG.png`)}`);
}

function sampleHotDeckDetail(deck) {
  const source = deck || {};
  const sections = [
    {
      title: 'Pokemon',
      displayTitle: '宝可梦',
      count: 19,
      cards: [
        { count: 4, name: 'Dreepy', set: 'TWM', number: '128' },
        { count: 4, name: 'Drakloak', set: 'TWM', number: '129' },
        { count: 2, name: 'Dragapult ex', set: 'TWM', number: '130' },
        { count: 2, name: 'Duskull', set: 'PRE', number: '35' },
        { count: 2, name: 'Dusclops', set: 'PRE', number: '36' },
        { count: 1, name: 'Dusknoir', set: 'PRE', number: '37' },
        { count: 1, name: 'Budew', set: 'ASC', number: '16' },
        { count: 1, name: 'Fezandipiti ex', set: 'ASC', number: '142' },
        { count: 1, name: 'Meowth ex', set: 'POR', number: '62' },
        { count: 1, name: 'Munkidori', set: 'TWM', number: '95' }
      ]
    },
    {
      title: 'Trainer',
      displayTitle: '训练家',
      count: 33,
      cards: [
        { count: 4, name: "Lillie's Determination", set: 'MEG', number: '119' },
        { count: 3, name: 'Crispin', set: 'SCR', number: '133' },
        { count: 2, name: "Boss's Orders", set: 'MEG', number: '114' },
        { count: 1, name: 'Dawn', set: 'PFL', number: '87' },
        { count: 4, name: 'Ultra Ball', set: 'MEG', number: '131' },
        { count: 4, name: 'Poke Pad', set: 'POR', number: '81' },
        { count: 4, name: 'Buddy-Buddy Poffin', set: 'TEF', number: '144' },
        { count: 4, name: 'Crushing Hammer', set: 'POR', number: '71' },
        { count: 2, name: 'Night Stretcher', set: 'ASC', number: '196' },
        { count: 1, name: 'Unfair Stamp', set: 'TWM', number: '165' },
        { count: 1, name: 'Special Red Card', set: 'CRI', number: '82' },
        { count: 1, name: 'Handheld Fan', set: 'TWM', number: '150' },
        { count: 1, name: "Team Rocket's Watchtower", set: 'DRI', number: '180' },
        { count: 1, name: 'Jamming Tower', set: 'TWM', number: '153' }
      ]
    },
    {
      title: 'Energy',
      displayTitle: '能量',
      count: 8,
      cards: [
        { count: 3, name: 'Psychic Energy', set: 'MEE', number: '5' },
        { count: 3, name: 'Fire Energy', set: 'MEE', number: '2' },
        { count: 2, name: 'Darkness Energy', set: 'MEE', number: '7' }
      ]
    }
  ].map((section) => Object.assign({}, section, {
    cards: section.cards.map((card) => Object.assign({}, card, {
      image: sampleDeckCardImage(card.set, card.number),
      line: `${card.count} ${card.name} ${card.set} ${card.number}`
    }))
  }));

  return {
    item: {
      rank: Number(source.rank || 1),
      name: source.name || 'Dragapult Dusknoir',
      overviewName: source.name || 'Dragapult ex',
      points: Number(source.points || 2227),
      share: source.share || '49.22%',
      url: source.url || 'https://limitlesstcg.com/decks/284',
      overviewUrl: source.url || 'https://limitlesstcg.com/decks/284',
      decklistUrl: source.url || 'https://limitlesstcg.com/decks/284',
      source: 'Limitless TCG',
      sourceUrl: source.url || 'https://limitlesstcg.com/decks/284',
      description: '本地示例牌表。连接自有服务后会读取 Limitless 最新卡组。',
      latestResult: {
        place: '2nd',
        player: 'Sample Player',
        variants: []
      },
      sections,
      totalCards: sections.reduce((sum, section) => sum + section.count, 0),
      copyText: buildDeckCopyText(sections)
    },
    source: 'local-hot-deck-seed',
    stale: true
  };
}

function getHotDeckDetail(deck) {
  return apiCall('getHotDeckDetail', deck || {}, () => sampleHotDeckDetail(deck));
}

function paginatePocket(items, options) {
  const page = Math.max(1, Number((options && options.page) || 1));
  const pageSize = Math.max(1, Number((options && (options.pageSize || options.limit)) || 30));
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    hasMore: offset + pageSize < items.length,
    source: 'local-pocket-seed'
  };
}

function listPocketCards(options) {
  const filters = options || {};
  return apiCall('listPocketCards', filters, () => {
    const keyword = String(filters.q || filters.keyword || '').trim().toLowerCase();
    const expansion = String(filters.expansion || '').toLowerCase();
    const rarity = String(filters.rarity || '').toLowerCase();
    const type = String(filters.type || '').toLowerCase();
    const pokemonId = Number(filters.pokemonId || 0);
    const items = pocketSample.CARDS.filter((card) => {
      if (keyword && ![card.name_zh, card.name_en, card.id, card.artist]
        .concat((card.collections || []).flatMap((item) => [item.expansion_id, item.expansion_name_zh, item.number]))
        .join(' ').toLowerCase().includes(keyword)) return false;
      if (expansion && !(card.collections || []).some((item) => String(item.expansion_id).toLowerCase() === expansion)) return false;
      if (rarity && String(card.rarity).toLowerCase() !== rarity) return false;
      if (type && String(card.card_type).toLowerCase() !== type) return false;
      if (pokemonId && Number(card.national_pokedex_number || 0) !== pokemonId) return false;
      return true;
    });
    return paginatePocket(items, filters);
  });
}

function getPocketCard(id) {
  return apiCall('getPocketCard', { id }, () => ({
    item: pocketSample.CARDS.find((card) => card.id === String(id)) || null,
    source: 'local-pocket-seed'
  }));
}

function getPocketMeta() {
  return apiCall('getPocketMeta', {}, () => ({
    item: { status: 'local' },
    counts: {
      cards: pocketSample.CARDS.length,
      expansions: pocketSample.EXPANSIONS.length,
      packs: pocketSample.PACKS.length,
      events: pocketSample.EVENTS.length
    },
    sources: {},
    source: 'local-pocket-seed'
  }));
}

function listPocketExpansions(options) {
  return apiCall('listPocketExpansions', options || {}, () => paginatePocket(pocketSample.EXPANSIONS, options || {}));
}

function listPocketPacks(options) {
  return apiCall('listPocketPacks', options || {}, () => paginatePocket(pocketSample.PACKS, options || {}));
}

function getPocketPullRates(expansion) {
  const payload = typeof expansion === 'object' ? expansion : { expansion };
  return apiCall('getPocketPullRates', payload, () => ({
    item: {
      'Regular Pack': {
        appearance_rate: 99.95,
        cards: 5,
        slots: { 1: { C: 100 }, 2: { C: 100 }, 3: { C: 100 }, 4: { U: 90, R: 10 }, 5: { U: 60, R: 30, RR: 10 } }
      }
    },
    source: 'local-pocket-seed'
  }));
}

function getPocketRarities() {
  return apiCall('getPocketRarities', {}, () => ({
    item: {
      C: { label: 'Common', group: 'Diamond', count: 1 },
      U: { label: 'Uncommon', group: 'Diamond', count: 2 },
      R: { label: 'Rare', group: 'Diamond', count: 3 },
      RR: { label: 'Double Rare', group: 'Diamond', count: 4 }
    },
    source: 'local-pocket-seed'
  }));
}

function openPocketPack(payload) {
  return apiCall('openPocketPack', payload || {}, () => {
    const cards = Array.from({ length: 5 }, (unused, index) => Object.assign({},
      pocketSample.CARDS[Math.floor(Math.random() * pocketSample.CARDS.length)], { slot: index + 1 }));
    return {
      item: {
        id: `local-pocket-pack-${Date.now()}`,
        pack: pocketSample.PACKS[0],
        pack_type: 'Regular Pack',
        is_rare_pack: false,
        cards,
        count: cards.length
      },
      source: 'local-pocket-seed'
    };
  });
}

function listPocketEvents(options) {
  return apiCall('listPocketEvents', options || {}, () => paginatePocket(pocketSample.EVENTS, options || {}));
}

function pocketCollection(action, sampleFilter, options) {
  return apiCall(action, options || {}, () => paginatePocket(
    pocketSample.EVENTS.filter((event) => sampleFilter.includes(event.type)), options || {}
  ));
}

function listPocketMissions(options) {
  return pocketCollection('listPocketMissions', ['missionGroup'], options);
}

function listPocketBattles(options) {
  return pocketCollection('listPocketBattles', ['soloBattle', 'pvpEmblemBattle', 'rankedPvpSeason'], options);
}

function listPocketShops(options) {
  return pocketCollection('listPocketShops', ['itemShop', 'pokeGoldShop'], options);
}

function listPocketWonderPicks(options) {
  return pocketCollection('listPocketWonderPicks', ['wonderPickFree', 'wonderPickChansey'], options);
}

function listPocketHotDecks(options) {
  return apiCall('listPocketHotDecks', options || {}, () => paginatePocket(pocketSample.HOT_DECKS, options || {}));
}

function getPocketHotDeck(id) {
  return apiCall('getPocketHotDeck', { id }, () => ({
    item: {
      id,
      name: pocketSample.HOT_DECKS[0].name,
      total_cards: 20,
      energy: 'Psychic',
      cards: pocketSample.CARDS.slice(0, 2).map((card) => ({
        id: card.id,
        count: 2,
        name: card.name_en,
        name_zh: card.name_zh,
        set: 'A1',
        number: (card.collections[0] || {}).number,
        image: card.image
      })),
      copy_text: '2 Mewtwo ex A1 129\n2 Gardevoir A1 132\n\nEnergy: Psychic',
      representative: { player: 'Sample Player', tournament: 'Pocket Tournament', place: 1 },
      archetype: pocketSample.HOT_DECKS[0]
    },
    source: 'local-pocket-seed'
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
  getHotDecks,
  getHotDeckDetail,
  listPocketCards,
  getPocketCard,
  getPocketMeta,
  listPocketExpansions,
  listPocketPacks,
  getPocketPullRates,
  getPocketRarities,
  openPocketPack,
  listPocketEvents,
  listPocketMissions,
  listPocketBattles,
  listPocketShops,
  listPocketWonderPicks,
  listPocketHotDecks,
  getPocketHotDeck
};
