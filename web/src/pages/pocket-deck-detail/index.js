import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const { getLocale, localize } = require('../../i18n/index.js')
import './index.scss'
function decorate(item) {
  const source = item || {}
  return Object.assign({}, source, {
    shareText: source.archetype
      ? `${Number(source.archetype.share || 0).toFixed(2)}%`
      : '',
    winRateText: source.archetype
      ? `${Number(source.archetype.win_rate || 0).toFixed(2)}%`
      : '',
    resultText: source.representative
      ? [
          source.representative.player,
          source.representative.place
            ? getLocale() === 'en' ? `Place ${source.representative.place}` : `第 ${source.representative.place} 名`
            : '',
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
    cards: (source.cards || []).map((card) =>
      Object.assign({}, card, {
        displayName: localize(card) || card.name,
        setText: `${card.set || ''} #${card.number || ''}`,
      })
    ),
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    error: '',
    deck: null,
  },
  onLoad(options) {
    this.deckId = decodeURIComponent(options.id || '')
    this.loadDeck()
  },
  loadDeck() {
    this.setData({
      loading: true,
      error: '',
    })
    api
      .getPocketHotDeck(this.deckId)
      .then((result) => {
        if (!result.item) throw new Error('卡组不存在')
        const deck = decorate(result.item)
        this.setData({
          loading: false,
          deck,
        })
        Taro.setNavigationBarTitle({
          title: deck.name || 'Pocket 卡组详情',
        })
      })
      .catch((error) =>
        this.setData({
          loading: false,
          error: error.message || '卡组详情加载失败',
        })
      )
  },
  copyDeck() {
    const text = this.data.deck && this.data.deck.copy_text
    if (!text) return
    Taro.setClipboardData({
      data: text,
      success: () =>
        Taro.showToast({
          title: '牌表已复制',
          icon: 'success',
        }),
    })
  },
  openCard(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    if (id)
      Taro.navigateTo({
        url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(id)}`,
      })
  },
  previewCard(event) {
    const current = getTarget(event.currentTarget, Taro).dataset.src
    const urls = (this.data.deck.cards || [])
      .map((card) => card.image)
      .filter(Boolean)
    if (current)
      Taro.previewImage({
        current,
        urls,
      })
  },
  retry() {
    this.loadDeck()
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { loading, error, deck } = this.data
    return (
      <View className="page pocket-deck-detail">
        {loading ? (
          <View className="detail-state">赛事牌表加载中</View>
        ) : error ? (
          <View className="detail-state error" onClick={this.retry}>
            {error}
          </View>
        ) : (
          deck && (
            <Block>
              <View className="deck-head">
                <View className="deck-rank">
                  {'#' + (deck.archetype.rank || '-')}
                </View>
                {deck.archetype.images && deck.archetype.images.length > 0 && (
                  <View className="deck-main-icons">
                    {deck.archetype.images.map((item, index) => {
                      return (
                        <Image key={item} src={item} mode="aspectFit"></Image>
                      )
                    })}
                  </View>
                )}
                <View className="deck-head-copy">
                  <View className="deck-title">{deck.name}</View>
                  <View className="deck-sub">{deck.resultText}</View>
                </View>
                <View className="deck-energy">
                  <Text>能量</Text>
                  <Text className="strong">{deck.energy}</Text>
                </View>
              </View>
              <View className="deck-metrics">
                <View>
                  <Text className="strong">{deck.total_cards}</Text>
                  <Text>卡牌总数</Text>
                </View>
                <View>
                  <Text className="strong">{deck.shareText}</Text>
                  <Text>使用率</Text>
                </View>
                <View>
                  <Text className="strong">{deck.winRateText}</Text>
                  <Text>胜率</Text>
                </View>
              </View>
              <View className="section-title">
                <Text>完整牌表</Text>
                <Text className="muted">{deck.cards.length + ' 种'}</Text>
              </View>
              <View className="deck-card-grid">
                {deck.cards.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="deck-card"
                      data-id={item.id}
                      onClick={this.openCard}
                    >
                      <View
                        className="deck-card-art"
                        data-src={item.image}
                        onClick={this.previewCard}
                      >
                        <Image src={item.image} mode="aspectFit"></Image>
                      </View>
                      <View className="count-badge">{'×' + item.count}</View>
                      <View className="deck-card-name">{item.displayName}</View>
                      <View className="deck-card-set">{item.setText}</View>
                    </View>
                  )
                })}
              </View>
              <View className="source-line">
                <Text>{deck.representative.tournament}</Text>
                <Text>Limitless Pocket</Text>
              </View>
            </Block>
          )
        )}
        {deck && (
          <View className="copy-bar" onClick={this.copyDeck}>
            复制完整牌表
          </View>
        )}
      </View>
    )
  }
}
export default _C
