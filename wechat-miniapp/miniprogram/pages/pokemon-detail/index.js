const api = require('../../services/api');
const storage = require('../../utils/storage');
const pokemonUtils = require('../../utils/pokemon');

const MOVE_PAGE_SIZE = 60;
const TYPE_META = pokemonUtils.TYPE_META || {};

const STAT_ROWS = [
  { key: 'hp', name: 'HP' },
  { key: 'attack', name: '攻击' },
  { key: 'defense', name: '防御' },
  { key: 'specialAttack', name: '特攻' },
  { key: 'specialDefense', name: '特防' },
  { key: 'speed', name: '速度' }
];

const MOVE_METHOD_OPTIONS = [
  { id: '', name: '全部' },
  { id: 'level-up', name: '升级' },
  { id: 'machine', name: '招式机' },
  { id: 'egg', name: '遗传' },
  { id: 'tutor', name: '教学' },
  { id: 'other', name: '其他' }
];

const GROWTH_RATE_NAMES = {
  slow: '慢',
  medium: '中等',
  'medium-slow': '中等偏慢',
  fast: '快',
  'slow-then-very-fast': '先慢后快',
  'fast-then-very-slow': '先快后慢'
};

const LANGUAGE_PRIORITY = {
  'zh-hans': 0,
  'zh-hant': 1,
  ja: 2,
  'ja-hrkt': 3,
  en: 4
};

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
  blueberry: 9
};

const CHINESE_LANGUAGES = ['zh-hans', 'zh-hant'];

function padId(id) {
  return String(id || 0).padStart(4, '0');
}

function joinNames(items) {
  return (items || []).map((item) => item.name || item).filter(Boolean).join('、') || '暂无';
}

function titleCase(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function growthRateName(value) {
  return GROWTH_RATE_NAMES[value] || titleCase(value) || '未知';
}

function valueText(value, fallback) {
  if (value === '' || value === null || value === undefined) return fallback || '-';
  return `${value}`;
}

function percentText(value) {
  if (value === '' || value === null || value === undefined) return '';
  return `${value}%`;
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
      description: ''
    };
  }
  const ability = Object.assign({
    key: '',
    name: '',
    name_en: '',
    name_ja: '',
    is_hidden: false,
    short_effect: '',
    flavor: ''
  }, item || {});
  ability.description = ability.flavor || ability.short_effect || '';
  return ability;
}

function methodGroup(method) {
  if (!method) return 'other';
  if (MOVE_METHOD_OPTIONS.find((item) => item.id === method)) return method;
  if (method === 'light-ball-egg') return 'egg';
  return 'other';
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
      learnText: ''
    };
  }

  const move = item || {};
  const method = move.method || 'other';
  const level = Number(move.level || 0);
  const name = move.name || titleCase(move.key);
  const nameEn = move.name_en || '';
  const type = move.type || '';
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
    learnText: [
      level ? `Lv.${level}` : '',
      move.version_group_name || ''
    ].filter(Boolean).join(' / '),
    timeText: move.learn_time || [
      move.method_name || titleCase(method),
      level ? `Lv.${level}` : '',
      move.version_group_name || ''
    ].filter(Boolean).join(' / ')
  });
}

function buildMoveState(pokemon, activeMethod, moveLimit) {
  const allMoves = (pokemon.moves && pokemon.moves.length ? pokemon.moves : pokemon.moves_summary || []).map(normalizeMove);
  const filtered = activeMethod
    ? allMoves.filter((move) => move.method_group === activeMethod)
    : allMoves;
  const visible = filtered.slice(0, moveLimit);
  return {
    moves: visible,
    moveTotal: allMoves.length,
    filteredMoveTotal: filtered.length,
    canShowMoreMoves: visible.length < filtered.length
  };
}

function buildFlavorGroups(entries) {
  const groups = {};
  (entries || []).forEach((entry) => {
    if (!entry || !entry.text) return;
    const key = entry.generation ? String(entry.generation) : 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(entry);
  });

  return Object.keys(groups)
    .sort((a, b) => {
      if (a === 'other') return 1;
      if (b === 'other') return -1;
      return Number(a) - Number(b);
    })
    .map((key) => {
      const seen = {};
      const items = groups[key]
        .slice()
        .sort((a, b) => {
          const aPriority = LANGUAGE_PRIORITY[a.language] === undefined ? 9 : LANGUAGE_PRIORITY[a.language];
          const bPriority = LANGUAGE_PRIORITY[b.language] === undefined ? 9 : LANGUAGE_PRIORITY[b.language];
          return aPriority - bPriority;
        })
        .filter((entry) => {
          if (seen[entry.text]) return false;
          seen[entry.text] = true;
          return true;
        })
        .slice(0, 3)
        .map((entry) => ({
          key: `${entry.version}-${entry.language}-${entry.text}`,
          version: entry.version_name || titleCase(entry.version),
          text: entry.text
        }));
      return {
        key,
        title: key === 'other' ? '其他版本' : `第 ${key} 世代`,
        items
      };
    })
    .filter((group) => group.items.length);
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''));
}

function isChineseFlavor(entry) {
  return entry && CHINESE_LANGUAGES.includes(String(entry.language || '').toLowerCase()) && entry.text;
}

function sortFlavorEntries(entries) {
  return (entries || []).slice().sort((a, b) => {
    const aPriority = LANGUAGE_PRIORITY[a.language] === undefined ? 9 : LANGUAGE_PRIORITY[a.language];
    const bPriority = LANGUAGE_PRIORITY[b.language] === undefined ? 9 : LANGUAGE_PRIORITY[b.language];
    const aGeneration = Number(a.generation || 99);
    const bGeneration = Number(b.generation || 99);
    return aPriority - bPriority || aGeneration - bGeneration;
  });
}

function buildSelectedFlavor(pokemon, selectedDex) {
  const targetGeneration = selectedDex && selectedDex.generation
    ? Number(selectedDex.generation)
    : Number(pokemon.generation || 0);
  const entries = sortFlavorEntries(pokemon.flavor_entries || []);
  const chineseEntries = entries.filter(isChineseFlavor);
  const sameGeneration = chineseEntries.find((entry) => Number(entry.generation || 0) === targetGeneration);
  const samePokemonGeneration = chineseEntries.find((entry) => Number(entry.generation || 0) === Number(pokemon.generation || 0));
  const fallbackFlavor = hasChineseText(pokemon.flavor) ? pokemon.flavor : '';
  const selected = sameGeneration || samePokemonGeneration || chineseEntries[0] || null;
  const title = selectedDex
    ? `${selectedDex.label}${targetGeneration ? ` · 第 ${targetGeneration} 世代` : ''}`
    : '中文图鉴描述';

  if (selected) {
    return {
      title,
      version: selected.version_name || titleCase(selected.version),
      text: selected.text
    };
  }

  return {
    title,
    version: fallbackFlavor ? '中文通用描述' : '',
    text: fallbackFlavor || '暂无中文图鉴描述'
  };
}

function buildEncounterRows(encounters) {
  const rows = (encounters && encounters.rows ? encounters.rows : []).map((row, index) => {
    const minLevel = Number(row.min_level || 0);
    const maxLevel = Number(row.max_level || 0);
    return Object.assign({}, row, {
      key: `${row.location}-${row.version}-${index}`,
      levelText: minLevel && maxLevel
        ? (minLevel === maxLevel ? `Lv.${minLevel}` : `Lv.${minLevel}-${maxLevel}`)
        : '',
      chanceText: row.chance ? `${row.chance}%` : ''
    });
  });
  return {
    rows,
    locations: encounters && encounters.locations ? encounters.locations : [],
    methods: encounters && encounters.methods ? encounters.methods : [],
    count: encounters ? Number(encounters.count || rows.length || 0) : 0
  };
}

function row(label, value) {
  return value === '' || value === null || value === undefined
    ? null
    : { label, value: `${value}` };
}

function buildMoveDetail(move) {
  const item = normalizeMove(move || {});
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
    row('招式机记录', item.machine_count ? `${item.machine_count} 个版本` : '')
  ].filter(Boolean);
  const extraRows = [
    row('异常状态', item.ailment_name && item.ailment_name !== '无' ? item.ailment_name : ''),
    row('效果类别', item.category_name),
    row('连续次数', item.min_hits || item.max_hits ? `${valueText(item.min_hits)}-${valueText(item.max_hits)}` : ''),
    row('持续回合', item.min_turns || item.max_turns ? `${valueText(item.min_turns)}-${valueText(item.max_turns)}` : ''),
    row('吸取/反伤', item.drain ? `${item.drain}%` : ''),
    row('回复', item.healing ? `${item.healing}%` : ''),
    row('击中要害等级', item.crit_rate ? `${item.crit_rate}` : ''),
    row('异常概率', percentText(item.ailment_chance)),
    row('畏缩概率', percentText(item.flinch_chance)),
    row('能力变化概率', percentText(item.stat_chance))
  ].filter(Boolean);

  return Object.assign({}, item, {
    mainRows,
    extraRows,
    statChanges: item.stat_changes || [],
    hasExtra: extraRows.length || (item.stat_changes || []).length,
    descriptionText: item.description || '暂无中文招式说明',
    effectText: item.short_effect || item.effect || '',
    fullEffectText: item.effect || ''
  });
}

function buildInfoRows(pokemon) {
  return [
    { label: '全国编号', value: `#${padId(pokemon.id)}` },
    { label: '世代', value: pokemon.generation ? `第 ${pokemon.generation} 世代` : '未知' },
    { label: '分类', value: pokemon.category || '未知' },
    { label: '身高', value: pokemon.height || '-' },
    { label: '体重', value: pokemon.weight || '-' },
    { label: '捕获率', value: pokemon.capture_rate || '-' },
    { label: '种族值', value: pokemon.stat_total || '-' },
    { label: '招式数', value: pokemon.move_count || ((pokemon.moves || []).length || '-') }
  ];
}

function buildBreedingRows(pokemon) {
  return [
    { label: '蛋群', value: joinNames(pokemon.egg_groups) },
    { label: '性别比例', value: pokemon.gender_text || '未知' },
    { label: '孵化周期', value: pokemon.hatch_counter !== undefined ? `${pokemon.hatch_counter}` : '-' },
    { label: '基础亲密度', value: pokemon.base_happiness !== undefined ? `${pokemon.base_happiness}` : '-' },
    { label: '成长速度', value: growthRateName(pokemon.growth_rate) }
  ];
}

function buildRegionalDexes(pokemon, selectedKey) {
  const fallbackGeneration = Number(pokemon.generation || 0);
  return (pokemon.regional_dexes || []).map((item, index) => {
    const key = item.key || `${item.name}-${index}`;
    return Object.assign({}, item, {
      key,
      generation: DEX_GENERATION_MAP[key] === undefined ? fallbackGeneration : DEX_GENERATION_MAP[key],
      label: `${item.name} #${item.entry_number}`,
      selected: key === selectedKey
    });
  });
}

function buildStatRows(pokemon) {
  const stats = pokemon.stats || {};
  const evByKey = {};
  (pokemon.ev_yield || []).forEach((item) => {
    evByKey[item.key] = item;
  });

  return STAT_ROWS.map((stat) => {
    const value = Number(stats[stat.key] || 0);
    const apiKey = stat.key === 'specialAttack'
      ? 'special-attack'
      : (stat.key === 'specialDefense' ? 'special-defense' : stat.key);
    const ev = evByKey[apiKey] || evByKey[stat.key];
    return {
      key: stat.key,
      name: stat.name,
      value,
      percent: Math.min(100, Math.max(8, Math.round(value / 160 * 100))),
      evText: ev ? `+${ev.value}` : ''
    };
  });
}

function buildEvolutionRows(pokemon) {
  const conditionByTarget = {};
  (pokemon.evolution_conditions || []).forEach((item) => {
    conditionByTarget[Number(item.to_id)] = item;
  });

  return (pokemon.evolution || []).map((item, index) => {
    const condition = conditionByTarget[Number(item.id)];
    return Object.assign({}, item, {
      conditionText: index === 0 ? '起点' : ((condition && condition.text) || '进化条件待补充'),
      active: Number(item.id) === Number(pokemon.id)
    });
  });
}

function typeName(type) {
  return TYPE_META[type] ? TYPE_META[type].name : type;
}

function typeColor(type) {
  return TYPE_META[type] ? TYPE_META[type].color : '#64748b';
}

function multiplierText(multiplier) {
  if (multiplier === 0) return '×0';
  if (multiplier === 0.25) return '×0.25';
  if (multiplier === 0.5) return '×0.5';
  if (multiplier === 4) return '×4';
  if (multiplier === 2) return '×2';
  return `×${multiplier}`;
}

function relationChip(type, multiplier) {
  return {
    id: type,
    name: typeName(type),
    color: typeColor(type),
    multiplier,
    multiplierText: multiplierText(multiplier)
  };
}

function sortRelationChips(a, b) {
  return b.multiplier - a.multiplier || a.name.localeCompare(b.name);
}

function buildDefensiveRelations(pokemon) {
  const defenderTypes = pokemon.types || [];
  const chips = Object.keys(TYPE_META).map((type) => {
    const multiplier = pokemonUtils.getDamageMultiplier
      ? pokemonUtils.getDamageMultiplier(type, defenderTypes)
      : 1;
    return relationChip(type, multiplier);
  });

  return {
    title: `${defenderTypes.map(typeName).join(' / ')}属性防守`,
    weaknesses: chips.filter((item) => item.multiplier > 1).sort(sortRelationChips),
    resistances: chips.filter((item) => item.multiplier > 0 && item.multiplier < 1).sort((a, b) => a.multiplier - b.multiplier || a.name.localeCompare(b.name)),
    immunities: chips.filter((item) => item.multiplier === 0).sort((a, b) => a.name.localeCompare(b.name))
  };
}

function normalizeModelForms(model3d) {
  if (!model3d) return [];
  const rawForms = model3d.forms && model3d.forms.length ? model3d.forms : [model3d];
  return rawForms
    .filter((form) => form && (form.normalImage || form.shinyImage || form.image))
    .map((form, index) => Object.assign({}, form, {
      label: form.label || form.formName || (index === 0 ? '默认形态' : form.slug),
      image: form.image || form.normalImage || form.shinyImage,
      normalImage: form.normalImage || '',
      shinyImage: form.shinyImage || ''
    }));
}

function variantOptionsForForm(form) {
  const options = [];
  if (form && form.normalImage) {
    options.push({ id: 'normal', name: '普通', image: form.normalImage });
  }
  if (form && form.shinyImage) {
    options.push({ id: 'shiny', name: '异色', image: form.shinyImage });
  }
  return options;
}

function buildModelState(model3d, preferredIndex, preferredVariant) {
  const forms = normalizeModelForms(model3d);
  if (!forms.length) {
    return {
      modelForms: [],
      modelVariantOptions: [],
      activeModel: null,
      activeModelFormIndex: 0,
      activeModelVariant: 'normal',
      activeModelVariantText: '',
      activeModelImage: ''
    };
  }

  const activeIndex = Math.max(0, Math.min(Number(preferredIndex || 0), forms.length - 1));
  const activeForm = forms[activeIndex];
  const variantOptions = variantOptionsForForm(activeForm);
  const matchedVariant = variantOptions.find((item) => item.id === preferredVariant) || variantOptions[0];
  const activeVariant = matchedVariant ? matchedVariant.id : 'normal';

  return {
    modelForms: forms.map((form, index) => Object.assign({}, form, {
      selected: index === activeIndex
    })),
    modelVariantOptions: variantOptions,
    activeModel: activeForm,
    activeModelFormIndex: activeIndex,
    activeModelVariant: activeVariant,
    activeModelVariantText: activeVariant === 'shiny' ? '异色' : '普通',
    activeModelImage: matchedVariant ? matchedVariant.image : activeForm.image
  };
}

Page({
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
      immunities: []
    }
  },

  onLoad(options) {
    this.setData({ id: Number(options.id || 1) });
    this.loadDetail();
  },

  loadDetail() {
    api.getPokemonById(this.data.id).then((result) => {
      const pokemon = result.item;
      if (!pokemon) return;
      const moveState = buildMoveState(pokemon, this.data.activeMoveMethod, this.data.moveLimit);
      const encounters = buildEncounterRows(pokemon.encounters);
      const selectedDexKey = ((pokemon.regional_dexes || [])[0] || {}).key || '';
      const regionalDexes = buildRegionalDexes(pokemon, selectedDexKey);
      const selectedDex = regionalDexes.find((item) => item.selected) || regionalDexes[0] || null;
      const modelState = buildModelState(pokemon.model3d, 0, 'normal');

      this.setData({
        pokemon: Object.assign({}, pokemon, {
          idText: `#${padId(pokemon.id)}`,
          generationText: pokemon.generation ? `第 ${pokemon.generation} 世代` : '世代未知',
          evYieldText: pokemon.ev_yield_text || '-'
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
        relations: buildDefensiveRelations(pokemon)
      });
      storage.addRecent(pokemon);
      this.loadRelatedCards(pokemon.id);
    });
  },

  loadRelatedCards(id) {
    Promise.all([
      api.getPokemonCards(id, { page: 1, pageSize: 6 }).catch(() => ({ items: [], total: 0 })),
      api.listPocketCards({ pokemonId: id, page: 1, pageSize: 6 }).catch(() => ({ items: [], total: 0 }))
    ]).then(([physical, pocket]) => {
      const physicalCards = (physical.items || []).map((card) => Object.assign({}, card, { cardSource: 'physical' }));
      const pocketCards = (pocket.items || []).map((card) => Object.assign({}, card, { cardSource: 'pocket' }));
      const mode = physicalCards.length || !pocketCards.length ? 'physical' : 'pocket';
      this.setData({
        relatedCardMode: mode,
        relatedCards: mode === 'physical' ? physicalCards : pocketCards,
        relatedCardTotal: Number(mode === 'physical' ? physical.total : pocket.total) || 0,
        physicalRelatedCards: physicalCards,
        physicalRelatedCardTotal: Number(physical.total || 0),
        pocketRelatedCards: pocketCards,
        pocketRelatedCardTotal: Number(pocket.total || 0)
      });
    });
  },

  selectRelatedCardMode(event) {
    const mode = event.currentTarget.dataset.mode === 'pocket' ? 'pocket' : 'physical';
    this.setData({
      relatedCardMode: mode,
      relatedCards: mode === 'pocket' ? this.data.pocketRelatedCards : this.data.physicalRelatedCards,
      relatedCardTotal: mode === 'pocket' ? this.data.pocketRelatedCardTotal : this.data.physicalRelatedCardTotal
    });
  },

  refreshMoves(activeMoveMethod, moveLimit) {
    const moveState = buildMoveState(this.data.pokemon || {}, activeMoveMethod, moveLimit);
    this.setData({
      activeMoveMethod,
      moveLimit,
      moves: moveState.moves,
      moveTotal: moveState.moveTotal,
      filteredMoveTotal: moveState.filteredMoveTotal,
      canShowMoreMoves: moveState.canShowMoreMoves
    });
  },

  selectMoveMethod(event) {
    this.refreshMoves(event.currentTarget.dataset.method || '', MOVE_PAGE_SIZE);
  },

  showMoreMoves() {
    this.refreshMoves(this.data.activeMoveMethod, this.data.moveLimit + MOVE_PAGE_SIZE);
  },

  openMoveDetail(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const move = this.data.moves[index];
    if (!move) return;
    this.setData({ activeMoveDetail: buildMoveDetail(move) });
  },

  closeMoveDetail() {
    this.setData({ activeMoveDetail: null });
  },

  noop() {},

  selectRegionalDex(event) {
    const key = event.currentTarget.dataset.key || '';
    const pokemon = this.data.pokemon || {};
    const regionalDexes = buildRegionalDexes(pokemon, key);
    const selectedDex = regionalDexes.find((item) => item.selected) || regionalDexes[0] || null;
    this.setData({
      selectedDexKey: key,
      regionalDexes,
      selectedFlavor: buildSelectedFlavor(pokemon, selectedDex)
    });
  },

  toggleFavorite() {
    const favorite = storage.toggleFavorite(this.data.pokemon.id);
    this.setData({ favorite });
    wx.showToast({ title: favorite ? '已收藏' : '已取消', icon: 'none' });
  },

  addToTeam() {
    const result = storage.addTeamSlot(this.data.pokemon.id);
    wx.showToast({ title: result.message, icon: 'none' });
  },

  openPokemon(event) {
    wx.redirectTo({ url: `/pages/pokemon-detail/index?id=${event.currentTarget.dataset.id}` });
  },

  openRelatedCard(event) {
    const id = encodeURIComponent(event.currentTarget.dataset.id);
    const source = event.currentTarget.dataset.source;
    wx.navigateTo({ url: source === 'pocket' ? `/pages/pocket-card-detail/index?id=${id}` : `/pages/card-detail/index?id=${id}` });
  },

  openRelatedCards() {
    if (this.data.relatedCardMode === 'pocket') {
      wx.setStorageSync('pokechill:pendingPocketPokemonId', this.data.pokemon.id);
      wx.switchTab({ url: '/pages/pocket/index' });
      return;
    }
    wx.setStorageSync('pokechill:pendingCardPokemonId', this.data.pokemon.id);
    wx.switchTab({ url: '/pages/carddex/index' });
  },

  selectModelForm(event) {
    const index = Number(event.currentTarget.dataset.index || 0);
    const modelState = buildModelState({ forms: this.data.modelForms }, index, this.data.activeModelVariant);
    this.setData(modelState);
  },

  selectModelVariant(event) {
    const variant = event.currentTarget.dataset.variant || 'normal';
    const modelState = buildModelState({ forms: this.data.modelForms }, this.data.activeModelFormIndex, variant);
    this.setData(modelState);
  },

  previewModel3d(event) {
    const model = this.data.activeModel || (this.data.pokemon && this.data.pokemon.model3d);
    if (!model) return;
    const urls = [model.normalImage || model.image, model.shinyImage].filter(Boolean);
    if (!urls.length) return;
    const variant = (event && event.currentTarget && event.currentTarget.dataset.variant) || this.data.activeModelVariant || 'normal';
    const current = variant === 'shiny' && model.shinyImage
      ? model.shinyImage
      : (this.data.activeModelImage || model.normalImage || model.image || urls[0]);
    wx.previewImage({ current, urls });
  },

  openTypeChart(event) {
    const type = event.currentTarget.dataset.type || '';
    wx.navigateTo({ url: `/pages/type-chart/index${type ? `?type=${type}` : ''}` });
  },

  openTeam() {
    wx.navigateTo({ url: '/pages/team/index' });
  }
});
