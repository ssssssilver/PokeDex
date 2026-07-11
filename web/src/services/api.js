const Taro = require('@tarojs/taro')
const config = require('../config.js')

function buildQuery(params) {
  return Object.keys(params || {})
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => {
      const value = Array.isArray(params[key]) ? params[key].join(',') : params[key]
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')
}

function apiUrl(path) {
  const base = String(config.apiBaseUrl || '').replace(/\/+$/, '')
  return `${base}${path}`
}

function request(path, options) {
  const settings = options || {}
  return Taro.request({
    url: apiUrl(path),
    method: settings.method || 'GET',
    data: settings.data || {},
    timeout: config.requestTimeoutMs || 15000,
    header: settings.data ? { 'Content-Type': 'application/json' } : {},
  }).then((response) => {
    if (response.statusCode >= 200 && response.statusCode < 300) return response.data
    const message = response.data && response.data.error
      ? response.data.error
      : `API request failed: ${response.statusCode}`
    throw new Error(message)
  })
}

function get(path, params) {
  const query = buildQuery(params)
  return request(`${path}${query ? `?${query}` : ''}`)
}

function post(path, data) {
  return request(path, { method: 'POST', data: data || {} })
}

function listPokemon(filters) {
  return get('/api/pokemon', filters)
}

function getPokemonById(id) {
  return get(`/api/pokemon/${encodeURIComponent(id)}`)
}

function getEvolutionChain(ids) {
  return get('/api/evolution', { ids })
}

function getTypes() {
  return get('/api/types')
}

function getTypeRelations(type) {
  return get(`/api/types/${encodeURIComponent(type || 'fire')}/relations`)
}

function getTypeChart() {
  return get('/api/type-chart')
}

function getDailyQuiz(options) {
  return get('/api/quiz/daily', options)
}

function submitDailyQuiz(payload) {
  return post('/api/quiz/daily/answer', payload)
}

function analyzeTeam(ids) {
  return post('/api/team/analyze', { ids })
}

function getSyncStatus(options) {
  return get('/api/sync/status', options)
}

function getSyncRuns(options) {
  return get('/api/sync/runs', Object.assign({ limit: 3 }, options || {}))
}

function validateCache(options) {
  return post('/api/cache/validate', options)
}

function listCards(filters) {
  return get('/api/cards', filters)
}

function getCardById(id) {
  return get(`/api/cards/${encodeURIComponent(id)}`)
}

function getPokemonCards(id, options) {
  return get(`/api/pokemon/${encodeURIComponent(id)}/cards`, options)
}

function getPtcgMeta() {
  return get('/api/ptcg/meta')
}

function getPtcgSyncStatus() {
  return get('/api/ptcg/sync-status')
}

function getPtcgSyncRuns(options) {
  return get('/api/ptcg/sync-runs', Object.assign({ limit: 3 }, options || {}))
}

function getDailyCardQuiz() {
  return get('/api/card-quiz/daily')
}

function submitDailyCardQuiz(payload) {
  return post('/api/card-quiz/daily/answer', payload)
}

function openCardPack(payload) {
  return post('/api/card-pack/open', payload)
}

function getHotDecks(options) {
  return get('/api/decks/hot', Object.assign({ limit: 6 }, options || {}))
}

function getHotDeckDetail(deck) {
  return get('/api/decks/detail', deck || {})
}

function listPocketCards(options) {
  return get('/api/pocket/cards', options)
}

function getPocketCard(id) {
  return get(`/api/pocket/cards/${encodeURIComponent(id)}`)
}

function getPocketMeta() {
  return get('/api/pocket/meta')
}

function listPocketExpansions(options) {
  return get('/api/pocket/expansions', options)
}

function listPocketPacks(options) {
  return get('/api/pocket/packs', options)
}

function getPocketPullRates(expansion) {
  const options = typeof expansion === 'object' ? expansion : { expansion }
  return get('/api/pocket/pull-rates', options)
}

function getPocketRarities() {
  return get('/api/pocket/rarities')
}

function openPocketPack(payload) {
  return post('/api/pocket/open-pack', payload)
}

function listPocketEvents(options) {
  return get('/api/pocket/events', options)
}

function listPocketMissions(options) {
  return get('/api/pocket/missions', options)
}

function listPocketBattles(options) {
  return get('/api/pocket/battles', options)
}

function listPocketShops(options) {
  return get('/api/pocket/shops', options)
}

function listPocketWonderPicks(options) {
  return get('/api/pocket/wonder-picks', options)
}

function listPocketHotDecks(options) {
  return get('/api/pocket/hot-decks', options)
}

function getPocketHotDeck(id) {
  return get(`/api/pocket/hot-decks/${encodeURIComponent(id)}`)
}

module.exports = {
  listPokemon,
  getPokemonById,
  getEvolutionChain,
  getTypes,
  getTypeRelations,
  getTypeChart,
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
  getPocketHotDeck,
}
