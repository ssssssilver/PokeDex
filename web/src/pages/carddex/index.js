import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Input, Text, Image, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { getLocale, localize } = require('../../i18n/index.js')
import EnergyIcon from '../../components/energy-icon/index'
import './index.scss'
const PAGE_SIZE = 30
function sourceText(source) {
  if (source === 'ptcg-cache') return 'PTCG 自有缓存'
  if (source === 'local-card-seed') return '本地样例'
  if (source === 'empty-cache') return '等待同步'
  return '卡牌数据'
}
function resultCountText(loaded, total) {
  if (!total) return `${loaded} 张卡牌`
  return `${loaded} / ${total} 张卡牌`
}
function markOptions(options, selectedId) {
  return (options || []).map((item) =>
    Object.assign({}, item, {
      selected: String(item.id) === String(selectedId),
    })
  )
}
function filterCount(data) {
  return (
    (data.activeSupertype ? 1 : 0) +
    (data.activeType ? 1 : 0) +
    (data.activeSetId ? 1 : 0) +
    (data.activeRarity ? 1 : 0) +
    (data.activeSort && data.activeSort !== 'releaseDate' ? 1 : 0) +
    (data.activePokemonId ? 1 : 0)
  )
}
function decorateRow(card, favorites, owned) {
  const english = getLocale() === 'en'
  const typeText = (english ? card.types : card.type_names || card.types || []).join(' / ')
  const subtypeText = (english ? card.subtypes : card.subtype_names || card.subtypes || []).slice(0, 2).join(' / ')
  return Object.assign(
    {
      type_energy: [],
    },
    card,
    {
      title: localize(card) || card.display_name,
      subtitle: !english && card.name_zh && card.name_zh !== card.name ? card.name : '',
      setText: [card.set_name, card.number ? `#${card.number}` : '']
        .filter(Boolean)
        .join(' · '),
      metaText: [
        english ? card.rarity : card.rarity_name || card.rarity,
        english ? card.supertype : card.supertype_name || card.supertype,
        subtypeText,
      ]
        .filter(Boolean)
        .join(' · '),
      typeText,
      favorite: favorites.includes(String(card.id)),
      owned: owned.includes(String(card.id)),
    }
  )
}
cacheOptions.setOptionsToCache({
  searchTimer: null,
  requestId: 0,
  data: {
    keyword: '',
    activeSupertype: '',
    activeType: '',
    activeSetId: '',
    activeRarity: '',
    activeSort: 'releaseDate',
    activePokemonId: 0,
    draftSupertype: '',
    draftType: '',
    draftSetId: '',
    draftRarity: '',
    draftSort: 'releaseDate',
    filterVisible: false,
    activeFilterCount: 0,
    sourceText: '',
    resultCountText: '0 张卡牌',
    cards: [],
    favorites: [],
    owned: [],
    page: 0,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    supertypeOptions: [],
    typeOptions: [],
    setOptions: [],
    rarityOptions: [],
    sortOptions: [
      {
        id: 'releaseDate',
        name: '最新',
      },
      {
        id: 'releaseDateAsc',
        name: '最早',
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
    filterSupertypes: [],
    filterTypes: [],
    filterSets: [],
    filterRarities: [],
    filterSorts: [],
  },
  onLoad() {
    api.getPtcgMeta().then((result) => {
      const meta = result.item || {}
      this.setData({
        supertypeOptions: meta.supertypes || [],
        typeOptions: meta.types || [],
        setOptions: (meta.sets || []).slice(0, 80),
        rarityOptions: meta.rarities || [],
        filterSupertypes: markOptions(
          meta.supertypes || [],
          this.data.draftSupertype
        ),
        filterTypes: markOptions(meta.types || [], this.data.draftType),
        filterSets: markOptions(
          (meta.sets || []).slice(0, 80),
          this.data.draftSetId
        ),
        filterRarities: markOptions(meta.rarities || [], this.data.draftRarity),
        filterSorts: markOptions(this.data.sortOptions, this.data.draftSort),
      })
    })
  },
  onShow() {
    let pendingSearch = ''
    let pendingPokemonId = 0
    try {
      pendingSearch = Taro.getStorageSync('pokechill:pendingCardSearch') || ''
      pendingPokemonId = Number(
        Taro.getStorageSync('pokechill:pendingCardPokemonId') || 0
      )
      if (pendingSearch) Taro.removeStorageSync('pokechill:pendingCardSearch')
      if (pendingPokemonId)
        Taro.removeStorageSync('pokechill:pendingCardPokemonId')
    } catch (error) {
      pendingSearch = ''
      pendingPokemonId = 0
    }
    const next = {
      keyword: pendingSearch || this.data.keyword,
      activePokemonId: pendingPokemonId || this.data.activePokemonId,
      favorites: storage.getCardFavorites(),
      owned: storage.getOwnedCards(),
    }
    next.activeFilterCount = filterCount(Object.assign({}, this.data, next))
    this.setData(next)
    this.loadCards(true)
  },
  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
  },
  onReachBottom() {
    this.loadCards(false)
  },
  loadCards(reset) {
    if (
      !reset &&
      (!this.data.hasMore || this.data.loadingMore || this.data.loading)
    )
      return Promise.resolve()
    const targetPage = reset ? 1 : this.data.page + 1
    const requestId = this.requestId + 1
    this.requestId = requestId
    this.setData(
      reset
        ? {
            loading: true,
            loadingMore: false,
            page: 0,
            hasMore: false,
          }
        : {
            loadingMore: true,
          }
    )
    return api
      .listCards({
        keyword: this.data.keyword,
        supertype: this.data.activeSupertype,
        type: this.data.activeType,
        setId: this.data.activeSetId,
        rarity: this.data.activeRarity,
        sort: this.data.activeSort,
        pokemonId: this.data.activePokemonId || '',
        page: targetPage,
        pageSize: this.data.pageSize,
      })
      .then((result) => {
        if (requestId !== this.requestId) return
        const favorites = storage.getCardFavorites()
        const owned = storage.getOwnedCards()
        const rows = (result.items || []).map((item) =>
          decorateRow(item, favorites, owned)
        )
        const cards = reset ? rows : this.data.cards.concat(rows)
        const total = Number(result.total || cards.length)
        this.setData({
          loading: false,
          loadingMore: false,
          favorites,
          owned,
          cards,
          total,
          page: Number(result.page || targetPage),
          hasMore: Boolean(result.hasMore),
          sourceText: sourceText(result.source),
          resultCountText: resultCountText(cards.length, total),
        })
      })
      .catch(() => {
        if (requestId !== this.requestId) return
        this.setData({
          loading: false,
          loadingMore: false,
          cards: reset ? [] : this.data.cards,
          sourceText: '加载失败',
          resultCountText: reset ? '0 张卡牌' : this.data.resultCountText,
        })
      })
  },
  scheduleLoad() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => this.loadCards(true), 250)
  },
  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value,
    })
    this.scheduleLoad()
  },
  submitSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.loadCards(true)
  },
  openFilter() {
    this.setData({
      filterVisible: true,
      draftSupertype: this.data.activeSupertype,
      draftType: this.data.activeType,
      draftSetId: this.data.activeSetId,
      draftRarity: this.data.activeRarity,
      draftSort: this.data.activeSort,
      filterSupertypes: markOptions(
        this.data.supertypeOptions,
        this.data.activeSupertype
      ),
      filterTypes: markOptions(this.data.typeOptions, this.data.activeType),
      filterSets: markOptions(this.data.setOptions, this.data.activeSetId),
      filterRarities: markOptions(
        this.data.rarityOptions,
        this.data.activeRarity
      ),
      filterSorts: markOptions(this.data.sortOptions, this.data.activeSort),
    })
  },
  closeFilter() {
    this.setData({
      filterVisible: false,
    })
  },
  stopTap() {},
  selectDraftSupertype(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    this.setData({
      draftSupertype: this.data.draftSupertype === id ? '' : id,
      filterSupertypes: markOptions(
        this.data.supertypeOptions,
        this.data.draftSupertype === id ? '' : id
      ),
    })
  },
  selectDraftType(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    this.setData({
      draftType: this.data.draftType === id ? '' : id,
      filterTypes: markOptions(
        this.data.typeOptions,
        this.data.draftType === id ? '' : id
      ),
    })
  },
  selectDraftSet(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    this.setData({
      draftSetId: this.data.draftSetId === id ? '' : id,
      filterSets: markOptions(
        this.data.setOptions,
        this.data.draftSetId === id ? '' : id
      ),
    })
  },
  selectDraftRarity(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || ''
    this.setData({
      draftRarity: this.data.draftRarity === id ? '' : id,
      filterRarities: markOptions(
        this.data.rarityOptions,
        this.data.draftRarity === id ? '' : id
      ),
    })
  },
  selectDraftSort(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id || 'releaseDate'
    this.setData({
      draftSort: id,
      filterSorts: markOptions(this.data.sortOptions, id),
    })
  },
  clearDraftFilters() {
    this.setData({
      draftSupertype: '',
      draftType: '',
      draftSetId: '',
      draftRarity: '',
      draftSort: 'releaseDate',
      filterSupertypes: markOptions(this.data.supertypeOptions, ''),
      filterTypes: markOptions(this.data.typeOptions, ''),
      filterSets: markOptions(this.data.setOptions, ''),
      filterRarities: markOptions(this.data.rarityOptions, ''),
      filterSorts: markOptions(this.data.sortOptions, 'releaseDate'),
    })
  },
  confirmFilters() {
    const next = {
      activeSupertype: this.data.draftSupertype,
      activeType: this.data.draftType,
      activeSetId: this.data.draftSetId,
      activeRarity: this.data.draftRarity,
      activeSort: this.data.draftSort,
      filterVisible: false,
    }
    next.activeFilterCount = filterCount(Object.assign({}, this.data, next))
    this.setData(next)
    this.loadCards(true)
  },
  resetFilters() {
    const next = {
      activeSupertype: '',
      activeType: '',
      activeSetId: '',
      activeRarity: '',
      activeSort: 'releaseDate',
      activePokemonId: 0,
      draftSupertype: '',
      draftType: '',
      draftSetId: '',
      draftRarity: '',
      draftSort: 'releaseDate',
      activeFilterCount: 0,
    }
    this.setData(next)
    this.loadCards(true)
  },
  openCard(event) {
    Taro.navigateTo({
      url: `/pages/card-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
      )}`,
    })
  },
  toggleFavorite(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    const favorite = storage.toggleCardFavorite(id)
    const favorites = storage.getCardFavorites()
    this.setData({
      favorites,
      cards: this.data.cards.map((item) =>
        Object.assign({}, item, {
          favorite:
            item.id === id ? favorite : favorites.includes(String(item.id)),
        })
      ),
    })
    Taro.showToast({
      title: favorite ? '已收藏' : '已取消',
      icon: 'none',
    })
  },
  toggleOwned(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    const ownedState = storage.toggleCardOwned(id)
    const owned = storage.getOwnedCards()
    this.setData({
      owned,
      cards: this.data.cards.map((item) =>
        Object.assign({}, item, {
          owned: item.id === id ? ownedState : owned.includes(String(item.id)),
        })
      ),
    })
    Taro.showToast({
      title: ownedState ? '已标记拥有' : '已取消拥有',
      icon: 'none',
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      keyword,
      activeFilterCount,
      activePokemonId,
      activeSupertype,
      activeType,
      activeSetId,
      activeRarity,
      activeSort,
      resultCountText,
      sourceText,
      loading,
      cards,
      loadingMore,
      hasMore,
      filterVisible,
      filterSupertypes,
      filterTypes,
      filterSets,
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
              placeholder="搜索卡牌、宝可梦、系列、编号或画师"
            ></Input>
          </View>
          <View
            className={'filter-trigger ' + (activeFilterCount ? 'active' : '')}
            onClick={this.openFilter}
          >
            <Text>筛选</Text>
            {activeFilterCount > 0 && (
              <Text className="filter-count">{activeFilterCount}</Text>
            )}
          </View>
        </View>
        {activeFilterCount > 0 && (
          <View className="applied-row">
            {activePokemonId && (
              <View className="applied-chip">{'关联 #' + activePokemonId}</View>
            )}
            {activeSupertype && (
              <View className="applied-chip">{activeSupertype}</View>
            )}
            {activeType && <View className="applied-chip">{activeType}</View>}
            {activeSetId && <View className="applied-chip">{activeSetId}</View>}
            {activeRarity && (
              <View className="applied-chip">{activeRarity}</View>
            )}
            {activeSort !== 'releaseDate' && (
              <View className="applied-chip">已排序</View>
            )}
            <View className="applied-reset" onClick={this.resetFilters}>
              重置
            </View>
          </View>
        )}
        <View className="result-meta">
          <Text>{resultCountText}</Text>
          <Text className="muted">{sourceText}</Text>
        </View>
        {loading && !cards?.length ? (
          <View className="card loading-state">卡牌图鉴加载中</View>
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
                          {item.set_id + ' #' + item.number}
                        </Text>
                        {item.regulation_mark && (
                          <Text className="regulation-pill">
                            {item.regulation_mark}
                          </Text>
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
                      {item.type_energy.length > 0 && (
                        <View className="energy-row">
                          {item.type_energy.map((item, index) => {
                            return (
                              <EnergyIcon
                                key={item.id}
                                type={item.id}
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
            <View className="hint">换个名称、系列、属性或稀有度试试。</View>
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
              <View className="filter-panel-title">卡牌筛选</View>
              <View className="filter-close" onClick={this.closeFilter}>
                关闭
              </View>
            </View>
            <ScrollView scrollY className="filter-panel-body">
              <View className="filter-section-title">卡牌大类</View>
              <View className="filter-grid three-grid">
                {filterSupertypes?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-id={item.id}
                      onClick={this.selectDraftSupertype}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">属性</View>
              <View className="filter-grid five-grid">
                {filterTypes?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-id={item.id}
                      onClick={this.selectDraftType}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">系列</View>
              <View className="filter-grid set-filter-grid">
                {filterSets?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      hoverClass="set-filter-hover"
                      className={
                        'filter-option set-filter-option ' +
                        (item.selected ? 'selected' : '')
                      }
                      data-id={item.id}
                      onClick={this.selectDraftSet}
                    >
                      {item.logo || item.symbol ? (
                        <Image
                          src={item.logo || item.symbol}
                          mode="aspectFit"
                        ></Image>
                      ) : (
                        <Text>{item.name}</Text>
                      )}
                      {(item.logo || item.symbol) && (
                        <View className="set-option-tooltip">{item.name}</View>
                      )}
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">稀有度</View>
              <View className="filter-grid two-grid">
                {filterRarities?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-id={item.id}
                      onClick={this.selectDraftRarity}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
              <View className="filter-section-title">排序</View>
              <View className="filter-grid sort-grid">
                {filterSorts?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'filter-option ' + (item.selected ? 'selected' : '')
                      }
                      data-id={item.id}
                      onClick={this.selectDraftSort}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
            </ScrollView>
            <View className="filter-actions">
              <View className="filter-clear" onClick={this.clearDraftFilters}>
                清空
              </View>
              <View className="filter-confirm" onClick={this.confirmFilters}>
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
