import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    activeCategory: 'pokemon',
    categories: [
      {
        id: 'pokemon',
        name: '宝可梦',
      },
      {
        id: 'card',
        name: '实体卡牌',
      },
      {
        id: 'pocket',
        name: 'Pocket',
      },
    ],
  },
  onLoad(options) {
    const category = ['pokemon', 'card', 'pocket'].includes(options.category)
      ? options.category
      : 'pokemon'
    this.setData({
      activeCategory: category,
    })
  },
  selectCategory(event) {
    this.setData({
      activeCategory: getTarget(event.currentTarget, Taro).dataset.id,
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
      url: '/pages/card-pack/index',
    })
  },
  openHotDecks() {
    Taro.navigateTo({
      url: '/pages/hot-decks/index',
    })
  },
  openPocketPack() {
    Taro.navigateTo({
      url: '/pages/pocket-pack/index',
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
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { categories, activeCategory } = this.data
    return (
      <View className="page play-page">
        <View className="play-header">
          <View className="title">玩法盒子</View>
          <View className="muted">按数据栏目选择轻玩法。</View>
        </View>
        <View className="play-categories">
          {categories.map((item, index) => {
            return (
              <View
                key={item.id}
                className={activeCategory === item.id ? 'active' : ''}
                data-id={item.id}
                onClick={this.selectCategory}
              >
                {item.name}
              </View>
            )
          })}
        </View>
        {activeCategory === 'pokemon' ? (
          <View className="play-list">
            <View className="category-heading">
              <Text>宝可梦玩法</Text>
              <Text className="small">图鉴与属性数据</Text>
            </View>
            <View className="card play-card" onClick={this.openQuiz}>
              <View className="play-icon">猜</View>
              <View className="play-copy">
                <View className="play-title">每日猜宝可梦</View>
                <View className="muted">根据属性和世代线索四选一。</View>
              </View>
            </View>
            <View className="card play-card" onClick={this.openTeam}>
              <View className="play-icon">队</View>
              <View className="play-copy">
                <View className="play-title">队伍属性分析</View>
                <View className="muted">维护多个六人队伍，检查共同弱点。</View>
              </View>
            </View>
            <View className="card play-card" onClick={this.openTypes}>
              <View className="play-icon">属</View>
              <View className="play-copy">
                <View className="play-title">属性克制速查</View>
                <View className="muted">快速查看弱点、抗性和免疫。</View>
              </View>
            </View>
          </View>
        ) : activeCategory === 'card' ? (
          <View className="play-list">
            <View className="category-heading">
              <Text>实体卡牌玩法</Text>
              <Text className="small">PTCG 数据</Text>
            </View>
            <View className="card play-card" onClick={this.openCardQuiz}>
              <View className="play-icon coral">猜</View>
              <View className="play-copy">
                <View className="play-title">今日猜卡牌</View>
                <View className="muted">根据卡图、系列和稀有度提示作答。</View>
              </View>
            </View>
            <View className="card play-card" onClick={this.openCardPack}>
              <View className="play-icon blue">包</View>
              <View className="play-copy">
                <View className="play-title">模拟开包</View>
                <View className="muted">选择实体卡系列并手动开包。</View>
              </View>
            </View>
            <View className="card play-card" onClick={this.openHotDecks}>
              <View className="play-icon coral">组</View>
              <View className="play-copy">
                <View className="play-title">热门卡组</View>
                <View className="muted">查看当前环境排行榜与完整牌表。</View>
              </View>
            </View>
          </View>
        ) : (
          <View className="play-list">
            <View className="category-heading">
              <Text>Pocket 玩法</Text>
              <Text className="small">移动端卡牌数据</Text>
            </View>
            <View className="card play-card" onClick={this.openPocketPack}>
              <View className="play-icon blue">包</View>
              <View className="play-copy">
                <View className="play-title">Pocket 模拟开包</View>
                <View className="muted">普通包与特典包采用对应抽取规则。</View>
              </View>
            </View>
            <View
              className="card play-card"
              data-tab="missions"
              onClick={this.openPocketEvents}
            >
              <View className="play-icon gold">任</View>
              <View className="play-copy">
                <View className="play-title">任务与活动</View>
                <View className="muted">查看当前活动、任务和奖励入口。</View>
              </View>
            </View>
            <View className="card play-card" onClick={this.openPocketDecks}>
              <View className="play-icon coral">组</View>
              <View className="play-copy">
                <View className="play-title">热门卡组挑战</View>
                <View className="muted">从当前环境热门原型寻找组牌灵感。</View>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
