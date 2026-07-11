import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image, Text } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { getLocale, localize } = require('../../i18n/index.js')
import EnergyIcon from '../../components/energy-icon/index'
import './index.scss'
const ENERGY_BY_NAME = {
  草: {
    id: 'Grass',
    name: '草',
    symbol: '草',
    color: '#2f9e44',
  },
  火: {
    id: 'Fire',
    name: '火',
    symbol: '火',
    color: '#e85d3f',
  },
  水: {
    id: 'Water',
    name: '水',
    symbol: '水',
    color: '#2f80ed',
  },
  雷: {
    id: 'Lightning',
    name: '雷',
    symbol: '雷',
    color: '#d99a00',
  },
  电: {
    id: 'Lightning',
    name: '雷',
    symbol: '雷',
    color: '#d99a00',
  },
  超: {
    id: 'Psychic',
    name: '超',
    symbol: '超',
    color: '#db2777',
  },
  超能力: {
    id: 'Psychic',
    name: '超',
    symbol: '超',
    color: '#db2777',
  },
  斗: {
    id: 'Fighting',
    name: '斗',
    symbol: '斗',
    color: '#c2410c',
  },
  恶: {
    id: 'Darkness',
    name: '恶',
    symbol: '恶',
    color: '#374151',
  },
  钢: {
    id: 'Metal',
    name: '钢',
    symbol: '钢',
    color: '#64748b',
  },
  妖: {
    id: 'Fairy',
    name: '妖',
    symbol: '妖',
    color: '#ec4899',
  },
  妖精: {
    id: 'Fairy',
    name: '妖',
    symbol: '妖',
    color: '#ec4899',
  },
  龙: {
    id: 'Dragon',
    name: '龙',
    symbol: '龙',
    color: '#2563eb',
  },
  无色: {
    id: 'Colorless',
    name: '无色',
    symbol: '无',
    color: '#8a8f98',
  },
}
function valueText(value) {
  if (value === undefined || value === null || value === '') return ''
  return `${value}`
}
function row(label, value) {
  const text = valueText(value)
  return text
    ? {
        label,
        value: text,
      }
    : null
}
function joinValues(items) {
  return (items || []).filter(Boolean).join('、')
}
function normalizeEnergy(item) {
  const source = item || {}
  const name = source.name || source.id || ''
  return {
    id: source.id || name,
    name,
    symbol: source.symbol || String(name).slice(0, 1),
    color: source.color || '#64748b',
  }
}
function normalizeEnergies(items, text) {
  if (items && items.length) return items.map(normalizeEnergy)
  return String(text || '')
    .split('、')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) =>
      normalizeEnergy(
        ENERGY_BY_NAME[name] || {
          name,
        }
      )
    )
}
function buildInfoRows(card) {
  const english = getLocale() === 'en'
  return [
    row(
      '卡牌编号',
      card.number ? `${card.set_id || ''} #${card.number}` : card.id
    ),
    row('系列', [card.set_name, card.set_series].filter(Boolean).join(' / ')),
    row('稀有度', english ? card.rarity : card.rarity_name || card.rarity),
    row('画师', card.artist),
    row(
      '卡牌类型',
      english
        ? [card.supertype, ...(card.subtypes || [])]
        : [card.supertype_name || card.supertype, ...(card.subtype_names || card.subtypes || [])]
        .filter(Boolean)
        .join(' / ')
    ),
    row('HP', card.hp),
    row('规则标记', card.regulation_mark),
    row(
      '发售日期',
      card.set_release_date || (card.set && card.set.release_date)
    ),
  ].filter(Boolean)
}
function buildBattleRows(card) {
  return [
    row('进化自', card.evolves_from),
    row('可进化为', joinValues(card.evolves_to)),
    row(
      '全国图鉴',
      (card.national_pokedex_numbers || []).map((id) => `#${id}`).join('、')
    ),
  ].filter(Boolean)
}
function decorateCard(card) {
  const english = getLocale() === 'en'
  const title = localize(card) || card.display_name
  const descriptionText = english
    ? card.flavor_text_en || card.flavor_text || card.description_zh || ''
    : card.description_zh || card.flavor_text || ''
  const descriptionEnglish = !english && card.description_zh
    ? card.flavor_text_en || card.flavor_text || ''
    : ''
  const decorateTextBlock = (item) =>
    Object.assign({}, item, {
      display_name: english ? item.name || item.name_zh : item.name_zh || item.name,
      english_name: !english && item.name_zh && item.name_zh !== item.name ? item.name : '',
      display_text: english ? item.original_text || item.text || item.text_zh || '' : item.text_zh || item.text || item.original_text || '',
      english_text: !english && item.text_zh ? item.original_text || item.text || '' : '',
    })
  const ruleBlocks = (
    card.rule_blocks ||
    (card.rules || []).map((rule) => ({
      original_text: rule,
    }))
  ).map((rule, index) => ({
    key: `${index}-${rule.text_zh || rule.original_text || ''}`,
    display_text: english ? rule.original_text || rule.text_zh || '' : rule.text_zh || rule.original_text || '',
    english_text: !english && rule.text_zh ? rule.original_text || '' : '',
  }))
  return Object.assign(
    {
      type_energy: [],
      abilities: [],
      attacks: [],
      weaknesses: [],
      resistances: [],
      rules: [],
      retreat_cost_energy: [],
      pokemon_refs: [],
      national_pokedex_numbers: [],
      legalities_text: [],
    },
    card,
    {
      title,
      rarityDisplay: english ? card.rarity : card.rarity_name || card.rarity,
      subtitle: !english && card.name_zh && card.name_zh !== card.name ? card.name : '',
      type_energy: normalizeEnergies(card.type_energy),
      abilities: (card.abilities || []).map(decorateTextBlock),
      attacks: (card.attacks || []).map((attack) =>
        Object.assign({}, decorateTextBlock(attack), {
          cost_energy: normalizeEnergies(attack.cost_energy, attack.cost_text),
        })
      ),
      ruleBlocks,
      retreat_cost_energy: normalizeEnergies(
        card.retreat_cost_energy,
        card.retreat_cost_text
      ),
      descriptionText,
      descriptionEnglish,
      descriptionSource: english ? '' : card.description_source || (descriptionText ? '原卡牌描述' : ''),
      typeText: (english ? card.types || [] : card.type_names || card.types || []).join(' / '),
      legalitiesText: (card.legalities_text || [])
        .map(
          (item) =>
            `${english ? item.key : item.name}${english ? `: ${item.status}` : item.status_name ? `：${item.status_name}` : ''}`
        )
        .join('、'),
    }
  )
}
cacheOptions.setOptionsToCache({
  data: {
    id: '',
    card: null,
    infoRows: [],
    battleRows: [],
    favorite: false,
    owned: false,
    wishlisted: false,
  },
  onLoad(options) {
    this.setData({
      id: decodeURIComponent(options.id || ''),
    })
    this.loadCard()
  },
  loadCard() {
    api.getCardById(this.data.id).then((result) => {
      const raw = result.item
      if (!raw) return
      const card = decorateCard(raw)
      this.setData({
        card,
        infoRows: buildInfoRows(card),
        battleRows: buildBattleRows(card),
        favorite: storage.isCardFavorite(card.id),
        owned: storage.isCardOwned(card.id),
        wishlisted: storage.isCardWishlisted(card.id),
      })
      storage.addRecentCard(card)
    })
  },
  previewImage() {
    const card = this.data.card || {}
    const url = card.image_large || card.image || card.image_small
    if (!url) return
    Taro.previewImage({
      urls: [url],
      current: url,
    })
  },
  toggleFavorite() {
    const favorite = storage.toggleCardFavorite(this.data.card.id)
    this.setData({
      favorite,
    })
    Taro.showToast({
      title: favorite ? '已收藏' : '已取消',
      icon: 'none',
    })
  },
  toggleOwned() {
    const owned = storage.toggleCardOwned(this.data.card.id)
    this.setData({
      owned,
    })
    Taro.showToast({
      title: owned ? '已标记拥有' : '已取消拥有',
      icon: 'none',
    })
  },
  toggleWishlist() {
    const wishlisted = storage.toggleCardWishlist(this.data.card.id)
    this.setData({
      wishlisted,
    })
    Taro.showToast({
      title: wishlisted ? '已加入愿望单' : '已移出愿望单',
      icon: 'none',
    })
  },
  openPokemon(event) {
    const id = Number(getTarget(event.currentTarget, Taro).dataset.id || 0)
    if (!id) return
    Taro.navigateTo({
      url: `/pages/pokemon-detail/index?id=${id}`,
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { card, favorite, owned, wishlisted, infoRows, battleRows } =
      this.data
    return card ? (
      <View className="page card-detail-page">
        <View className="detail-hero card">
          <View className="card-art-large" onClick={this.previewImage}>
            {card.image_large || card.image ? (
              <Image
                src={card.image_large || card.image}
                mode="aspectFit"
              ></Image>
            ) : (
              <View className="card-art-empty">CARD</View>
            )}
          </View>
          <View className="hero-copy">
            <View className="hero-meta">
              <Text>{card.set_id + ' #' + card.number}</Text>
              {card.regulation_mark && <Text>{card.regulation_mark}</Text>}
            </View>
            <View className="hero-name">{card.title}</View>
            {card.subtitle && (
              <View className="hero-subtitle">{card.subtitle}</View>
            )}
            <View className="hero-tags">
              {card.type_energy.map((item, index) => {
                return (
                  <EnergyIcon
                    key={item.id}
                    type={item.id}
                    label={item.name + '能量'}
                  ></EnergyIcon>
                )
              })}
              {card.rarityDisplay && (
                <View className="plain-badge">{card.rarityDisplay}</View>
              )}
            </View>
            <View className="hero-actions">
              <View
                className={'action ' + (favorite ? 'active' : '')}
                onClick={this.toggleFavorite}
              >
                {favorite ? '已收藏' : '收藏'}
              </View>
              <View
                className={'action ' + (owned ? 'active' : '')}
                onClick={this.toggleOwned}
              >
                {owned ? '已拥有' : '标拥有'}
              </View>
              <View
                className={'action ' + (wishlisted ? 'active' : '')}
                onClick={this.toggleWishlist}
              >
                {wishlisted ? '愿望中' : '愿望单'}
              </View>
            </View>
          </View>
        </View>
        <View className="card info-card">
          <View className="section-title compact">基础资料</View>
          <View className="info-grid">
            {infoRows?.map((item, index) => {
              return (
                <View key={item.label} className="info-row">
                  <View className="muted">{item.label}</View>
                  <View>{item.value}</View>
                </View>
              )
            })}
          </View>
        </View>
        {card.descriptionText && (
          <View className="card info-card">
            <View className="section-title compact">中文描述</View>
            <View className="block-copy">{card.descriptionText}</View>
            {card.descriptionEnglish && (
              <View className="translation-en">{card.descriptionEnglish}</View>
            )}
            {card.descriptionSource && (
              <View className="description-source">
                {card.descriptionSource}
              </View>
            )}
          </View>
        )}
        {card.abilities.length > 0 && (
          <View className="card info-card">
            <View className="section-title compact">特性</View>
            {card.abilities.map((item, index) => {
              return (
                <View key={item.name} className="text-block">
                  <View className="block-title">
                    {item.display_name}
                    {item.type_name && <Text>{'· ' + item.type_name}</Text>}
                  </View>
                  {item.english_name && (
                    <View className="block-name-en">{item.english_name}</View>
                  )}
                  {item.display_text && (
                    <View className="block-copy">{item.display_text}</View>
                  )}
                  {item.english_text && (
                    <View className="translation-en">{item.english_text}</View>
                  )}
                </View>
              )
            })}
          </View>
        )}
        {card.attacks.length > 0 && (
          <View className="card info-card">
            <View className="section-title compact">招式</View>
            {card.attacks.map((item, index) => {
              return (
                <View key={item.name} className="attack-row">
                  <View className="attack-head">
                    <View>
                      <View className="block-title">{item.display_name}</View>
                      {item.english_name && (
                        <View className="block-name-en">
                          {item.english_name}
                        </View>
                      )}
                    </View>
                    <View className="damage">{item.damage || '-'}</View>
                  </View>
                  <View className="cost-line">
                    <Text className="cost-label">费用</Text>
                    <View className="energy-icon-row">
                      {item.cost_energy.map((item, index) => {
                        return (
                          <EnergyIcon
                            key={item.id}
                            type={item.id}
                            label={item.name + '能量'}
                          ></EnergyIcon>
                        )
                      })}
                      {!item.cost_energy.length && (
                        <Text className="muted">-</Text>
                      )}
                    </View>
                    <Text className="cost-total">
                      {'总能量 ' + item.converted_energy_cost}
                    </Text>
                  </View>
                  {item.display_text && (
                    <View className="block-copy">{item.display_text}</View>
                  )}
                  {item.english_text && (
                    <View className="translation-en">{item.english_text}</View>
                  )}
                </View>
              )
            })}
          </View>
        )}
        <View className="card info-card">
          <View className="section-title compact">对战资料</View>
          <View className="info-grid">
            {battleRows?.map((item, index) => {
              return (
                <View key={item.label} className="info-row">
                  <View className="muted">{item.label}</View>
                  <View>{item.value}</View>
                </View>
              )
            })}
          </View>
          <View className="retreat-cost-row">
            <View className="muted">撤退费用</View>
            <View className="energy-icon-row">
              {card.retreat_cost_energy.map((item, index) => {
                return (
                  <EnergyIcon
                    key={item.id}
                    type={item.id}
                    label={item.name + '能量'}
                  ></EnergyIcon>
                )
              })}
              {!card.retreat_cost_energy.length && (
                <Text className="muted">无</Text>
              )}
            </View>
            <View className="cost-total">
              {(card.converted_retreat_cost || 0) + ' 能量'}
            </View>
          </View>
          {card.weaknesses.length > 0 && (
            <View className="relation-group">
              <View className="muted">弱点</View>
              <View className="relation-row">
                {card.weaknesses.map((item, index) => {
                  return (
                    <View key={item.type} className="relation-chip">
                      <EnergyIcon
                        type={item.type}
                        label={item.type_name + '能量'}
                      ></EnergyIcon>
                      <Text>{item.type_name + ' ' + item.value}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}
          {card.resistances.length > 0 && (
            <View className="relation-group">
              <View className="muted">抵抗</View>
              <View className="relation-row">
                {card.resistances.map((item, index) => {
                  return (
                    <View key={item.type} className="relation-chip">
                      <EnergyIcon
                        type={item.type}
                        label={item.type_name + '能量'}
                      ></EnergyIcon>
                      <Text>{item.type_name + ' ' + item.value}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          )}
        </View>
        {(card.ruleBlocks.length || card.legalitiesText) && (
          <View className="card info-card">
            <View className="section-title compact">规则</View>
            {card.legalitiesText && (
              <View className="block-copy">{card.legalitiesText}</View>
            )}
            {card.ruleBlocks.map((item, index) => {
              return (
                <View key={item.key} className="rule-row">
                  <View>{item.display_text}</View>
                  {item.english_text && (
                    <View className="translation-en rule-translation-en">
                      {item.english_text}
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
        {card.pokemon_refs.length > 0 && (
          <View className="card info-card">
            <View className="section-title compact">关联宝可梦</View>
            <View className="pokemon-ref-row">
              {card.pokemon_refs.map((item, index) => {
                return (
                  <View
                    key={item.id}
                    className="pokemon-ref"
                    data-id={item.id}
                    onClick={this.openPokemon}
                  >
                    <View className="ref-number">{'#' + item.id}</View>
                    <View>{localize(item)}</View>
                  </View>
                )
              })}
            </View>
          </View>
        )}
      </View>
    ) : (
      <View className="page">
        <View className="card empty-state">
          <View className="title">卡牌加载中</View>
          <View className="hint">正在读取卡牌详情。</View>
        </View>
      </View>
    )
  }
}
export default _C
