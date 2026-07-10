const ENERGY_META = {
  Grass: { id: 'Grass', name: '草', symbol: '草', color: '#2f9e44' },
  Fire: { id: 'Fire', name: '火', symbol: '火', color: '#e85d3f' },
  Water: { id: 'Water', name: '水', symbol: '水', color: '#2f80ed' },
  Lightning: { id: 'Lightning', name: '雷', symbol: '雷', color: '#d99a00' },
  Psychic: { id: 'Psychic', name: '超', symbol: '超', color: '#db2777' },
  Fighting: { id: 'Fighting', name: '斗', symbol: '斗', color: '#c2410c' },
  Darkness: { id: 'Darkness', name: '恶', symbol: '恶', color: '#374151' },
  Metal: { id: 'Metal', name: '钢', symbol: '钢', color: '#64748b' },
  Fairy: { id: 'Fairy', name: '妖', symbol: '妖', color: '#ec4899' },
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
  'Stage 1': '1阶进化',
  'Stage 2': '2阶进化',
  Restored: '复原',
  Item: '物品',
  Tool: '宝可梦道具',
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
  Fusion: '汇流'
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

const ABILITY_TYPE_NAMES = {
  Ability: '特性',
  'Poké-POWER': '宝可力量',
  'Poké-BODY': '宝可体质',
  'Pokémon Power': '宝可梦特殊能力',
  AncientTrait: '古代能力'
};

// Common official move and Trainer names. Unknown card-original names stay in English.
const CARD_NAME_TRANSLATIONS = {
  'Battle Sense': '战斗感知',
  Bite: '咬住',
  Confusion: '念力',
  Crunch: '咬碎',
  Ember: '火花',
  'Energy Burn': '能量燃烧',
  'Energy Retrieval': '能量回收',
  'Energy Search': '能量搜索',
  'Escape Rope': '离洞绳',
  'Fire Spin': '火焰旋涡',
  Flamethrower: '喷射火焰',
  Growl: '叫声',
  'Great Ball': '超级球',
  'Gust of Wind': '突风',
  'Hydro Pump': '水炮',
  'Leech Seed': '寄生种子',
  Multiply: '增殖',
  'Nest Ball': '巢穴球',
  'Night Stretcher': '暗夜担架',
  Pound: '拍击',
  'Pokémon Catcher': '宝可梦捕捉器',
  'Professor\'s Research': '博士的研究',
  Psychic: '精神强念',
  'Quick Attack': '电光一闪',
  'Rare Candy': '神奇糖果',
  'Razor Leaf': '飞叶快刀',
  'Royal Blaze': '皇家烈焰',
  Scratch: '抓',
  'Super Rod': '厉害钓竿',
  Switch: '宝可梦交替',
  Tackle: '撞击',
  'Thunder Jolt': '电击冲击',
  'Thunder Shock': '电击',
  Thunderbolt: '十万伏特',
  'Ultra Ball': '高级球',
  'Vine Whip': '藤鞭',
  'Water Gun': '水枪'
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

function localizeCardName(value) {
  const name = String(value || '').trim();
  return CARD_NAME_TRANSLATIONS[name] || '';
}

function localizeAbilityType(value) {
  return ABILITY_TYPE_NAMES[value] || value || '';
}

function localizeCardText(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  const replacements = [
    [/Once during your turn(?:, before your attack)?, you may look at the top (\d+) cards? of your deck and put (\d+) of them into your hand\. Discard the other cards\./gi, '在自己的回合时，可使用1次。查看自己牌库上方的$1张卡牌，选择其中$2张加入手牌。将其余卡牌放于弃牌区。'],
    [/Search your deck for up to (\d+) ([^.]+?), reveal (?:it|them), and put (?:it|them) into your hand\. Then, shuffle your deck\./gi, '选择自己牌库中最多$1张$2，在给对手看过之后加入手牌。并重洗牌库。'],
    [/Search your deck for (?:a|an|1) ([^.]+?), reveal it, and put it into your hand\. Then, shuffle your deck\./gi, '选择自己牌库中的1张$1，在给对手看过之后加入手牌。并重洗牌库。'],
    [/Once during your turn(?:, before your attack)?, you may ([^.]+)\./gi, '在自己的回合时，可执行1次以下操作：$1。'],
    [/You may use this Ability only if ([^.]+)\./gi, '仅当$1时，才可使用这个特性。'],
    [/Flip a coin\. If tails, this attack does nothing\./gi, '抛掷1次硬币。若为反面，则这个招式失败。'],
    [/Flip a coin\. If heads, ([^.]+)\./gi, '抛掷1次硬币。若为正面，则$1。'],
    [/Flip a coin\. If tails, ([^.]+)\./gi, '抛掷1次硬币。若为反面，则$1。'],
    [/Flip a coin until you get tails\./gi, '持续抛掷硬币直到出现反面。'],
    [/Flip (\d+) coins?\./gi, '抛掷$1次硬币。'],
    [/Flip a coin\./gi, '抛掷1次硬币。'],
    [/This attack does (\d+) more damage for each ([A-Za-zÀ-ž' -]+) card in your discard pile\./gi, '自己的弃牌区中每有1张“$2”，则追加造成$1伤害。'],
    [/This attack does (\d+) more damage for each ([^.]+)\./gi, '每有$2，则追加造成$1伤害。'],
    [/This attack does (\d+) more damage/gi, '这个招式追加造成$1伤害'],
    [/This attack does (\d+) damage to itself/gi, '这只宝可梦也受到$1伤害'],
    [/This Pokémon also does (\d+) damage to itself\./gi, '这只宝可梦也受到$1伤害。'],
    [/This Pokémon does (\d+) damage to itself\./gi, '这只宝可梦也受到$1伤害。'],
    [/([A-Za-zÀ-ž' -]+) does (\d+) damage to itself\./gi, '$1也受到$2伤害。'],
    [/This attack does nothing/gi, '这个招式无效'],
    [/Discard (\d+) Energy cards? attached to ([^.]+?)(?: in order to use this attack)?\./gi, '选择$2身上附着的$1个能量，放于弃牌区。'],
    [/Discard all Energy from this Pokémon\./gi, '将这只宝可梦身上附着的所有能量放于弃牌区。'],
    [/Discard an Energy from this Pokémon\./gi, '选择这只宝可梦身上附着的1个能量，放于弃牌区。'],
    [/Discard the other cards\./gi, '将其余卡牌放于弃牌区。'],
    [/Search your deck for ([^.]+?) and put it onto your Bench\. Shuffle your deck afterward\./gi, '选择自己牌库中的1张$1，放置于备战区。并重洗牌库。'],
    [/Your opponent's Active Pokémon is now Burned\./gi, '将对手的战斗宝可梦灼伤。'],
    [/Your opponent's Active Pokémon is now Poisoned\./gi, '将对手的战斗宝可梦中毒。'],
    [/Your opponent's Active Pokémon is now Paralyzed\./gi, '将对手的战斗宝可梦麻痹。'],
    [/Your opponent's Active Pokémon is now Asleep\./gi, '将对手的战斗宝可梦睡眠。'],
    [/Your opponent's Active Pokémon is now Confused\./gi, '将对手的战斗宝可梦混乱。'],
    [/The Defending Pokémon is now Burned\./gi, '将对手的战斗宝可梦灼伤。'],
    [/The Defending Pokémon is now Poisoned\./gi, '将对手的战斗宝可梦中毒。'],
    [/The Defending Pokémon is now Paralyzed\./gi, '将对手的战斗宝可梦麻痹。'],
    [/The Defending Pokémon is now Asleep\./gi, '将对手的战斗宝可梦睡眠。'],
    [/The Defending Pokémon is now Confused\./gi, '将对手的战斗宝可梦混乱。'],
    [/The Defending Pokémon can't retreat during your opponent's next turn\./gi, '在下一个对手的回合，对手的战斗宝可梦无法撤退。'],
    [/During your opponent's next turn, the Defending Pokémon can't retreat\./gi, '在下一个对手的回合，对手的战斗宝可梦无法撤退。'],
    [/Draw (\d+) cards?\./gi, '从自己的牌库上方抽取$1张卡牌。'],
    [/Draw a card\./gi, '从自己的牌库上方抽取1张卡牌。'],
    [/Draw cards until you have (\d+) cards in your hand\./gi, '从自己的牌库上方抽取卡牌，直到手牌达到$1张为止。'],
    [/Look at the top (\d+) cards? of your deck/gi, '查看自己牌库上方的$1张卡牌'],
    [/put (\d+) of them into your hand/gi, '选择其中$1张加入手牌'],
    [/put it into your hand/gi, '将其加入手牌'],
    [/Search your deck for up to (\d+) ([^.]+?), reveal (?:it|them), and put (?:it|them) into your hand\./gi, '选择自己牌库中最多$1张$2，在给对手看过之后加入手牌。'],
    [/Search your deck for (?:a|an|1) ([^.]+?), reveal it, and put it into your hand\./gi, '选择自己牌库中的1张$1，在给对手看过之后加入手牌。'],
    [/Search your deck for ([^.]+)\./gi, '选择自己牌库中的$1。'],
    [/Shuffle your deck afterward\./gi, '并重洗牌库。'],
    [/Then, shuffle your deck\./gi, '并重洗牌库。'],
    [/Heal (\d+) damage from this Pokémon\./gi, '将这只宝可梦的HP回复$1。'],
    [/Heal (\d+) damage from each of your Pokémon\./gi, '将自己的所有宝可梦的HP各回复$1。'],
    [/Discard the top (\d+) cards? of your deck\./gi, '将自己牌库上方的$1张卡牌放于弃牌区。'],
    [/Discard the top (\d+) cards? of your opponent's deck\./gi, '将对手牌库上方的$1张卡牌放于弃牌区。'],
    [/During your next turn, this Pokémon can't attack\./gi, '在下一个自己的回合，这只宝可梦无法使用招式。'],
    [/This Pokémon can't attack during your next turn\./gi, '在下一个自己的回合，这只宝可梦无法使用招式。'],
    [/This attack's damage isn't affected by Weakness or Resistance\./gi, '这个招式的伤害不计算弱点、抗性。'],
    [/Apply Weakness and Resistance for Benched Pokémon\./gi, '对备战宝可梦也计算弱点、抗性。'],
    [/Don't apply Weakness and Resistance for Benched Pokémon\./gi, '对备战宝可梦不计算弱点、抗性。'],
    [/Switch this Pokémon with 1 of your Benched Pokémon\./gi, '将这只宝可梦与自己的1只备战宝可梦互换。'],
    [/Your opponent switches their Active Pokémon with 1 of their Benched Pokémon\./gi, '对手将战斗宝可梦与其1只备战宝可梦互换。'],
    [/This attack does (\d+) damage to (\d+) of your opponent's Benched Pokémon\./gi, '选择对手的$2只备战宝可梦，对其各造成$1伤害。'],
    [/This attack also does (\d+) damage to (\d+) of your opponent's Benched Pokémon\./gi, '并选择对手的$2只备战宝可梦，对其各造成$1伤害。'],
    [/This attack does (\d+) damage to each of your opponent's Pokémon\./gi, '对手的所有宝可梦各受到$1伤害。'],
    [/During your opponent's next turn, this Pokémon takes (\d+) less damage from attacks \(after applying Weakness and Resistance\)\./gi, '在下一个对手的回合，这只宝可梦受到招式的伤害减少$1。［计算弱点、抗性后］'],
    [/Put (\d+) damage counters? on ([^.]+)\./gi, '在$2身上放置$1个伤害指示物。'],
    [/Attach ([^.]+) from your discard pile to ([^.]+)\./gi, '选择自己弃牌区中的$1，附着于$2身上。'],
    [/If the Defending Pokémon already has any damage counters on it, this attack does (\d+) damage plus (\d+) more damage\./gi, '若对手的战斗宝可梦身上放置有伤害指示物，则追加造成$2伤害。'],
    [/During your opponent's next turn, any damage done to ([A-Za-zÀ-ž' -]+) by attacks is reduced by (\d+) \(after applying Weakness and Resistance\)\./gi, '在下一个对手的回合，这只宝可梦受到招式的伤害减少$2。［计算弱点、抗性后］'],
    [/If this Pokémon has any damage counters on it, ([^.]+)\./gi, '若这只宝可梦身上有伤害指示物，$1。'],
    [/If your opponent's Active Pokémon is affected by a Special Condition, ([^.]+)\./gi, '若对手的战斗宝可梦处于特殊状态，$1。']
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });

  return text
    .replace(/\bBasic Pokémon\b/g, '基础宝可梦')
    .replace(/\bEvolution Pokémon\b/g, '进化宝可梦')
    .replace(/\bthis Pokémon\b/gi, '这只宝可梦')
    .replace(/\bthe Defending Pokémon\b/gi, '对手的战斗宝可梦')
    .replace(/\bDefending Pokémon\b/g, '对手的战斗宝可梦')
    .replace(/\byour opponent's Active Pokémon\b/g, '对手的战斗宝可梦')
    .replace(/\byour opponent's Pokémon\b/g, '对手的宝可梦')
    .replace(/\byour Active Pokémon\b/g, '自己的战斗宝可梦')
    .replace(/\byour Pokémon\b/g, '自己的宝可梦')
    .replace(/\byour opponent's Benched Pokémon\b/g, '对手的备战宝可梦')
    .replace(/\byour Benched Pokémon\b/g, '自己的备战宝可梦')
    .replace(/\bBenched Pokémon\b/g, '备战宝可梦')
    .replace(/\bPokémon\b/g, '宝可梦')
    .replace(/\bLeon\b/g, '丹帝')
    .replace(/\bFire Energy\b/g, '火能量')
    .replace(/\bWater Energy\b/g, '水能量')
    .replace(/\bGrass Energy\b/g, '草能量')
    .replace(/\bLightning Energy\b/g, '雷能量')
    .replace(/\bPsychic Energy\b/g, '超能量')
    .replace(/\bFighting Energy\b/g, '斗能量')
    .replace(/\bDarkness Energy\b/g, '恶能量')
    .replace(/\bMetal Energy\b/g, '钢能量')
    .replace(/\bEnergy\b/g, '能量')
    .replace(/\bdamage counters\b/g, '伤害指示物')
    .replace(/\bdiscard pile\b/g, '弃牌区')
    .replace(/\byour deck\b/gi, '自己的牌库')
    .replace(/\byour hand\b/gi, '自己的手牌')
    .replace(/\bdeck\b/gi, '牌库')
    .replace(/\bhand\b/gi, '手牌')
    .replace(/\bWeakness\b/g, '弱点')
    .replace(/\bResistance\b/g, '抗性')
    .replace(/\bSpecial Condition\b/g, '特殊状态')
    .replace(/\bKnocked Out\b/g, '【昏厥】')
    .replace(/\bPrize cards?\b/g, '奖赏卡')
    .replace(/\bStadium card\b/g, '竞技场卡')
    .replace(/\bRetreat Cost\b/g, '撤退所需能量')
    .replace(/\battack\b/gi, '招式')
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
  localizeAbilityType,
  localizeCardName,
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
