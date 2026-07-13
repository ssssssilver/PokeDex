import Taro from '@tarojs/taro'

const STORAGE_KEY = 'pokechill:theme'
export const THEMES = ['light', 'dark']

function preferredTheme() {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

function detectTheme() {
  try {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    if (THEMES.includes(saved)) return saved
  } catch (error) {}
  return preferredTheme()
}

let currentTheme = detectTheme()
const listeners = new Set()

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}

export function getTheme() { return currentTheme }
export function setTheme(theme) {
  if (!THEMES.includes(theme) || theme === currentTheme) return
  currentTheme = theme
  try { Taro.setStorageSync(STORAGE_KEY, theme) } catch (error) {}
  applyTheme(theme)
  listeners.forEach(listener => listener(theme))
}
export function toggleTheme() { setTheme(currentTheme === 'dark' ? 'light' : 'dark') }
export function subscribeTheme(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

applyTheme(currentTheme)
