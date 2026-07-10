const ENERGY_META = {
  Grass: { id: 'Grass', name: '草', symbol: '草', color: '#2f9e44' },
  Fire: { id: 'Fire', name: '火', symbol: '火', color: '#e85d3f' },
  Water: { id: 'Water', name: '水', symbol: '水', color: '#2f80ed' },
  Lightning: { id: 'Lightning', name: '电', symbol: '电', color: '#d99a00' },
  Psychic: { id: 'Psychic', name: '超能力', symbol: '超', color: '#db2777' },
  Fighting: { id: 'Fighting', name: '斗', symbol: '斗', color: '#c2410c' },
  Darkness: { id: 'Darkness', name: '恶', symbol: '恶', color: '#374151' },
  Metal: { id: 'Metal', name: '钢', symbol: '钢', color: '#64748b' },
  Fairy: { id: 'Fairy', name: '妖精', symbol: '妖', color: '#ec4899' },
  Dragon: { id: 'Dragon', name: '龙', symbol: '龙', color: '#2563eb' },
  Colorless: { id: 'Colorless', name: '无色', symbol: '无', color: '#8a8f98' }
};

const SUPERTYPE_NAMES = {
  Pokémon: '宝可梦',
  Trainer: '训练家',
  Energy: '能量'
};

const SUBTYPE_NAMES = {
  Basic: '基础',
  'Stage 1': '一阶进化',
  'Stage 2': '二阶进化',
  Restored: '复原',
  Item: '物品',
  Tool: '道具',
  Supporter: '支援者',
  Stadium: '竞技场',
  Special: '特殊',
  'Basic Energy': '基本能量',
  'Special Energy': '特殊能量',
  ex: 'ex',
  EX: 'EX',
  GX: 'GX',
  V: 'V',
  VMAX: 'VMAX',
  VSTAR: 'VSTAR',
  BREAK: 'BREAK',
  Mega: 'Mega',
  'Rapid Strike': '连击',
  'Single Strike': '一击',
  Fusion: '融合'
};

const RARITY_NAMES = {
  Common: '普通',
  Uncommon: '非普通',
  Rare: '稀有',
  'Rare Holo': '闪稀有',
  'Rare Holo EX': 'EX 闪稀有',
  'Rare Holo GX': 'GX 闪稀有',
  'Rare Holo V': 'V 闪稀有',
  'Rare Holo VMAX': 'VMAX 闪稀有',
  'Rare Holo VSTAR': 'VSTAR 闪稀有',
  'Rare Ultra': '超稀有',
  'Rare Secret': '秘密稀有',
  'Rare Rainbow': '彩虹稀有',
  'Rare Shiny': '异色稀有',
  'Rare Shiny GX': '异色 GX',
  'Illustration Rare': '插画稀有',
  'Special Illustration Rare': '特殊插画稀有',
  'Hyper Rare': '极稀有',
  Promo: '宣传卡'
};

const LEGALITY_NAMES = {
  standard: '标准',
  expanded: '扩展',
  unlimited: '无限'
};

const LEGALITY_STATUS_NAMES = {
  Legal: '可用',
  Banned: '禁用'
};

function labelFromMap(map, value) {
  return map[value] || value || '';
}

function energyName(value) {
  return ENERGY_META[value] ? ENERGY_META[value].name : (value || '');
}

function energyColor(value) {
  return ENERGY_META[value] ? ENERGY_META[value].color : '#64748b';
}

function normalizeDate(value) {
  if (!value) return '';
  return String(value).replace(/\//g, '-');
}

function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase();
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function titleCase(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatLegalities(legalities) {
  return Object.keys(legalities || {}).map((key) => ({
    key,
    name: LEGALITY_NAMES[key] || titleCase(key),
    status: legalities[key],
    status_name: LEGALITY_STATUS_NAMES[legalities[key]] || legalities[key]
  }));
}

function localizeCardText(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  const replacements = [
    [/Flip a coin\. If tails, this attack does nothing\./gi, '投掷 1 次硬币。若为反面，这个招式无效。'],
    [/Flip a coin\. If heads, ([^.]+)\./gi, '投掷 1 次硬币。若为正面，$1。'],
    [/Flip a coin\. If tails, ([^.]+)\./gi, '投掷 1 次硬币。若为反面，$1。'],
    [/This attack does (\d+) more damage/gi, '这个招式追加 $1 点伤害'],
    [/This attack does (\d+) damage to itself/gi, '这只宝可梦也受到 $1 点伤害'],
    [/This attack does nothing/gi, '这个招式无效'],
    [/Discard (\d+) Energy cards? attached to ([^.]+)\./gi, '丢弃附加在$2身上的 $1 个能量。'],
    [/Discard all Energy from this Pokémon\./gi, '丢弃这只宝可梦身上的所有能量。'],
    [/Discard an Energy from this Pokémon\./gi, '丢弃这只宝可梦身上的 1 个能量。'],
    [/Your opponent's Active Pokémon is now Burned\./gi, '对手的战斗宝可梦变为灼伤。'],
    [/Your opponent's Active Pokémon is now Poisoned\./gi, '对手的战斗宝可梦变为中毒。'],
    [/Your opponent's Active Pokémon is now Paralyzed\./gi, '对手的战斗宝可梦变为麻痹。'],
    [/Your opponent's Active Pokémon is now Asleep\./gi, '对手的战斗宝可梦变为睡眠。'],
    [/Your opponent's Active Pokémon is now Confused\./gi, '对手的战斗宝可梦变为混乱。'],
    [/Draw (\d+) cards?\./gi, '抽 $1 张卡。'],
    [/Search your deck for ([^.]+)\./gi, '从你的牌库中查找$1。'],
    [/Then, shuffle your deck\./gi, '然后重洗你的牌库。'],
    [/Heal (\d+) damage from this Pokémon\./gi, '将这只宝可梦恢复 $1 点伤害。'],
    [/During your next turn, this Pokémon can't attack\./gi, '在你的下个回合，这只宝可梦无法攻击。'],
    [/This Pokémon can't attack during your next turn\./gi, '这只宝可梦在你的下个回合无法攻击。'],
    [/This attack's damage isn't affected by Weakness or Resistance\./gi, '这个招式的伤害不受弱点或抵抗影响。'],
    [/Apply Weakness and Resistance for Benched Pokémon\./gi, '对备战宝可梦也计算弱点与抵抗。'],
    [/Don't apply Weakness and Resistance for Benched Pokémon\./gi, '对备战宝可梦不计算弱点与抵抗。'],
    [/Switch this Pokémon with 1 of your Benched Pokémon\./gi, '将这只宝可梦与 1 只你的备战宝可梦互换。'],
    [/Your opponent switches their Active Pokémon with 1 of their Benched Pokémon\./gi, '对手将其战斗宝可梦与 1 只备战宝可梦互换。'],
    [/Put (\d+) damage counters? on ([^.]+)\./gi, '在$2身上放置 $1 个伤害指示物。'],
    [/Attach ([^.]+) from your discard pile to ([^.]+)\./gi, '从你的弃牌区将$1附加到$2身上。'],
    [/If this Pokémon has any damage counters on it, ([^.]+)\./gi, '若这只宝可梦身上有伤害指示物，$1。'],
    [/If your opponent's Active Pokémon is affected by a Special Condition, ([^.]+)\./gi, '若对手的战斗宝可梦处于特殊状态，$1。']
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .replace(/\bthis Pokémon\b/g, '这只宝可梦')
    .replace(/\bThis Pokémon\b/g, '这只宝可梦')
    .replace(/\bthe Defending Pokémon\b/g, '防守宝可梦')
    .replace(/\byour opponent's Active Pokémon\b/g, '对手的战斗宝可梦')
    .replace(/\byour Active Pokémon\b/g, '你的战斗宝可梦')
    .replace(/\bBenched Pokémon\b/g, '备战宝可梦')
    .replace(/\bPokémon\b/g, '宝可梦')
    .replace(/\bEnergy\b/g, '能量')
    .replace(/\bdamage counters\b/g, '伤害指示物')
    .replace(/\bdiscard pile\b/g, '弃牌区')
    .replace(/\bdeck\b/g, '牌库')
    .replace(/\bhand\b/g, '手牌')
    .replace(/\s+/g, ' ')
    .trim();
}

function decorateEnergyList(types) {
  return (types || []).map((type) => ({
    id: type,
    name: energyName(type),
    symbol: ENERGY_META[type] ? ENERGY_META[type].symbol : energyName(type).slice(0, 1),
    color: energyColor(type)
  }));
}

function formatSubtypeNames(subtypes) {
  return (subtypes || []).map((item) => labelFromMap(SUBTYPE_NAMES, item));
}

function formatSupertypeName(supertype) {
  return labelFromMap(SUPERTYPE_NAMES, supertype);
}

function formatRarityName(rarity) {
  return labelFromMap(RARITY_NAMES, rarity);
}

function cleanImageUrls(images) {
  const source = images || {};
  return {
    small: source.small || '',
    large: source.large || ''
  };
}

function cleanSetImages(images) {
  const source = images || {};
  return {
    symbol: source.symbol || '',
    logo: source.logo || ''
  };
}

function transformSet(set) {
  const images = cleanSetImages(set.images);
  return {
    id: set.id,
    name: set.name || '',
    series: set.series || '',
    printed_total: Number(set.printedTotal || 0),
    total: Number(set.total || 0),
    legalities: set.legalities || {},
    legalities_text: formatLegalities(set.legalities || []),
    ptcgo_code: set.ptcgoCode || '',
    release_date: normalizeDate(set.releaseDate),
    updated_at: set.updatedAt || '',
    image_symbol_remote: images.symbol,
    image_logo_remote: images.logo
  };
}

function transformAttack(attack) {
  return {
    cost: attack.cost || [],
    cost_text: (attack.cost || []).map(energyName).join('、'),
    cost_energy: decorateEnergyList(attack.cost || []),
    name: attack.name || '',
    text: attack.text || '',
    damage: attack.damage || '',
    converted_energy_cost: Number(attack.convertedEnergyCost || 0)
  };
}

function transformAbility(ability) {
  return {
    name: ability.name || '',
    text: ability.text || '',
    type: ability.type || '',
    type_name: ability.type || ''
  };
}

function transformRelation(item) {
  return {
    type: item.type || '',
    type_name: energyName(item.type || ''),
    type_color: energyColor(item.type || ''),
    value: item.value || ''
  };
}

function transformCard(card) {
  const set = transformSet(card.set || {});
  const images = cleanImageUrls(card.images);
  const supertype = card.supertype || '';
  const subtypes = card.subtypes || [];
  const types = card.types || [];
  const summary = {
    id: card.id,
    name: card.name || '',
    name_zh: '',
    supertype,
    supertype_name: formatSupertypeName(supertype),
    subtypes,
    subtype_names: formatSubtypeNames(subtypes),
    hp: card.hp || '',
    types,
    type_names: types.map(energyName),
    type_energy: decorateEnergyList(types),
    set_id: set.id || '',
    set_name: set.name || '',
    set_series: set.series || '',
    set_release_date: set.release_date || '',
    number: card.number || '',
    artist: card.artist || '',
    rarity: card.rarity || '',
    rarity_name: formatRarityName(card.rarity || ''),
    regulation_mark: card.regulationMark || '',
    legalities: card.legalities || {},
    legalities_text: formatLegalities(card.legalities || {}),
    national_pokedex_numbers: card.nationalPokedexNumbers || [],
    image_small_remote: images.small,
    image_large_remote: images.large,
    updated_at: set.updated_at || ''
  };

  const detail = Object.assign({}, summary, {
    level: card.level || '',
    evolves_from: card.evolvesFrom || '',
    evolves_to: card.evolvesTo || [],
    rules: card.rules || [],
    ancient_trait: card.ancientTrait || null,
    abilities: (card.abilities || []).map(transformAbility),
    attacks: (card.attacks || []).map(transformAttack),
    weaknesses: (card.weaknesses || []).map(transformRelation),
    resistances: (card.resistances || []).map(transformRelation),
    retreat_cost: card.retreatCost || [],
    retreat_cost_text: (card.retreatCost || []).map(energyName).join('、'),
    retreat_cost_energy: decorateEnergyList(card.retreatCost || []),
    converted_retreat_cost: Number(card.convertedRetreatCost || 0),
    set,
    flavor_text: card.flavorText || '',
    images: {
      small: images.small,
      large: images.large
    }
  });

  return { summary, detail };
}

module.exports = {
  ENERGY_META,
  SUPERTYPE_NAMES,
  SUBTYPE_NAMES,
  RARITY_NAMES,
  LEGALITY_NAMES,
  LEGALITY_STATUS_NAMES,
  asArray,
  decorateEnergyList,
  energyColor,
  energyName,
  formatLegalities,
  localizeCardText,
  formatRarityName,
  formatSubtypeNames,
  formatSupertypeName,
  normalizeDate,
  normalizeKeyword,
  titleCase,
  transformCard,
  transformSet
};
