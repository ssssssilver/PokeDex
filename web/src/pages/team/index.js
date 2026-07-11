import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Text, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { getLocale, localize } = require('../../i18n/index.js')
import './index.scss'
function teamTabs(teams, activeId) {
  return (teams || []).map((team) =>
    Object.assign({}, team, {
      active: team.id === activeId,
      count: (team.memberIds || []).length,
    })
  )
}
cacheOptions.setOptionsToCache({
  data: {
    pokemon: [],
    teams: [],
    activeTeamId: '',
    activeTeamName: '',
    selectedIds: [],
    selectedMembers: [],
    teamSlots: [],
    analysis: null,
  },
  onShow() {
    api
      .listPokemon({
        sort: 'id',
      })
      .then((result) => {
        this.refreshTeamState(result.items || [])
      })
  },
  refreshTeamState(pokemon) {
    const allPokemon = pokemon || this.data.pokemon
    const teams = storage.getTeams()
    const activeTeam = storage.getActiveTeam()
    const selectedIds = (activeTeam.memberIds || []).slice()
    const selectedMembers = selectedIds
      .map((id) => allPokemon.find((item) => item.id === id))
      .filter(Boolean)
    const teamSlots = Array.from(
      {
        length: 6,
      },
      (unused, index) => ({
        index,
        pokemon: selectedMembers[index] || null,
      })
    )
    this.setData({
      pokemon: this.decorateSelection(allPokemon, selectedIds),
      teams: teamTabs(teams, activeTeam.id),
      activeTeamId: activeTeam.id,
      activeTeamName: activeTeam.name,
      selectedIds,
      selectedMembers,
      teamSlots,
    })
    this.runAnalysis()
  },
  decorateSelection(items, selectedIds) {
    return items.map((item) =>
      Object.assign({}, item, {
        selected: selectedIds.includes(item.id),
      })
    )
  },
  selectTeam(event) {
    if (
      !storage.setActiveTeamId(getTarget(event.currentTarget, Taro).dataset.id)
    )
      return
    this.refreshTeamState()
  },
  createTeam() {
    const team = storage.createTeam()
    if (!team) {
      Taro.showToast({
        title: '最多创建 8 个队伍',
        icon: 'none',
      })
      return
    }
    this.refreshTeamState()
  },
  renameTeam() {
    Taro.showModal({
      title: '重命名队伍',
      editable: true,
      placeholderText: this.data.activeTeamName,
      success: (result) => {
        if (!result.confirm) return
        if (!storage.renameTeam(this.data.activeTeamId, result.content)) {
          Taro.showToast({
            title: '请输入队伍名称',
            icon: 'none',
          })
          return
        }
        this.refreshTeamState()
      },
    })
  },
  deleteTeam() {
    if (this.data.teams.length <= 1) {
      Taro.showToast({
        title: '至少保留一个队伍',
        icon: 'none',
      })
      return
    }
    Taro.showModal({
      title: '删除队伍',
      content: `确定删除“${this.data.activeTeamName}”吗？`,
      success: (result) => {
        if (!result.confirm) return
        storage.deleteTeam(this.data.activeTeamId)
        this.refreshTeamState()
      },
    })
  },
  toggleMember(event) {
    const id = Number(getTarget(event.currentTarget, Taro).dataset.id)
    const selected = this.data.selectedIds.slice()
    const index = selected.indexOf(id)
    if (index >= 0) {
      selected.splice(index, 1)
    } else if (selected.length < 6) {
      selected.push(id)
    } else {
      Taro.showToast({
        title: '最多选择 6 只',
        icon: 'none',
      })
      return
    }
    storage.setTeamSlots(selected, this.data.activeTeamId)
    this.refreshTeamState()
  },
  removeMember(event) {
    const id = Number(getTarget(event.currentTarget, Taro).dataset.id)
    storage.setTeamSlots(
      this.data.selectedIds.filter((item) => item !== id),
      this.data.activeTeamId
    )
    this.refreshTeamState()
  },
  runAnalysis() {
    if (!this.data.selectedIds.length) {
      this.setData({
        analysis: null,
      })
      return
    }
    api.analyzeTeam(this.data.selectedIds).then((result) =>
      this.setData({
        analysis: result.item,
      })
    )
  },
  openPokemon(event) {
    Taro.navigateTo({
      url: `/pages/pokemon-detail/index?id=${
        getTarget(event.currentTarget, Taro).dataset.id
      }`,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { teams, activeTeamName, selectedIds, analysis, teamSlots, pokemon } =
      this.data
    return (
      <View className="page team-page">
        <View className="team-switcher">
          <ScrollView scrollX className="team-tabs">
            <View className="team-tab-row">
              {teams?.map((item, index) => {
                return (
                  <View
                    key={item.id}
                    className={'team-tab ' + (item.active ? 'active' : '')}
                    data-id={item.id}
                    onClick={this.selectTeam}
                  >
                    <Text>{item.name}</Text>
                    <Text className="small">{item.count + ' / 6'}</Text>
                  </View>
                )
              })}
            </View>
          </ScrollView>
          <View className="add-team" onClick={this.createTeam}>
            ＋
          </View>
        </View>
        <View className="card team-summary">
          <View>
            <View className="muted">当前队伍</View>
            <View className="active-team-name">{activeTeamName}</View>
            <View className="team-count">{selectedIds?.length + ' / 6'}</View>
          </View>
          <View className="team-commands">
            <View onClick={this.renameTeam}>重命名</View>
            <View className="danger" onClick={this.deleteTeam}>
              删除
            </View>
          </View>
          {analysis && <View className="score">{analysis.score}</View>}
        </View>
        <View className="selected-strip">
          {teamSlots?.map((item, index) => {
            return (
              <View
                key={index}
                className={'selected-slot ' + (item.pokemon ? 'filled' : '')}
              >
                {item.pokemon ? (
                  <Block>
                    <Image
                      src={item.pokemon.image}
                      mode="aspectFit"
                      data-id={item.pokemon.id}
                      onClick={this.openPokemon}
                    ></Image>
                    <View
                      className="slot-remove"
                      data-id={item.pokemon.id}
                      onClick={this.removeMember}
                    >
                      ×
                    </View>
                    <Text>{localize(item.pokemon)}</Text>
                  </Block>
                ) : (
                  <Text className="slot-empty">+</Text>
                )}
              </View>
            )
          })}
        </View>
        {analysis ? (
          <View className="card analysis-card">
            <View className="analysis-text">{analysis.summary}</View>
            <View className="analysis-section">
              <View className="analysis-title">主要弱点</View>
              {analysis.weaknesses.length ? (
                <View className="tag-line">
                  {analysis.weaknesses.map((item, index) => {
                    return (
                      <View key={item.id} className="soft-tag weakness-tag">
                        {item.name + ' × ' + item.count}
                      </View>
                    )
                  })}
                </View>
              ) : (
                <View className="analysis-empty">暂无明显共同弱点</View>
              )}
            </View>
            <View className="analysis-section">
              <View className="analysis-title">抗性覆盖</View>
              {analysis.resistances.length ? (
                <View className="tag-line">
                  {analysis.resistances.map((item, index) => {
                    return (
                      <View key={item.id} className="soft-tag resistance-tag">
                        {item.name + ' × ' + item.count}
                      </View>
                    )
                  })}
                </View>
              ) : (
                <View className="analysis-empty">暂无抗性覆盖</View>
              )}
            </View>
            {analysis.immunities.length > 0 && (
              <View className="analysis-section">
                <View className="analysis-title">免疫覆盖</View>
                <View className="tag-line">
                  {analysis.immunities.map((item, index) => {
                    return (
                      <View key={item.id} className="soft-tag immunity-tag">
                        {item.name + ' × ' + item.count}
                      </View>
                    )
                  })}
                </View>
              </View>
            )}
          </View>
        ) : (
          <View className="card team-empty-analysis">
            添加宝可梦后显示队伍属性分析
          </View>
        )}
        <View className="section">
          <View className="section-title">
            <Text>选择成员</Text>
            <Text className="muted">点击加入或移除</Text>
          </View>
          <View className="team-list">
            {pokemon?.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className={
                    'member-card card ' + (item.selected ? 'active' : '')
                  }
                  data-id={item.id}
                  onClick={this.toggleMember}
                >
                  <Image src={item.image} mode="aspectFit"></Image>
                  <View className="member-main">
                    <View className="member-name">{localize(item)}</View>
                    <View className="muted">{'#' + item.id + (getLocale() === 'en' ? '' : ' ' + item.name_en)}</View>
                    <View className="member-types">
                      {item.types.map((type, typeIndex) => {
                        return (
                          <View
                            key={type}
                            className={'type-badge type-' + type}
                          >
                            {item.typeNames[typeIndex]}
                          </View>
                        )
                      })}
                    </View>
                  </View>
                  <View className="member-mark">
                    {item.selected ? '✓' : '+'}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    )
  }
}
export default _C
