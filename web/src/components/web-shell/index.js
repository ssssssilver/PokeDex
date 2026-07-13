import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getLocale, setLocale, subscribe, t } from '../../i18n'
import { getTheme, setTheme, subscribeTheme } from '../../theme'
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
  if (/pokemon-detail|\/quiz\/|\/team\/|type-chart|monsters-chill/.test(route)) return 'pokedex'
  if (/pocket/.test(route)) return 'pocket'
  if (/card-detail|card-pack|card-quiz|hot-decks|deck-detail/.test(route)) return 'cards'
  if (/profile|data-sources|\/play\//.test(route)) return 'profile'
  return nav.find(item => route.includes(item.url))?.key || 'home'
}

export default class WebShell extends React.Component {
  state = { locale: getLocale(), route: '', theme: getTheme(), mobileNavOpen: false }
  componentDidMount() {
    this.unsubscribe = subscribe((locale) => this.setState({ locale }, this.translateLegacyUi))
    this.unsubscribeTheme = subscribeTheme((theme) => this.setState({ theme }))
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
    this.unsubscribeTheme?.()
    this.observer?.disconnect()
    window.removeEventListener('hashchange', this.syncRoute)
  }
  syncRoute = () => this.setState({
    route: window.location.hash || window.location.pathname,
    mobileNavOpen: false
  })
  changeLocale = (locale) => {
    setLocale(locale)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', locale)
    window.history.replaceState({}, '', url)
    window.location.reload()
  }
  toggleLocale = () => this.changeLocale(this.state.locale === 'en' ? 'zh-TW' : 'en')
  toggleTheme = () => setTheme(this.state.theme === 'dark' ? 'light' : 'dark')
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
    if (typeof document !== 'undefined' && document.title) {
      document.title = translateLegacyText(document.title, locale)
    }
    this.translating = false
  }
  navigate = (url) => {
    this.setState({ mobileNavOpen: false })
    return Taro.switchTab({ url })
  }
  openPage = (url) => {
    this.setState({ mobileNavOpen: false })
    return Taro.navigateTo({ url })
  }
  toggleMobileNav = () => this.setState(state => ({ mobileNavOpen: !state.mobileNavOpen }))
  closeMobileNav = () => this.setState({ mobileNavOpen: false })
  stopPropagation = event => event.stopPropagation()
  goBack = () => {
    const activeKey = sectionForRoute(this.state.route)
    const fallback = nav.find(item => item.key === activeKey) || nav[0]
    Taro.navigateBack({ delta: 1 }).catch(() => this.navigate(fallback.url))
  }
  render() {
    const activeKey = sectionForRoute(this.state.route)
    const active = nav.find(item => item.key === activeKey) || nav[0]
    const isTopLevel = nav.some(item => this.state.route.includes(item.url))
    const languageToggleLabel = this.state.locale === 'en' ? '切換至繁體中文' : 'Switch to English'
    const themeToggleLabel = this.state.theme === 'dark' ? 'Light theme' : 'Dark theme'
    if (typeof document !== 'undefined') {
      const isRootPage = window.location.pathname === '/' || window.location.pathname.endsWith('/index.html')
      if (isRootPage || nav.some(item => window.location.pathname.endsWith(item.url))) {
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
        <button className="language-toggle desktop-language-toggle" onClick={this.toggleLocale} title={languageToggleLabel} aria-label={languageToggleLabel}>
          <Text className={this.state.locale === 'zh-TW' ? 'active' : ''}>中</Text>
          <Text className="language-toggle-divider">/</Text>
          <Text className={this.state.locale === 'en' ? 'active' : ''}>EN</Text>
        </button>
        <View className="sidebar-tools">
          <button className="theme-toggle desktop-theme-toggle" onClick={this.toggleTheme} title={themeToggleLabel} aria-label={themeToggleLabel}>
            <Text className={this.state.theme === 'light' ? 'active' : ''}>☀</Text>
            <Text className="theme-toggle-divider">/</Text>
            <Text className={this.state.theme === 'dark' ? 'active' : ''}>☾</Text>
          </button>
          <button className="sponsor-link" onClick={() => this.openPage('/pages/sponsor/index')}>♡ {this.state.locale === 'en' ? 'Sponsor' : this.state.locale === 'zh-TW' ? '贊助本站' : '赞助本站'}</button>
        </View>
      </aside>
      <main className="web-main">{this.props.children}</main>
      <View className="mobile-web-navigation">
        {!isTopLevel && <button className="mobile-nav-button" onClick={this.goBack} title="Back" aria-label="Back">‹</button>}
        <button className="mobile-nav-button" onClick={this.toggleMobileNav} title="Menu" aria-label="Menu" aria-expanded={this.state.mobileNavOpen}>☰</button>
      </View>
      <View className="mobile-web-tools">
        <button className="language-toggle mobile-language-toggle" onClick={this.toggleLocale} title={languageToggleLabel} aria-label={languageToggleLabel}>
          <Text className="active">{this.state.locale === 'zh-TW' ? '中' : 'EN'}</Text>
        </button>
        <button className="theme-toggle mobile-theme-toggle" onClick={this.toggleTheme} title={themeToggleLabel} aria-label={themeToggleLabel}>
          <Text className="active">{this.state.theme === 'dark' ? '☾' : '☀'}</Text>
        </button>
      </View>
      {this.state.mobileNavOpen && <View className="mobile-drawer-layer" onClick={this.closeMobileNav}>
        <aside className="mobile-drawer" aria-label="Primary navigation" onClick={this.stopPropagation}>
          <View className="mobile-drawer-head">
            <View className="mobile-drawer-brand">{t('appName')}</View>
            <button className="mobile-drawer-close" onClick={this.closeMobileNav} title="Close" aria-label="Close">×</button>
          </View>
          <nav className="mobile-drawer-nav">
            {nav.map(item => <View key={item.key} className={`mobile-drawer-item ${activeKey === item.key ? 'active' : ''}`} onClick={() => this.navigate(item.url)}>
              <Text className="mobile-drawer-icon" aria-hidden="true">{item.icon}</Text>
              <Text>{t(item.key)}</Text>
            </View>)}
          </nav>
          <button className="mobile-drawer-sponsor" onClick={() => this.openPage('/pages/sponsor/index')}>{this.state.locale === 'en' ? 'Sponsor' : this.state.locale === 'zh-TW' ? '贊助本站' : '赞助本站'}</button>
        </aside>
      </View>}
    </View>
  }
}
