import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Button } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const config = require('../../config.js')
const storage = require('../../utils/storage.js')
const { t } = require('../../i18n/index.js')
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    version: config.appVersion,
    pokemonStats: {
      favorites: 0,
      teams: 0,
      quizCount: 0,
    },
    cardStats: {
      favorites: 0,
      owned: 0,
      wishlist: 0,
    },
    pocketStats: {
      favorites: 0,
      owned: 0,
    },
    teams: [],
  },
  onShow() {
    this.loadProfile()
  },
  loadProfile() {
    const teams = storage.getTeams()
    this.setData({
      pokemonStats: {
        favorites: storage.getFavorites().length,
        teams: teams.length,
        quizCount: Object.keys(storage.getQuizHistory()).length,
      },
      cardStats: {
        favorites: storage.getCardFavorites().length,
        owned: storage.getOwnedCards().length,
        wishlist: storage.getWishlistCards().length,
      },
      pocketStats: {
        favorites: storage.getPocketFavorites().length,
        owned: storage.getPocketOwned().length,
      },
      teams: teams.map((team) =>
        Object.assign({}, team, {
          memberCount: team.memberIds.length,
          memberText: team.memberIds.length
            ? `${team.memberIds.length} / 6`
            : '未添加',
        })
      ),
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
  openPocket() {
    Taro.switchTab({
      url: '/pages/pocket/index',
    })
  },
  openTeam() {
    Taro.navigateTo({
      url: '/pages/team/index',
    })
  },
  openQuiz() {
    Taro.navigateTo({
      url: '/pages/quiz/index',
    })
  },
  openPlay() {
    Taro.navigateTo({
      url: '/pages/play/index',
    })
  },
  openDataSources() {
    Taro.navigateTo({
      url: '/pages/data-sources/index',
    })
  },
  openSponsor() {
    Taro.navigateTo({ url: '/pages/sponsor/index' })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { pokemonStats, teams, cardStats, pocketStats, version } = this.data
    return (
      <View className="page profile-page">
        <View className="profile-heading">
          <View className="profile-title">{t('profile')}</View>
          <View className="muted">收藏、拥有状态与队伍保存在当前微信设备</View>
        </View>
        <View className="domain-section">
          <View className="domain-head">
            <View className="domain-mark pokemon">宝</View>
            <View>
              <View className="domain-title">{t('pokemon')}</View>
              <View className="muted">图鉴收藏与队伍</View>
            </View>
            <View className="domain-link" onClick={this.openPokedex}>
              进入图鉴
            </View>
          </View>
          <View className="stats-grid">
            <View onClick={this.openPokedex}>
              <View className="stat-value">{pokemonStats.favorites}</View>
              <Text>收藏</Text>
            </View>
            <View onClick={this.openTeam}>
              <View className="stat-value">{pokemonStats.teams}</View>
              <Text>队伍</Text>
            </View>
            <View onClick={this.openQuiz}>
              <View className="stat-value">{pokemonStats.quizCount}</View>
              <Text>猜谜记录</Text>
            </View>
          </View>
          <View className="team-list">
            {teams?.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className="team-row"
                  onClick={this.openTeam}
                >
                  <View className="team-index">{index + 1}</View>
                  <View className="team-copy">
                    <View>{item.name}</View>
                    <Text>
                      {item.memberCount ? '已保存队伍成员' : '等待添加宝可梦'}
                    </Text>
                  </View>
                  <View className="team-count">{item.memberText}</View>
                  <View className="row-arrow">›</View>
                </View>
              )
            })}
          </View>
        </View>
        <View className="domain-section">
          <View className="domain-head">
            <View className="domain-mark cardmark">卡</View>
            <View>
              <View className="domain-title">{t('physicalCards')}</View>
              <View className="muted">收藏、拥有与愿望单</View>
            </View>
            <View className="domain-link" onClick={this.openCarddex}>
              进入图鉴
            </View>
          </View>
          <View className="stats-grid">
            <View onClick={this.openCarddex}>
              <View className="stat-value">{cardStats.favorites}</View>
              <Text>收藏</Text>
            </View>
            <View onClick={this.openCarddex}>
              <View className="stat-value">{cardStats.owned}</View>
              <Text>已拥有</Text>
            </View>
            <View onClick={this.openCarddex}>
              <View className="stat-value">{cardStats.wishlist}</View>
              <Text>愿望单</Text>
            </View>
          </View>
        </View>
        <View className="domain-section">
          <View className="domain-head">
            <View className="domain-mark pocket">P</View>
            <View>
              <View className="domain-title">Pocket</View>
              <View className="muted">移动端卡牌收藏</View>
            </View>
            <View className="domain-link" onClick={this.openPocket}>
              进入图鉴
            </View>
          </View>
          <View className="stats-grid two-columns">
            <View onClick={this.openPocket}>
              <View className="stat-value">{pocketStats.favorites}</View>
              <Text>收藏</Text>
            </View>
            <View onClick={this.openPocket}>
              <View className="stat-value">{pocketStats.owned}</View>
              <Text>已拥有</Text>
            </View>
          </View>
        </View>
        <View className="settings-section">
          <View className="section-label">更多</View>
          <View className="settings-list">
            <View className="settings-row" onClick={this.openSponsor}>
              <View className="settings-icon support">♡</View>
              <View className="settings-copy">
                <View className="settings-title">赞助本站</View>
                <Text>支持数据更新、服务器与持续开发</Text>
              </View>
              <View className="row-arrow">›</View>
            </View>
            <View className="settings-row" onClick={this.openPlay}>
              <View className="settings-icon">玩</View>
              <View className="settings-copy">
                <View className="settings-title">玩法盒子</View>
                <Text>查看全部轻玩法</Text>
              </View>
              <View className="row-arrow">›</View>
            </View>
            <View className="settings-row version-row">
              <View className="settings-icon version">版</View>
              <View className="settings-copy">
                <View className="settings-title">{t('version')}</View>
                <Text>{t('appName')}</Text>
              </View>
              <View className="version-value">{'v' + version}</View>
            </View>
            <View className="settings-row" onClick={this.openDataSources}>
              <View className="settings-icon source">i</View>
              <View className="settings-copy">
                <View className="settings-title">数据来源与声明</View>
                <Text>来源、数据状态和使用边界</Text>
              </View>
              <View className="row-arrow">›</View>
            </View>
            <Button
              className="settings-row feedback-button"
              openType="feedback"
            >
              <View className="settings-icon support">意</View>
              <View className="settings-copy">
                <View className="settings-title">{t('feedback')}</View>
                <Text>通过微信反馈问题或建议</Text>
              </View>
              <View className="row-arrow">›</View>
            </Button>
          </View>
        </View>
      </View>
    )
  }
}
export default _C
