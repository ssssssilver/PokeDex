import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Text, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
import './index.scss'
function safeDecode(value) {
  try {
    return decodeURIComponent(value || '')
  } catch (error) {
    return value || ''
  }
}
function sectionCount(section) {
  const explicit = Number(section && section.count)
  if (Number.isFinite(explicit) && explicit > 0) return explicit
  return (section.cards || []).reduce(
    (sum, card) => sum + Number(card.count || 0),
    0
  )
}
function normalizeSection(section) {
  const count = sectionCount(section || {})
  return Object.assign({}, section, {
    displayTitle: section.displayTitle || section.title || '牌表',
    count,
    countText: `${count} 张`,
    cards: (section.cards || []).map((card) =>
      Object.assign({}, card, {
        setLine: [card.set, card.number].filter(Boolean).join(' '),
        line:
          card.line ||
          `${card.count} ${card.name} ${card.set || ''} ${card.number || ''}`
            .replace(/\s+/g, ' ')
            .trim(),
      })
    ),
  })
}
function galleryCards(sections) {
  return sections.reduce(
    (items, section) =>
      items.concat(
        section.cards
          .filter((card) => card.image)
          .map((card) => ({
            count: card.count,
            name: card.name,
            setLine: card.setLine,
            image: card.image,
          }))
      ),
    []
  )
}
function normalizeDeck(item, initialDeck) {
  const source = item || {}
  const initial = initialDeck || {}
  const sections = (source.sections || []).map(normalizeSection)
  const latest = source.latestResult || null
  return Object.assign({}, source, {
    rank: source.rank || initial.rank || '',
    name: source.name || initial.name || '卡组详情',
    points: source.points || initial.points || '',
    share: source.share || initial.share || '',
    url:
      source.url ||
      initial.url ||
      source.overviewUrl ||
      source.decklistUrl ||
      '',
    source: source.source || 'Limitless TCG',
    sourceUrl:
      source.sourceUrl ||
      source.decklistUrl ||
      source.overviewUrl ||
      initial.url ||
      '',
    totalCards:
      source.totalCards ||
      sections.reduce((sum, section) => sum + section.count, 0),
    sections,
    galleryCards: galleryCards(sections),
    latestText:
      latest && (latest.place || latest.player)
        ? [latest.place, latest.player].filter(Boolean).join(' · ')
        : '',
    description: source.description || '',
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    deck: null,
    initialDeck: null,
    error: '',
  },
  onLoad(options) {
    const initialDeck = {
      url: safeDecode(options.url),
      name: safeDecode(options.name),
      rank: safeDecode(options.rank),
      points: safeDecode(options.points),
      share: safeDecode(options.share),
    }
    this.setData({
      initialDeck,
    })
    Taro.setNavigationBarTitle({
      title: initialDeck.name || '卡组详情',
    })
    this.loadDeck(initialDeck)
  },
  loadDeck(deck) {
    this.setData({
      loading: true,
      error: '',
    })
    api
      .getHotDeckDetail(deck)
      .then((result) => {
        const normalized = normalizeDeck(result.item, deck)
        this.setData({
          loading: false,
          deck: normalized,
          error: result.message || '',
        })
        Taro.setNavigationBarTitle({
          title: normalized.name || '卡组详情',
        })
      })
      .catch((error) => {
        this.setData({
          loading: false,
          error: error.message || '卡组详情加载失败',
          deck: null,
        })
      })
  },
  retry() {
    this.loadDeck(this.data.initialDeck || {})
  },
  copyDeck() {
    const deck = this.data.deck || {}
    const text = deck.copyText || ''
    if (!text) {
      Taro.showToast({
        title: '暂无可复制牌表',
        icon: 'none',
      })
      return
    }
    Taro.setClipboardData({
      data: text,
      success() {
        Taro.showToast({
          title: '已复制卡组',
          icon: 'success',
        })
      },
      fail() {
        Taro.showToast({
          title: '复制失败',
          icon: 'none',
        })
      },
    })
  },
  copySource() {
    const deck = this.data.deck || {}
    const url = deck.sourceUrl || deck.url || ''
    if (!url) {
      Taro.showToast({
        title: '暂无来源链接',
        icon: 'none',
      })
      return
    }
    Taro.setClipboardData({
      data: url,
      success() {
        Taro.showToast({
          title: '已复制来源',
          icon: 'success',
        })
      },
      fail() {
        Taro.showToast({
          title: '复制失败',
          icon: 'none',
        })
      },
    })
  },
  previewCard(event) {
    const current = getTarget(event.currentTarget, Taro).dataset.src
    const urls = ((this.data.deck && this.data.deck.galleryCards) || [])
      .map((card) => card.image)
      .filter(Boolean)
    if (!current || !urls.length) return
    Taro.previewImage({
      current,
      urls,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { loading, deck, error } = this.data
    return (
      <View className="page deck-detail-page">
        {loading ? (
          <View className="card loading-card">
            <View className="loading-title">正在加载卡组</View>
            <View className="muted">从 Limitless 获取最新牌表...</View>
          </View>
        ) : deck ? (
          <Block>
            <View className="card deck-hero">
              <View className="deck-topline">
                {deck.rank && (
                  <View className="deck-rank">{'#' + deck.rank}</View>
                )}
                <View className="deck-source">{deck.source}</View>
              </View>
              <View className="deck-title">{deck.name}</View>
              {deck.description && (
                <View className="deck-description">{deck.description}</View>
              )}
              <View className="deck-meta-grid">
                <View className="deck-meta-item">
                  <View className="meta-value">{deck.totalCards}</View>
                  <View className="muted">卡牌</View>
                </View>
                <View className="deck-meta-item">
                  <View className="meta-value">{deck.points || '-'}</View>
                  <View className="muted">积分</View>
                </View>
                <View className="deck-meta-item">
                  <View className="meta-value">{deck.share || '-'}</View>
                  <View className="muted">占比</View>
                </View>
              </View>
              {deck.latestText && (
                <View className="latest-result">
                  <View className="latest-label">最新结果</View>
                  <View className="latest-value">{deck.latestText}</View>
                </View>
              )}
              {deck.images && deck.images.length > 0 && (
                <View className="deck-hero-icons">
                  {deck.images.map((item, index) => {
                    return (
                      <Image
                        key={item.src}
                        src={item.src}
                        mode="aspectFit"
                      ></Image>
                    )
                  })}
                </View>
              )}
              <View className="deck-actions">
                <View className="button-primary" onClick={this.copyDeck}>
                  一键复制卡组
                </View>
                <View className="button-secondary" onClick={this.copySource}>
                  复制来源
                </View>
              </View>
            </View>
            {deck.galleryCards.length > 0 && (
              <View className="section deck-gallery-section">
                <View className="section-title">
                  <Text>卡组全览</Text>
                  <Text className="muted">
                    {deck.galleryCards.length +
                      ' 种 · ' +
                      deck.totalCards +
                      ' 张'}
                  </Text>
                </View>
                <ScrollView
                  scrollX
                  enhanced
                  showScrollbar={false}
                  className="deck-gallery-scroll"
                >
                  <View className="deck-gallery-row">
                    {deck.galleryCards.map((item, index) => {
                      return (
                        <View
                          key={item.image}
                          className="deck-gallery-item"
                          onClick={this.previewCard}
                          data-src={item.image}
                        >
                          <View className="deck-card-thumb-wrap">
                            <Image
                              className="deck-card-thumb"
                              src={item.image}
                              mode="aspectFit"
                              lazyLoad
                            ></Image>
                            <View className="deck-card-quantity">
                              {'×' + item.count}
                            </View>
                          </View>
                          <View className="deck-gallery-name">{item.name}</View>
                          <View className="deck-gallery-set">
                            {item.setLine}
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
            {deck.sections.map((item, index) => {
              return (
                <View key={item.title} className="section">
                  <View className="section-title">
                    <Text>{item.displayTitle}</Text>
                    <Text className="muted">{item.countText}</Text>
                  </View>
                  <View className="card deck-section-card">
                    {item.cards.map((card, index) => {
                      return (
                        <View key={card.line} className="deck-card-row">
                          <View className="deck-card-count">{card.count}</View>
                          <View className="deck-card-main">
                            <View className="deck-card-name">{card.name}</View>
                            <View className="muted">{card.setLine}</View>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                </View>
              )
            })}
            <View className="copy-panel">
              <View className="button-primary" onClick={this.copyDeck}>
                一键复制卡组
              </View>
            </View>
          </Block>
        ) : (
          <View className="card empty-state">
            <View className="title">卡组详情加载失败</View>
            <View className="hint">{error || '请稍后重试'}</View>
            <View className="button-primary retry-button" onClick={this.retry}>
              重新加载
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
