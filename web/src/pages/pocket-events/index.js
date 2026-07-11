import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const { localize } = require('../../i18n/index.js')
import './index.scss'
const TABS = [
  {
    id: 'events',
    name: '活动',
  },
  {
    id: 'missions',
    name: '任务',
  },
  {
    id: 'battles',
    name: '对战',
  },
  {
    id: 'shops',
    name: '商店',
  },
]
function dateText(epoch) {
  if (!epoch) return '长期开放'
  const date = new Date(Number(epoch) * 1000)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}.${String(date.getDate()).padStart(2, '0')}`
}
function eventType(type) {
  return (
    {
      missionGroup: '任务',
      soloBattle: '单人战',
      pvpEmblemBattle: '徽章战',
      rankedPvpSeason: '排位赛',
      itemShop: '活动商店',
      pokeGoldShop: '宝可金块',
      wonderPickFree: '免费得卡挑战',
      wonderPickChansey: '吉利蛋挑战',
    }[type] || '活动'
  )
}
function detailLines(event) {
  const data = event.data || {}
  if (event.type === 'missionGroup') {
    return (data.rewardsByStep || []).map(
      (step) =>
        `完成 ${step.clearCount} 项 · 奖励 ${
          step.reward ? step.reward.count : 0
        }`
    )
  }
  if (event.type === 'itemShop' || event.type === 'pokeGoldShop') {
    return [`商品 ${(data.products || data.items || []).length} 项`]
  }
  if (event.type === 'wonderPickFree' || event.type === 'wonderPickChansey') {
    return [`挑战卡池 ${(data.packs || []).length} 组`]
  }
  if (event.type === 'rankedPvpSeason') {
    const meta = data.meta || {}
    return [
      `赛季 ${meta.linked ? meta.linked.expansionId : ''}`,
      `段位 ${(meta.ranks || []).length} 阶`,
    ]
  }
  if (event.type === 'soloBattle' || event.type === 'pvpEmblemBattle') {
    return [`对战关卡 ${(data.battles || data.stages || []).length || 1} 组`]
  }
  return []
}
function decorate(items) {
  return (items || []).map((event) =>
    Object.assign({}, event, {
      typeText: eventType(event.type),
      rangeText: `${dateText(event.start_epoch)} - ${
        event.end_epoch ? dateText(event.end_epoch) : '长期'
      }`,
      statusText:
        event.status === 'upcoming'
          ? '即将开始'
          : event.status === 'expired'
          ? '已结束'
          : '进行中',
      detailLines: detailLines(event),
      expanded: false,
    })
  )
}
cacheOptions.setOptionsToCache({
  data: {
    tabs: TABS,
    activeTab: 'events',
    loading: true,
    error: '',
    items: [],
  },
  onLoad(options) {
    const selected = TABS.find((tab) => tab.id === options.tab)
      ? options.tab
      : 'events'
    this.setData({
      activeTab: selected,
    })
    this.loadItems()
  },
  switchTab(event) {
    const activeTab = getTarget(event.currentTarget, Taro).dataset.id
    if (activeTab === this.data.activeTab) return
    this.setData({
      activeTab,
    })
    this.loadItems()
  },
  loadItems() {
    const loaders = {
      events: api.listPocketEvents,
      missions: api.listPocketMissions,
      battles: api.listPocketBattles,
      shops: api.listPocketShops,
    }
    this.setData({
      loading: true,
      error: '',
      items: [],
    })
    loaders[this.data.activeTab]({
      page: 1,
      pageSize: 100,
    })
      .then((result) => {
        this.setData({
          loading: false,
          items: decorate(result.items || []),
        })
      })
      .catch(() =>
        this.setData({
          loading: false,
          error: '内容加载失败',
        })
      )
  },
  toggleDetail(event) {
    const id = getTarget(event.currentTarget, Taro).dataset.id
    this.setData({
      items: this.data.items.map((item) =>
        Object.assign({}, item, {
          expanded: item.id === id ? !item.expanded : item.expanded,
        })
      ),
    })
  },
  retry() {
    this.loadItems()
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { tabs, activeTab, loading, error, items } = this.data
    return (
      <View className="page events-page">
        <ScrollView scrollX className="event-tabs">
          {tabs.map((item, index) => {
            return (
              <View
                key={item.id}
                className={
                  'event-tab ' + (activeTab === item.id ? 'active' : '')
                }
                data-id={item.id}
                onClick={this.switchTab}
              >
                {item.name}
              </View>
            )
          })}
        </ScrollView>
        {loading ? (
          <View className="event-state">内容加载中</View>
        ) : error ? (
          <View className="event-state error" onClick={this.retry}>
            {error}
          </View>
        ) : items?.length ? (
          <View className="event-cards">
            {items?.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className="event-card"
                  data-id={item.id}
                  onClick={this.toggleDetail}
                >
                  <View className="event-top">
                    <View className="event-type">{item.typeText}</View>
                    <View
                      className={
                        'event-status ' +
                        (item.status === 'upcoming' ? 'upcoming' : '')
                      }
                    >
                      {item.statusText}
                    </View>
                  </View>
                  <View className="event-name">
                    {localize(item) || item.typeText}
                  </View>
                  <View className="event-range">{item.rangeText}</View>
                  {item.detailLines.length > 0 && (
                    <View className="event-more">
                      {item.expanded ? '收起' : '查看内容'}
                    </View>
                  )}
                  {item.expanded && (
                    <View className="event-detail">
                      {item.detailLines.map((item, index) => {
                        return <View key={item}>{item}</View>
                      })}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        ) : (
          <View className="event-state">当前栏目暂无内容</View>
        )}
      </View>
    )
  }
}
export default _C
