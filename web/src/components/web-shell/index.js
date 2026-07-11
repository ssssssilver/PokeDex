import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { getLocale, setLocale, subscribe, t } from '../../i18n'
import './index.scss'

const nav = [
  { key: 'home', icon: '⌂', url: '/pages/home/index' },
  { key: 'pokedex', icon: '◉', url: '/pages/pokedex/index' },
  { key: 'cards', icon: '▣', url: '/pages/carddex/index' },
  { key: 'pocket', icon: 'P', url: '/pages/pocket/index' },
  { key: 'profile', icon: '●', url: '/pages/profile/index' }
]

export default class WebShell extends React.Component {
  state = { locale: getLocale(), route: '' }
  componentDidMount() {
    this.unsubscribe = subscribe((locale) => this.setState({ locale }))
    this.syncRoute()
    window.addEventListener('hashchange', this.syncRoute)
  }
  componentWillUnmount() {
    this.unsubscribe?.()
    window.removeEventListener('hashchange', this.syncRoute)
  }
  syncRoute = () => this.setState({ route: window.location.hash || window.location.pathname })
  navigate = (url) => Taro.switchTab({ url })
  render() {
    const active = nav.find(item => this.state.route.includes(item.url)) || nav[0]
    if (typeof document !== 'undefined') {
      document.title = `${t(active.key)} | ${t('appName')}`
      const canonical = document.querySelector('link[rel="canonical"]') || document.head.appendChild(document.createElement('link'))
      canonical.setAttribute('rel', 'canonical')
      canonical.setAttribute('href', `${window.location.origin}${window.location.pathname}`)
    }
    return <View className="web-app-shell">
      <aside className="desktop-sidebar" aria-label="Primary navigation">
        <View className="desktop-brand">{t('appName')}</View>
        <nav className="desktop-nav">
          {nav.map(item => <View key={item.key} className={`desktop-nav-item ${this.state.route.includes(item.url) ? 'active' : ''}`} onClick={() => this.navigate(item.url)}>
            <Text className="desktop-nav-icon" aria-hidden="true">{item.icon}</Text><Text>{t(item.key)}</Text>
          </View>)}
        </nav>
        <label className="locale-control">
          <Text>{t('language')}</Text>
          <select value={this.state.locale} onChange={event => setLocale(event.target.value)} aria-label={t('language')}>
            <option value="zh-CN">简体中文</option><option value="zh-TW">繁體中文</option><option value="en">English</option>
          </select>
        </label>
      </aside>
      <main className="web-main">{this.props.children}</main>
      <View className="mobile-locale-switch" role="group" aria-label={t('language')}>
        {['zh-CN', 'zh-TW', 'en'].map(locale => <button key={locale} className={locale === this.state.locale ? 'active' : ''} onClick={() => setLocale(locale)}>{locale === 'zh-CN' ? '简' : locale === 'zh-TW' ? '繁' : 'EN'}</button>)}
      </View>
    </View>
  }
}
