import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Input, Text, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { t, localize } = require('../../i18n/index.js')
import './index.scss'
function safe(promise, fallback) {
  return promise.catch(() => fallback)
}
function dailyItem(items) {
  if (!items.length) return null
  const now = new Date()
  const day = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() /
      86400000
  )
  return items[day % items.length]
}
function decoratePocketEvent(event) {
  return Object.assign({}, event, {
    typeText:
      {
        missionGroup: '任务',
        soloBattle: '单人战',
        pvpEmblemBattle: '徽章战',
        rankedPvpSeason: '排位',
        itemShop: '商店',
        wonderPickFree: '得卡挑战',
        wonderPickChansey: '吉利蛋挑战',
      }[event.type] || '活动',
    statusText: event.status === 'upcoming' ? '即将开始' : '进行中',
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    keyword: '',
    homeMode: 'pokemon',
    dailyPokemon: null,
    dailyCard: null,
    dailyPocketCard: null,
    hotDecks: [],
    pocketEvents: [],
    pocketDecks: [],
    recent: [],
    recentCards: [],
    recentPocketCards: [],
  },
  onShow() {
    this.loadHome()
  },
  loadHome() {
    this.setData({
      loading: true,
    })
    Promise.all([
      safe(
        api.listPokemon({
          sort: 'id',
        }),
        {
          items: [],
        }
      ),
      safe(
        api.listCards({
          sort: 'releaseDate',
          page: 1,
          pageSize: 20,
        }),
        {
          items: [],
        }
      ),
      safe(
        api.getHotDecks({
          limit: 4,
        }),
        {
          items: [],
        }
      ),
      safe(
        api.listPocketCards({
          page: 1,
          pageSize: 60,
        }),
        {
          items: [],
        }
      ),
      safe(
        api.listPocketEvents({
          page: 1,
          pageSize: 8,
        }),
        {
          items: [],
        }
      ),
      safe(
        api.listPocketHotDecks({
          page: 1,
          pageSize: 3,
        }),
        {
          items: [],
        }
      ),
    ]).then(
      ([
        pokemonResult,
        cardResult,
        deckResult,
        pocketCardResult,
        pocketEventResult,
        pocketDeckResult,
      ]) => {
        const pokemon = pokemonResult.items || []
        const cards = cardResult.items || []
        const pocketCards = pocketCardResult.items || []
        this.setData({
          loading: false,
          dailyPokemon: dailyItem(pokemon),
          dailyCard: dailyItem(cards),
          dailyPocketCard: dailyItem(pocketCards),
          hotDecks: deckResult.items || [],
          pocketEvents: (pocketEventResult.items || [])
            .slice(0, 3)
            .map(decoratePocketEvent),
          pocketDecks: pocketDeckResult.items || [],
          recent: storage.getRecentViews(pokemon),
          recentCards: storage.getRecentCards(),
          recentPocketCards: storage.getPocketRecent(),
        })
      }
    )
  },
  onKeywordInput(event) {
    this.setData({
      keyword: event.detail.value,
    })
  },
  switchHomeMode(event) {
    this.setData({
      homeMode:
        getTarget(event.currentTarget, Taro).dataset.target || 'pokemon',
      keyword: '',
    })
  },
  submitSearch() {
    const keyword = String(this.data.keyword || '').trim()
    if (this.data.homeMode === 'pocket') {
      if (keyword) Taro.setStorageSync('pokechill:pendingPocketSearch', keyword)
      Taro.navigateTo({
        url: '/pages/pocket-carddex/index',
      })
      return
    }
    if (this.data.homeMode === 'card') {
      if (keyword) Taro.setStorageSync('pokechill:pendingCardSearch', keyword)
      Taro.switchTab({
        url: '/pages/carddex/index',
      })
      return
    }
    if (keyword) Taro.setStorageSync('pokechill:pendingSearch', keyword)
    Taro.switchTab({
      url: '/pages/pokedex/index',
    })
  },
  openPokemon(event) {
    Taro.navigateTo({
      url: `/pages/pokemon-detail/index?id=${
        getTarget(event.currentTarget, Taro).dataset.id
      }`,
    })
  },
  openPokedex() {
    Taro.switchTab({
      url: '/pages/pokedex/index',
    })
  },
  openCarddex() {
    Taro.switchTab({
      url: '/pages/carddex/index',
    })
  },
  openCard(event) {
    Taro.navigateTo({
      url: `/pages/card-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
      )}`,
    })
  },
  openQuiz() {
    Taro.navigateTo({
      url: '/pages/quiz/index',
    })
  },
  openTeam() {
    Taro.navigateTo({
      url: '/pages/team/index',
    })
  },
  openTypes() {
    Taro.navigateTo({
      url: '/pages/type-chart/index',
    })
  },
  openCardQuiz() {
    Taro.navigateTo({
      url: '/pages/card-quiz/index',
    })
  },
  openCardPack() {
    Taro.navigateTo({
      url:
        this.data.homeMode === 'pocket'
          ? '/pages/pocket-pack/index'
          : '/pages/card-pack/index',
    })
  },
  openPlay() {
    Taro.navigateTo({
      url: `/pages/play/index?category=${this.data.homeMode}`,
    })
  },
  openHotDecks() {
    Taro.navigateTo({
      url: '/pages/hot-decks/index',
    })
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
  openPocket() {
    Taro.switchTab({
      url: '/pages/pocket/index',
    })
  },
  openPocketCarddex() {
    Taro.switchTab({
      url: '/pages/pocket/index',
    })
  },
  openPocketCard(event) {
    Taro.navigateTo({
      url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
      )}`,
    })
  },
  openPocketEvents(event) {
    Taro.navigateTo({
      url: `/pages/pocket-events/index?tab=${
        getTarget(event.currentTarget, Taro).dataset.tab || 'events'
      }`,
    })
  },
  openPocketDecks() {
    Taro.navigateTo({
      url: '/pages/pocket-hot-decks/index',
    })
  },
  openPocketDeck(event) {
    Taro.navigateTo({
      url: `/pages/pocket-deck-detail/index?id=${encodeURIComponent(
        getTarget(event.currentTarget, Taro).dataset.id
      )}`,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      homeMode,
      keyword,
      dailyPokemon,
      recent,
      dailyCard,
      hotDecks,
      recentCards,
      dailyPocketCard,
      pocketEvents,
      pocketDecks,
      recentPocketCards,
    } = this.data
    return (
      <View className="page home-page">
        <View className="home-banner">
          <Image
            src={require('../../assets/banner/home-banner.jpg')}
            mode="aspectFill"
          ></Image>
          <View className="home-banner-title">{t('appName')}</View>
        </View>
        <View className="search-tabs three-tabs">
          <View
            className={'search-tab ' + (homeMode === 'pokemon' ? 'active' : '')}
            data-target="pokemon"
            onClick={this.switchHomeMode}
          >
            宝可梦
          </View>
          <View
            className={'search-tab ' + (homeMode === 'card' ? 'active' : '')}
            data-target="card"
            onClick={this.switchHomeMode}
          >
            实体卡牌
          </View>
          <View
            className={
              'search-tab ' + (homeMode === 'pocket' ? 'active pocket' : '')
            }
            data-target="pocket"
            onClick={this.switchHomeMode}
          >
            Pocket
          </View>
        </View>
        <View className="search-box home-search">
          <Input
            value={keyword}
            onInput={this.onKeywordInput}
            onConfirm={this.submitSearch}
            confirmType="search"
            placeholder={
              homeMode === 'pokemon'
                ? '搜索宝可梦名称或编号'
                : homeMode === 'card'
                ? '搜索实体卡牌、系列或编号'
                : '搜索 Pocket 卡牌'
            }
          ></Input>
          <View className="search-action" onClick={this.submitSearch}>
            搜索
          </View>
        </View>
        <View className="section home-quick-section">
          <View className="section-title">
            <Text>常用功能</Text>
          </View>
          {homeMode === 'pokemon' ? (
            <View className="quick-grid">
              <View className="quick-card" onClick={this.openPokedex}>
                <View className="quick-icon">鉴</View>
                <View className="quick-title">{t('pokedex')}</View>
                <View className="quick-sub">搜索与筛选</View>
              </View>
              <View className="quick-card" onClick={this.openQuiz}>
                <View className="quick-icon">猜</View>
                <View className="quick-title">宝可梦猜谜</View>
                <View className="quick-sub">随机 4 选 1</View>
              </View>
              <View className="quick-card" onClick={this.openTeam}>
                <View className="quick-icon">队</View>
                <View className="quick-title">队伍分析</View>
                <View className="quick-sub">多队伍编辑</View>
              </View>
              <View className="quick-card" onClick={this.openTypes}>
                <View className="quick-icon gold">属</View>
                <View className="quick-title">属性速查</View>
                <View className="quick-sub">克制关系</View>
              </View>
              <View className="quick-card" onClick={this.openPlay}>
                <View className="quick-icon ink">玩</View>
                <View className="quick-title">玩法盒子</View>
                <View className="quick-sub">宝可梦玩法</View>
              </View>
            </View>
          ) : homeMode === 'card' ? (
            <View className="quick-grid">
              <View className="quick-card" onClick={this.openCarddex}>
                <View className="quick-icon">鉴</View>
                <View className="quick-title">{t('cards')}</View>
                <View className="quick-sub">实体卡牌</View>
              </View>
              <View className="quick-card" onClick={this.openCardQuiz}>
                <View className="quick-icon">猜</View>
                <View className="quick-title">猜卡牌</View>
                <View className="quick-sub">今日挑战</View>
              </View>
              <View className="quick-card" onClick={this.openCardPack}>
                <View className="quick-icon blue">包</View>
                <View className="quick-title">每日开包</View>
                <View className="quick-sub">手动开启</View>
              </View>
              <View className="quick-card" onClick={this.openHotDecks}>
                <View className="quick-icon coral">组</View>
                <View className="quick-title">热门卡组</View>
                <View className="quick-sub">排行榜</View>
              </View>
              <View className="quick-card" onClick={this.openPlay}>
                <View className="quick-icon ink">玩</View>
                <View className="quick-title">玩法盒子</View>
                <View className="quick-sub">实体卡玩法</View>
              </View>
            </View>
          ) : (
            <View className="quick-grid">
              <View className="quick-card" onClick={this.openPocketCarddex}>
                <View className="quick-icon">鉴</View>
                <View className="quick-title">{t('pocket')}</View>
                <View className="quick-sub">搜索与筛选</View>
              </View>
              <View
                className="quick-card"
                data-tab="events"
                onClick={this.openPocketEvents}
              >
                <View className="quick-icon coral">活</View>
                <View className="quick-title">活动</View>
                <View className="quick-sub">当前与预告</View>
              </View>
              <View className="quick-card" onClick={this.openCardPack}>
                <View className="quick-icon blue">包</View>
                <View className="quick-title">模拟开包</View>
                <View className="quick-sub">5 张一包</View>
              </View>
              <View className="quick-card" onClick={this.openPocketDecks}>
                <View className="quick-icon ink">组</View>
                <View className="quick-title">热门卡组</View>
                <View className="quick-sub">赛事数据</View>
              </View>
              <View className="quick-card" onClick={this.openPlay}>
                <View className="quick-icon gold">玩</View>
                <View className="quick-title">玩法盒子</View>
                <View className="quick-sub">Pocket玩法</View>
              </View>
            </View>
          )}
        </View>
        {homeMode === 'pokemon' ? (
          <Block>
            {dailyPokemon && (
              <View
                className="card hero-card"
                data-id={dailyPokemon.id}
                onClick={this.openPokemon}
              >
                <View className="hero-copy">
                  <View className="muted">今日宝可梦</View>
                  <View className="hero-name">{localize(dailyPokemon)}</View>
                  <View className="hero-en">
                    {'#' + dailyPokemon.id + ' ' + dailyPokemon.name_en}
                  </View>
                  <View className="type-line">
                    {dailyPokemon.types.map((item, index) => {
                      return (
                        <View key={item} className={'type-badge type-' + item}>
                          {dailyPokemon.typeNames[index]}
                        </View>
                      )
                    })}
                  </View>
                </View>
                <Image
                  className="hero-image"
                  src={dailyPokemon.image}
                  mode="aspectFit"
                ></Image>
              </View>
            )}
            <View className="section">
              <View className="section-title">
                <Text>最近查看</Text>
                <Text className="muted" onClick={this.openPokedex}>
                  去宝可梦图鉴
                </Text>
              </View>
              {recent?.length ? (
                <ScrollView scrollX className="recent-row">
                  {recent?.map((item, index) => {
                    return (
                      <View
                        key={item.id}
                        className="recent-card"
                        data-id={item.id}
                        onClick={this.openPokemon}
                      >
                        <Image src={item.image} mode="aspectFit"></Image>
                        <View>{localize(item)}</View>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : (
                <View className="card empty-state">
                  <View className="title">还没有浏览记录</View>
                </View>
              )}
            </View>
          </Block>
        ) : homeMode === 'card' ? (
          <Block>
            {dailyCard && (
              <View
                className="card card-hero"
                data-id={dailyCard.id}
                onClick={this.openCard}
              >
                <View className="card-hero-art">
                  <Image src={dailyCard.image} mode="aspectFit"></Image>
                </View>
                <View className="card-hero-copy">
                  <View className="muted">今日实体卡牌</View>
                  <View className="card-hero-name">
                    {dailyCard.display_name ||
                      dailyCard.name_zh ||
                      dailyCard.name}
                  </View>
                  <View className="card-hero-sub">
                    {'#' + dailyCard.number}
                  </View>
                  <View className="card-hero-meta">
                    {dailyCard.rarity_name || dailyCard.rarity}
                  </View>
                </View>
              </View>
            )}
            {hotDecks?.length > 0 && (
              <View id="physical-hot-decks" className="section">
                <View className="section-title">
                  <Text>热门卡组</Text>
                  <Text className="muted" onClick={this.openHotDecks}>
                    排行榜
                  </Text>
                </View>
                <View className="deck-list">
                  {hotDecks?.map((item, index) => {
                    return (
                      <View
                        key={item.rank}
                        className="deck-row card"
                        data-url={item.url}
                        data-name={item.name}
                        data-rank={item.rank}
                        data-points={item.points}
                        data-share={item.share}
                        onClick={this.openDeck}
                      >
                        <View className="deck-rank">{'#' + item.rank}</View>
                        <View className="deck-icons">
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
                        <View className="deck-copy">
                          <View className="deck-name">{item.name}</View>
                          <View className="muted">
                            {item.points + ' 分 · ' + item.share}
                          </View>
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            )}
            <View className="section">
              <View className="section-title">
                <Text>最近看卡</Text>
                <Text className="muted" onClick={this.openCarddex}>
                  去实体卡牌图鉴
                </Text>
              </View>
              {recentCards?.length ? (
                <ScrollView scrollX className="recent-card-row">
                  {recentCards?.map((item, index) => {
                    return (
                      <View
                        key={item.id}
                        className="recent-tcg-card"
                        data-id={item.id}
                        onClick={this.openCard}
                      >
                        <Image src={item.image} mode="aspectFit"></Image>
                        <View>{item.display_name}</View>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : (
                <View className="card empty-state">
                  <View className="title">还没有看过实体卡牌</View>
                </View>
              )}
            </View>
          </Block>
        ) : (
          <Block>
            {dailyPocketCard && (
              <View
                className="pocket-home-card"
                data-id={dailyPocketCard.id}
                onClick={this.openPocketCard}
              >
                <View className="pocket-home-art">
                  <Image src={dailyPocketCard.image} mode="aspectFit"></Image>
                </View>
                <View className="pocket-home-copy">
                  <View className="pocket-label">今日 Pocket 卡牌</View>
                  <View className="pocket-name">{localize(dailyPocketCard)}</View>
                  <View className="pocket-en">{dailyPocketCard.name_en}</View>
                  <View className="pocket-meta">
                    {dailyPocketCard.collections[0].expansion_id +
                      ' #' +
                      dailyPocketCard.collections[0].number +
                      ' · ' +
                      dailyPocketCard.rarity}
                  </View>
                </View>
                <View className="pocket-arrow">›</View>
              </View>
            )}
            <View className="section pocket-panel-section">
              <View className="section-title">
                <Text>活动动态</Text>
                <Text
                  className="muted"
                  data-tab="events"
                  onClick={this.openPocketEvents}
                >
                  全部活动
                </Text>
              </View>
              <View className="pocket-event-list">
                {pocketEvents?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="pocket-event-row"
                      data-tab="events"
                      onClick={this.openPocketEvents}
                    >
                      <Text>{item.typeText}</Text>
                      <View>
                        <Text className="strong">{localize(item)}</Text>
                        <View>{item.statusText}</View>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
            <View className="section pocket-panel-section">
              <View className="section-title">
                <Text>热门 Pocket 卡组</Text>
                <Text className="muted" onClick={this.openPocketDecks}>
                  排行榜
                </Text>
              </View>
              <View className="pocket-deck-list">
                {pocketDecks?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="pocket-deck-row"
                      data-id={item.id}
                      onClick={this.openPocketDeck}
                    >
                      <Text>{'#' + item.rank}</Text>
                      <View className="home-pocket-deck-icons">
                        {item.images.map((icon, index) => {
                          return (
                            <Image
                              key={icon}
                              src={icon}
                              mode="aspectFit"
                            ></Image>
                          )
                        })}
                      </View>
                      <View>
                        <Text className="strong">{item.name}</Text>
                        <View>
                          {'使用率 ' +
                            item.share +
                            '% · 胜率 ' +
                            item.win_rate +
                            '%'}
                        </View>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
            <View className="section">
              <View className="section-title">
                <Text>最近看卡</Text>
                <Text className="muted" onClick={this.openPocketCarddex}>
                  去 Pocket 图鉴
                </Text>
              </View>
              {recentPocketCards?.length ? (
                <ScrollView scrollX className="recent-card-row">
                  {recentPocketCards?.map((item, index) => {
                    return (
                      <View
                        key={item.id}
                        className="recent-tcg-card"
                        data-id={item.id}
                        onClick={this.openPocketCard}
                      >
                        <Image src={item.image} mode="aspectFit"></Image>
                        <View>{localize(item)}</View>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : (
                <View className="card empty-state">
                  <View className="title">还没有看过 Pocket 卡牌</View>
                </View>
              )}
            </View>
          </Block>
        )}
      </View>
    )
  }
}
export default _C
