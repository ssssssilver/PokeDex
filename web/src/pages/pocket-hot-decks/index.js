import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const { getLocale } = require('../../i18n/index.js')
import './index.scss'
const pageCopy = {
  'zh-TW': {
    archetypes: '目前賽制牌組原型', loading: '排行榜載入中', failed: '熱門牌組載入失敗',
    empty: '暫無熱門牌組', decklists: '副牌表', usage: '使用率', winRate: '勝率'
  },
  en: {
    archetypes: 'Current format archetypes', loading: 'Loading rankings', failed: 'Failed to load popular decks',
    empty: 'No popular decks available', decklists: 'deck lists', usage: 'Usage', winRate: 'Win rate'
  }
}
function decorate(deck) {
  return Object.assign({}, deck, {
    shareText: `${Number(deck.share || 0).toFixed(2)}%`,
    winRateText: `${Number(deck.win_rate || 0).toFixed(2)}%`,
    scoreText: `${Number(deck.wins || 0)} - ${Number(
      deck.losses || 0
    )} - ${Number(deck.ties || 0)}`,
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
      .listPocketHotDecks({
        page: 1,
        pageSize: 100,
      })
      .then((result) => {
        this.setData({
          loading: false,
          decks: (result.items || []).map(decorate),
          total: Number(result.total || 0),
        })
      })
      .catch(() =>
        this.setData({
          loading: false,
          error: pageCopy[getLocale()].failed,
        })
      )
  },
  openDeck(event) {
    Taro.navigateTo({
      url: `/pages/pocket-deck-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
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
    const words = pageCopy[getLocale()] || pageCopy.en
    return (
      <View className="page pocket-decks-page">
        <View className="deck-summary">
          <View>
            <Text>{total}</Text>
            <View>{words.archetypes}</View>
          </View>
          <View className="summary-source">LIMITLESS POCKET</View>
        </View>
        <View className="ranking-panel">
          {loading ? (
            <View className="deck-state">{words.loading}</View>
          ) : error ? (
            <View className="deck-state error" onClick={this.retry}>
              {error}
            </View>
          ) : decks?.length ? (
            <View className="ranking-list">
              {decks?.map((item, index) => {
                return (
                  <View
                    key={item.id}
                    className="ranking-row"
                    data-id={item.id}
                    onClick={this.openDeck}
                  >
                    <View className="ranking-number">{item.rank}</View>
                    <View className="ranking-icons">
                      {item.images.map((icon, index) => {
                        return (
                          <Image key={icon} src={icon} mode="aspectFit"></Image>
                        )
                      })}
                    </View>
                    <View className="ranking-copy">
                      <View className="ranking-name">{item.name}</View>
                      <View className="ranking-score">
                        {`${item.scoreText} · ${item.count} ${words.decklists}`}
                      </View>
                    </View>
                    <View className="ranking-metrics">
                      <Text className="strong">{item.shareText}</Text>
                      <Text>{words.usage}</Text>
                      <Text className="strong">{item.winRateText}</Text>
                      <Text>{words.winRate}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          ) : (
            <View className="deck-state">{words.empty}</View>
          )}
        </View>
      </View>
    )
  }
}
export default _C
