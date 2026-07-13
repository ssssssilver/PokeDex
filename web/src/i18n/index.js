import Taro from '@tarojs/taro'

const STORAGE_KEY = 'pokechill:locale'
export const SUPPORTED_LOCALES = ['zh-TW', 'en']
export const CHINESE_TIMEZONES = new Set([
  'Asia/Shanghai', 'Asia/Chongqing', 'Asia/Harbin', 'Asia/Urumqi',
  'Asia/Hong_Kong', 'Asia/Macau', 'Asia/Taipei'
])

const messages = {
  'zh-TW': {
    appName: '寶批小站', home: '首頁', pokedex: '寶可夢圖鑑', cards: '卡牌圖鑑',
    pocket: 'Pocket圖鑑', profile: '我的', language: '語言', search: '搜尋',
    loading: '載入中', retry: '重試', all: '全部', filter: '篩選', reset: '重設',
    confirm: '確定', favorite: '收藏', owned: '已擁有', wishlist: '願望清單',
    play: '玩法盒子', decks: '熱門牌組', events: '活動動態', openPack: '每日開包',
    pokemon: '寶可夢', physicalCards: '實體卡牌', version: '版本號',
    feedback: '使用者意見回饋', noData: '暫無資料', viewDetails: '查看詳情',
    searchPokemon: '搜尋寶可夢名稱或編號', searchCards: '搜尋實體卡牌、系列或編號', searchPocket: '搜尋 Pocket 卡牌',
    monstersChill: '寶可夢放置冒險', gameProgress: '探索、培育與隊伍養成',
    gameBack: '返回', gameFullscreen: '全螢幕', gameExitFullscreen: '退出全螢幕',
    gameLoading: '正在載入遊戲', gameHint: '遊戲進度儲存在目前瀏覽器'
  },
  en: {
    appName: 'PokeChill', home: 'Home', pokedex: 'Pokédex', cards: 'TCG',
    pocket: 'Pocket Cards', profile: 'My Collection', language: 'Language', search: 'Search',
    loading: 'Loading', retry: 'Retry', all: 'All', filter: 'Filters', reset: 'Reset',
    confirm: 'Apply', favorite: 'Favorites', owned: 'Owned', wishlist: 'Wishlist',
    play: 'Play', decks: 'Popular Decks', events: 'Events', openPack: 'Daily Pack',
    pokemon: 'Pokémon', physicalCards: 'TCG', version: 'Version',
    feedback: 'Send Feedback', noData: 'No data available', viewDetails: 'View details',
    searchPokemon: 'Search Pokémon by name or number', searchCards: 'Search physical cards, sets, or numbers',
    searchPocket: 'Search Pocket cards',
    monstersChill: 'Monsters & Chill', gameProgress: 'Explore, train, and build your team',
    gameBack: 'Back', gameFullscreen: 'Fullscreen', gameExitFullscreen: 'Exit fullscreen',
    gameLoading: 'Loading game', gameHint: 'Game progress is saved in this browser'
  }
}

function normalizeLocale(value) {
  const locale = String(value || '').replace('_', '-').toLowerCase()
  if (locale.startsWith('zh')) return 'zh-TW'
  if (locale.startsWith('en')) return 'en'
  return 'en'
}

export function defaultLocaleForTimeZone(timeZone) {
  return CHINESE_TIMEZONES.has(String(timeZone || '')) ? 'zh-TW' : 'en'
}

function currentTimeZone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch (error) { return '' }
}

function detectLocale() {
  if (typeof window !== 'undefined') {
    const requested = new URLSearchParams(window.location.search).get('lang') || window.sessionStorage.getItem('pokechill:requestedLocale')
    if (requested) return normalizeLocale(requested)
  }
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    if (saved) return normalizeLocale(saved)
  } catch (error) {}
  return defaultLocaleForTimeZone(currentTimeZone())
}

let currentLocale = detectLocale()
const listeners = new Set()

export function getLocale() { return currentLocale }
export function t(key, values = {}) {
  const template = messages[currentLocale]?.[key] || messages['zh-TW'][key] || messages.en[key] || key
  return Object.keys(values).reduce((text, name) => text.replaceAll(`{${name}}`, values[name]), template)
}
export function setLocale(locale) {
  const next = normalizeLocale(locale)
  if (next === currentLocale) return
  currentLocale = next
  try { Taro.setStorageSync(STORAGE_KEY, next) } catch (error) {}
  if (typeof document !== 'undefined') document.documentElement.lang = next
  listeners.forEach((listener) => listener(next))
}
export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
export function localize(entity, field = 'name') {
  if (!entity) return ''
  const candidates = currentLocale === 'en'
    ? [`${field}_en`, field, `${field}_zh`, `${field}_zh_cn`, `${field}_zh_tw`]
    : [`${field}_zh_tw`, `${field}_zh`, `${field}_zh_cn`, field, `${field}_en`]
  for (const key of candidates) if (entity[key]) return entity[key]
  return ''
}

if (typeof document !== 'undefined') document.documentElement.lang = currentLocale
