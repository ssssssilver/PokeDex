const fs = require('fs');
const path = require('path');
const seed = require('../wechat-miniapp/miniprogram/utils/pokemon');
const {
  ENERGY_META,
  RARITY_NAMES,
  SUBTYPE_NAMES,
  SUPERTYPE_NAMES,
  asArray,
  decorateEnergyList,
  formatLegalities,
  localizeCardText,
  normalizeKeyword,
  titleCase
} = require('./ptcg-utils');

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.floor(number), max));
}

function dateValue(value) {
  const date = new Date(String(value || '').replace(/\//g, '-'));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function cleanText(value) {
  return String(value || '').trim();
}

function compactObject(value) {
  return Object.keys(value || {}).reduce((next, key) => {
    if (value[key] !== undefined && value[key] !== null && value[key] !== '') {
      next[key] = value[key];
    }
    return next;
  }, {});
}

function parseIds(value) {
  return asArray(value)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function formatDate(value) {
  if (!value) return '尚未同步';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function runStatusText(status) {
  if (status === 'success') return '成功';
  if (status === 'running') return '运行中';
  if (status === 'failed') return '失败';
  return status || '未知';
}

function runHealthTone(status) {
  if (status === 'success') return 'ready';
  if (status === 'running') return 'local';
  return 'stale';
}

function sortRunsByTime(runs) {
  return runs.slice().sort((a, b) => {
    const aTime = new Date(a.startedAt || a.finishedAt).getTime();
    const bTime = new Date(b.startedAt || b.finishedAt).getTime();
    return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
  });
}

function formatRun(run) {
  return {
    key: run.runId || `${run.status}-${run.startedAt}`,
    runId: run.runId || '',
    status: run.status || '',
    statusText: runStatusText(run.status),
    healthTone: runHealthTone(run.status),
    timeText: formatDate(run.finishedAt || run.startedAt),
    cardText: `${Number(run.cardSyncedCount || 0)} / ${Number(run.cardTotalCount || 0)}`,
    setText: `${Number(run.setSyncedCount || 0)} / ${Number(run.setTotalCount || 0)}`,
    durationMs: Number(run.durationMs || 0),
    message: run.message || ''
  };
}

function pokemonNameMap(pokemonStore) {
  const rows = pokemonStore && pokemonStore.getSummaries
    ? pokemonStore.getSummaries()
    : seed.POKEMON;
  const map = {};
  rows.forEach((pokemon) => {
    if (!pokemon || !pokemon.id) return;
    map[Number(pokemon.id)] = {
      id: Number(pokemon.id),
      name_en: pokemon.name_en || pokemon.slug || '',
      name_zh: pokemon.name_zh || '',
      image: pokemon.image || ''
    };
  });
  return map;
}

function setMap(cardStore) {
  const rows = cardStore && cardStore.getSets ? cardStore.getSets() : [];
  const map = {};
  rows.forEach((set) => {
    if (!set || !set.id) return;
    map[String(set.id)] = set;
  });
  return map;
}

function hasChineseText(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''));
}

function chooseChineseFlavor(entries) {
  const priorities = {
    'zh-hans': 0,
    'zh-hant': 1,
    zh: 2
  };
  return (entries || [])
    .filter((entry) => entry && entry.text && priorities[String(entry.language || '').toLowerCase()] !== undefined)
    .sort((a, b) => {
      const aLanguage = priorities[String(a.language || '').toLowerCase()];
      const bLanguage = priorities[String(b.language || '').toLowerCase()];
      const aGeneration = Number(a.generation || 99);
      const bGeneration = Number(b.generation || 99);
      return aLanguage - bLanguage || bGeneration - aGeneration;
    })[0] || null;
}

function pokemonFlavor(card, pokemonStore) {
  const numbers = card && card.national_pokedex_numbers ? card.national_pokedex_numbers : [];
  if (!numbers.length || !pokemonStore || !pokemonStore.getDetail) return null;
  const detail = pokemonStore.getDetail(Number(numbers[0]));
  if (!detail) return null;
  const selected = chooseChineseFlavor(detail.flavor_entries || []);
  if (selected) {
    return {
      text: selected.text,
      source: `${detail.name_zh || detail.name_en || `#${numbers[0]}`} · ${selected.version_name || titleCase(selected.version)} 图鉴描述`
    };
  }
  if (hasChineseText(detail.flavor)) {
    return {
      text: detail.flavor,
      source: `${detail.name_zh || detail.name_en || `#${numbers[0]}`} · 中文通用描述`
    };
  }
  return null;
}

function deriveChineseName(card, map) {
  if (card.name_zh) return card.name_zh;
  const numbers = card.national_pokedex_numbers || [];
  if (!numbers.length) return '';
  const first = map[Number(numbers[0])];
  if (!first || !first.name_zh) return '';
  const english = first.name_en || '';
  if (!english || !card.name || card.name === english) return first.name_zh;
  if (card.name.toLowerCase().startsWith(english.toLowerCase())) {
    return `${first.name_zh}${card.name.slice(english.length)}`;
  }
  return first.name_zh;
}

function imagePath(card, size) {
  const id = encodeURIComponent(card.id);
  return `/assets/ptcg/cards/${id}/${size === 'large' ? 'large' : 'small'}`;
}

function setImagePath(set, kind) {
  const id = encodeURIComponent(set.id);
  return `/assets/ptcg/sets/${id}/${kind === 'logo' ? 'logo' : 'symbol'}`;
}

function decorateSet(set, context) {
  if (!set) return null;
  const next = Object.assign({}, set);
  if (context.publicBaseUrl) {
    if (set.image_symbol_remote) {
      next.symbol = `${context.publicBaseUrl}${setImagePath(set, 'symbol')}`;
      next.image_symbol = next.symbol;
    }
    if (set.image_logo_remote) {
      next.logo = `${context.publicBaseUrl}${setImagePath(set, 'logo')}`;
      next.image_logo = next.logo;
    }
  } else {
    next.symbol = set.image_symbol_remote || '';
    next.logo = set.image_logo_remote || '';
    next.image_symbol = next.symbol;
    next.image_logo = next.logo;
  }
  return next;
}

function enrichEnergyItem(item) {
  const id = item && item.id ? item.id : item;
  const meta = ENERGY_META[id] || {};
  return Object.assign({}, item && typeof item === 'object' ? item : {}, {
    id,
    name: meta.name || (item && item.name) || id || '',
    symbol: meta.symbol || (item && item.symbol) || String((item && item.name) || id || '').slice(0, 1),
    color: meta.color || (item && item.color) || '#64748b'
  });
}

function enrichStoredEnergyList(list, rawTypes) {
  if (list && list.length) return list.map(enrichEnergyItem);
  return decorateEnergyList(rawTypes || []);
}

function decorateTextBlocks(card) {
  return {
    abilities: (card.abilities || []).map((ability) => Object.assign({}, ability, {
      text_zh: localizeCardText(ability.text),
      original_text: ability.text || ''
    })),
    attacks: (card.attacks || []).map((attack) => Object.assign({}, attack, {
      cost_energy: enrichStoredEnergyList(attack.cost_energy, attack.cost),
      text_zh: localizeCardText(attack.text),
      original_text: attack.text || ''
    })),
    rules: (card.rules || []).map((rule) => localizeCardText(rule) || rule)
  };
}

function decorateCard(card, context) {
  if (!card) return null;
  const pokemonMap = context.pokemonMap || {};
  const set = (context.setMap || {})[String(card.set_id || '')] || (card.set && card.set.id ? card.set : null);
  const decoratedSet = decorateSet(set, context);
  const textBlocks = decorateTextBlocks(card);
  const nameZh = deriveChineseName(card, pokemonMap);
  const next = Object.assign({}, card, {
    name_zh: nameZh,
    display_name: nameZh || card.name,
    type_energy: enrichStoredEnergyList(card.type_energy, card.types),
    abilities: textBlocks.abilities,
    attacks: textBlocks.attacks,
    rules: textBlocks.rules,
    retreat_cost_energy: enrichStoredEnergyList(card.retreat_cost_energy, card.retreat_cost),
    pokemon_refs: (card.national_pokedex_numbers || [])
      .map((id) => pokemonMap[Number(id)])
      .filter(Boolean)
  });
  if (decoratedSet) {
    next.set = card.set ? Object.assign({}, card.set, decoratedSet) : decoratedSet;
    next.set_symbol = decoratedSet.symbol || '';
    next.set_logo = decoratedSet.logo || '';
  }

  if (context.publicBaseUrl) {
    if (card.image_small_remote) {
      next.image = `${context.publicBaseUrl}${imagePath(card, 'small')}`;
      next.image_small = next.image;
    }
    if (card.image_large_remote) {
      next.image_large = `${context.publicBaseUrl}${imagePath(card, 'large')}`;
    }
  } else {
    next.image = card.image_small_remote || '';
    next.image_small = card.image_small_remote || '';
    next.image_large = card.image_large_remote || '';
  }

  return next;
}

function cardSearchText(card) {
  return [
    card.id,
    card.name,
    card.name_zh,
    card.set_name,
    card.set_series,
    card.number,
    card.artist,
    ...(card.type_names || []),
    ...(card.subtype_names || []),
    ...(card.national_pokedex_numbers || [])
  ].join(' ').toLowerCase();
}

function matchesCsvFilter(values, filter) {
  const filters = asArray(filter).map((item) => item.toLowerCase());
  if (!filters.length) return true;
  const source = (values || []).map((item) => String(item || '').toLowerCase());
  return filters.every((item) => source.includes(item));
}

function sortCards(items, sort) {
  const key = sort || 'releaseDate';
  if (key === 'name') {
    return items.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  if (key === 'number') {
    return items.slice().sort((a, b) => String(a.set_id).localeCompare(String(b.set_id)) ||
      String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
  }
  if (key === 'rarity') {
    return items.slice().sort((a, b) => String(a.rarity_name || a.rarity).localeCompare(String(b.rarity_name || b.rarity)));
  }
  if (key === 'releaseDateAsc') {
    return items.slice().sort((a, b) => dateValue(a.set_release_date) - dateValue(b.set_release_date));
  }
  return items.slice().sort((a, b) => dateValue(b.set_release_date) - dateValue(a.set_release_date) ||
    String(a.set_id).localeCompare(String(b.set_id)) ||
    String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
}

function uniqueSorted(values) {
  return Array.from(new Set((values || []).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

class PtcgService {
  constructor(store, options = {}) {
    this.store = store;
    this.publicBaseUrl = options.publicBaseUrl || '';
    this.pokemonStore = options.pokemonStore || null;
    this.dataDir = options.dataDir || path.join(__dirname, '.data');
  }

  context() {
    return {
      publicBaseUrl: this.publicBaseUrl,
      pokemonMap: pokemonNameMap(this.pokemonStore),
      setMap: setMap(this.store)
    };
  }

  getSummaries() {
    const items = this.store.getCardSummaries();
    return {
      items,
      cacheReady: items.length > 0,
      source: items.length ? 'ptcg-cache' : 'empty-cache'
    };
  }

  listCards(options = {}) {
    const keyword = normalizeKeyword(options.keyword || options.q);
    const ids = parseIds(options.ids);
    const pokemonId = Number(options.pokemonId || options.pokedexNumber || 0);
    const setId = cleanText(options.setId || options.set);
    const series = cleanText(options.series);
    const supertype = cleanText(options.supertype);
    const rarity = cleanText(options.rarity);
    const regulationMark = cleanText(options.regulationMark || options.regulation);
    const format = cleanText(options.format || options.legality).toLowerCase();
    const typeFilter = options.type || options.types;
    const subtypeFilter = options.subtype || options.subtypes;
    const summaries = this.getSummaries();
    const context = this.context();
    const decorated = summaries.items.map((card) => decorateCard(card, context)).filter(Boolean);

    const filtered = decorated.filter((card) => {
      if (ids.length && !ids.includes(String(card.id))) return false;
      if (keyword && !cardSearchText(card).includes(keyword)) return false;
      if (pokemonId && !(card.national_pokedex_numbers || []).map(Number).includes(pokemonId)) return false;
      if (setId && String(card.set_id).toLowerCase() !== setId.toLowerCase()) return false;
      if (series && String(card.set_series).toLowerCase() !== series.toLowerCase()) return false;
      if (supertype && String(card.supertype).toLowerCase() !== supertype.toLowerCase()) return false;
      if (rarity && String(card.rarity).toLowerCase() !== rarity.toLowerCase()) return false;
      if (regulationMark && String(card.regulation_mark).toLowerCase() !== regulationMark.toLowerCase()) return false;
      if (format && !(card.legalities || {})[format]) return false;
      if (!matchesCsvFilter(card.types, typeFilter)) return false;
      if (!matchesCsvFilter(card.subtypes, subtypeFilter)) return false;
      return true;
    });
    const sorted = sortCards(filtered, options.sort);
    const page = boundedInteger(options.page, 1, 1, 10000);
    const pageSize = boundedInteger(options.pageSize || options.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    const pageItems = sorted.slice(offset, offset + pageSize);

    return {
      items: pageItems.map((card) => compactObject({
        id: card.id,
        name: card.name,
        name_zh: card.name_zh,
        display_name: card.display_name,
        supertype: card.supertype,
        supertype_name: card.supertype_name,
        subtypes: card.subtypes,
        subtype_names: card.subtype_names,
        hp: card.hp,
        types: card.types,
        type_names: card.type_names,
        type_energy: card.type_energy,
        set_id: card.set_id,
        set_name: card.set_name,
        set_series: card.set_series,
        set_symbol: card.set_symbol,
        set_logo: card.set_logo,
        set_release_date: card.set_release_date,
        number: card.number,
        artist: card.artist,
        rarity: card.rarity,
        rarity_name: card.rarity_name,
        regulation_mark: card.regulation_mark,
        legalities_text: card.legalities_text,
        national_pokedex_numbers: card.national_pokedex_numbers,
        pokemon_refs: card.pokemon_refs,
        image: card.image,
        image_small: card.image_small
      })),
      total,
      page,
      pageSize,
      totalPages,
      hasMore: offset + pageSize < total,
      source: summaries.source
    };
  }

  getCard(id) {
    const detail = this.store.getCardDetail(id);
    const item = decorateCard(detail, this.context());
    if (item) {
      const flavor = pokemonFlavor(item, this.pokemonStore);
      item.description_zh = flavor ? flavor.text : '';
      item.description_source = flavor ? flavor.source : '';
      item.card_flavor_text = item.flavor_text || '';
    }
    return {
      item,
      source: detail ? 'ptcg-cache' : 'empty-cache'
    };
  }

  listSets(options = {}) {
    const keyword = normalizeKeyword(options.keyword || options.q);
    const series = cleanText(options.series);
    const sorted = this.store.getSets()
      .filter((set) => {
        if (series && String(set.series).toLowerCase() !== series.toLowerCase()) return false;
        if (!keyword) return true;
        return [set.id, set.name, set.series, set.ptcgo_code].join(' ').toLowerCase().includes(keyword);
      })
      .sort((a, b) => dateValue(b.release_date) - dateValue(a.release_date));
    const page = boundedInteger(options.page, 1, 1, 10000);
    const pageSize = boundedInteger(options.pageSize || options.limit, 50, 1, 100);
    const offset = (page - 1) * pageSize;

    const context = this.context();
    return {
      items: sorted.slice(offset, offset + pageSize).map((set) => decorateSet(set, context)),
      total: sorted.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(sorted.length / pageSize)),
      hasMore: offset + pageSize < sorted.length,
      source: sorted.length ? 'ptcg-cache' : 'empty-cache'
    };
  }

  getSet(id) {
    const item = decorateSet(this.store.getSet(id), this.context());
    return {
      item,
      source: item ? 'ptcg-cache' : 'empty-cache'
    };
  }

  getMeta() {
    const cards = this.store.getCardSummaries();
    const sets = this.store.getSets();
    const context = this.context();
    const types = Object.keys(ENERGY_META).map((id) => ENERGY_META[id]);
    const series = uniqueSorted(sets.map((set) => set.series)).map((id) => ({ id, name: id }));
    const rarities = uniqueSorted(cards.map((card) => card.rarity)).map((id) => ({
      id,
      name: RARITY_NAMES[id] || id
    }));
    const regulationMarks = uniqueSorted(cards.map((card) => card.regulation_mark)).map((id) => ({ id, name: id }));

    return {
      item: {
        types,
        supertypes: Object.keys(SUPERTYPE_NAMES).map((id) => ({ id, name: SUPERTYPE_NAMES[id] })),
        subtypes: Object.keys(SUBTYPE_NAMES).map((id) => ({ id, name: SUBTYPE_NAMES[id] })),
        rarities,
        regulationMarks,
        series,
        sets: sets.map((set) => decorateSet({
          id: set.id,
          name: set.name,
          series: set.series,
          release_date: set.release_date,
          total: set.total,
          image_symbol_remote: set.image_symbol_remote,
          image_logo_remote: set.image_logo_remote
        }, context))
      },
      source: cards.length ? 'ptcg-cache' : 'empty-cache'
    };
  }

  getSyncStatus() {
    const meta = this.store.getMeta('ptcg');
    const cards = this.store.getCardSummaries();
    const sets = this.store.getSets();
    const cacheReady = cards.length > 0;
    const failed = meta && meta.status === 'failed';
    const running = meta && meta.status === 'running';

    return {
      item: {
        mode: cacheReady ? 'ptcg-cache' : 'empty-cache',
        label: cacheReady ? 'PTCG 自有缓存' : 'PTCG 未同步',
        healthLabel: running ? '同步中' : (cacheReady && !failed ? '已同步' : '需同步'),
        healthTone: running ? 'local' : (cacheReady && !failed ? 'ready' : 'stale'),
        cacheReady,
        total: cards.length,
        setTotal: sets.length,
        upstreamTotal: Number(meta && meta.cardTotalCount || 0),
        syncedCount: cards.length,
        setSyncedCount: sets.length,
        lastRunCardSyncedCount: Number(meta && meta.cardSyncedCount || 0),
        lastRunSetSyncedCount: Number(meta && meta.setSyncedCount || 0),
        failedCount: failed ? Number(meta.failedCount || 1) : 0,
        syncedAtText: meta ? formatDate(meta.syncedAt || meta.finishedAt) : '尚未同步',
        message: meta && meta.message ? meta.message : '',
        source: meta && meta.source ? meta.source : 'pokemontcg-api'
      },
      source: cacheReady ? 'ptcg-cache' : 'empty-cache'
    };
  }

  getSyncRuns(options = {}) {
    const limit = boundedInteger(options.limit, 5, 1, 20);
    const runs = this.store.getRuns();
    return {
      items: sortRunsByTime(runs).slice(0, limit).map(formatRun),
      total: runs.length,
      source: 'ptcg-cache'
    };
  }

  getPokemonCards(id, options = {}) {
    return this.listCards(Object.assign({}, options, {
      pokemonId: id
    }));
  }

  getRelatedPokemon(id) {
    const card = this.getCard(id).item;
    return {
      items: card ? (card.pokemon_refs || []) : [],
      source: card ? 'ptcg-cache' : 'empty-cache'
    };
  }

  getDailyCardQuiz() {
    const summaries = this.getSummaries();
    const cards = summaries.items;
    if (!cards.length) {
      return {
        item: null,
        source: summaries.source
      };
    }

    const answerRaw = cards[Math.floor(Math.random() * cards.length)];
    const optionsRaw = [answerRaw];
    while (optionsRaw.length < 4 && optionsRaw.length < cards.length) {
      const candidate = cards[Math.floor(Math.random() * cards.length)];
      if (!optionsRaw.find((item) => item.id === candidate.id)) {
        optionsRaw.push(candidate);
      }
    }

    const context = this.context();
    const answer = decorateCard(answerRaw, context);
    const options = optionsRaw.map((card) => decorateCard(card, context)).filter(Boolean);

    return {
      item: {
        quizId: `card-random-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        answerId: answer.id,
        image: answer.image,
        hints: [
          `系列：${answer.set_name || '未知'}`,
          `属性：${(answer.type_names || []).join(' / ') || '无'}`,
          `稀有度：${answer.rarity_name || answer.rarity || '未知'}`,
          `编号：${answer.set_id || '-'} #${answer.number || '-'}`
        ],
        options: options
          .slice()
          .sort(() => Math.random() - 0.5)
          .map((card) => ({
            id: card.id,
            name: card.name,
            name_zh: card.name_zh,
            display_name: card.display_name,
            set_name: card.set_name,
            number: card.number,
            image: card.image
          }))
      },
      source: summaries.source
    };
  }

  submitDailyCardQuiz(payload = {}) {
    const correct = String(payload.selectedId || '') === String(payload.answerId || '');
    return {
      item: {
        correct,
        message: correct ? '猜对了，今天的卡牌灵感到手。' : '差一点，看看卡牌详情再熟悉一下。'
      },
      source: 'ptcg-cache'
    };
  }

  getImageInfo(id, size = 'small') {
    const detail = this.store.getCardDetail(id) || this.store.getCardSummary(id);
    if (!detail) return null;
    const remote = size === 'large'
      ? (detail.image_large_remote || detail.image_small_remote)
      : (detail.image_small_remote || detail.image_large_remote);
    if (!remote) return null;
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = size === 'large' ? `${safeId}_large.png` : `${safeId}.png`;
    const filePath = path.join(this.dataDir, 'ptcg-images', 'cards', fileName);
    return {
      remote,
      filePath
    };
  }

  getSetImageInfo(id, kind = 'symbol') {
    const set = this.store.getSet(id);
    if (!set) return null;
    const remote = kind === 'logo'
      ? (set.image_logo_remote || set.image_symbol_remote)
      : (set.image_symbol_remote || set.image_logo_remote);
    if (!remote) return null;
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = kind === 'logo' ? `${safeId}_logo.png` : `${safeId}_symbol.png`;
    return {
      remote,
      filePath: path.join(this.dataDir, 'ptcg-images', 'sets', fileName)
    };
  }

  openCardPack(options = {}) {
    const context = this.context();
    const setId = cleanText(options.setId || options.set);
    const sets = this.store.getSets();
    const latestSet = sets.slice().sort((a, b) => dateValue(b.release_date) - dateValue(a.release_date))[0] || null;
    const targetSetId = setId || (latestSet && latestSet.id) || '';
    const pool = this.store.getCardSummaries()
      .filter((card) => !targetSetId || String(card.set_id).toLowerCase() === String(targetSetId).toLowerCase())
      .map((card) => decorateCard(card, context))
      .filter(Boolean);
    const targetSet = decorateSet(this.store.getSet(targetSetId) || latestSet, context);
    const packSize = boundedInteger(options.count, 10, 1, 15);

    if (!pool.length) {
      return {
        item: null,
        source: 'empty-cache'
      };
    }

    const used = new Set();
    const pickOne = (items) => {
      const choices = items.filter((card) => !used.has(card.id));
      if (!choices.length) return null;
      const card = choices[Math.floor(Math.random() * choices.length)];
      used.add(card.id);
      return card;
    };
    const common = pool.filter((card) => String(card.rarity || '').toLowerCase() === 'common');
    const uncommon = pool.filter((card) => String(card.rarity || '').toLowerCase() === 'uncommon');
    const rare = pool.filter((card) => !['common', 'uncommon'].includes(String(card.rarity || '').toLowerCase()));
    const pulls = [];
    [
      ...Array(5).fill(common),
      ...Array(3).fill(uncommon),
      ...Array(2).fill(rare)
    ].slice(0, packSize).forEach((bucket) => {
      const picked = pickOne(bucket.length ? bucket : pool);
      if (picked) pulls.push(picked);
    });
    while (pulls.length < packSize) {
      const picked = pickOne(pool);
      if (!picked) break;
      pulls.push(picked);
    }

    return {
      item: {
        packId: `pack-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        set: targetSet,
        count: pulls.length,
        cards: pulls.map((card, index) => compactObject({
          slot: index + 1,
          id: card.id,
          name: card.name,
          name_zh: card.name_zh,
          display_name: card.display_name,
          image: card.image,
          image_small: card.image_small,
          set_id: card.set_id,
          set_name: card.set_name,
          number: card.number,
          rarity: card.rarity,
          rarity_name: card.rarity_name,
          supertype_name: card.supertype_name,
          type_energy: card.type_energy
        }))
      },
      source: 'ptcg-cache'
    };
  }
}

module.exports = {
  PtcgService,
  decorateCard
};
