import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Text, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const { getLocale, localize } = require('../../i18n/index.js')
import './index.scss'
function selectRows(items, id) {
  return (items || []).map((item) =>
    Object.assign({}, item, {
      selected: item.id === id,
    })
  )
}
function decorateCard(card) {
  const collection = (card.collections || [])[0] || {}
  return Object.assign({}, card, {
    title: localize(card),
    setText: `${collection.expansion_id || ''} #${collection.number || ''}`,
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    opening: false,
    error: '',
    packs: [],
    selectedPack: null,
    result: null,
    cards: [],
  },
  onLoad() {
    api
      .listPocketPacks({
        page: 1,
        pageSize: 100,
      })
      .then((result) => {
        const formal = (result.items || []).filter(
          (pack) => pack.is_regular && pack.name_zh
        )
        const packs = formal.length
          ? formal
          : (result.items || []).filter((pack) => pack.name_zh)
        const selectedPack = packs[0] || null
        this.setData({
          loading: false,
          selectedPack,
          packs: selectRows(packs, selectedPack && selectedPack.id),
        })
      })
      .catch(() =>
        this.setData({
          loading: false,
          error: '卡包加载失败',
        })
      )
  },
  selectPack(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    const selectedPack = this.data.packs.find((pack) => pack.id === id) || null
    this.setData({
      selectedPack,
      packs: selectRows(this.data.packs, id),
      result: null,
      cards: [],
    })
  },
  openPack() {
    if (this.data.opening || !this.data.selectedPack) return
    this.setData({
      opening: true,
      error: '',
    })
    api
      .openPocketPack({
        packId: this.data.selectedPack.id,
      })
      .then((response) => {
        const result = response.item
        this.setData({
          opening: false,
          result,
          cards: result ? (result.cards || []).map(decorateCard) : [],
        })
      })
      .catch(() =>
        this.setData({
          opening: false,
          error: '开包失败，请重试',
        })
      )
  },
  openCard(event) {
    Taro.navigateTo({
      url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
      )}`,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { selectedPack, packs, loading, error, cards, opening, result } =
      this.data
    return (
      <View className="page pocket-pack-page">
        {selectedPack && (
          <View className="pack-head">
            <View className="pack-identity">
              {selectedPack.image && (
                <Image
                  className="pack-cover"
                  src={selectedPack.image}
                  mode="aspectFit"
                ></Image>
              )}
              <View className="pack-copy">
                <View className="pack-series">{selectedPack.expansion_id}</View>
                <View className="pack-title">{localize(selectedPack)}</View>
                <View className="pack-desc">{getLocale() === 'en' ? selectedPack.description_en : selectedPack.description_zh}</View>
              </View>
            </View>
            <View className="pack-stats">
              <View>
                <Text className="strong">{selectedPack.card_ids.length}</Text>
                <Text>卡池</Text>
              </View>
              <View>
                <Text className="strong">{selectedPack.is_promo ? 1 : 5}</Text>
                <Text>每包张数</Text>
              </View>
              <View>
                <Text className="strong">{selectedPack.is_promo ? '等概率' : '0.05%'}</Text>
                <Text>{selectedPack.is_promo ? '抽取规则' : '稀有包'}</Text>
              </View>
            </View>
          </View>
        )}
        {packs?.length > 0 && (
          <ScrollView scrollX className="pack-options">
            {packs?.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className={'pack-option ' + (item.selected ? 'selected' : '')}
                  data-id={item.id}
                  onClick={this.selectPack}
                >
                  {item.image && (
                    <Image src={item.image} mode="aspectFit"></Image>
                  )}
                  <View className="pack-option-copy">
                    <Text>{item.expansion_id}</Text>
                    <View>{localize(item)}</View>
                  </View>
                </View>
              )
            })}
          </ScrollView>
        )}
        {loading ? (
          <View className="pack-state">卡包加载中</View>
        ) : error && !cards?.length ? (
          <View className="pack-state error">{error}</View>
        ) : (
          selectedPack && (
            <View
              className={'open-command ' + (opening ? 'disabled' : '')}
              onClick={this.openPack}
            >
              {opening ? '开包中' : '开一包'}
            </View>
          )
        )}
        {result && (
          <View className="result-head">
            <View>
              <Text>
                {result.is_promo
                  ? '特典包 · 等概率'
                  : result.is_rare_pack
                  ? '稀有包'
                  : '普通包'}
              </Text>
              <Text className="strong">{result.pack_type}</Text>
            </View>
            <View>{result.count + ' 张'}</View>
          </View>
        )}
        {cards?.length ? (
          <View className="pull-grid">
            {cards?.map((item, index) => {
              return (
                <View
                  key={item.slot}
                  className="pull-card"
                  data-id={item.id}
                  onClick={this.openCard}
                >
                  <View className="slot-number">{item.slot}</View>
                  <View className="pull-art">
                    <Image src={item.image} mode="aspectFit"></Image>
                  </View>
                  <View className="pull-name">{item.title}</View>
                  <View className="pull-meta">
                    {item.setText + ' · ' + item.rarity}
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          !loading &&
          !opening &&
          !error && <View className="pack-state">尚未开包</View>
        )}
      </View>
    )
  }
}
export default _C
