import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Text, Image, ScrollView } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { TYPE_META } = require('../../utils/type-meta.js')
import './index.scss'
const MOVE_PAGE_SIZE = 60
const STAT_ROWS = [
  {
    key: 'hp',
    name: 'HP',
  },
  {
    key: 'attack',
    name: '攻击',
  },
  {
    key: 'defense',
    name: '防御',
  },
  {
    key: 'specialAttack',
    name: '特攻',
  },
  {
    key: 'specialDefense',
    name: '特防',
  },
  {
    key: 'speed',
    name: '速度',
  },
]
const MOVE_METHOD_OPTIONS = [
  {
    id: '',
    name: '全部',
  },
  {
    id: 'level-up',
    name: '升级',
  },
  {
    id: 'machine',
    name: '招式机',
  },
  {
    id: 'egg',
    name: '遗传',
  },
  {
    id: 'tutor',
    name: '教学',
  },
  {
    id: 'other',
    name: '其他',
  },
]
const GROWTH_RATE_NAMES = {
  slow: '慢',
  medium: '中等',
  'medium-slow': '中等偏慢',
  fast: '快',
  'slow-then-very-fast': '先慢后快',
  'fast-then-very-slow': '先快后慢',
}
const LANGUAGE_PRIORITY = {
  'zh-hans': 0,
  'zh-hant': 1,
  ja: 2,
  'ja-hrkt': 3,
  en: 4,
}
const DEX_GENERATION_MAP = {
  national: 0,
  kanto: 1,
  'letsgo-kanto': 7,
  'original-johto': 2,
  'updated-johto': 4,
  hoenn: 3,
  'updated-hoenn': 6,
  'original-sinnoh': 4,
  'extended-sinnoh': 4,
  'original-unova': 5,
  'updated-unova': 5,
  'kalos-central': 6,
  'kalos-coastal': 6,
  'kalos-mountain': 6,
  'original-alola': 7,
  'updated-alola': 7,
  galar: 8,
  'isle-of-armor': 8,
  'crown-tundra': 8,
  hisui: 8,
  paldea: 9,
  kitakami: 9,
  blueberry: 9,
}
const CHINESE_LANGUAGES = ['zh-hans', 'zh-hant']
function padId(id) {
  return String(id || 0).padStart(4, '0')
}
function joinNames(items) {
  return (
    (items || [])
      .map((item) => item.name || item)
      .filter(Boolean)
      .join('、') || '暂无'
  )
}
function titleCase(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
function growthRateName(value) {
  return GROWTH_RATE_NAMES[value] || titleCase(value) || '未知'
}
function valueText(value, fallback) {
  if (value === '' || value === null || value === undefined)
    return fallback || '-'
  return `${value}`
}
function percentText(value) {
  if (value === '' || value === null || value === undefined) return ''
  return `${value}%`
}
function normalizeAbility(item) {
  if (typeof item === 'string') {
    return {
      key: item,
      name: item,
      name_en: '',
      name_ja: '',
      is_hidden: false,
      short_effect: '',
      flavor: '',
      description: '',
    }
  }
  const ability = Object.assign(
    {
      key: '',
      name: '',
      name_en: '',
      name_ja: '',
      is_hidden: false,
      short_effect: '',
      flavor: '',
    },
    item || {}
  )
  ability.description = ability.flavor || ability.short_effect || ''
  return ability
}
function methodGroup(method) {
  if (!method) return 'other'
  if (MOVE_METHOD_OPTIONS.find((item) => item.id === method)) return method
  if (method === 'light-ball-egg') return 'egg'
  return 'other'
}
function normalizeMove(item) {
  if (typeof item === 'string') {
    return {
      key: item,
      name: item,
      name_en: '',
      nameEnVisible: false,
      type: '',
      type_name: '',
      type_color: '#64748b',
      damage_class_name: '',
      powerText: '-',
      accuracyText: '-',
      ppText: '-',
      priorityText: '0',
      timeText: '',
      method: 'other',
      method_group: 'other',
      method_name: '推荐',
      level: 0,
      levelText: '',
      version_group_name: '',
      learnText: '',
    }
  }
  const move = item || {}
  const method = move.method || 'other'
  const level = Number(move.level || 0)
  const name = move.name || titleCase(move.key)
  const nameEn = move.name_en || ''
  const type = move.type || ''
  return Object.assign({}, move, {
    name,
    name_en: nameEn,
    nameEnVisible: Boolean(nameEn && nameEn !== name),
    type,
    type_name: move.type_name || typeName(type),
    type_color: typeColor(type),
    damage_class_name: move.damage_class_name || '-',
    category_name: move.category_name || '',
    powerText: valueText(move.power),
    accuracyText: valueText(move.accuracy),
    ppText: valueText(move.pp),
    priorityText: valueText(move.priority, '0'),
    method_group: methodGroup(method),
    method_name: move.method_name || titleCase(method),
    levelText: level ? `Lv.${level}` : '',
    learnText: [level ? `Lv.${level}` : '', move.version_group_name || '']
      .filter(Boolean)
      .join(' / '),
    timeText:
      move.learn_time ||
      [
        move.method_name || titleCase(method),
        level ? `Lv.${level}` : '',
        move.version_group_name || '',
      ]
        .filter(Boolean)
        .join(' / '),
  })
}
function buildMoveState(pokemon, activeMethod, moveLimit) {
  const allMoves = (
    pokemon.moves && pokemon.moves.length
      ? pokemon.moves
      : pokemon.moves_summary || []
  ).map(normalizeMove)
  const filtered = activeMethod
    ? allMoves.filter((move) => move.method_group === activeMethod)
    : allMoves
  const visible = filtered.slice(0, moveLimit)
  return {
    moves: visible,
    moveTotal: allMoves.length,
    filteredMoveTotal: filtered.length,
    canShowMoreMoves: visible.length < filtered.length,
  }
}
function buildFlavorGroups(entries) {
  const groups = {}
  ;(entries || []).forEach((entry) => {
    if (!entry || !entry.text) return
    const key = entry.generation ? String(entry.generation) : 'other'
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  })
  return Object.keys(groups)
    .sort((a, b) => {
      if (a === 'other') return 1
      if (b === 'other') return -1
      return Number(a) - Number(b)
    })
    .map((key) => {
      const seen = {}
      const items = groups[key]
        .slice()
        .sort((a, b) => {
          const aPriority =
            LANGUAGE_PRIORITY[a.language] === undefined
              ? 9
              : LANGUAGE_PRIORITY[a.language]
          const bPriority =
            LANGUAGE_PRIORITY[b.language] === undefined
              ? 9
              : LANGUAGE_PRIORITY[b.language]
          return aPriority - bPriority
        })
        .filter((entry) => {
          if (seen[entry.text]) return false
          seen[entry.text] = true
          return true
        })
        .slice(0, 3)
        .map((entry) => ({
          key: `${entry.version}-${entry.language}-${entry.text}`,
          version: entry.version_name || titleCase(entry.version),
          text: entry.text,
        }))
      return {
        key,
        title: key === 'other' ? '其他版本' : `第 ${key} 世代`,
        items,
      }
    })
    .filter((group) => group.items.length)
}
function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''))
}
function isChineseFlavor(entry) {
  return (
    entry &&
    CHINESE_LANGUAGES.includes(String(entry.language || '').toLowerCase()) &&
    entry.text
  )
}
function sortFlavorEntries(entries) {
  return (entries || []).slice().sort((a, b) => {
    const aPriority =
      LANGUAGE_PRIORITY[a.language] === undefined
        ? 9
        : LANGUAGE_PRIORITY[a.language]
    const bPriority =
      LANGUAGE_PRIORITY[b.language] === undefined
        ? 9
        : LANGUAGE_PRIORITY[b.language]
    const aGeneration = Number(a.generation || 99)
    const bGeneration = Number(b.generation || 99)
    return aPriority - bPriority || aGeneration - bGeneration
  })
}
function buildSelectedFlavor(pokemon, selectedDex) {
  const targetGeneration =
    selectedDex && selectedDex.generation
      ? Number(selectedDex.generation)
      : Number(pokemon.generation || 0)
  const entries = sortFlavorEntries(pokemon.flavor_entries || [])
  const chineseEntries = entries.filter(isChineseFlavor)
  const sameGeneration = chineseEntries.find(
    (entry) => Number(entry.generation || 0) === targetGeneration
  )
  const samePokemonGeneration = chineseEntries.find(
    (entry) => Number(entry.generation || 0) === Number(pokemon.generation || 0)
  )
  const fallbackFlavor = hasChineseText(pokemon.flavor) ? pokemon.flavor : ''
  const selected =
    sameGeneration || samePokemonGeneration || chineseEntries[0] || null
  const title = selectedDex
    ? `${selectedDex.label}${
        targetGeneration ? ` · 第 ${targetGeneration} 世代` : ''
      }`
    : '中文图鉴描述'
  if (selected) {
    return {
      title,
      version: selected.version_name || titleCase(selected.version),
      text: selected.text,
    }
  }
  return {
    title,
    version: fallbackFlavor ? '中文通用描述' : '',
    text: fallbackFlavor || '暂无中文图鉴描述',
  }
}
function buildEncounterRows(encounters) {
  const rows = (encounters && encounters.rows ? encounters.rows : []).map(
    (row, index) => {
      const minLevel = Number(row.min_level || 0)
      const maxLevel = Number(row.max_level || 0)
      return Object.assign({}, row, {
        key: `${row.location}-${row.version}-${index}`,
        levelText:
          minLevel && maxLevel
            ? minLevel === maxLevel
              ? `Lv.${minLevel}`
              : `Lv.${minLevel}-${maxLevel}`
            : '',
        chanceText: row.chance ? `${row.chance}%` : '',
      })
    }
  )
  return {
    rows,
    locations: encounters && encounters.locations ? encounters.locations : [],
    methods: encounters && encounters.methods ? encounters.methods : [],
    count: encounters ? Number(encounters.count || rows.length || 0) : 0,
  }
}
function row(label, value) {
  return value === '' || value === null || value === undefined
    ? null
    : {
        label,
        value: `${value}`,
      }
}
function buildMoveDetail(move) {
  const item = normalizeMove(move || {})
  const mainRows = [
    row('属性', item.type_name),
    row('分类', item.damage_class_name),
    row('威力', item.powerText),
    row('命中', item.accuracyText),
    row('PP', item.ppText),
    row('优先度', item.priorityText),
    row('目标', item.target_name),
    row('学习方式', item.method_name),
    row('学习时间', item.timeText),
    row('版本', item.version_group_name),
    row('世代', item.generation_name),
    row('效果概率', percentText(item.effect_chance)),
    row('招式机记录', item.machine_count ? `${item.machine_count} 个版本` : ''),
  ].filter(Boolean)
  const extraRows = [
    row(
      '异常状态',
      item.ailment_name && item.ailment_name !== '无' ? item.ailment_name : ''
    ),
    row('效果类别', item.category_name),
    row(
      '连续次数',
      item.min_hits || item.max_hits
        ? `${valueText(item.min_hits)}-${valueText(item.max_hits)}`
        : ''
    ),
    row(
      '持续回合',
      item.min_turns || item.max_turns
        ? `${valueText(item.min_turns)}-${valueText(item.max_turns)}`
        : ''
    ),
    row('吸取/反伤', item.drain ? `${item.drain}%` : ''),
    row('回复', item.healing ? `${item.healing}%` : ''),
    row('击中要害等级', item.crit_rate ? `${item.crit_rate}` : ''),
    row('异常概率', percentText(item.ailment_chance)),
    row('畏缩概率', percentText(item.flinch_chance)),
    row('能力变化概率', percentText(item.stat_chance)),
  ].filter(Boolean)
  return Object.assign({}, item, {
    mainRows,
    extraRows,
    statChanges: item.stat_changes || [],
    hasExtra: extraRows.length || (item.stat_changes || []).length,
    descriptionText: item.description || '暂无中文招式说明',
    effectText: item.short_effect || item.effect || '',
    fullEffectText: item.effect || '',
  })
}
function buildInfoRows(pokemon) {
  return [
    {
      label: '全国编号',
      value: `#${padId(pokemon.id)}`,
    },
    {
      label: '世代',
      value: pokemon.generation ? `第 ${pokemon.generation} 世代` : '未知',
    },
    {
      label: '分类',
      value: pokemon.category || '未知',
    },
    {
      label: '身高',
      value: pokemon.height || '-',
    },
    {
      label: '体重',
      value: pokemon.weight || '-',
    },
    {
      label: '捕获率',
      value: pokemon.capture_rate || '-',
    },
    {
      label: '种族值',
      value: pokemon.stat_total || '-',
    },
    {
      label: '招式数',
      value: pokemon.move_count || (pokemon.moves || []).length || '-',
    },
  ]
}
function buildBreedingRows(pokemon) {
  return [
    {
      label: '蛋群',
      value: joinNames(pokemon.egg_groups),
    },
    {
      label: '性别比例',
      value: pokemon.gender_text || '未知',
    },
    {
      label: '孵化周期',
      value:
        pokemon.hatch_counter !== undefined ? `${pokemon.hatch_counter}` : '-',
    },
    {
      label: '基础亲密度',
      value:
        pokemon.base_happiness !== undefined
          ? `${pokemon.base_happiness}`
          : '-',
    },
    {
      label: '成长速度',
      value: growthRateName(pokemon.growth_rate),
    },
  ]
}
function buildRegionalDexes(pokemon, selectedKey) {
  const fallbackGeneration = Number(pokemon.generation || 0)
  return (pokemon.regional_dexes || []).map((item, index) => {
    const key = item.key || `${item.name}-${index}`
    return Object.assign({}, item, {
      key,
      generation:
        DEX_GENERATION_MAP[key] === undefined
          ? fallbackGeneration
          : DEX_GENERATION_MAP[key],
      label: `${item.name} #${item.entry_number}`,
      selected: key === selectedKey,
    })
  })
}
function buildStatRows(pokemon) {
  const stats = pokemon.stats || {}
  const evByKey = {}
  ;(pokemon.ev_yield || []).forEach((item) => {
    evByKey[item.key] = item
  })
  return STAT_ROWS.map((stat) => {
    const value = Number(stats[stat.key] || 0)
    const apiKey =
      stat.key === 'specialAttack'
        ? 'special-attack'
        : stat.key === 'specialDefense'
        ? 'special-defense'
        : stat.key
    const ev = evByKey[apiKey] || evByKey[stat.key]
    return {
      key: stat.key,
      name: stat.name,
      value,
      percent: Math.min(100, Math.max(8, Math.round((value / 160) * 100))),
      evText: ev ? `+${ev.value}` : '',
    }
  })
}
function buildEvolutionRows(pokemon) {
  const conditionByTarget = {}
  ;(pokemon.evolution_conditions || []).forEach((item) => {
    conditionByTarget[Number(item.to_id)] = item
  })
  return (pokemon.evolution || []).map((item, index) => {
    const condition = conditionByTarget[Number(item.id)]
    return Object.assign({}, item, {
      conditionText:
        index === 0
          ? '起点'
          : (condition && condition.text) || '进化条件待补充',
      active: Number(item.id) === Number(pokemon.id),
    })
  })
}
function typeName(type) {
  return TYPE_META[type] ? TYPE_META[type].name : type
}
function typeColor(type) {
  return TYPE_META[type] ? TYPE_META[type].color : '#64748b'
}
function buildDefensiveRelations(pokemon) {
  return pokemon.defensive_relations || {
    weaknesses: [],
    resistances: [],
    immunities: [],
  }
}
function normalizeModelForms(model3d) {
  if (!model3d) return []
  const rawForms =
    model3d.forms && model3d.forms.length ? model3d.forms : [model3d]
  return rawForms
    .filter(
      (form) => form && (form.normalImage || form.shinyImage || form.image)
    )
    .map((form, index) =>
      Object.assign({}, form, {
        label:
          form.label || form.formName || (index === 0 ? '默认形态' : form.slug),
        image: form.image || form.normalImage || form.shinyImage,
        normalImage: form.normalImage || '',
        shinyImage: form.shinyImage || '',
      })
    )
}
function variantOptionsForForm(form) {
  const options = []
  if (form && form.normalImage) {
    options.push({
      id: 'normal',
      name: '普通',
      image: form.normalImage,
    })
  }
  if (form && form.shinyImage) {
    options.push({
      id: 'shiny',
      name: '异色',
      image: form.shinyImage,
    })
  }
  return options
}
function buildModelState(model3d, preferredIndex, preferredVariant) {
  const forms = normalizeModelForms(model3d)
  if (!forms.length) {
    return {
      modelForms: [],
      modelVariantOptions: [],
      activeModel: null,
      activeModelFormIndex: 0,
      activeModelVariant: 'normal',
      activeModelVariantText: '',
      activeModelImage: '',
    }
  }
  const activeIndex = Math.max(
    0,
    Math.min(Number(preferredIndex || 0), forms.length - 1)
  )
  const activeForm = forms[activeIndex]
  const variantOptions = variantOptionsForForm(activeForm)
  const matchedVariant =
    variantOptions.find((item) => item.id === preferredVariant) ||
    variantOptions[0]
  const activeVariant = matchedVariant ? matchedVariant.id : 'normal'
  return {
    modelForms: forms.map((form, index) =>
      Object.assign({}, form, {
        selected: index === activeIndex,
      })
    ),
    modelVariantOptions: variantOptions,
    activeModel: activeForm,
    activeModelFormIndex: activeIndex,
    activeModelVariant: activeVariant,
    activeModelVariantText: activeVariant === 'shiny' ? '异色' : '普通',
    activeModelImage: matchedVariant ? matchedVariant.image : activeForm.image,
  }
}
cacheOptions.setOptionsToCache({
  data: {
    id: 0,
    pokemon: null,
    infoRows: [],
    breedingRows: [],
    stats: [],
    regionalDexes: [],
    selectedDexKey: '',
    selectedFlavor: null,
    abilities: [],
    moves: [],
    activeMoveDetail: null,
    moveMethodOptions: MOVE_METHOD_OPTIONS,
    activeMoveMethod: '',
    moveLimit: MOVE_PAGE_SIZE,
    moveTotal: 0,
    filteredMoveTotal: 0,
    canShowMoreMoves: false,
    encounterRows: [],
    encounterLocations: [],
    encounterMethods: [],
    encounterCount: 0,
    evolution: [],
    relatedCardMode: 'physical',
    relatedCards: [],
    relatedCardTotal: 0,
    physicalRelatedCards: [],
    physicalRelatedCardTotal: 0,
    pocketRelatedCards: [],
    pocketRelatedCardTotal: 0,
    favorite: false,
    modelForms: [],
    modelVariantOptions: [],
    activeModel: null,
    activeModelFormIndex: 0,
    activeModelVariant: 'normal',
    activeModelVariantText: '',
    activeModelImage: '',
    relations: {
      weaknesses: [],
      resistances: [],
      immunities: [],
    },
  },
  onLoad(options) {
    this.setData({
      id: Number(options.id || 1),
    })
    this.loadDetail()
  },
  loadDetail() {
    api.getPokemonById(this.data.id).then((result) => {
      const pokemon = result.item
      if (!pokemon) return
      const moveState = buildMoveState(
        pokemon,
        this.data.activeMoveMethod,
        this.data.moveLimit
      )
      const encounters = buildEncounterRows(pokemon.encounters)
      const selectedDexKey = ((pokemon.regional_dexes || [])[0] || {}).key || ''
      const regionalDexes = buildRegionalDexes(pokemon, selectedDexKey)
      const selectedDex =
        regionalDexes.find((item) => item.selected) || regionalDexes[0] || null
      const modelState = buildModelState(pokemon.model3d, 0, 'normal')
      this.setData({
        pokemon: Object.assign({}, pokemon, {
          idText: `#${padId(pokemon.id)}`,
          generationText: pokemon.generation
            ? `第 ${pokemon.generation} 世代`
            : '世代未知',
          evYieldText: pokemon.ev_yield_text || '-',
        }),
        infoRows: buildInfoRows(pokemon),
        breedingRows: buildBreedingRows(pokemon),
        stats: buildStatRows(pokemon),
        selectedDexKey,
        regionalDexes,
        selectedFlavor: buildSelectedFlavor(pokemon, selectedDex),
        abilities: (pokemon.abilities || []).map(normalizeAbility),
        moves: moveState.moves,
        moveTotal: moveState.moveTotal,
        filteredMoveTotal: moveState.filteredMoveTotal,
        canShowMoreMoves: moveState.canShowMoreMoves,
        encounterRows: encounters.rows,
        encounterLocations: encounters.locations,
        encounterMethods: encounters.methods,
        encounterCount: encounters.count,
        evolution: buildEvolutionRows(pokemon),
        favorite: storage.isFavorite(pokemon.id),
        modelForms: modelState.modelForms,
        modelVariantOptions: modelState.modelVariantOptions,
        activeModel: modelState.activeModel,
        activeModelFormIndex: modelState.activeModelFormIndex,
        activeModelVariant: modelState.activeModelVariant,
        activeModelVariantText: modelState.activeModelVariantText,
        activeModelImage: modelState.activeModelImage,
        relations: buildDefensiveRelations(pokemon),
      })
      storage.addRecent(pokemon)
      this.loadRelatedCards(pokemon.id)
    })
  },
  loadRelatedCards(id) {
    Promise.all([
      api
        .getPokemonCards(id, {
          page: 1,
          pageSize: 6,
        })
        .catch(() => ({
          items: [],
          total: 0,
        })),
      api
        .listPocketCards({
          pokemonId: id,
          page: 1,
          pageSize: 6,
        })
        .catch(() => ({
          items: [],
          total: 0,
        })),
    ]).then(([physical, pocket]) => {
      const physicalCards = (physical.items || []).map((card) =>
        Object.assign({}, card, {
          cardSource: 'physical',
        })
      )
      const pocketCards = (pocket.items || []).map((card) =>
        Object.assign({}, card, {
          cardSource: 'pocket',
        })
      )
      const mode =
        physicalCards.length || !pocketCards.length ? 'physical' : 'pocket'
      this.setData({
        relatedCardMode: mode,
        relatedCards: mode === 'physical' ? physicalCards : pocketCards,
        relatedCardTotal:
          Number(mode === 'physical' ? physical.total : pocket.total) || 0,
        physicalRelatedCards: physicalCards,
        physicalRelatedCardTotal: Number(physical.total || 0),
        pocketRelatedCards: pocketCards,
        pocketRelatedCardTotal: Number(pocket.total || 0),
      })
    })
  },
  selectRelatedCardMode(event) {
    const mode =
      getTarget(event.currentTarget, Taro).dataset.mode === 'pocket'
        ? 'pocket'
        : 'physical'
    this.setData({
      relatedCardMode: mode,
      relatedCards:
        mode === 'pocket'
          ? this.data.pocketRelatedCards
          : this.data.physicalRelatedCards,
      relatedCardTotal:
        mode === 'pocket'
          ? this.data.pocketRelatedCardTotal
          : this.data.physicalRelatedCardTotal,
    })
  },
  refreshMoves(activeMoveMethod, moveLimit) {
    const moveState = buildMoveState(
      this.data.pokemon || {},
      activeMoveMethod,
      moveLimit
    )
    this.setData({
      activeMoveMethod,
      moveLimit,
      moves: moveState.moves,
      moveTotal: moveState.moveTotal,
      filteredMoveTotal: moveState.filteredMoveTotal,
      canShowMoreMoves: moveState.canShowMoreMoves,
    })
  },
  selectMoveMethod(event) {
    this.refreshMoves(
      getTarget(event.currentTarget, Taro).dataset.method || '',
      MOVE_PAGE_SIZE
    )
  },
  showMoreMoves() {
    this.refreshMoves(
      this.data.activeMoveMethod,
      this.data.moveLimit + MOVE_PAGE_SIZE
    )
  },
  openMoveDetail(event) {
    const index = Number(
      getTarget(event.currentTarget, Taro).dataset.index || 0
    )
    const move = this.data.moves[index]
    if (!move) return
    this.setData({
      activeMoveDetail: buildMoveDetail(move),
    })
  },
  closeMoveDetail() {
    this.setData({
      activeMoveDetail: null,
    })
  },
  noop() {},
  selectRegionalDex(event) {
    const key = getTarget(event.currentTarget, Taro).dataset.key || ''
    const pokemon = this.data.pokemon || {}
    const regionalDexes = buildRegionalDexes(pokemon, key)
    const selectedDex =
      regionalDexes.find((item) => item.selected) || regionalDexes[0] || null
    this.setData({
      selectedDexKey: key,
      regionalDexes,
      selectedFlavor: buildSelectedFlavor(pokemon, selectedDex),
    })
  },
  toggleFavorite() {
    const favorite = storage.toggleFavorite(this.data.pokemon.id)
    this.setData({
      favorite,
    })
    Taro.showToast({
      title: favorite ? '已收藏' : '已取消',
      icon: 'none',
    })
  },
  addToTeam() {
    const result = storage.addTeamSlot(this.data.pokemon.id)
    Taro.showToast({
      title: result.message,
      icon: 'none',
    })
  },
  openPokemon(event) {
    Taro.redirectTo({
      url: `/pages/pokemon-detail/index?id=${
        getTarget(event.currentTarget, Taro).dataset.id
      }`,
    })
  },
  openRelatedCard(event) {
    const id = encodeURIComponent(
      getTarget(event.currentTarget, Taro).dataset.id
    )
    const source = getTarget(event.currentTarget, Taro).dataset.source
    Taro.navigateTo({
      url:
        source === 'pocket'
          ? `/pages/pocket-card-detail/index?id=${id}`
          : `/pages/card-detail/index?id=${id}`,
    })
  },
  openRelatedCards() {
    if (this.data.relatedCardMode === 'pocket') {
      Taro.setStorageSync(
        'pokechill:pendingPocketPokemonId',
        this.data.pokemon.id
      )
      Taro.switchTab({
        url: '/pages/pocket/index',
      })
      return
    }
    Taro.setStorageSync('pokechill:pendingCardPokemonId', this.data.pokemon.id)
    Taro.switchTab({
      url: '/pages/carddex/index',
    })
  },
  selectModelForm(event) {
    const index = Number(
      getTarget(event.currentTarget, Taro).dataset.index || 0
    )
    const modelState = buildModelState(
      {
        forms: this.data.modelForms,
      },
      index,
      this.data.activeModelVariant
    )
    this.setData(modelState)
  },
  selectModelVariant(event) {
    const variant =
      getTarget(event.currentTarget, Taro).dataset.variant || 'normal'
    const modelState = buildModelState(
      {
        forms: this.data.modelForms,
      },
      this.data.activeModelFormIndex,
      variant
    )
    this.setData(modelState)
  },
  previewModel3d(event) {
    const model =
      this.data.activeModel || (this.data.pokemon && this.data.pokemon.model3d)
    if (!model) return
    const urls = [model.normalImage || model.image, model.shinyImage].filter(
      Boolean
    )
    if (!urls.length) return
    const variant =
      (event &&
        event.currentTarget &&
        getTarget(event.currentTarget, Taro).dataset.variant) ||
      this.data.activeModelVariant ||
      'normal'
    const current =
      variant === 'shiny' && model.shinyImage
        ? model.shinyImage
        : this.data.activeModelImage ||
          model.normalImage ||
          model.image ||
          urls[0]
    Taro.previewImage({
      current,
      urls,
    })
  },
  openTypeChart(event) {
    const type = getTarget(event.currentTarget, Taro).dataset.type || ''
    Taro.navigateTo({
      url: `/pages/type-chart/index${type ? `?type=${type}` : ''}`,
    })
  },
  openTeam() {
    Taro.navigateTo({
      url: '/pages/team/index',
    })
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const {
      pokemon,
      activeModelImage,
      activeModel,
      activeModelVariantText,
      favorite,
      modelForms,
      modelVariantOptions,
      activeModelVariant,
      physicalRelatedCardTotal,
      pocketRelatedCardTotal,
      relatedCardTotal,
      relatedCardMode,
      relatedCards,
      infoRows,
      regionalDexes,
      selectedFlavor,
      stats,
      abilities,
      breedingRows,
      filteredMoveTotal,
      moveTotal,
      moveMethodOptions,
      activeMoveMethod,
      moves,
      canShowMoreMoves,
      activeMoveDetail,
      encounterCount,
      encounterMethods,
      encounterRows,
      evolution,
      relations,
    } = this.data
    return (
      pokemon && (
        <View className="page detail-page">
          <View className="card detail-hero">
            <View className="detail-copy">
              <View className="hero-meta">
                <Text>{pokemon.idText}</Text>
                <Text>{pokemon.generationText}</Text>
              </View>
              <View className="detail-name">{pokemon.name_zh}</View>
              <View className="detail-subtitle">
                <Text>{pokemon.name_en}</Text>
                {pokemon.name_ja && <Text>{'/ ' + pokemon.name_ja}</Text>}
              </View>
              <View className="type-line">
                {pokemon.types.map((item, index) => {
                  return (
                    <View key={item} className={'type-badge type-' + item}>
                      {pokemon.typeNames[index]}
                    </View>
                  )
                })}
              </View>
            </View>
            <View className="detail-image-wrap" onClick={this.previewModel3d}>
              <Image
                className={
                  'detail-image ' + (activeModelImage ? 'is-model' : '')
                }
                src={activeModelImage || pokemon.image}
                mode="aspectFit"
              ></Image>
              {activeModel && (
                <View className="hero-model-pill">
                  {activeModel.label + ' · ' + activeModelVariantText}
                </View>
              )}
            </View>
          </View>
          <View className="action-row">
            <View className="button-primary" onClick={this.toggleFavorite}>
              {favorite ? '取消收藏' : '收藏'}
            </View>
            <View className="button-secondary" onClick={this.addToTeam}>
              加入队伍
            </View>
            <View className="button-secondary" onClick={this.openTeam}>
              看队伍
            </View>
          </View>
          {modelForms?.length > 0 && (
            <View className="card info-card model-card">
              <View className="relation-head">
                <View>
                  <View className="info-title">3D 动态图</View>
                  <View className="muted">
                    {activeModel.label + ' · ' + activeModelVariantText}
                  </View>
                </View>
                <View className="model-source">
                  {modelForms?.length + ' 形态'}
                </View>
              </View>
              {modelForms?.length > 1 && (
                <ScrollView scrollX className="model-form-scroll">
                  <View className="model-form-row">
                    {modelForms?.map((item, index) => {
                      return (
                        <View
                          key={item.slug}
                          className={
                            'model-form-chip ' + (item.selected ? 'active' : '')
                          }
                          data-index={index}
                          onClick={this.selectModelForm}
                        >
                          {item.label}
                        </View>
                      )
                    })}
                  </View>
                </ScrollView>
              )}
              <View className="model-variant-row">
                {modelVariantOptions?.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'model-variant-button ' +
                        (activeModelVariant === item.id ? 'active' : '')
                      }
                      data-variant={item.id}
                      onClick={this.selectModelVariant}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
              <View className="model-credit">
                {activeModel.sourceName + ' · ' + activeModel.credit}
              </View>
            </View>
          )}
          {physicalRelatedCardTotal + pocketRelatedCardTotal > 0 && (
            <View className="card info-card">
              <View className="relation-head">
                <View>
                  <View className="info-title">相关卡牌</View>
                  <View className="muted">
                    {'已找到 ' + relatedCardTotal + ' 张'}
                  </View>
                </View>
                <View className="chart-link" onClick={this.openRelatedCards}>
                  全部
                </View>
              </View>
              <View className="related-card-tabs">
                <View
                  className={relatedCardMode === 'physical' ? 'active' : ''}
                  data-mode="physical"
                  onClick={this.selectRelatedCardMode}
                >
                  实体卡牌<Text>{physicalRelatedCardTotal}</Text>
                </View>
                <View
                  className={relatedCardMode === 'pocket' ? 'active' : ''}
                  data-mode="pocket"
                  onClick={this.selectRelatedCardMode}
                >
                  Pocket卡牌<Text>{pocketRelatedCardTotal}</Text>
                </View>
              </View>
              {relatedCards?.length ? (
                <ScrollView scrollX className="related-card-scroll">
                  {relatedCards?.map((item, index) => {
                    return (
                      <View
                        key={item.id}
                        className="related-card"
                        data-id={item.id}
                        data-source={item.cardSource}
                        onClick={this.openRelatedCard}
                      >
                        <Image src={item.image} mode="aspectFit"></Image>
                      </View>
                    )
                  })}
                </ScrollView>
              ) : (
                <View className="section-empty">
                  {'暂无' +
                    (relatedCardMode === 'pocket' ? ' Pocket' : '实体') +
                    '关联卡牌'}
                </View>
              )}
            </View>
          )}
          <View className="card info-card">
            <View className="info-title">基础资料</View>
            <View className="info-grid">
              {infoRows?.map((item, index) => {
                return (
                  <View key={item.label} className="info-cell">
                    <View className="muted">{item.label}</View>
                    <View>{item.value}</View>
                  </View>
                )
              })}
            </View>
            {regionalDexes?.length > 0 && (
              <View className="tag-line regional-line">
                {regionalDexes?.map((item, index) => {
                  return (
                    <View
                      key={item.key}
                      className={
                        'soft-tag dex-tag ' + (item.selected ? 'selected' : '')
                      }
                      data-key={item.key}
                      onClick={this.selectRegionalDex}
                    >
                      {item.label}
                    </View>
                  )
                })}
              </View>
            )}
            {selectedFlavor && (
              <View className="flavor selected-flavor">
                <View className="flavor-title">{selectedFlavor.title}</View>
                {selectedFlavor.version && (
                  <View className="muted">{selectedFlavor.version}</View>
                )}
                <View>{selectedFlavor.text}</View>
              </View>
            )}
          </View>
          <View className="card info-card">
            <View className="info-title">能力值与努力值</View>
            <View className="ev-summary">
              {'击败获得：' + pokemon.evYieldText}
            </View>
            {stats?.map((item, index) => {
              return (
                <View key={item.key} className="stat-row">
                  <View className="stat-name">{item.name}</View>
                  <View className="stat-track">
                    <View
                      className="stat-fill"
                      style={{
                        width: `${item.percent}%`,
                      }}
                    ></View>
                  </View>
                  <View className="stat-value">{item.value}</View>
                  <View className={'ev-chip ' + (item.evText ? 'active' : '')}>
                    {item.evText || '-'}
                  </View>
                </View>
              )
            })}
          </View>
          <View className="card info-card">
            <View className="info-title">特性</View>
            {abilities?.map((item, index) => {
              return (
                <View key={item.key} className="ability-row">
                  <View className="ability-head">
                    <View>
                      <Text className="ability-name">{item.name}</Text>
                      {item.name_en && (
                        <Text className="ability-en">{item.name_en}</Text>
                      )}
                    </View>
                    {item.is_hidden && (
                      <View className="hidden-pill">隐藏</View>
                    )}
                  </View>
                  {item.name_ja && (
                    <View className="muted">{item.name_ja}</View>
                  )}
                  {item.description && (
                    <View className="ability-text">{item.description}</View>
                  )}
                </View>
              )
            })}
          </View>
          <View className="card info-card">
            <View className="info-title">孵蛋与培育</View>
            <View className="info-grid breeding-grid">
              {breedingRows?.map((item, index) => {
                return (
                  <View key={item.label} className="info-cell">
                    <View className="muted">{item.label}</View>
                    <View>{item.value}</View>
                  </View>
                )
              })}
            </View>
          </View>
          <View className="card info-card">
            <View className="info-title">招式列表</View>
            <View className="move-meta">
              {filteredMoveTotal + ' / ' + moveTotal + ' 招式'}
            </View>
            <ScrollView scrollX className="chip-scroll move-filter">
              <View className="chip-row">
                {moveMethodOptions.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className={
                        'chip ' + (activeMoveMethod === item.id ? 'active' : '')
                      }
                      data-method={item.id}
                      onClick={this.selectMoveMethod}
                    >
                      {item.name}
                    </View>
                  )
                })}
              </View>
            </ScrollView>
            {moves?.length ? (
              <View className="move-list">
                {moves?.map((item, index) => {
                  return (
                    <View
                      key={item.key}
                      className="move-row"
                      data-index={index}
                      onClick={this.openMoveDetail}
                    >
                      <View className="move-main">
                        <View className="move-name">{item.name}</View>
                        <View className="move-bits">
                          <Text
                            className="move-type-mini"
                            style={{
                              background: `${item.type_color}`,
                            }}
                          >
                            {item.type_name}
                          </Text>
                          <Text className="move-class-mini">
                            {item.damage_class_name}
                          </Text>
                          <Text className="move-power-mini">
                            {'威力 ' + item.powerText}
                          </Text>
                        </View>
                      </View>
                      <View className="move-method">{item.method_name}</View>
                    </View>
                  )
                })}
              </View>
            ) : (
              <View className="section-empty">暂无招式数据</View>
            )}
            {canShowMoreMoves && (
              <View className="load-more" onClick={this.showMoreMoves}>
                加载更多
              </View>
            )}
          </View>
          {activeMoveDetail && (
            <View className="modal-mask" onClick={this.closeMoveDetail}>
              <View className="move-modal" onClick={this.noop}>
                <View className="modal-head">
                  <View>
                    <View className="modal-title">{activeMoveDetail.name}</View>
                    <View className="modal-subtitle">
                      {activeMoveDetail.name_en && (
                        <Text>{activeMoveDetail.name_en}</Text>
                      )}
                      {activeMoveDetail.name_ja && (
                        <Text>{'/ ' + activeMoveDetail.name_ja}</Text>
                      )}
                    </View>
                  </View>
                  <View className="modal-close" onClick={this.closeMoveDetail}>
                    ×
                  </View>
                </View>
                <View className="move-badge-line">
                  <View
                    className="move-type-pill"
                    style={{
                      background: `${activeMoveDetail.type_color}`,
                    }}
                  >
                    {activeMoveDetail.type_name}
                  </View>
                  <View className="move-class-pill">
                    {activeMoveDetail.damage_class_name}
                  </View>
                </View>
                <View className="move-description">
                  {activeMoveDetail.descriptionText}
                </View>
                {activeMoveDetail.effectText && (
                  <View className="move-effect">
                    {activeMoveDetail.effectText}
                  </View>
                )}
                <View className="move-detail-grid">
                  {activeMoveDetail.mainRows.map((item, index) => {
                    return (
                      <View key={item.label} className="move-detail-cell">
                        <View className="muted">{item.label}</View>
                        <View>{item.value}</View>
                      </View>
                    )
                  })}
                </View>
                {activeMoveDetail.hasExtra && (
                  <View className="move-extra">
                    <View className="move-extra-title">附加信息</View>
                    {activeMoveDetail.extraRows.map((item, index) => {
                      return (
                        <View key={item.label} className="move-extra-row">
                          <Text className="muted">{item.label}</Text>
                          <Text>{item.value}</Text>
                        </View>
                      )
                    })}
                    {activeMoveDetail.statChanges.map((item, index) => {
                      return (
                        <View key={item.stat} className="move-extra-row">
                          <Text className="muted">{item.name}</Text>
                          <Text>{item.change_text}</Text>
                        </View>
                      )
                    })}
                  </View>
                )}
                {activeMoveDetail.fullEffectText &&
                  activeMoveDetail.fullEffectText !==
                    activeMoveDetail.effectText && (
                    <View className="move-effect-original">
                      {activeMoveDetail.fullEffectText}
                    </View>
                  )}
              </View>
            </View>
          )}
          <View className="card info-card">
            <View className="info-title">获得方式</View>
            {encounterCount ? (
              <View>
                <View className="tag-line">
                  {encounterMethods?.map((item, index) => {
                    return (
                      <View key={item} className="soft-tag">
                        {item}
                      </View>
                    )
                  })}
                </View>
                <View className="encounter-list">
                  {encounterRows?.map((item, index) => {
                    return (
                      <View key={item.key} className="encounter-row">
                        <View>
                          <View className="encounter-location">
                            {item.location}
                          </View>
                          <View className="muted">
                            {item.version_name + ' ' + item.method_name}
                          </View>
                        </View>
                        <View className="encounter-meta">
                          <Text>{item.levelText}</Text>
                          {item.chanceText && <Text>{item.chanceText}</Text>}
                        </View>
                      </View>
                    )
                  })}
                </View>
              </View>
            ) : (
              <View className="section-empty">暂无野外遭遇数据</View>
            )}
          </View>
          <View className="card info-card">
            <View className="info-title">进化链</View>
            <View className="evolution-row">
              {evolution?.map((item, index) => {
                return (
                  <View
                    key={item.id}
                    className="evolution-item"
                    data-id={item.id}
                    onClick={this.openPokemon}
                  >
                    <Image src={item.image} mode="aspectFit"></Image>
                    <View className="evolution-name">{item.name_zh}</View>
                    <View
                      className={
                        'evolution-condition ' + (item.active ? 'active' : '')
                      }
                    >
                      {item.active ? '当前形态' : item.conditionText}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
          <View className="card info-card">
            <View className="relation-head">
              <View>
                <View className="info-title">属性关系</View>
                <View className="muted">{relations.title}</View>
              </View>
              <View className="chart-link" onClick={this.openTypeChart}>
                相克表
              </View>
            </View>
            <View className="relation-block">
              <View className="relation-title">弱点</View>
              <View className="type-chip-line">
                {relations.weaknesses.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="relation-chip"
                      style={{
                        background: `${item.color}`,
                      }}
                      data-type={item.id}
                      onClick={this.openTypeChart}
                    >
                      <Text>{item.name}</Text>
                      <Text>{item.multiplierText}</Text>
                    </View>
                  )
                })}
                {!relations.weaknesses.length && (
                  <View className="section-empty">暂无</View>
                )}
              </View>
            </View>
            <View className="relation-block">
              <View className="relation-title">抵抗</View>
              <View className="type-chip-line">
                {relations.resistances.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="relation-chip"
                      style={{
                        background: `${item.color}`,
                      }}
                      data-type={item.id}
                      onClick={this.openTypeChart}
                    >
                      <Text>{item.name}</Text>
                      <Text>{item.multiplierText}</Text>
                    </View>
                  )
                })}
                {!relations.resistances.length && (
                  <View className="section-empty">暂无</View>
                )}
              </View>
            </View>
            <View className="relation-block">
              <View className="relation-title">免疫</View>
              <View className="type-chip-line">
                {relations.immunities.map((item, index) => {
                  return (
                    <View
                      key={item.id}
                      className="relation-chip"
                      style={{
                        background: `${item.color}`,
                      }}
                      data-type={item.id}
                      onClick={this.openTypeChart}
                    >
                      <Text>{item.name}</Text>
                      <Text>{item.multiplierText}</Text>
                    </View>
                  )
                })}
                {!relations.immunities.length && (
                  <View className="section-empty">暂无</View>
                )}
              </View>
            </View>
          </View>
        </View>
      )
    )
  }
}
export default _C
