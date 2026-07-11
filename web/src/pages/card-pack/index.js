import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, ScrollView, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
import './index.scss'
function markSets(sets, selectedId) {
  return (sets || []).map((set) =>
    Object.assign({}, set, {
      selected: String(set.id) === String(selectedId),
    })
  )
}
function decorateCard(card) {
  return Object.assign({}, card, {
    title: card.display_name || card.name_zh || card.name,
    rarityText: card.rarity_name || card.rarity || '',
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    opening: false,
    setOptions: [],
    selectedSetId: '',
    selectedSet: null,
    pack: null,
    cards: [],
    sourceText: '',
  },
  onLoad() {
    api
      .getPtcgMeta()
      .then((result) => {
        const sets = (
          result.item && result.item.sets ? result.item.sets : []
        ).slice(0, 24)
        const selectedSet = sets[0] || null
        this.setData({
          loading: false,
          selectedSetId: selectedSet ? selectedSet.id : '',
          selectedSet,
          setOptions: markSets(sets, selectedSet ? selectedSet.id : ''),
        })
      })
      .catch(() => {
        this.setData({
          loading: false,
        })
      })
  },
  selectSet(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    const selectedSet =
      this.data.setOptions.find((set) => String(set.id) === String(id)) || null
    this.setData({
      selectedSetId: id,
      selectedSet,
      setOptions: markSets(this.data.setOptions, id),
      pack: null,
      cards: [],
    })
  },
  openPack() {
    if (this.data.opening) return
    this.setData({
      opening: true,
    })
    api
      .openCardPack({
        setId: this.data.selectedSetId,
        count: 10,
      })
      .then((result) => {
        const pack = result.item || null
        this.setData({
          opening: false,
          pack,
          cards: pack ? (pack.cards || []).map(decorateCard) : [],
          sourceText:
            result.source === 'ptcg-cache' ? 'PTCG 自有缓存' : '本地样例',
        })
      })
      .catch(() => {
        this.setData({
          opening: false,
        })
        Taro.showToast({
          title: '抽包失败',
          icon: 'none',
        })
      })
  },
  openCard(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    if (!id) return
    Taro.navigateTo({
      url: `/pages/card-detail/index?id=${encodeURIComponent(id)}`,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { selectedSet, sourceText, setOptions, opening, cards, loading } =
      this.data
    return (
      <View className="page pack-page">
        <View className="pack-header card">
          <View className="pack-copy">
            <View className="muted">每日开包</View>
            <View className="pack-title">
              {selectedSet ? selectedSet.name : '卡牌补充包'}
            </View>
            <View className="pack-sub">
              {selectedSet ? selectedSet.series : sourceText}
            </View>
          </View>
          {selectedSet && (selectedSet.logo || selectedSet.symbol) && (
            <Image
              className="pack-logo"
              src={selectedSet.logo || selectedSet.symbol}
              mode="aspectFit"
            ></Image>
          )}
        </View>
        {setOptions?.length > 0 && (
          <ScrollView scrollX className="set-row">
            {setOptions?.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className={'set-chip ' + (item.selected ? 'selected' : '')}
                  data-id={item.id}
                  onClick={this.selectSet}
                >
                  {(item.symbol || item.logo) && (
                    <Image
                      src={item.symbol || item.logo}
                      mode="aspectFit"
                    ></Image>
                  )}
                  <View>{item.name}</View>
                </View>
              )
            })}
          </ScrollView>
        )}
        <View
          className={'open-button ' + (opening ? 'disabled' : '')}
          onClick={this.openPack}
        >
          {opening ? '开包中' : '开一包'}
        </View>
        {cards?.length ? (
          <View className="pack-result">
            <View className="section-title">
              <Text>本包结果</Text>
              <Text className="muted">{cards?.length + ' 张'}</Text>
            </View>
            <View className="pull-grid">
              {cards?.map((item, index) => {
                return (
                  <View
                    key={item.id}
                    className="pull-card card"
                    data-id={item.id}
                    onClick={this.openCard}
                  >
                    <Image
                      src={item.image}
                      mode="aspectFit"
                      lazyLoad="true"
                    ></Image>
                    <View className="pull-name">{item.title}</View>
                    <View className="pull-meta">{item.rarityText}</View>
                  </View>
                )
              })}
            </View>
          </View>
        ) : (
          !opening &&
          !loading && (
            <View className="card empty-state">
              <View className="title">还没有抽包结果</View>
              <View className="hint">选择一个系列后开一包。</View>
            </View>
          )
        )}
      </View>
    )
  }
}
export default _C
