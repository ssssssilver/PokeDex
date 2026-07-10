const fs = require('fs');
const path = require('path');
const seed = require('../wechat-miniapp/miniprogram/utils/pokemon');

const LOCAL_SPRITE_DIR = path.resolve(__dirname, 'assets', 'local-pokemon');
const LOCAL_SPRITE_ALIASES = {
  'basculegion-male': 'basculegionM.png',
  sneasler: 'hisuianSneasler.png',
  ogerpon: 'ogerponTeal.png'
};
const POKEDEX_GROUPS = {
  national: ['national'],
  kanto: ['kanto', 'letsgo-kanto'],
  johto: ['original-johto', 'updated-johto'],
  hoenn: ['hoenn', 'updated-hoenn'],
  sinnoh: ['original-sinnoh', 'extended-sinnoh'],
  unova: ['original-unova', 'updated-unova'],
  kalos: ['kalos-central', 'kalos-coastal', 'kalos-mountain'],
  alola: ['original-alola', 'original-melemele', 'original-akala', 'original-ulaula', 'original-poni', 'updated-alola', 'updated-melemele', 'updated-akala', 'updated-ulaula', 'updated-poni'],
  galar: ['galar', 'isle-of-armor', 'crown-tundra'],
  hisui: ['hisui'],
  paldea: ['paldea'],
  kitakami: ['kitakami'],
  blueberry: ['blueberry']
};
const DEFAULT_LIST_PAGE_SIZE = 40;
const MAX_LIST_PAGE_SIZE = 100;

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seedValue) {
  let state = hashString(seedValue) || 1;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRandom(items, random) {
  const next = items.slice();
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function typeName(type) {
  return seed.TYPE_META[type] ? seed.TYPE_META[type].name : type;
}

function decoratePokemon(pokemon, context = {}) {
  if (!pokemon) return null;
  const localAssetPath = findLocalSpriteAsset(pokemon);
  const next = Object.assign({}, pokemon, {
    typeNames: (pokemon.types || []).map(typeName)
  });

  if (localAssetPath && context.publicBaseUrl) {
    next.image = `${context.publicBaseUrl}${localAssetPath}`;
    next.image_local_asset = localAssetPath;
  } else if (next.image_asset_path && context.publicBaseUrl) {
    next.image = `${context.publicBaseUrl}${next.image_asset_path}`;
  }

  return next;
}

function slugToLocalSpriteName(slug) {
  return String(slug || '')
    .split('-')
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
}

function findLocalSpriteAsset(pokemon) {
  const alias = LOCAL_SPRITE_ALIASES[pokemon.slug];
  if (alias && fs.existsSync(path.join(LOCAL_SPRITE_DIR, alias))) {
    return `/assets/local-pokemon/${alias}`;
  }

  const candidates = [
    slugToLocalSpriteName(pokemon.slug),
    slugToLocalSpriteName(pokemon.name_en),
    String(pokemon.name_en || '').replace(/[^a-zA-Z0-9]/g, '')
  ]
    .filter(Boolean)
    .map((name) => `${name.charAt(0).toLowerCase()}${name.slice(1)}.png`);

  for (const fileName of Array.from(new Set(candidates))) {
    if (fs.existsSync(path.join(LOCAL_SPRITE_DIR, fileName))) {
      return `/assets/local-pokemon/${fileName}`;
    }
  }

  return '';
}

function hasLocalOrCachedImage(pokemon) {
  return Boolean(
    pokemon &&
    (pokemon.image_cached || pokemon.image_asset_path || findLocalSpriteAsset(pokemon))
  );
}

function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeFilterKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeTypeFilters(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(raw
    .map((item) => String(item || '').trim())
    .filter(Boolean)));
}

function matchesPokedex(pokemon, filter) {
  const key = normalizeFilterKey(filter);
  if (!key || key === 'all') return true;
  const keys = pokemon.regional_dex_keys || (pokemon.regional_dexes || []).map((item) => item.key);
  if (!keys.length) return key === 'national';
  const accepted = POKEDEX_GROUPS[key] || [key];
  return accepted.some((item) => keys.includes(item));
}

function sortPokemon(items, sort) {
  if (sort === 'name') {
    return items.slice().sort((a, b) => String(a.name_en).localeCompare(String(b.name_en)));
  }
  if (sort === 'power') {
    return items.slice().sort((a, b) => Number(b.stat_total || 0) - Number(a.stat_total || 0));
  }
  return items.slice().sort((a, b) => Number(a.id) - Number(b.id));
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.floor(number), max));
}

function selectedPokedexEntry(pokemon, filter) {
  const dexes = pokemon.regional_dexes || [];
  if (!dexes.length) return null;
  const key = normalizeFilterKey(filter) || 'national';
  const accepted = POKEDEX_GROUPS[key] || [key];
  return dexes.find((dex) => accepted.includes(dex.key)) ||
    dexes.find((dex) => dex.key === 'national') ||
    dexes[0];
}

function toListPokemon(pokemon, context = {}, activePokedex = '') {
  const decorated = decoratePokemon(pokemon, context);
  if (!decorated) return null;
  const regionalDex = selectedPokedexEntry(decorated, activePokedex);
  const item = {
    id: decorated.id,
    slug: decorated.slug,
    name_en: decorated.name_en,
    name_zh: decorated.name_zh,
    name_ja: decorated.name_ja,
    image: decorated.image,
    types: decorated.types || [],
    typeNames: decorated.typeNames || [],
    generation: decorated.generation,
    stat_total: decorated.stat_total,
    category: decorated.category,
    capture_rate: decorated.capture_rate,
    ev_yield_text: decorated.ev_yield_text,
    move_count: decorated.move_count,
    active_regional_dex: regionalDex,
    regional_dex_text: regionalDex ? `${regionalDex.name} #${regionalDex.entry_number}` : ''
  };

  if (decorated.image_local_asset) item.image_local_asset = decorated.image_local_asset;
  if (decorated.image_asset_path) item.image_asset_path = decorated.image_asset_path;
  return item;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value.$date) return new Date(value.$date);
  return new Date(value);
}

function formatDate(value) {
  const date = normalizeDate(value);
  if (!date || Number.isNaN(date.getTime())) return '尚未同步';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getSyncFreshness(meta, options = {}) {
  const maxSyncAgeHours = Number(options.maxSyncAgeHours || 30);
  const syncedAt = normalizeDate(meta && (meta.syncedAt || meta.finishedAt));
  if (!syncedAt || Number.isNaN(syncedAt.getTime())) {
    return {
      maxSyncAgeHours,
      syncAgeHours: null,
      syncAgeText: '-',
      syncFresh: false,
      syncStale: true
    };
  }

  const ageHours = Math.max(0, (Date.now() - syncedAt.getTime()) / 3600000);
  const roundedAgeHours = Math.round(ageHours * 100) / 100;
  return {
    maxSyncAgeHours,
    syncAgeHours: roundedAgeHours,
    syncAgeText: `${roundedAgeHours}h`,
    syncFresh: ageHours <= maxSyncAgeHours,
    syncStale: ageHours > maxSyncAgeHours
  };
}

function runStatusText(status) {
  if (status === 'success') return '成功';
  if (status === 'partial') return '部分失败';
  if (status === 'running') return '运行中';
  if (status === 'skipped') return '已跳过';
  if (status === 'failed') return '失败';
  return status || '未知';
}

function runHealthTone(status) {
  if (status === 'success') return 'ready';
  if (status === 'running' || status === 'skipped') return 'local';
  return 'stale';
}

function sortRunsByTime(runs) {
  return runs.slice().sort((a, b) => {
    const aTime = normalizeDate(a.startedAt || a.finishedAt);
    const bTime = normalizeDate(b.startedAt || b.finishedAt);
    return (bTime ? bTime.getTime() : 0) - (aTime ? aTime.getTime() : 0);
  });
}

function formatSyncRun(run) {
  const plan = run.plan || {};
  const status = run.status || (run.ok === false ? 'partial' : 'success');
  const startedAtText = formatDate(run.startedAt);
  const finishedAtText = formatDate(run.finishedAt);
  const startId = Number(run.startId || plan.startId || 0);
  const endId = Number(run.endId || plan.endId || 0);
  const limit = Number(run.limit || plan.limit || 0);
  const syncedCount = Number(run.syncedCount || 0);
  const imageCachedCount = Number(run.imageCachedCount || 0);
  const failedCount = Number(run.failedCount || 0);
  const imageFailedCount = Number(run.imageCacheFailedCount || 0);
  const rangeText = startId && endId ? `#${startId}-${endId}` : `${limit || syncedCount} 只`;

  return {
    key: run.runId || `${status}-${startId}-${endId}-${startedAtText}`,
    runId: run.runId || '',
    status,
    statusText: runStatusText(status),
    healthTone: runHealthTone(status),
    startedAtText,
    finishedAtText,
    timeText: run.finishedAt ? finishedAtText : startedAtText,
    rangeText,
    countText: `${syncedCount} / ${limit || syncedCount}`,
    imageText: `${imageCachedCount} / ${imageFailedCount}`,
    failedCount,
    imageFailedCount,
    durationMs: Number(run.durationMs || 0),
    cacheImages: Boolean(run.cacheImages || plan.cacheImages),
    refreshImages: Boolean(run.refreshImages || plan.refreshImages)
  };
}

function uniqueSortedIds(ids) {
  return Array.from(new Set((ids || []).map(Number).filter(Boolean)))
    .sort((a, b) => a - b);
}

function rangePayloads(ids, options = {}) {
  const sorted = uniqueSortedIds(ids);
  const batchSize = Math.max(1, Number(options.batchSize || 50));
  const ranges = [];
  let current = null;

  sorted.forEach((id) => {
    if (!current || id > current.endId + 1 || current.endId - current.startId + 1 >= batchSize) {
      current = { startId: id, endId: id };
      ranges.push(current);
      return;
    }
    current.endId = id;
  });

  return ranges.map((range) => ({
    startId: range.startId,
    endId: range.endId,
    retries: Number(options.retries || 2),
    concurrency: Number(options.concurrency || 3),
    cacheImages: options.cacheImages !== false,
    strictImageCache: Boolean(options.strictImageCache),
    force: true
  }));
}

function getDamageMultiplier(attackingType, defenderTypes) {
  return (defenderTypes || []).reduce((multiplier, defenderType) => {
    const relation = seed.TYPE_RELATIONS[defenderType] || { weakTo: [], resists: [], immuneTo: [] };
    if (relation.immuneTo.includes(attackingType)) return 0;
    if (relation.weakTo.includes(attackingType)) return multiplier * 2;
    if (relation.resists.includes(attackingType)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

class PokedexService {
  constructor(store, options = {}) {
    this.store = store;
    this.publicBaseUrl = options.publicBaseUrl || 'http://127.0.0.1:8787';
  }

  getSummaries() {
    const cached = this.store.getSummaries();
    const items = cached.length ? cached : seed.POKEMON;
    return {
      items,
      cacheReady: cached.length > 0,
      source: cached.length ? 'remote-cache' : 'local-seed'
    };
  }

  listPokemon(options = {}) {
    const keyword = normalizeKeyword(options.keyword);
    const types = normalizeTypeFilters(options.type || options.types);
    const generation = options.generation ? Number(options.generation) : 0;
    const pokedex = options.pokedex || options.region || options.regionDex || '';
    const summaries = this.getSummaries();
    const filtered = summaries.items.filter((pokemon) => {
      const matchedKeyword = !keyword ||
        String(pokemon.id) === keyword ||
        String(pokemon.name_en || '').toLowerCase().includes(keyword) ||
        String(pokemon.name_zh || '').includes(keyword) ||
        String(pokemon.name_ja || '').includes(keyword);
      const matchedType = !types.length || types.every((type) => (pokemon.types || []).includes(type));
      const matchedGeneration = !generation || Number(pokemon.generation) === generation;
      const matchedPokedex = matchesPokedex(pokemon, pokedex);
      return matchedKeyword && matchedType && matchedGeneration && matchedPokedex;
    });
    const sorted = sortPokemon(filtered, options.sort);
    const shouldPaginate = options.page !== undefined || options.pageSize !== undefined || options.limit !== undefined;
    const page = boundedInteger(options.page, 1, 1, 10000);
    const pageSize = boundedInteger(options.pageSize || options.limit, DEFAULT_LIST_PAGE_SIZE, 1, MAX_LIST_PAGE_SIZE);
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;
    const pageItems = shouldPaginate ? sorted.slice(offset, offset + pageSize) : sorted;

    return {
      items: pageItems.map((pokemon) => toListPokemon(pokemon, this, pokedex)).filter(Boolean),
      total,
      page: shouldPaginate ? page : 1,
      pageSize: shouldPaginate ? pageSize : total,
      totalPages: shouldPaginate ? totalPages : 1,
      hasMore: shouldPaginate ? offset + pageSize < total : false,
      source: summaries.source
    };
  }

  getPokemon(id) {
    const numericId = Number(id);
    const detail = this.store.getDetail(numericId) || seed.getPokemonById(numericId);
    const item = decoratePokemon(detail, this);
    if (item) {
      item.evolution = this.resolveEvolution(item.evolution_chain);
    }

    return {
      item,
      source: this.store.getDetail(numericId) ? 'remote-cache' : 'local-seed'
    };
  }

  resolveEvolution(ids) {
    const summaries = this.getSummaries().items;
    return uniqueSortedIds(ids)
      .map((id) => summaries.find((pokemon) => Number(pokemon.id) === id) || seed.getPokemonById(id))
      .filter(Boolean)
      .map((pokemon) => decoratePokemon(pokemon, this));
  }

  getEvolutionChain(ids) {
    return {
      items: this.resolveEvolution(ids),
      source: this.getSummaries().source
    };
  }

  getTypes() {
    return {
      items: seed.getAllTypes(),
      source: 'seed'
    };
  }

  getTypeRelations(type) {
    return {
      item: seed.getTypeRelations(type || 'fire'),
      source: 'seed'
    };
  }

  getDailyQuiz(seed) {
    const summaries = this.getSummaries();
    const items = summaries.items;
    const quizKey = seed || `${Date.now()}-${Math.random()}`;
    const random = createSeededRandom(`pokemon-random-${quizKey}`);
    const answer = items[Math.floor(random() * items.length)];
    const options = [answer];
    while (options.length < 4 && options.length < items.length) {
      const candidate = items[Math.floor(random() * items.length)];
      if (!options.find((item) => Number(item.id) === Number(candidate.id))) {
        options.push(candidate);
      }
    }

    return {
      item: {
        quizId: `pokemon-random-${quizKey}-${answer.id}`,
        answerId: answer.id,
        silhouette: decoratePokemon(answer, this).image,
        hints: [
          `属性：${(answer.types || []).map(typeName).join(' / ')}`,
          `世代：第 ${answer.generation || 1} 世代`,
          `种族值总和：${answer.stat_total || '-'}`,
          `分类：${answer.category || '未知'}`
        ],
        options: shuffleWithRandom(options, random).map((pokemon) => decoratePokemon(pokemon, this))
      },
      source: summaries.source
    };
  }

  submitDailyQuiz(payload = {}) {
    const correct = Number(payload.selectedId) === Number(payload.answerId);
    return {
      item: {
        correct,
        message: correct ? '猜对了，再来挑战一题吧。' : '差一点，看看详情再来熟悉一下。'
      },
      source: 'remote-cache'
    };
  }

  analyzeTeam(payload = {}) {
    const ids = (payload.ids || []).map(Number);
    const summaries = this.getSummaries();
    const members = ids
      .map((id) => summaries.items.find((pokemon) => Number(pokemon.id) === id))
      .filter(Boolean)
      .map((pokemon) => decoratePokemon(pokemon, this));
    const weaknesses = [];
    const resistances = [];
    const immunities = [];
    const typeCounts = {};

    members.forEach((member) => {
      (member.types || []).forEach((type) => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
    });

    Object.keys(seed.TYPE_META).forEach((type) => {
      let weakCount = 0;
      let resistCount = 0;
      let immuneCount = 0;
      members.forEach((member) => {
        const multiplier = getDamageMultiplier(type, member.types);
        if (multiplier >= 2) weakCount += 1;
        if (multiplier > 0 && multiplier < 1) resistCount += 1;
        if (multiplier === 0) immuneCount += 1;
      });
      if (weakCount) weaknesses.push({ id: type, name: typeName(type), count: weakCount });
      if (resistCount) resistances.push({ id: type, name: typeName(type), count: resistCount });
      if (immuneCount) immunities.push({ id: type, name: typeName(type), count: immuneCount });
    });

    weaknesses.sort((a, b) => b.count - a.count);
    resistances.sort((a, b) => b.count - a.count);
    immunities.sort((a, b) => b.count - a.count);

    const primaryTypes = Object.keys(typeCounts)
      .sort((a, b) => typeCounts[b] - typeCounts[a])
      .slice(0, 3)
      .map(typeName);
    const score = Math.max(40, Math.min(95, 82 - weaknesses.length * 3 + resistances.length * 2 + immunities.length * 2));

    return {
      item: {
        members,
        score,
        primaryTypes,
        weaknesses: weaknesses.slice(0, 6),
        resistances: resistances.slice(0, 6),
        immunities: immunities.slice(0, 6),
        summary: members.length
          ? `当前队伍以${primaryTypes.join('、') || '混合'}属性为主，主要风险来自${weaknesses.slice(0, 3).map((item) => item.name).join('、') || '暂无明显共同弱点'}。`
          : '先选择 1 到 6 只宝可梦，再查看队伍属性分析。'
      },
      source: summaries.source
    };
  }

  getSyncStatus(options = {}) {
    const summaries = this.getSummaries();
    const meta = this.store.getMeta('pokeapi');
    const cacheReady = summaries.cacheReady;
    const imageCachedTotal = cacheReady
      ? summaries.items.filter(hasLocalOrCachedImage).length
      : 0;
    const missingImageTotal = cacheReady
      ? summaries.items.filter((pokemon) => !pokemon.image && !pokemon.image_asset_path).length
      : 0;
    const missingCachedImageTotal = cacheReady
      ? summaries.items.filter((pokemon) => pokemon.image_remote && !hasLocalOrCachedImage(pokemon)).length
      : 0;
    const freshness = getSyncFreshness(meta, options);
    const lastRunFailedCount = meta ? Number(meta.failedCount || 0) : 0;
    const lastRunImageCacheFailedCount = meta ? Number(meta.imageCacheFailedCount || 0) : 0;
    const requireCachedImages = Boolean(options.requireCachedImages);
    const imageIssuesMatter = requireCachedImages || Boolean(meta && meta.strictImageCache);
    const hasRunFailures = lastRunFailedCount > 0 || (imageIssuesMatter && lastRunImageCacheFailedCount > 0);
    const hasCacheIssues = missingImageTotal > 0 || (requireCachedImages && missingCachedImageTotal > 0);
    const healthNeedsCheck = freshness.syncStale || hasRunFailures || hasCacheIssues;
    const healthTone = !cacheReady ? 'local' : (healthNeedsCheck ? 'stale' : 'ready');

    return {
      item: {
        mode: cacheReady ? 'remote-cache' : 'local-seed',
        label: cacheReady ? '自有服务器缓存' : '本地种子数据',
        healthLabel: !cacheReady ? '本地' : (healthNeedsCheck ? '需检查' : '已同步'),
        healthTone,
        cacheReady,
        total: summaries.items.length,
        limit: meta ? meta.limit || summaries.items.length : summaries.items.length,
        syncedCount: cacheReady ? summaries.items.length : Number(meta && meta.syncedCount || 0),
        imageCachedCount: cacheReady ? imageCachedTotal : Number(meta && meta.imageCachedCount || 0),
        imageUploadedCount: Number(meta && meta.imageUploadedCount || 0),
        imageReusedCount: Number(meta && meta.imageReusedCount || 0),
        imageCacheFailedCount: lastRunImageCacheFailedCount,
        failedCount: lastRunFailedCount,
        missingImageCount: missingImageTotal,
        missingCachedImageCount: missingCachedImageTotal,
        lastRunSyncedCount: Number(meta && meta.syncedCount || 0),
        lastRunImageCachedCount: Number(meta && meta.imageCachedCount || 0),
        lastRunImageUploadedCount: Number(meta && meta.imageUploadedCount || 0),
        lastRunImageReusedCount: Number(meta && meta.imageReusedCount || 0),
        lastRunImageCacheFailedCount,
        lastRunFailedCount,
        cacheImages: meta ? Boolean(meta.cacheImages) : false,
        strictImageCache: meta ? Boolean(meta.strictImageCache) : false,
        syncedAtText: meta ? formatDate(meta.syncedAt || meta.finishedAt) : '尚未同步',
        maxSyncAgeHours: freshness.maxSyncAgeHours,
        syncAgeHours: freshness.syncAgeHours,
        syncAgeText: freshness.syncAgeText,
        syncFresh: freshness.syncFresh,
        syncStale: freshness.syncStale
      },
      source: summaries.source
    };
  }

  getSyncRuns(options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit || 5), 20));
    const runs = this.store.getRuns();
    return {
      items: sortRunsByTime(runs).slice(0, limit).map(formatSyncRun),
      total: runs.length,
      source: 'remote-cache'
    };
  }

  validateCache(options = {}) {
    const expectedCount = options.expectedCount ? Number(options.expectedCount) : 1025;
    const sampleIds = uniqueSortedIds(options.sampleIds || [1, 4, 7, 25, expectedCount]);
    const maxSyncAgeHours = Number(options.maxSyncAgeHours || 30);
    const requireCachedImages = Boolean(options.requireCachedImages);
    const detailCheckLimit = Math.min(expectedCount, Number(options.detailCheckLimit || expectedCount));
    const detailCheckIds = uniqueSortedIds(options.detailCheckIds || Array.from({ length: detailCheckLimit }, (_, index) => index + 1));
    const summaries = this.getSummaries();
    const summaryIds = new Set(summaries.items.map((pokemon) => Number(pokemon.id)));
    const missingSummaryIds = [];
    const missingDetailIds = [];
    const invalidEvolutionIds = [];
    const missingImageIds = [];
    const missingCachedImageIds = [];
    const sampleDetails = [];

    if (expectedCount > 0) {
      for (let id = 1; id <= expectedCount; id += 1) {
        if (!summaryIds.has(id)) missingSummaryIds.push(id);
      }
    }

    summaries.items.forEach((pokemon) => {
      if (!pokemon.image && !pokemon.image_asset_path) missingImageIds.push(Number(pokemon.id));
      if (pokemon.image_remote && !hasLocalOrCachedImage(pokemon)) {
        missingCachedImageIds.push(Number(pokemon.id));
      }
    });

    uniqueSortedIds([...detailCheckIds, ...sampleIds]).forEach((id) => {
      const detail = this.store.getDetail(id);
      if (!detail) {
        if (detailCheckIds.includes(id)) missingDetailIds.push(id);
        return;
      }
      if (sampleIds.includes(id)) {
        const evolution = this.resolveEvolution(detail.evolution_chain);
        const expectedEvolutionIds = uniqueSortedIds(detail.evolution_chain || [])
          .filter((evolutionId) => !expectedCount || evolutionId <= expectedCount || summaryIds.has(evolutionId));
        if (expectedEvolutionIds.length && evolution.length < expectedEvolutionIds.length) {
          invalidEvolutionIds.push(id);
        }
        sampleDetails.push({
          id,
          name_zh: detail.name_zh,
          evolution: evolution.map((item) => item.id),
          imageCached: hasLocalOrCachedImage(detail)
        });
      }
    });

    const status = this.getSyncStatus({ maxSyncAgeHours, requireCachedImages }).item;
    const syncFailedCount = Number(status.failedCount || 0);
    const imageCacheFailedCount = Number(status.imageCacheFailedCount || 0);
    const checks = {
      cloudReady: summaries.cacheReady,
      remoteReady: summaries.cacheReady,
      expectedCount,
      maxSyncAgeHours,
      detailCheckCount: detailCheckIds.length,
      actualCount: summaries.items.length,
      countOk: expectedCount ? summaries.items.length >= expectedCount : summaries.items.length > 0,
      missingSummaryIds,
      missingDetailIds,
      invalidEvolutionIds,
      missingImageIds,
      missingCachedImageIds,
      requireCachedImages,
      syncFailedCount,
      syncFresh: Boolean(status.syncFresh),
      syncStale: Boolean(status.syncStale),
      syncAgeHours: status.syncAgeHours,
      imageCacheFailedCount,
      sampleDetails
    };
    const repairIds = uniqueSortedIds([
      ...missingSummaryIds,
      ...missingDetailIds,
      ...invalidEvolutionIds,
      ...missingImageIds,
      ...(requireCachedImages ? missingCachedImageIds : [])
    ]);
    const repair = {
      needed: repairIds.length > 0,
      ids: repairIds,
      dataIds: repairIds,
      imageIds: requireCachedImages ? missingCachedImageIds : [],
      payloads: rangePayloads(repairIds, options),
      note: repairIds.length
        ? 'Run these payloads against POST /api/sync/pokeapi, then validate again.'
        : 'No repair payloads needed.'
    };

    return {
      ok: checks.remoteReady &&
        checks.countOk &&
        missingSummaryIds.length === 0 &&
        missingDetailIds.length === 0 &&
        invalidEvolutionIds.length === 0 &&
        missingImageIds.length === 0 &&
        (!requireCachedImages || missingCachedImageIds.length === 0) &&
        !checks.syncStale &&
        syncFailedCount === 0 &&
        (!checks.requireCachedImages || imageCacheFailedCount === 0),
      checks,
      status,
      repair,
      source: summaries.source
    };
  }
}

module.exports = {
  PokedexService,
  decoratePokemon,
  formatDate,
  getSyncFreshness,
  uniqueSortedIds
};
