const generatedSnapshot = require('../data/generated-pokemon.js')
const TYPE_META = {
  normal: {
    name: '一般',
    color: '#8a8f98',
  },
  fire: {
    name: '火',
    color: '#e85d3f',
  },
  water: {
    name: '水',
    color: '#2f80ed',
  },
  electric: {
    name: '电',
    color: '#d99a00',
  },
  grass: {
    name: '草',
    color: '#2f9e44',
  },
  ice: {
    name: '冰',
    color: '#39a9c7',
  },
  fighting: {
    name: '格斗',
    color: '#c2410c',
  },
  poison: {
    name: '毒',
    color: '#9333ea',
  },
  ground: {
    name: '地面',
    color: '#b7791f',
  },
  flying: {
    name: '飞行',
    color: '#647acb',
  },
  psychic: {
    name: '超能力',
    color: '#db2777',
  },
  bug: {
    name: '虫',
    color: '#65a30d',
  },
  rock: {
    name: '岩石',
    color: '#78716c',
  },
  ghost: {
    name: '幽灵',
    color: '#6d28d9',
  },
  dragon: {
    name: '龙',
    color: '#2563eb',
  },
  dark: {
    name: '恶',
    color: '#374151',
  },
  steel: {
    name: '钢',
    color: '#64748b',
  },
  fairy: {
    name: '妖精',
    color: '#ec4899',
  },
}
const TYPE_RELATIONS = {
  normal: {
    weakTo: ['fighting'],
    resists: [],
    immuneTo: ['ghost'],
  },
  fire: {
    weakTo: ['water', 'ground', 'rock'],
    resists: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'],
    immuneTo: [],
  },
  water: {
    weakTo: ['electric', 'grass'],
    resists: ['fire', 'water', 'ice', 'steel'],
    immuneTo: [],
  },
  electric: {
    weakTo: ['ground'],
    resists: ['electric', 'flying', 'steel'],
    immuneTo: [],
  },
  grass: {
    weakTo: ['fire', 'ice', 'poison', 'flying', 'bug'],
    resists: ['water', 'electric', 'grass', 'ground'],
    immuneTo: [],
  },
  ice: {
    weakTo: ['fire', 'fighting', 'rock', 'steel'],
    resists: ['ice'],
    immuneTo: [],
  },
  fighting: {
    weakTo: ['flying', 'psychic', 'fairy'],
    resists: ['bug', 'rock', 'dark'],
    immuneTo: [],
  },
  poison: {
    weakTo: ['ground', 'psychic'],
    resists: ['grass', 'fighting', 'poison', 'bug', 'fairy'],
    immuneTo: [],
  },
  ground: {
    weakTo: ['water', 'grass', 'ice'],
    resists: ['poison', 'rock'],
    immuneTo: ['electric'],
  },
  flying: {
    weakTo: ['electric', 'ice', 'rock'],
    resists: ['grass', 'fighting', 'bug'],
    immuneTo: ['ground'],
  },
  psychic: {
    weakTo: ['bug', 'ghost', 'dark'],
    resists: ['fighting', 'psychic'],
    immuneTo: [],
  },
  bug: {
    weakTo: ['fire', 'flying', 'rock'],
    resists: ['grass', 'fighting', 'ground'],
    immuneTo: [],
  },
  rock: {
    weakTo: ['water', 'grass', 'fighting', 'ground', 'steel'],
    resists: ['normal', 'fire', 'poison', 'flying'],
    immuneTo: [],
  },
  ghost: {
    weakTo: ['ghost', 'dark'],
    resists: ['poison', 'bug'],
    immuneTo: ['normal', 'fighting'],
  },
  dragon: {
    weakTo: ['ice', 'dragon', 'fairy'],
    resists: ['fire', 'water', 'electric', 'grass'],
    immuneTo: [],
  },
  dark: {
    weakTo: ['fighting', 'bug', 'fairy'],
    resists: ['ghost', 'dark'],
    immuneTo: ['psychic'],
  },
  steel: {
    weakTo: ['fire', 'fighting', 'ground'],
    resists: [
      'normal',
      'grass',
      'ice',
      'flying',
      'psychic',
      'bug',
      'rock',
      'dragon',
      'steel',
      'fairy',
    ],
    immuneTo: ['poison'],
  },
  fairy: {
    weakTo: ['poison', 'steel'],
    resists: ['fighting', 'bug', 'dark'],
    immuneTo: ['dragon'],
  },
}
const SEED_POKEMON = [
  {
    id: 1,
    name_en: 'Bulbasaur',
    name_zh: '妙蛙种子',
    image: '/assets/pokemon/bulbasaur.png',
    types: ['grass', 'poison'],
    generation: 1,
    height: '0.7 m',
    weight: '6.9 kg',
    category: '种子宝可梦',
    abilities: ['茂盛', '叶绿素'],
    stats: {
      hp: 45,
      attack: 49,
      defense: 49,
      specialAttack: 65,
      specialDefense: 65,
      speed: 45,
    },
    evolution_chain: [1, 2, 3],
    moves_summary: ['藤鞭', '飞叶快刀', '生长', '寄生种子'],
    flavor: '背上的种子会随着成长逐渐变大，是很适合新手认识属性关系的宝可梦。',
  },
  {
    id: 2,
    name_en: 'Ivysaur',
    name_zh: '妙蛙草',
    image: '/assets/pokemon/ivysaur.png',
    types: ['grass', 'poison'],
    generation: 1,
    height: '1.0 m',
    weight: '13.0 kg',
    category: '种子宝可梦',
    abilities: ['茂盛', '叶绿素'],
    stats: {
      hp: 60,
      attack: 62,
      defense: 63,
      specialAttack: 80,
      specialDefense: 80,
      speed: 60,
    },
    evolution_chain: [1, 2, 3],
    moves_summary: ['藤鞭', '飞叶快刀', '甜甜香气', '睡眠粉'],
    flavor: '花苞开始绽放，草与毒的双属性让它有鲜明的抗性和弱点。',
  },
  {
    id: 3,
    name_en: 'Venusaur',
    name_zh: '妙蛙花',
    image: '/assets/pokemon/venusaur.png',
    types: ['grass', 'poison'],
    generation: 1,
    height: '2.0 m',
    weight: '100.0 kg',
    category: '种子宝可梦',
    abilities: ['茂盛', '叶绿素'],
    stats: {
      hp: 80,
      attack: 82,
      defense: 83,
      specialAttack: 100,
      specialDefense: 100,
      speed: 80,
    },
    evolution_chain: [1, 2, 3],
    moves_summary: ['花瓣舞', '日光束', '污泥炸弹', '催眠粉'],
    flavor: '攻防均衡的最终进化，适合作为队伍分析器里的稳定草系样本。',
  },
  {
    id: 4,
    name_en: 'Charmander',
    name_zh: '小火龙',
    image: '/assets/pokemon/charmander.png',
    types: ['fire'],
    generation: 1,
    height: '0.6 m',
    weight: '8.5 kg',
    category: '蜥蜴宝可梦',
    abilities: ['猛火', '太阳之力'],
    stats: {
      hp: 39,
      attack: 52,
      defense: 43,
      specialAttack: 60,
      specialDefense: 50,
      speed: 65,
    },
    evolution_chain: [4, 5, 6],
    moves_summary: ['火花', '烟幕', '火焰牙', '喷射火焰'],
    flavor: '尾巴上的火焰是它生命力的象征，也是火系弱点教学的好入口。',
  },
  {
    id: 5,
    name_en: 'Charmeleon',
    name_zh: '火恐龙',
    image: '/assets/pokemon/charmeleon.png',
    types: ['fire'],
    generation: 1,
    height: '1.1 m',
    weight: '19.0 kg',
    category: '火焰宝可梦',
    abilities: ['猛火', '太阳之力'],
    stats: {
      hp: 58,
      attack: 64,
      defense: 58,
      specialAttack: 80,
      specialDefense: 65,
      speed: 80,
    },
    evolution_chain: [4, 5, 6],
    moves_summary: ['火焰牙', '劈开', '喷射火焰', '鬼面'],
    flavor: '速度与特攻开始突出，单火属性的优缺点很清晰。',
  },
  {
    id: 6,
    name_en: 'Charizard',
    name_zh: '喷火龙',
    image: '/assets/pokemon/charizard.png',
    types: ['fire', 'flying'],
    generation: 1,
    height: '1.7 m',
    weight: '90.5 kg',
    category: '火焰宝可梦',
    abilities: ['猛火', '太阳之力'],
    stats: {
      hp: 78,
      attack: 84,
      defense: 78,
      specialAttack: 109,
      specialDefense: 85,
      speed: 100,
    },
    evolution_chain: [4, 5, 6],
    moves_summary: ['喷射火焰', '空气斩', '龙爪', '热风'],
    flavor: '火/飞行带来高输出和明显的岩石弱点，适合队伍短板演示。',
  },
  {
    id: 7,
    name_en: 'Squirtle',
    name_zh: '杰尼龟',
    image: '/assets/pokemon/squirtle.png',
    types: ['water'],
    generation: 1,
    height: '0.5 m',
    weight: '9.0 kg',
    category: '小龟宝可梦',
    abilities: ['激流', '雨盘'],
    stats: {
      hp: 44,
      attack: 48,
      defense: 65,
      specialAttack: 50,
      specialDefense: 64,
      speed: 43,
    },
    evolution_chain: [7, 8, 9],
    moves_summary: ['水枪', '缩入壳中', '泡沫', '水之波动'],
    flavor: '防御扎实的水系初学者样本，适合和火系、草系互相对照。',
  },
  {
    id: 8,
    name_en: 'Wartortle',
    name_zh: '卡咪龟',
    image: '/assets/pokemon/wartortle.png',
    types: ['water'],
    generation: 1,
    height: '1.0 m',
    weight: '22.5 kg',
    category: '龟宝可梦',
    abilities: ['激流', '雨盘'],
    stats: {
      hp: 59,
      attack: 63,
      defense: 80,
      specialAttack: 65,
      specialDefense: 80,
      speed: 58,
    },
    evolution_chain: [7, 8, 9],
    moves_summary: ['水之波动', '高速旋转', '咬住', '守住'],
    flavor: '水系中段进化，耐久更稳定，适合收藏页与进化链展示。',
  },
  {
    id: 9,
    name_en: 'Blastoise',
    name_zh: '水箭龟',
    image: '/assets/pokemon/blastoise.png',
    types: ['water'],
    generation: 1,
    height: '1.6 m',
    weight: '85.5 kg',
    category: '甲壳宝可梦',
    abilities: ['激流', '雨盘'],
    stats: {
      hp: 79,
      attack: 83,
      defense: 100,
      specialAttack: 85,
      specialDefense: 105,
      speed: 78,
    },
    evolution_chain: [7, 8, 9],
    moves_summary: ['水炮', '加农光炮', '高速旋转', '守住'],
    flavor: '防守端很可靠的最终进化，单水属性让队伍分析结果更直观。',
  },
  {
    id: 25,
    name_en: 'Pikachu',
    name_zh: '皮卡丘',
    image: '/assets/pokemon/pikachu.png',
    types: ['electric'],
    generation: 1,
    height: '0.4 m',
    weight: '6.0 kg',
    category: '鼠宝可梦',
    abilities: ['静电', '避雷针'],
    stats: {
      hp: 35,
      attack: 55,
      defense: 40,
      specialAttack: 50,
      specialDefense: 50,
      speed: 90,
    },
    evolution_chain: [25],
    moves_summary: ['电击', '电光一闪', '十万伏特', '电磁波'],
    flavor: '速度快、辨识度高，是宝可梦猜谜和新手入口最友好的宝可梦之一。',
  },
  {
    id: 94,
    name_en: 'Gengar',
    name_zh: '耿鬼',
    image: '/assets/pokemon/gengar.png',
    types: ['ghost', 'poison'],
    generation: 1,
    height: '1.5 m',
    weight: '40.5 kg',
    category: '影子宝可梦',
    abilities: ['诅咒之躯'],
    stats: {
      hp: 60,
      attack: 65,
      defense: 60,
      specialAttack: 130,
      specialDefense: 75,
      speed: 110,
    },
    evolution_chain: [94],
    moves_summary: ['暗影球', '催眠术', '祸不单行', '污泥炸弹'],
    flavor: '高速度高特攻，但弱点也不少，是属性速查里很有意思的案例。',
  },
  {
    id: 133,
    name_en: 'Eevee',
    name_zh: '伊布',
    image: '/assets/pokemon/eevee.png',
    types: ['normal'],
    generation: 1,
    height: '0.3 m',
    weight: '6.5 kg',
    category: '进化宝可梦',
    abilities: ['逃跑', '适应力', '危险预知'],
    stats: {
      hp: 55,
      attack: 55,
      defense: 50,
      specialAttack: 45,
      specialDefense: 65,
      speed: 55,
    },
    evolution_chain: [133],
    moves_summary: ['电光一闪', '帮助', '咬住', '高速星星'],
    flavor: '拥有多种进化可能，适合后续扩展成进化链专题和每日发现。',
  },
].map((pokemon) => {
  const stats = pokemon.stats
  const stat_total =
    stats.hp +
    stats.attack +
    stats.defense +
    stats.specialAttack +
    stats.specialDefense +
    stats.speed
  return Object.assign({}, pokemon, {
    stat_total,
  })
})
const GENERATED_POKEMON = Array.isArray(generatedSnapshot.pokemon)
  ? generatedSnapshot.pokemon
  : []
const POKEMON = (
  GENERATED_POKEMON.length ? GENERATED_POKEMON : SEED_POKEMON
).map((pokemon) => {
  if (pokemon.stat_total) return pokemon
  const stats = pokemon.stats || {}
  const stat_total =
    Number(stats.hp || 0) +
    Number(stats.attack || 0) +
    Number(stats.defense || 0) +
    Number(stats.specialAttack || 0) +
    Number(stats.specialDefense || 0) +
    Number(stats.speed || 0)
  return Object.assign({}, pokemon, {
    stat_total,
  })
})
const SNAPSHOT_META = {
  generatedAt: generatedSnapshot.generatedAt || '',
  source: generatedSnapshot.source || 'seed',
  count: POKEMON.length,
  usingGenerated: GENERATED_POKEMON.length > 0,
}
function getTypeName(type) {
  return TYPE_META[type] ? TYPE_META[type].name : type
}
function decoratePokemon(pokemon) {
  if (!pokemon) return null
  return Object.assign({}, pokemon, {
    typeNames: pokemon.types.map(getTypeName),
  })
}
function normalizeKeyword(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
}
function normalizeTypeFilters(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',')
  return Array.from(
    new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))
  )
}
function listPokemon(filters) {
  const options = filters || {}
  const keyword = normalizeKeyword(options.keyword)
  const types = normalizeTypeFilters(options.type || options.types)
  const generation = options.generation ? Number(options.generation) : 0
  const sort = options.sort || 'id'
  let items = POKEMON.filter((pokemon) => {
    const matchedKeyword =
      !keyword ||
      String(pokemon.id) === keyword ||
      pokemon.name_en.toLowerCase().includes(keyword) ||
      pokemon.name_zh.includes(keyword) ||
      String(pokemon.name_ja || '').includes(keyword)
    const matchedType =
      !types.length || types.every((type) => pokemon.types.includes(type))
    const matchedGeneration = !generation || pokemon.generation === generation
    return matchedKeyword && matchedType && matchedGeneration
  })
  if (sort === 'name') {
    items = items.slice().sort((a, b) => a.name_en.localeCompare(b.name_en))
  } else if (sort === 'power') {
    items = items.slice().sort((a, b) => b.stat_total - a.stat_total)
  } else {
    items = items.slice().sort((a, b) => a.id - b.id)
  }
  return items.map(decoratePokemon)
}
function getPokemonById(id) {
  const numericId = Number(id)
  return decoratePokemon(POKEMON.find((pokemon) => pokemon.id === numericId))
}
function getEvolutionChain(ids) {
  return (ids || []).map(getPokemonById).filter(Boolean)
}
function getAllTypes() {
  return Object.keys(TYPE_META).map((id) => ({
    id,
    name: TYPE_META[id].name,
    color: TYPE_META[id].color,
  }))
}
function getTypeRelations(type) {
  const relation = TYPE_RELATIONS[type] || {
    weakTo: [],
    resists: [],
    immuneTo: [],
  }
  return {
    type,
    name: getTypeName(type),
    weakTo: relation.weakTo.map((id) => ({
      id,
      name: getTypeName(id),
    })),
    resists: relation.resists.map((id) => ({
      id,
      name: getTypeName(id),
    })),
    immuneTo: relation.immuneTo.map((id) => ({
      id,
      name: getTypeName(id),
    })),
  }
}
function getDamageMultiplier(attackingType, defenderTypes) {
  return defenderTypes.reduce((multiplier, defenderType) => {
    const relation = TYPE_RELATIONS[defenderType] || {
      weakTo: [],
      resists: [],
      immuneTo: [],
    }
    if (relation.immuneTo.includes(attackingType)) return 0
    if (relation.weakTo.includes(attackingType)) return multiplier * 2
    if (relation.resists.includes(attackingType)) return multiplier * 0.5
    return multiplier
  }, 1)
}
function analyzeTeam(ids) {
  const members = (ids || []).map(getPokemonById).filter(Boolean)
  const typeIds = Object.keys(TYPE_META)
  const weaknesses = []
  const resistances = []
  const immunities = []
  const typeCounts = {}
  members.forEach((member) => {
    member.types.forEach((type) => {
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })
  })
  typeIds.forEach((type) => {
    let weakCount = 0
    let resistCount = 0
    let immuneCount = 0
    members.forEach((member) => {
      const multiplier = getDamageMultiplier(type, member.types)
      if (multiplier >= 2) weakCount += 1
      if (multiplier > 0 && multiplier < 1) resistCount += 1
      if (multiplier === 0) immuneCount += 1
    })
    if (weakCount)
      weaknesses.push({
        id: type,
        name: getTypeName(type),
        count: weakCount,
      })
    if (resistCount)
      resistances.push({
        id: type,
        name: getTypeName(type),
        count: resistCount,
      })
    if (immuneCount)
      immunities.push({
        id: type,
        name: getTypeName(type),
        count: immuneCount,
      })
  })
  weaknesses.sort((a, b) => b.count - a.count)
  resistances.sort((a, b) => b.count - a.count)
  immunities.sort((a, b) => b.count - a.count)
  const score = Math.max(
    40,
    Math.min(
      95,
      82 -
        weaknesses.length * 3 +
        resistances.length * 2 +
        immunities.length * 2
    )
  )
  const primaryTypes = Object.keys(typeCounts)
    .sort((a, b) => typeCounts[b] - typeCounts[a])
    .slice(0, 3)
    .map((type) => getTypeName(type))
  return {
    members,
    score,
    primaryTypes,
    weaknesses: weaknesses.slice(0, 6),
    resistances: resistances.slice(0, 6),
    immunities: immunities.slice(0, 6),
    summary: members.length
      ? `当前队伍以${primaryTypes.join('、') || '混合'}属性为主，主要风险来自${
          weaknesses
            .slice(0, 3)
            .map((item) => item.name)
            .join('、') || '暂无明显共同弱点'
        }。`
      : '先选择 1 到 6 只宝可梦，再查看队伍属性分析。',
  }
}
function hashString(value) {
  let hash = 2166136261
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
function createSeededRandom(seedValue) {
  let state = hashString(seedValue) || 1
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
function shuffleWithRandom(items, random) {
  const next = items.slice()
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}
function getDailyQuiz(seed) {
  const quizKey = seed || `${Date.now()}-${Math.random()}`
  const random = createSeededRandom(`pokemon-random-${quizKey}`)
  const answer = POKEMON[Math.floor(random() * POKEMON.length)]
  const options = [answer]
  while (options.length < 4) {
    const candidate = POKEMON[Math.floor(random() * POKEMON.length)]
    if (!options.find((item) => item.id === candidate.id)) {
      options.push(candidate)
    }
  }
  return {
    quizId: `pokemon-random-${quizKey}-${answer.id}`,
    answerId: answer.id,
    silhouette: answer.image,
    hints: [
      `属性：${answer.types.map(getTypeName).join(' / ')}`,
      `世代：第 ${answer.generation} 世代`,
      `种族值总和：${answer.stat_total}`,
      `分类：${answer.category}`,
    ],
    options: shuffleWithRandom(options, random).map((pokemon) => ({
      id: pokemon.id,
      name_zh: pokemon.name_zh,
      name_en: pokemon.name_en,
      image: pokemon.image,
      types: pokemon.types,
      typeNames: pokemon.types.map(getTypeName),
    })),
  }
}
function submitDailyQuiz(payload) {
  const selectedId = Number(payload && payload.selectedId)
  const answerId = Number(payload && payload.answerId)
  const correct = selectedId === answerId
  return {
    correct,
    message: correct
      ? '猜对了，再来挑战一题吧。'
      : '差一点，看看详情再来熟悉一下。',
  }
}
module.exports = {
  TYPE_META,
  TYPE_RELATIONS,
  POKEMON,
  SEED_POKEMON,
  SNAPSHOT_META,
  getTypeName,
  listPokemon,
  getPokemonById,
  getEvolutionChain,
  getAllTypes,
  getTypeRelations,
  getDamageMultiplier,
  analyzeTeam,
  getDailyQuiz,
  submitDailyQuiz,
}
