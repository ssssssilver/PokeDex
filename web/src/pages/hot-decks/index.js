import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
import './index.scss'
function decorate(deck) {
  return Object.assign({}, deck, {
    shareText: deck.share || `${Number(deck.share_value || 0).toFixed(2)}%`,
    pointsText: `${Number(deck.points || 0)} 分`,
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    error: '',
    decks: [],
    total: 0,
  },
  onLoad() {
    this.loadDecks()
  },
  onPullDownRefresh() {
    this.loadDecks().finally(() => Taro.stopPullDownRefresh())
  },
  loadDecks() {
    this.setData({
      loading: true,
      error: '',
    })
    return api
      .getHotDecks({
        limit: 100,
      })
      .then((result) => {
        const decks = (result.items || []).map(decorate)
        this.setData({
          loading: false,
          decks,
          total: decks.length,
        })
      })
      .catch(() =>
        this.setData({
          loading: false,
          error: '热门卡组加载失败',
        })
      )
  },
  openDeck(event) {
    const deck = getTarget(event.currentTarget, Taro).dataset || {}
    Taro.navigateTo({
      url: `/pages/deck-detail/index?url=${encodeURIComponent(
        deck.url || ''
      )}&name=${encodeURIComponent(deck.name || '')}&rank=${
        deck.rank || ''
      }&points=${deck.points || ''}&share=${encodeURIComponent(
        deck.share || ''
      )}`,
    })
  },
  retry() {
    this.loadDecks()
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { total, loading, error, decks } = this.data
    return (
      <View className="page hot-decks-page">
        <View className="deck-summary">
          <View>
            <Text>{total}</Text>
            <View>当前环境卡组原型</View>
          </View>
          <View className="summary-source">LIMITLESS TCG</View>
        </View>
        <View className="ranking-panel">
          {loading ? (
            <View className="deck-state">排行榜加载中</View>
          ) : error ? (
            <View className="deck-state error" onClick={this.retry}>
              {error}
            </View>
          ) : decks?.length ? (
            <View className="ranking-list">
              {decks?.map((item, index) => {
                return (
                  <View
                    key={item.rank}
                    className="ranking-row"
                    data-url={item.url}
                    data-name={item.name}
                    data-rank={item.rank}
                    data-points={item.points}
                    data-share={item.share}
                    onClick={this.openDeck}
                  >
                    <View className="ranking-number">{item.rank}</View>
                    <View className="ranking-icons">
                      {item.images.map((icon, index) => {
                        return (
                          <Image
                            key={icon.src}
                            src={icon.src}
                            mode="aspectFit"
                          ></Image>
                        )
                      })}
                    </View>
                    <View className="ranking-copy">
                      <View className="ranking-name">{item.name}</View>
                      <View className="ranking-points">{item.pointsText}</View>
                    </View>
                    <View className="ranking-share">
                      <View>{item.shareText}</View>
                      <Text>环境占比</Text>
                    </View>
                    <View className="ranking-arrow">›</View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View className="deck-state">暂无热门卡组</View>
          )}
        </View>
      </View>
    )
  }
}
export default _C
