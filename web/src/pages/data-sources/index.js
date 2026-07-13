import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const { getLocale, t } = require('../../i18n/index.js')
import './index.scss'

const COPY = {
  'zh-TW': {
    title: '資料來源與聲明', subtitle: '目前公開資料的來源、狀態與使用界線',
    active: '使用中', inactive: '未啟用', healthy: '資料可用', unavailable: '狀態未知',
    policy: '使用政策', policyText: '本站免費使用並可能包含廣告或贊助。實體卡只有可確認的官方簡體中文版才顯示中文；其他卡牌保留英文。繁體中文採用台灣官方術語。',
    rights: '版權聲明', rightsText: 'Pokémon 名稱、角色、卡圖及遊戲素材的權利歸各自權利人所有。本站是非官方資料工具，與 Nintendo、The Pokémon Company、Creatures 或 DeNA 無隸屬或贊助關係。',
    source: '來源', license: '授權/條款', revision: '固定版本'
  },
  en: {
    title: 'Data Sources & Notices', subtitle: 'Sources, status, and usage boundaries for published data',
    active: 'Active', inactive: 'Disabled', healthy: 'Available', unavailable: 'Unknown',
    policy: 'Usage policy', policyText: 'The site is free to use and may contain advertising or sponsorship. Physical cards use Chinese only when an official Simplified Chinese edition is verified; otherwise the original English is retained. Traditional Chinese follows official Taiwan terminology.',
    rights: 'Copyright notice', rightsText: 'Pokémon names, characters, card artwork, and game assets belong to their respective rights holders. This is an unofficial reference tool and is not affiliated with or sponsored by Nintendo, The Pokémon Company, Creatures, or DeNA.',
    source: 'Source', license: 'License / terms', revision: 'Pinned revision'
  }
}

function productHealth(health, product) {
  const value = health && health.products && health.products[product]
  if (!value) return false
  if (product === 'pocket') return Boolean(value.counts && value.counts.cards)
  return Boolean(value.item ? value.item.cacheReady !== false : value.cacheReady !== false)
}

cacheOptions.setOptionsToCache({
  data: { loading: true, error: '', sources: [], health: null },
  onLoad() {
    const copy = COPY[getLocale()] || COPY['zh-TW']
    Taro.setNavigationBarTitle({ title: copy.title }).then(() => {
      if (typeof document !== 'undefined') document.title = `${copy.title} | ${t('appName')}`
    })
    Promise.all([api.getDataSources(), api.getDataHealth()])
      .then(([sources, health]) => this.setData({ loading: false, sources: sources.items || [], health }))
      .catch(() => this.setData({ loading: false, error: 'load-failed' }))
  }
})

@withWeapp(cacheOptions.getOptionsFromCache())
class DataSourcesPage extends React.Component {
  render() {
    const locale = getLocale()
    const copy = COPY[locale] || COPY['zh-TW']
    const grouped = ['pokedex', 'ptcg', 'pocket'].map(product => ({
      product,
      healthy: productHealth(this.data.health, product),
      items: (this.data.sources || []).filter(source => source.product === product)
    }))
    const productNames = locale === 'en'
      ? { pokedex: 'Pokédex', ptcg: 'TCG', pocket: 'Pokémon TCG Pocket' }
      : { pokedex: '寶可夢圖鑑', ptcg: '實體卡牌', pocket: 'Pokémon TCG Pocket' }
    return <View className="page data-sources-page">
      <View className="source-heading"><View className="source-title">{copy.title}</View><Text>{copy.subtitle}</Text></View>
      {this.data.error ? <View className="source-empty">{copy.unavailable}</View> : grouped.map(group => <View className="source-section" key={group.product}>
        <View className="source-section-head"><View>{productNames[group.product]}</View><Text className={group.healthy ? 'healthy' : ''}>{group.healthy ? copy.healthy : copy.unavailable}</Text></View>
        {group.items.map(item => <View className="source-row" key={item.id}>
          <View className="source-main"><View className="source-name">{item.id}</View><Text>{copy.source}: {item.url}</Text><Text>{copy.license}: {item.license}</Text>{item.revision ? <Text>{copy.revision}: {item.revision.slice(0, 12)}</Text> : null}</View>
          <View className={item.enabled ? 'source-state enabled' : 'source-state'}>{item.enabled ? copy.active : copy.inactive}</View>
        </View>)}
      </View>)}
      <View className="notice-section"><View>{copy.policy}</View><Text>{copy.policyText}</Text></View>
      <View className="notice-section"><View>{copy.rights}</View><Text>{copy.rightsText}</Text></View>
    </View>
  }
}

export default DataSourcesPage
