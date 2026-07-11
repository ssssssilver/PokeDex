import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, ScrollView, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const pokemonUtils = require('../../utils/pokemon.js')
import './index.scss'
const TYPE_META = pokemonUtils.TYPE_META || {}
function multiplierText(multiplier) {
  if (multiplier === 0) return '×0'
  if (multiplier === 0.25) return '×0.25'
  if (multiplier === 0.5) return '×0.5'
  if (multiplier === 4) return '×4'
  if (multiplier === 2) return '×2'
  return `×${multiplier}`
}
function typeChip(type, multiplier) {
  const meta = TYPE_META[type] || {}
  return {
    id: type,
    name: meta.name || type,
    color: meta.color || '#64748b',
    multiplier,
    multiplierText: multiplierText(multiplier),
  }
}
function cellTone(multiplier) {
  if (multiplier === 0) return 'zero'
  if (multiplier > 1) return 'super'
  if (multiplier < 1) return 'resist'
  return 'normal'
}
function buildTypeColumns() {
  return Object.keys(TYPE_META).map((type) => typeChip(type, 1))
}
function buildTypeTable() {
  const types = Object.keys(TYPE_META)
  return types.map((attackingType) => {
    const attack = typeChip(attackingType, 1)
    return Object.assign({}, attack, {
      cells: types.map((defenderType) => {
        const multiplier = pokemonUtils.getDamageMultiplier(attackingType, [
          defenderType,
        ])
        return {
          key: `${attackingType}-${defenderType}`,
          text: multiplierText(multiplier),
          tone: cellTone(multiplier),
        }
      }),
    })
  })
}
function decorateRelation(relation) {
  const item = relation || {}
  return Object.assign({}, item, {
    weakTo: (item.weakTo || []).map((type) => typeChip(type.id, 2)),
    resists: (item.resists || []).map((type) => typeChip(type.id, 0.5)),
    immuneTo: (item.immuneTo || []).map((type) => typeChip(type.id, 0)),
  })
}
cacheOptions.setOptionsToCache({
  data: {
    types: pokemonUtils.getAllTypes(),
    activeType: 'fire',
    relation: null,
    typeColumns: buildTypeColumns(),
    typeRows: buildTypeTable(),
  },
  onLoad(options) {
    const activeType = (options && options.type) || this.data.activeType
    this.setData({
      activeType,
    })
    api.getTypes().then((result) => {
      this.setData({
        types: result.items || this.data.types,
      })
      this.loadRelation()
    })
  },
  selectType(event) {
    this.setData({
      activeType: getTarget(event.currentTarget, Taro).dataset.type,
    })
    this.loadRelation()
  },
  loadRelation() {
    api.getTypeRelations(this.data.activeType).then((result) => {
      this.setData({
        relation: decorateRelation(result.item),
      })
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { types, activeType, relation, typeColumns, typeRows } = this.data
    return (
      <View className="page type-page">
        <ScrollView scrollX className="chip-scroll">
          <View className="chip-row">
            {types.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className={
                    'type-filter ' + (activeType === item.id ? 'active' : '')
                  }
                  style={{
                    borderColor: `${item.color}`,
                    color: `${activeType === item.id ? '#fff' : item.color}`,
                    background: `${
                      activeType === item.id ? item.color : '#fff'
                    }`,
                  }}
                  data-type={item.id}
                  onClick={this.selectType}
                >
                  {item.name}
                </View>
              )
            })}
          </View>
        </ScrollView>
        {relation && (
          <View className="card relation-card">
            <View className="relation-title">{relation.name + '属性防守'}</View>
            <View className="relation-section">
              <View className="section-label">弱点</View>
              <View className="tag-line">
                {relation.weakTo.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="relation-chip"
                      style={{
                        background: `${item.color}`,
                      }}
                    >
                      <Text>{item.name}</Text>
                      <Text>{item.multiplierText}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
            <View className="relation-section">
              <View className="section-label">抗性</View>
              <View className="tag-line">
                {relation.resists.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="relation-chip"
                      style={{
                        background: `${item.color}`,
                      }}
                    >
                      <Text>{item.name}</Text>
                      <Text>{item.multiplierText}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
            <View className="relation-section">
              <View className="section-label">免疫</View>
              <View className="tag-line">
                {relation.immuneTo.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="relation-chip"
                      style={{
                        background: `${item.color}`,
                      }}
                    >
                      <Text>{item.name}</Text>
                      <Text>{item.multiplierText}</Text>
                    </View>
                  )
                })}
                {relation.immuneTo.length === 0 && (
                  <View className="muted">暂无</View>
                )}
              </View>
            </View>
          </View>
        )}
        <View className="card chart-card">
          <View className="relation-title">属性相克表</View>
          <View className="muted chart-hint">纵轴攻击方，横轴防守方</View>
          <ScrollView scrollX className="type-table-scroll">
            <View className="matchup-table">
              <View className="table-row header-row">
                <View className="corner-cell">攻\防</View>
                {typeColumns.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="type-head"
                      style={{
                        background: `${item.color}`,
                      }}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
              {typeRows.map((row, index) => {
                return (
                  <View key={row.id} className="table-row">
                    <View
                      className="row-type"
                      style={{
                        background: `${row.color}`,
                      }}
                    >
                      {row.name}
                    </View>
                    {row.cells.map((cell, index) => {
                      return (
                        <View
                          key={cell.key}
                          className={'matchup-cell ' + cell.tone}
                        >
                          {cell.text}
                        </View>
                      )
                    })}
                  </View>
                )
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    )
  }
}
export default _C
