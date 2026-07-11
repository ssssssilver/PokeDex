import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Input, Text, Image, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { localize } = require('../../i18n/index.js')
import EnergyIcon from '../../components/energy-icon/index'
import './index.scss'
const PAGE_SIZE = 30
const TYPE_META = {
  1: {
    name: '草',
    color: '#2f9e55',
    iconType: 'Grass',
  },
  2: {
    name: '火',
    color: '#df5b45',
    iconType: 'Fire',
  },
  3: {
    name: '水',
    color: '#3d82d7',
    iconType: 'Water',
  },
  4: {
    name: '雷',
    color: '#c89116',
    iconType: 'Lightning',
  },
  5: {
    name: '超',
    color: '#b45088',
    iconType: 'Psychic',
  },
  6: {
    name: '斗',
    color: '#b16d3b',
    iconType: 'Fighting',
  },
  7: {
    name: '恶',
    color: '#4c5563',
    iconType: 'Darkness',
  },
  8: {
    name: '钢',
    color: '#718096',
    iconType: 'Metal',
  },
  9: {
    name: '无色',
    color: '#8a919b',
    iconType: 'Colorless',
  },
}
function optionRows(object) {
  return Object.keys(object || {}).map((id) => ({
    id,
    name: (object[id] || {}).label || id,
  }))
}
function markOptions(items, selected) {
  return (items || []).map((item) =>
    Object.assign({}, item, {
      selected: String(item.id) === String(selected),
    })
  )
}
function activeFilterCount(data) {
  return [
    data.activeExpansion,
    data.activeRarity,
    data.activeType,
    data.activePokemonId,
    data.activeSort && data.activeSort !== 'set' ? data.activeSort : '',
  ].filter(Boolean).length
}
function decorateCard(card, favorites, owned) {
  const collection = (card.collections || [])[0] || {}
  const typeBadges = (card.types || []).map((id) =>
    Object.assign(
      {
        id,
      },
      TYPE_META[id] || TYPE_META[9]
    )
  )
  return Object.assign({}, card, {
    collection,
    title: localize(card),
    subtitle: card.name_en && card.name_en !== card.name_zh ? card.name_en : '',
    setText: [
      collection.expansion_name_zh || collection.expansion_id,
      collection.number ? `#${collection.number}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    metaText: [
      card.rarity,
      card.card_type === 'pokemon' ? '宝可梦' : '训练家',
      card.hp ? `HP ${card.hp}` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    typeBadges,
    favorite: favorites.includes(String(card.id)),
    owned: owned.includes(String(card.id)),
  })
}
cacheOptions.setOptionsToCache({
  searchTimer: null,
  requestId: 0,
  data: {
    keyword: '',
    activeExpansion: '',
    activeRarity: '',
    activeType: '',
    activePokemonId: 0,
    activeSort: 'set',
    draftExpansion: '',
    draftRarity: '',
    draftType: '',
    draftSort: 'set',
    filterVisible: false,
    filterCount: 0,
    cards: [],
    page: 0,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: '',
    expansionOptions: [],
    rarityOptions: [],
    typeOptions: [
      {
        id: 'pokemon',
        name: '宝可梦',
      },
      {
        id: 'trainer',
        name: '训练家',
      },
    ],
    sortOptions: [
      {
        id: 'set',
        name: '系列编号',
      },
      {
        id: 'name',
        name: '名称',
      },
      {
        id: 'number',
        name: '编号',
      },
      {
        id: 'rarity',
        name: '稀有度',
      },
    ],
    filterExpansions: [],
    filterRarities: [],
    filterTypes: [],
    filterSorts: [],
  },
  onLoad() {
    Promise.all([
      api.listPocketExpansions({
        page: 1,
        pageSize: 50,
      }),
      api.getPocketRarities(),
    ]).then(([expansionResult, rarityResult]) => {
      const expansions = (expansionResult.items || []).map((item) => ({
        id: item.id,
        name: item.name_long_zh || item.name_zh || item.id,
        code: item.id,
      }))
      const rarities = optionRows(rarityResult.item || {})
      this.setData({
        expansionOptions: expansions,
        rarityOptions: rarities,
        filterExpansions: markOptions(expansions, this.data.activeExpansion),
        filterRarities: markOptions(rarities, this.data.activeRarity),
        filterTypes: markOptions(this.data.typeOptions, this.data.activeType),
        filterSorts: markOptions(this.data.sortOptions, this.data.activeSort),
      })
    })
  },
  onShow() {
    let keyword = ''
    let pokemonId = 0
    try {
      keyword = Taro.getStorageSync('pokechill:pendingPocketSearch') || ''
      pokemonId = Number(
        Taro.getStorageSync('pokechill:pendingPocketPokemonId') || 0
      )
      if (keyword) Taro.removeStorageSync('pokechill:pendingPocketSearch')
      if (pokemonId) Taro.removeStorageSync('pokechill:pendingPocketPokemonId')
    } catch (error) {
      keyword = ''
      pokemonId = 0
    }
    const next = {
      keyword: keyword || this.data.keyword,
      activePokemonId: pokemonId || this.data.activePokemonId,
    }
    next.filterCount = activeFilterCount(Object.assign({}, this.data, next))
    this.setData(next)
    this.loadCards(true)
  },
  onPullDownRefresh() {
    this.loadCards(true).finally(() => Taro.stopPullDownRefresh())
  },
  onReachBottom() {
    this.loadCards(false)
  },
  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  loadCards(reset) {
    if (
      !reset &&
      (!this.data.hasMore || this.data.loading || this.data.loadingMore)
    )
      return Promise.resolve()
    const page = reset ? 1 : this.data.page + 1
    const requestId = ++this.requestId
    this.setData(
      reset
        ? {
            loading: true,
            error: '',
            page: 0,
            hasMore: false,
          }
        : {
            loadingMore: true,
          }
    )
    return api
      .listPocketCards({
        keyword: String(this.data.keyword || '').trim(),
        expansion: this.data.activeExpansion,
        rarity: this.data.activeRarity,
        type: this.data.activeType,
        pokemonId: this.data.activePokemonId || '',
        sort: this.data.activeSort,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((result) => {
        if (requestId !== this.requestId) return
        const favorites = storage.getPocketFavorites()
        const owned = storage.getPocketOwned()
        const rows = (result.items || []).map((card) =>
          decorateCard(card, favorites, owned)
        )
        this.setData({
          loading: false,
          loadingMore: false,
          cards: reset ? rows : this.data.cards.concat(rows),
          page: Number(result.page || page),
          total: Number(result.total || rows.length),
          hasMore: Boolean(result.hasMore),
        })
      })
      .catch(() => {
        if (requestId !== this.requestId) return
        this.setData({
          loading: false,
          loadingMore: false,
          cards: reset ? [] : this.data.cards,
          error: '卡牌加载失败，点击重试',
        })
      })
  },
  scheduleLoad() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.loadCards(true), 260)
  },
  onKeywordInput(event) {
    const next = {
      keyword: event.detail.value,
      activePokemonId: 0,
    }
    next.filterCount = activeFilterCount(Object.assign({}, this.data, next))
    this.setData(next)
    this.scheduleLoad()
  },
  submitSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.loadCards(true)
  },
  openFilter() {
    this.setData({
      filterVisible: true,
      draftExpansion: this.data.activeExpansion,
      draftRarity: this.data.activeRarity,
      draftType: this.data.activeType,
      draftSort: this.data.activeSort,
      filterExpansions: markOptions(
        this.data.expansionOptions,
        this.data.activeExpansion
      ),
      filterRarities: markOptions(
        this.data.rarityOptions,
        this.data.activeRarity
      ),
      filterTypes: markOptions(this.data.typeOptions, this.data.activeType),
      filterSorts: markOptions(this.data.sortOptions, this.data.activeSort),
    })
  },
  closeFilter() {
    this.setData({
      filterVisible: false,
    })
  },
  stopTap() {},
  selectDraft(event) {
    const field = getTarget(event.currentTarget, Taro).dataset.field
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    const dataField = `draft${field}`
    const isSort = field === 'Sort'
    const next = isSort ? id : this.data[dataField] === id ? '' : id
    const sources = {
      Expansion: this.data.expansionOptions,
      Rarity: this.data.rarityOptions,
      Type: this.data.typeOptions,
      Sort: this.data.sortOptions,
    }
    const lists = {
      Expansion: 'filterExpansions',
      Rarity: 'filterRarities',
      Type: 'filterTypes',
      Sort: 'filterSorts',
    }
    this.setData({
      [dataField]: next,
      [lists[field]]: markOptions(sources[field], next),
    })
  },
  clearDraft() {
    this.setData({
      draftExpansion: '',
      draftRarity: '',
      draftType: '',
      draftSort: 'set',
      filterExpansions: markOptions(this.data.expansionOptions, ''),
      filterRarities: markOptions(this.data.rarityOptions, ''),
      filterTypes: markOptions(this.data.typeOptions, ''),
      filterSorts: markOptions(this.data.sortOptions, 'set'),
    })
  },
  confirmFilter() {
    const next = {
      activeExpansion: this.data.draftExpansion,
      activeRarity: this.data.draftRarity,
      activeType: this.data.draftType,
      activeSort: this.data.draftSort,
      filterVisible: false,
    }
    next.filterCount = activeFilterCount(Object.assign({}, this.data, next))
    this.setData(next)
    this.loadCards(true)
  },
  resetFilters() {
    this.setData({
      activeExpansion: '',
      activeRarity: '',
      activeType: '',
      activePokemonId: 0,
      activeSort: 'set',
      draftExpansion: '',
      draftRarity: '',
      draftType: '',
      draftSort: 'set',
      filterCount: 0,
    })
    this.loadCards(true)
  },
  openCard(event) {
    Taro.navigateTo({
      url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
      )}`,
    })
  },
  toggleFavorite(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    const favorite = storage.togglePocketFavorite(id)
    const favorites = storage.getPocketFavorites()
    this.setData({
      cards: this.data.cards.map((card) =>
        Object.assign({}, card, {
          favorite:
            card.id === id ? favorite : favorites.includes(String(card.id)),
        })
      ),
    })
  },
  toggleOwned(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    const ownedState = storage.togglePocketOwned(id)
    const owned = storage.getPocketOwned()
    this.setData({
      cards: this.data.cards.map((card) =>
        Object.assign({}, card, {
          owned: card.id === id ? ownedState : owned.includes(String(card.id)),
        })
      ),
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      keyword,
      filterCount,
      activePokemonId,
      activeType,
      activeExpansion,
      activeRarity,
      activeSort,
      cards,
      total,
      loading,
      error,
      loadingMore,
      hasMore,
      filterVisible,
      filterTypes,
      filterExpansions,
      filterRarities,
      filterSorts,
    } = this.data
    return (
      <View className="page carddex-page">
        <View className="search-row">
          <View className="search-box search-inline">
            <Input
              value={keyword}
              onInput={this.onKeywordInput}
              onConfirm={this.submitSearch}
              confirmType="search"
              placeholder="搜索卡牌、宝可梦、扩展包、编号或画师"
            ></Input>
          </View>
          <View
            className={'filter-trigger ' + (filterCount ? 'active' : '')}
            onClick={this.openFilter}
          >
            <Text>筛选</Text>
            {filterCount > 0 && <Text className="filter-count">{filterCount}</Text>}
          </View>
        </View>
        {filterCount > 0 && (
          <View className="applied-row">
            {activePokemonId && (
              <View className="applied-chip">{'关联 #' + activePokemonId}</View>
            )}
            {activeType && (
              <View className="applied-chip">
                {activeType === 'pokemon' ? '宝可梦' : '训练家'}
              </View>
            )}
            {activeExpansion && (
              <View className="applied-chip">{activeExpansion}</View>
            )}
            {activeRarity && (
              <View className="applied-chip">{activeRarity}</View>
            )}
            {activeSort !== 'set' && (
              <View className="applied-chip">已排序</View>
            )}
            <View className="applied-reset" onClick={this.resetFilters}>
              重置
            </View>
          </View>
        )}
        <View className="result-meta">
          <Text>{cards?.length + ' / ' + total + ' 张卡牌'}</Text>
          <Text className="muted">Pocket 数据</Text>
        </View>
        {loading && !cards?.length ? (
          <View className="card loading-state">Pocket 图鉴加载中</View>
        ) : error && !cards?.length ? (
          <View className="card empty-state" onClick={this.submitSearch}>
            <View className="title">{error}</View>
          </View>
        ) : cards?.length ? (
          <View className="card-list">
            {cards?.map((item, index) => {
              return (
                <View key={item.id} className="card-row card">
                  <View
                    className="row-main"
                    data-id={item.id}
                    onClick={this.openCard}
                  >
                    <View className="card-art-wrap">
                      {item.image ? (
                        <Image
                          src={item.image}
                          mode="aspectFit"
                          lazyLoad="true"
                        ></Image>
                      ) : (
                        <View className="card-art-empty">CARD</View>
                      )}
                    </View>
                    <View className="row-copy">
                      <View className="row-topline">
                        <Text className="set-number">
                          {item.collection.expansion_id +
                            ' #' +
                            item.collection.number}
                        </Text>
                        {item.is_ex && (
                          <Text className="regulation-pill">ex</Text>
                        )}
                      </View>
                      <View className="row-name">{item.title}</View>
                      {item.subtitle && (
                        <View className="row-subtitle">{item.subtitle}</View>
                      )}
                      <View className="row-facts">
                        <Text>{item.setText}</Text>
                        {item.metaText && <Text>{item.metaText}</Text>}
                      </View>
                      {item.typeBadges.length > 0 && (
                        <View className="energy-row">
                          {item.typeBadges.map((item, index) => {
                            return (
                              <EnergyIcon
                                key={item.id}
                                type={item.iconType}
                                label={item.name + '能量'}
                              ></EnergyIcon>
                            )
                          })}
                        </View>
                      )}
                    </View>
                  </View>
                  <View className="row-actions">
                    <View
                      className={
                        'mini-action ' + (item.favorite ? 'active' : '')
                      }
                      data-id={item.id}
                      onClick={this.toggleFavorite}
                    >
                      {item.favorite ? '★' : '☆'}
                    </View>
                    <View
                      className={'mini-owned ' + (item.owned ? 'active' : '')}
                      data-id={item.id}
                      onClick={this.toggleOwned}
                    >
                      {item.owned ? '有' : '收'}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className="card empty-state">
            <View className="title">没有找到卡牌</View>
            <View className="hint">换个名称、扩展包、编号或稀有度试试。</View>
          </View>
        )}
        {loadingMore ? (
          <View className="load-more-state">继续加载中</View>
        ) : (
          cards?.length &&
          !hasMore && <View className="load-more-state">已加载全部</View>
        )}
        {filterVisible && (
          <View className="filter-mask" onClick={this.closeFilter}></View>
        )}
        {filterVisible && (
          <View className="filter-panel" onClick={this.stopTap}>
            <View className="filter-panel-head">
              <View className="filter-panel-title">Pocket 卡牌筛选</View>
              <View className="filter-close" onClick={this.closeFilter}>
                关闭
              </View>
            </View>
            <ScrollView scrollY className="filter-panel-body">
              <View className="filter-section-title">卡牌大类</View>
              <View className="filter-grid two-grid">
                {filterTypes?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-field="Type"
                      data-id={item.id}
                      onClick={this.selectDraft}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">扩展包</View>
              <View className="filter-grid two-grid">
                {filterExpansions?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option pocket-set-option ' +
                        (item.selected ? 'selected' : '')
                      }
                      data-field="Expansion"
                      data-id={item.id}
                      onClick={this.selectDraft}
                    >
                      <Text>{item.code}</Text>
                      <View>{item.name}</View>
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">稀有度</View>
              <View className="filter-grid three-grid">
                {filterRarities?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-field="Rarity"
                      data-id={item.id}
                      onClick={this.selectDraft}
                    >
                      {item.id}
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">排序</View>
              <View className="filter-grid two-grid">
                {filterSorts?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-field="Sort"
                      data-id={item.id}
                      onClick={this.selectDraft}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
            </ScrollView>
            <View className="filter-actions">
              <View className="filter-clear" onClick={this.clearDraft}>
                清空
              </View>
              <View className="filter-confirm" onClick={this.confirmFilter}>
                确定
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
