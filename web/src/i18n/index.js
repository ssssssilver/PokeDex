import Taro from '@tarojs/taro'

const STORAGE_KEY = 'pokechill:locale'
export const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en']

const messages = {
  'zh-CN': {
    appName: '宝批小站', home: '首页', pokedex: '宝可梦图鉴', cards: '卡牌图鉴',
    pocket: 'Pocket图鉴', profile: '我的', language: '语言', search: '搜索',
    loading: '加载中', retry: '重试', all: '全部', filter: '筛选', reset: '重置',
    confirm: '确定', favorite: '收藏', owned: '已拥有', wishlist: '愿望单',
    play: '玩法盒子', decks: '热门卡组', events: '活动动态', openPack: '每日开包',
    pokemon: '宝可梦', physicalCards: '实体卡牌', version: '版本号',
    feedback: '用户意见反馈', noData: '暂无数据', viewDetails: '查看详情'
  },
  'zh-TW': {
    appName: '寶批小站', home: '首頁', pokedex: '寶可夢圖鑑', cards: '卡牌圖鑑',
    pocket: 'Pocket圖鑑', profile: '我的', language: '語言', search: '搜尋',
    loading: '載入中', retry: '重試', all: '全部', filter: '篩選', reset: '重設',
    confirm: '確定', favorite: '收藏', owned: '已擁有', wishlist: '願望清單',
    play: '玩法盒子', decks: '熱門牌組', events: '活動動態', openPack: '每日開包',
    pokemon: '寶可夢', physicalCards: '實體卡牌', version: '版本號',
    feedback: '使用者意見回饋', noData: '暫無資料', viewDetails: '查看詳情'
  },
  en: {
    appName: 'PokeChill', home: 'Home', pokedex: 'Pokédex', cards: 'TCG Cards',
    pocket: 'Pocket Cards', profile: 'My Collection', language: 'Language', search: 'Search',
    loading: 'Loading', retry: 'Retry', all: 'All', filter: 'Filters', reset: 'Reset',
    confirm: 'Apply', favorite: 'Favorites', owned: 'Owned', wishlist: 'Wishlist',
    play: 'Play', decks: 'Popular Decks', events: 'Events', openPack: 'Daily Pack',
    pokemon: 'Pokémon', physicalCards: 'Physical TCG', version: 'Version',
    feedback: 'Send Feedback', noData: 'No data available', viewDetails: 'View details'
  }
}

function normalizeLocale(value) {
  const locale = String(value || '').replace('_', '-').toLowerCase()
  if (locale.startsWith('zh-tw') || locale.startsWith('zh-hk') || locale.startsWith('zh-hant')) return 'zh-TW'
  if (locale.startsWith('en')) return 'en'
  return 'zh-CN'
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
  if (typeof navigator !== 'undefined') return normalizeLocale(navigator.languages?.[0] || navigator.language)
  return 'zh-CN'
}

let currentLocale = detectLocale()
const listeners = new Set()

export function getLocale() { return currentLocale }
export function t(key, values = {}) {
  const template = messages[currentLocale]?.[key] || messages['zh-CN'][key] || key
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
    : currentLocale === 'zh-TW'
      ? [`${field}_zh_tw`, `${field}_zh`, `${field}_zh_cn`, field, `${field}_en`]
      : [`${field}_zh_cn`, `${field}_zh`, field, `${field}_zh_tw`, `${field}_en`]
  for (const key of candidates) if (entity[key]) return entity[key]
  return ''
}

if (typeof document !== 'undefined') document.documentElement.lang = currentLocale
