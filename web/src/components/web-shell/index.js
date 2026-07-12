import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getLocale, setLocale, subscribe, t } from '../../i18n'
import { prepareLegacyLocale, translateLegacyText } from '../../i18n/legacy-ui'
import './index.scss'

const nav = [
  { key: 'home', icon: '⌂', url: '/pages/home/index' },
  { key: 'pokedex', icon: '◉', url: '/pages/pokedex/index' },
  { key: 'cards', icon: '▣', url: '/pages/carddex/index' },
  { key: 'pocket', icon: 'P', url: '/pages/pocket/index' },
  { key: 'profile', icon: '●', url: '/pages/profile/index' }
]

function updateTabBarLocale() {
  nav.forEach((item, index) => {
    Taro.setTabBarItem({ index, text: t(item.key) }).catch(() => {})
  })
}

function sectionForRoute(route) {
  if (/pokemon-detail|\/quiz\/|\/team\/|type-chart/.test(route)) return 'pokedex'
  if (/pocket/.test(route)) return 'pocket'
  if (/card-detail|card-pack|card-quiz|hot-decks|deck-detail/.test(route)) return 'cards'
  if (/profile|data-sources|\/play\//.test(route)) return 'profile'
  return nav.find(item => route.includes(item.url))?.key || 'home'
}

export default class WebShell extends React.Component {
  state = { locale: getLocale(), route: '' }
  componentDidMount() {
    this.unsubscribe = subscribe((locale) => this.setState({ locale }, this.translateLegacyUi))
    this.syncRoute()
    updateTabBarLocale()
    window.addEventListener('hashchange', this.syncRoute)
    this.translateLegacyUi()
    prepareLegacyLocale(getLocale()).then(this.translateLegacyUi)
    this.observer = new MutationObserver(() => this.translateLegacyUi())
    this.observer.observe(document.getElementById('app'), { childList: true, subtree: true, characterData: true })
  }
  componentWillUnmount() {
    this.unsubscribe?.()
    this.observer?.disconnect()
    window.removeEventListener('hashchange', this.syncRoute)
  }
  syncRoute = () => this.setState({ route: window.location.hash || window.location.pathname })
  changeLocale = (locale) => {
    setLocale(locale)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', locale)
    window.history.replaceState({}, '', url)
    window.location.reload()
  }
  translateLegacyUi = () => {
    if (this.translating) return
    this.translating = true
    const locale = getLocale()
    const root = document.getElementById('app')
    if (root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      let node
      while ((node = walker.nextNode())) {
        if (!this.originalText) this.originalText = new WeakMap()
        const previous = this.originalText.get(node)
        if (!previous || node.nodeValue !== previous.translated) {
          this.originalText.set(node, { source: node.nodeValue, translated: node.nodeValue })
        }
        const entry = this.originalText.get(node)
        const source = entry.source
        const translated = translateLegacyText(source, locale)
        entry.translated = translated
        if (node.nodeValue !== translated) node.nodeValue = translated
      }
      root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(element => {
        ;['placeholder', 'title', 'aria-label'].forEach(attribute => {
          if (!element.hasAttribute(attribute)) return
          const key = `data-i18n-source-${attribute}`
          if (!element.hasAttribute(key)) element.setAttribute(key, element.getAttribute(attribute))
          element.setAttribute(attribute, translateLegacyText(element.getAttribute(key), locale))
        })
      })
    }
    this.translating = false
  }
  navigate = (url) => Taro.switchTab({ url })
  render() {
    const activeKey = sectionForRoute(this.state.route)
    const active = nav.find(item => item.key === activeKey) || nav[0]
    if (typeof document !== 'undefined') {
      if (nav.some(item => window.location.pathname.endsWith(item.url))) {
        document.title = `${t(active.key)} | ${t('appName')}`
      }
      const canonical = document.querySelector('link[rel="canonical"]') || document.head.appendChild(document.createElement('link'))
      canonical.setAttribute('rel', 'canonical')
      canonical.setAttribute('href', `${window.location.origin}${window.location.pathname}`)
    }
    return <View className="web-app-shell">
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <View className="desktop-brand">{t('appName')}</View>
        <nav className="desktop-nav">
          {nav.map(item => <View key={item.key} className={`desktop-nav-item ${activeKey === item.key ? 'active' : ''}`} onClick={() => this.navigate(item.url)}>
            <Text className="desktop-nav-icon" aria-hidden="true">{item.icon}</Text><Text>{t(item.key)}</Text>
          </View>)}
        </nav>
        <label className="locale-control">
          <Text>{t('language')}</Text>
          <select value={this.state.locale} onChange={event => this.changeLocale(event.target.value)} aria-label={t('language')}>
            <option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option>
          </select>
        </label>
      </aside>
      <main className="web-main">{this.props.children}</main>
      <View className="mobile-locale-switch" role="group" aria-label={t('language')}>
        {['zh-CN', 'zh-TW', 'en'].map(locale => <button key={locale} className={locale === this.state.locale ? 'active' : ''} onClick={() => this.changeLocale(locale)}>{locale === 'zh-CN' ? '简' : locale === 'zh-TW' ? '繁' : 'EN'}</button>)}
      </View>
    </View>
  }
}
