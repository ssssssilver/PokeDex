import React from 'react'
import { View, Text, Button } from '@tarojs/components'
import { getLocale } from '../../i18n'
import config from '../../config'
import './index.scss'

const copy = {
  'zh-TW': {
    title: '贊助本站', intro: '寶批小站免費提供圖鑑、卡牌與 Pocket 工具。贊助將用於資料更新、伺服器與持續開發。',
    principle: '贊助不會影響牌組排名、資料結論或內容展示。', action: '聯絡贊助', unavailable: '贊助連結尚未設定'
  },
  en: {
    title: 'Sponsor PokeChill', intro: 'PokeChill keeps its Pokédex, TCG, and Pocket tools free. Sponsorship supports data updates, hosting, and continued development.',
    principle: 'Sponsorship never influences deck rankings, data conclusions, or editorial placement.', action: 'Sponsor inquiry', unavailable: 'A sponsorship link has not been configured yet'
  }
}

export default function SponsorPage() {
  const locale = getLocale()
  const words = copy[locale] || copy.en
  const openSponsor = () => {
    if (config.sponsorUrl) window.open(config.sponsorUrl, '_blank', 'noopener,noreferrer')
    else if (config.sponsorContact) window.location.href = `mailto:${config.sponsorContact}?subject=${encodeURIComponent('PokeChill Sponsorship')}`
  }
  return <View className="page sponsor-page">
    <View className="sponsor-panel">
      <Text className="sponsor-mark" aria-hidden="true">♡</Text>
      <View className="sponsor-title">{words.title}</View>
      <View className="sponsor-intro">{words.intro}</View>
      <View className="sponsor-principle">{words.principle}</View>
      <Button className="button-primary sponsor-action" onClick={openSponsor}>{config.sponsorUrl || config.sponsorContact ? words.action : words.unavailable}</Button>
    </View>
  </View>
}
