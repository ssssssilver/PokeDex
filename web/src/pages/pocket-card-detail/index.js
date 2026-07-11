import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
import EnergyIcon from '../../components/energy-icon/index'
import './index.scss'
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
const ENERGY_META = {
  1: {
    name: '无色',
    iconType: 'Colorless',
  },
  2: {
    name: '草',
    iconType: 'Grass',
  },
  3: {
    name: '火',
    iconType: 'Fire',
  },
  4: {
    name: '水',
    iconType: 'Water',
  },
  5: {
    name: '雷',
    iconType: 'Lightning',
  },
  6: {
    name: '超',
    iconType: 'Psychic',
  },
  7: {
    name: '斗',
    iconType: 'Fighting',
  },
  8: {
    name: '恶',
    iconType: 'Darkness',
  },
  9: {
    name: '钢',
    iconType: 'Metal',
  },
}
function cleanGameText(value) {
  return String(value || '')
    .replace(/\[Num:[^\]]+\]/g, '指定数值')
    .replace(/\[Img:[^\]]+\]/g, '对应属性')
    .replace(/\[\/?Ctrl:[^\]]+\]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim()
}
function energyCost(energy) {
  return Object.keys(energy || {}).reduce((rows, id) => {
    const count = Number(energy[id] || 0)
    return rows.concat(
      Array.from(
        {
          length: count,
        },
        () =>
          Object.assign(
            {
              id: `${id}-${rows.length}`,
            },
            ENERGY_META[id] || ENERGY_META[1]
          )
      )
    )
  }, [])
}
function acquisitionRows(source) {
  const rows = []
  if ((source.pack || []).length)
    rows.push({
      label: '卡包',
      value: `${source.pack.length} 个卡池`,
    })
  if ((source.itemShop || []).length || (source.goldShop || []).length)
    rows.push({
      label: '商店',
      value: '可兑换或购买',
    })
  if ((source.mission || []).length)
    rows.push({
      label: '任务',
      value: '任务奖励',
    })
  const wonder = source.wonderPick || {}
  if ((wonder.free || []).length || (wonder.chansey || []).length)
    rows.push({
      label: '得卡挑战',
      value: '活动卡池',
    })
  return rows.length
    ? rows
    : [
        {
          label: '获得方式',
          value: '暂无公开记录',
        },
      ]
}
function decorateCard(card) {
  const type = TYPE_META[(card.types || [])[0]] || TYPE_META[9]
  const weakness = card.weakness
    ? TYPE_META[card.weakness.id] || TYPE_META[9]
    : null
  return Object.assign({}, card, {
    type,
    weakness: card.weakness ? Object.assign({}, card.weakness, weakness) : null,
    retreatItems: Array.from(
      {
        length: Number(card.retreat || 0),
      },
      (unused, index) =>
        Object.assign(
          {
            id: index,
          },
          ENERGY_META[1]
        )
    ),
    collectionRows: (card.collections || []).map((item) =>
      Object.assign({}, item, {
        text: `${item.expansion_name_zh || item.expansion_id} · #${
          item.number
        }`,
      })
    ),
    attacks: (card.attacks || []).map((attack) =>
      Object.assign({}, attack, {
        costItems: energyCost(attack.energy),
        damageText:
          attack.damage && attack.damage.value !== undefined
            ? String(attack.damage.value)
            : '',
        descriptionText: cleanGameText(attack.description_zh_template),
      })
    ),
    abilities: (card.abilities || []).map((ability) =>
      Object.assign({}, ability, {
        descriptionText: cleanGameText(ability.description_zh_template),
      })
    ),
    acquisitionRows: acquisitionRows(card.source || {}),
  })
}
cacheOptions.setOptionsToCache({
  data: {
    loading: true,
    error: '',
    card: null,
    relatedPokemon: null,
    favorite: false,
    owned: false,
  },
  onLoad(options) {
    this.cardId = decodeURIComponent(options.id || '')
    this.loadCard()
  },
  loadCard() {
    this.setData({
      loading: true,
      error: '',
    })
    api
      .getPocketCard(this.cardId)
      .then((result) => {
        if (!result.item) throw new Error('卡牌不存在')
        const card = decorateCard(result.item)
        storage.addPocketRecent(card)
        this.setData({
          loading: false,
          card,
          favorite: storage.getPocketFavorites().includes(String(card.id)),
          owned: storage.getPocketOwned().includes(String(card.id)),
        })
        if (card.national_pokedex_number) {
          api
            .getPokemonById(card.national_pokedex_number)
            .then((pokemonResult) => {
              this.setData({
                relatedPokemon: pokemonResult.item || null,
              })
            })
            .catch(() =>
              this.setData({
                relatedPokemon: null,
              })
            )
        } else {
          this.setData({
            relatedPokemon: null,
          })
        }
        Taro.setNavigationBarTitle({
          title: card.name_zh || 'Pocket 卡牌详情',
        })
      })
      .catch((error) =>
        this.setData({
          loading: false,
          error: error.message || '详情加载失败',
        })
      )
  },
  previewImage() {
    if (!this.data.card || !this.data.card.image) return
    Taro.previewImage({
      current: this.data.card.image,
      urls: [this.data.card.image],
    })
  },
  toggleFavorite() {
    this.setData({
      favorite: storage.togglePocketFavorite(this.cardId),
    })
  },
  toggleOwned() {
    this.setData({
      owned: storage.togglePocketOwned(this.cardId),
    })
  },
  openPokemon() {
    const pokemon = this.data.relatedPokemon
    if (!pokemon || !pokemon.id) return
    Taro.navigateTo({
      url: `/pages/pokemon-detail/index?id=${pokemon.id}`,
    })
  },
  retry() {
    this.loadCard()
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { loading, error, card, relatedPokemon, favorite, owned } = this.data
    return (
      <View className="page pocket-detail-page">
        {loading ? (
          <View className="detail-state">卡牌详情加载中</View>
        ) : error ? (
          <View className="detail-state error" onClick={this.retry}>
            {error}
          </View>
        ) : (
          card && (
            <Block>
              <View className="detail-top">
                <View className="detail-art" onClick={this.previewImage}>
                  <Image src={card.image} mode="aspectFit"></Image>
                </View>
                <View className="detail-copy">
                  <View className="detail-code">
                    {card.collectionRows[0].expansion_id +
                      ' #' +
                      card.collectionRows[0].number}
                  </View>
                  <View className="detail-name">{card.name_zh}</View>
                  <View className="detail-en">{card.name_en}</View>
                  <View className="detail-badges">
                    <EnergyIcon
                      type={card.type.iconType}
                      label={card.type.name + '能量'}
                    ></EnergyIcon>
                    <Text className="rarity">{card.rarity}</Text>
                    {card.is_ex && <Text className="ex">ex</Text>}
                  </View>
                </View>
              </View>
              <View className="detail-section stats-section">
                <View className="section-heading">基础数据</View>
                <View className="stats-grid">
                  <View>
                    <Text>HP</Text>
                    <Strong>{card.hp || '-'}</Strong>
                  </View>
                  <View>
                    <Text>卡牌类型</Text>
                    <Strong>
                      {card.card_type === 'pokemon' ? '宝可梦' : '训练家'}
                    </Strong>
                  </View>
                  <View>
                    <Text>弱点</Text>
                    {card.weakness ? (
                      <View className="weakness-energy">
                        <EnergyIcon
                          type={card.weakness.iconType}
                          label={card.weakness.name + '能量'}
                        ></EnergyIcon>
                        <Strong>{'+' + card.weakness.bonus}</Strong>
                      </View>
                    ) : (
                      <Strong>-</Strong>
                    )}
                  </View>
                  <View>
                    <Text>撤退费用</Text>
                    <View className="energy-line">
                      {card.retreatItems.map((item, index) => {
                        return (
                          <EnergyIcon
                            key={item.id}
                            type={item.iconType}
                            label={item.name + '能量'}
                          ></EnergyIcon>
                        )
                      })}
                      {!card.retreatItems.length && <Strong>0</Strong>}
                    </View>
                  </View>
                </View>
              </View>
              {card.abilities.length > 0 && (
                <View className="detail-section">
                  <View className="section-heading">特性</View>
                  {card.abilities.map((item, index) => {
                    return (
                      <View key={item.id} className="move-row">
                        <View className="move-head">
                          <View className="ability-label">特性</View>
                          <View className="move-name">{item.name_zh}</View>
                        </View>
                        {item.descriptionText && (
                          <View className="move-text">
                            {item.descriptionText}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
              {card.attacks.length > 0 && (
                <View className="detail-section">
                  <View className="section-heading">招式</View>
                  {card.attacks.map((item, index) => {
                    return (
                      <View key={item.id} className="move-row">
                        <View className="move-head">
                          <View className="energy-line">
                            {item.costItems.map((energy, index) => {
                              return (
                                <EnergyIcon
                                  key={energy.id}
                                  type={energy.iconType}
                                  label={energy.name + '能量'}
                                ></EnergyIcon>
                              )
                            })}
                          </View>
                          <View className="move-name">{item.name_zh}</View>
                          <View className="move-damage">{item.damageText}</View>
                        </View>
                        {item.descriptionText && (
                          <View className="move-text">
                            {item.descriptionText}
                          </View>
                        )}
                      </View>
                    )
                  })}
                </View>
              )}
              <View className="detail-section">
                <View className="section-heading">图鉴编号</View>
                <View className="collection-list">
                  {card.collectionRows.map((item, index) => {
                    return (
                      <View key={item.key} className="collection-row">
                        <Text>{item.text}</Text>
                        <Text>
                          {card.mirror_type === 'normalMirror' ? '镜面' : ''}
                        </Text>
                      </View>
                    )
                  })}
                </View>
              </View>
              <View className="detail-section">
                <View className="section-heading">获得方式</View>
                <View className="acquisition-list">
                  {card.acquisitionRows.map((item, index) => {
                    return (
                      <View key={item.label}>
                        <Text>{item.label}</Text>
                        <Text>{item.value}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
              {relatedPokemon && (
                <View className="detail-section">
                  <View className="section-heading">关联宝可梦</View>
                  <View className="related-pokemon" onClick={this.openPokemon}>
                    <Image src={relatedPokemon.image} mode="aspectFit"></Image>
                    <View>
                      <Strong>{relatedPokemon.name_zh}</Strong>
                      <Text>
                        {'#' + relatedPokemon.id + ' ' + relatedPokemon.name_en}
                      </Text>
                    </View>
                    <Text className="related-arrow">›</Text>
                  </View>
                </View>
              )}
            </Block>
          )
        )}
        {card && (
          <View className="detail-actions">
            <View
              className={'action-secondary ' + (favorite ? 'active' : '')}
              onClick={this.toggleFavorite}
            >
              {favorite ? '★ 已收藏' : '☆ 收藏'}
            </View>
            <View
              className={'action-primary ' + (owned ? 'owned' : '')}
              onClick={this.toggleOwned}
            >
              {owned ? '已拥有' : '标记拥有'}
            </View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
