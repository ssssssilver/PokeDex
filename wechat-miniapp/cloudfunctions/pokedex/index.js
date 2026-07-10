const cloud = require('wx-server-sdk');
const seed = require('./data/seed');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

function typeName(type) {
  return seed.typeMeta[type] ? seed.typeMeta[type].name : type;
}

function decoratePokemon(pokemon) {
  if (!pokemon) return null;
  return Object.assign({}, pokemon, {
    typeNames: (pokemon.types || []).map(typeName)
  });
}

function normalizeKeyword(value) {
  return String(value || '').trim().toLowerCase();
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

async function readCollection(name, options = {}) {
  const pageSize = options.pageSize || 1000;
  const maxPages = options.maxPages || 20;
  const rows = [];

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const result = await db.collection(name)
        .skip(page * pageSize)
        .limit(pageSize)
        .get();
      const data = result.data || [];
      rows.push(...data);
      if (data.length < pageSize) break;
    }
    return rows;
  } catch (error) {
    return [];
  }
}

async function getSummaries() {
  const cached = await readCollection('pokemon_summary');
  return cached.length ? cached : seed.pokemon;
}

async function resolveEvolution(ids) {
  const idSet = (ids || []).map(Number).filter(Boolean);
  if (!idSet.length) return [];
  const summaries = await getSummaries();
  return idSet
    .map((id) => summaries.find((pokemon) => Number(pokemon.id) === id) ||
      seed.pokemon.find((pokemon) => Number(pokemon.id) === id))
    .filter(Boolean)
    .map(decoratePokemon);
}

async function getDetail(id) {
  try {
    const result = await db.collection('pokemon_detail').doc(String(id)).get();
    if (result.data) {
      return {
        item: result.data,
        source: 'cloud'
      };
    }
  } catch (error) {
    // Missing cloud cache falls back to seed data.
  }
  return {
    item: seed.pokemon.find((pokemon) => Number(pokemon.id) === Number(id)) || null,
    source: 'seed'
  };
}

function formatDate(value) {
  if (!value) return '尚未同步';
  const date = normalizeDate(value);
  if (Number.isNaN(date.getTime())) return '尚未同步';
  const pad = (number) => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && value.$date) return new Date(value.$date);
  return new Date(value);
}

function getSyncFreshness(meta, event = {}) {
  const maxSyncAgeHours = Number(event.maxSyncAgeHours || 30);
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

function buildRepairPlan(checks, event = {}) {
  const failedIds = (event.failedIds || []).map(Number).filter(Boolean);
  const dataIds = uniqueSortedIds([
    ...(checks.missingSummaryIds || []),
    ...(checks.missingDetailIds || []),
    ...(checks.invalidEvolutionIds || []),
    ...(checks.missingImageIds || []),
    ...failedIds
  ]);
  const imageIds = uniqueSortedIds(checks.missingCachedImageIds || []);
  const allIds = uniqueSortedIds([...dataIds, ...imageIds]);
  const options = {
    batchSize: Number(event.repairBatchSize || 50),
    retries: Number(event.retries || 2),
    concurrency: Number(event.concurrency || 3),
    cacheImages: true,
    strictImageCache: Boolean(event.strictImageCache)
  };

  return {
    needed: allIds.length > 0,
    ids: allIds,
    dataIds,
    imageIds,
    payloads: rangePayloads(allIds, options),
    note: allIds.length
      ? 'Run these payloads against syncPokeapi, then run validateCache again.'
      : 'No repair payloads needed.'
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
  if (status === 'running') return 'local';
  if (status === 'skipped') return 'local';
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

async function listPokemon(event) {
  const keyword = normalizeKeyword(event.keyword);
  const type = event.type || '';
  const generation = event.generation ? Number(event.generation) : 0;
  const items = await getSummaries();
  const filtered = items.filter((pokemon) => {
    const matchedKeyword = !keyword ||
      String(pokemon.id) === keyword ||
      String(pokemon.name_en || '').toLowerCase().includes(keyword) ||
      String(pokemon.name_zh || '').includes(keyword);
    const matchedType = !type || (pokemon.types || []).includes(type);
    const matchedGeneration = !generation || Number(pokemon.generation) === generation;
    return matchedKeyword && matchedType && matchedGeneration;
  });

  return {
    items: sortPokemon(filtered, event.sort).map(decoratePokemon),
    source: items === seed.pokemon ? 'seed' : 'cloud'
  };
}

async function getPokemon(event) {
  const detail = await getDetail(event.id);
  const item = decoratePokemon(detail.item);
  if (item) {
    item.evolution = await resolveEvolution(item.evolution_chain);
  }
  return {
    item,
    source: detail.source
  };
}

async function getEvolutionChain(event) {
  return {
    items: await resolveEvolution(event.ids),
    source: 'cloud'
  };
}

function getTypes() {
  return {
    items: Object.keys(seed.typeMeta).map((id) => ({
      id,
      name: typeName(id)
    })),
    source: 'seed'
  };
}

function getTypeRelations(event) {
  const type = event.type || 'fire';
  const relation = seed.typeRelations[type] || { weakTo: [], resists: [], immuneTo: [] };
  return {
    item: {
      type,
      name: typeName(type),
      weakTo: relation.weakTo.map((id) => ({ id, name: typeName(id) })),
      resists: relation.resists.map((id) => ({ id, name: typeName(id) })),
      immuneTo: relation.immuneTo.map((id) => ({ id, name: typeName(id) }))
    },
    source: 'seed'
  };
}

async function getDailyQuiz() {
  const items = await getSummaries();
  const daySeed = Math.floor(Date.now() / 86400000);
  const answer = items[daySeed % items.length];
  const options = [answer];
  let cursor = (daySeed + 3) % items.length;
  while (options.length < 4 && options.length < items.length) {
    const candidate = items[cursor % items.length];
    if (!options.find((item) => Number(item.id) === Number(candidate.id))) {
      options.push(candidate);
    }
    cursor += 2;
  }

  return {
    item: {
      quizId: `daily-${daySeed}`,
      answerId: answer.id,
      silhouette: answer.image,
      hints: [
        `属性：${(answer.types || []).map(typeName).join(' / ')}`,
        `世代：第 ${answer.generation || 1} 世代`,
        `种族值总和：${answer.stat_total || '-'}`,
        `分类：${answer.category || '未知'}`
      ],
      options: sortPokemon(options, 'id').map(decoratePokemon)
    },
    source: 'cloud'
  };
}

function submitDailyQuiz(event) {
  const correct = Number(event.selectedId) === Number(event.answerId);
  return {
    item: {
      correct,
      message: correct ? '猜对了，今天的图鉴灵感到手。' : '差一点，看看详情再来熟悉一下。'
    },
    source: 'cloud'
  };
}

function getDamageMultiplier(attackingType, defenderTypes) {
  return (defenderTypes || []).reduce((multiplier, defenderType) => {
    const relation = seed.typeRelations[defenderType] || { weakTo: [], resists: [], immuneTo: [] };
    if (relation.immuneTo.includes(attackingType)) return 0;
    if (relation.weakTo.includes(attackingType)) return multiplier * 2;
    if (relation.resists.includes(attackingType)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

async function analyzeTeam(event) {
  const ids = (event.ids || []).map(Number);
  const summaries = await getSummaries();
  const members = ids.map((id) => summaries.find((pokemon) => Number(pokemon.id) === id)).filter(Boolean).map(decoratePokemon);
  const weaknesses = [];
  const resistances = [];
  const immunities = [];
  const typeCounts = {};

  members.forEach((member) => {
    (member.types || []).forEach((type) => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });
  });

  Object.keys(seed.typeMeta).forEach((type) => {
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
    source: 'cloud'
  };
}

async function getSyncStatus(event = {}) {
  const summaries = await getSummaries();
  let meta = null;
  try {
    const result = await db.collection('sync_meta').doc('pokeapi').get();
    meta = result.data || null;
  } catch (error) {
    meta = null;
  }

  const cacheReady = summaries !== seed.pokemon;
  const imageCachedTotal = cacheReady
    ? summaries.filter((pokemon) => pokemon.image_cached || String(pokemon.image || '').startsWith('cloud://')).length
    : 0;
  const missingImageTotal = cacheReady
    ? summaries.filter((pokemon) => !pokemon.image).length
    : 0;
  const missingCachedImageTotal = cacheReady
    ? summaries.filter((pokemon) => pokemon.image_remote && !pokemon.image_cached).length
    : 0;
  const lastRunSyncedCount = meta ? meta.syncedCount || 0 : 0;
  const lastRunImageCachedCount = meta ? meta.imageCachedCount || 0 : 0;
  const lastRunImageUploadedCount = meta ? meta.imageUploadedCount || 0 : 0;
  const lastRunImageReusedCount = meta ? meta.imageReusedCount || 0 : 0;
  const lastRunImageCacheFailedCount = meta ? meta.imageCacheFailedCount || 0 : 0;
  const lastRunFailedCount = meta ? meta.failedCount || 0 : 0;
  const freshness = getSyncFreshness(meta, event);
  const hasRunFailures = Number(lastRunFailedCount || 0) > 0 || Number(lastRunImageCacheFailedCount || 0) > 0;
  const hasCacheIssues = missingImageTotal > 0 || missingCachedImageTotal > 0;
  const healthNeedsCheck = freshness.syncStale || hasRunFailures || hasCacheIssues;
  const healthTone = !cacheReady ? 'local' : (healthNeedsCheck ? 'stale' : 'ready');
  return {
    item: {
      mode: cacheReady ? 'cloud' : 'seed',
      label: cacheReady ? '云开发缓存数据' : '云函数种子数据',
      healthLabel: !cacheReady ? '本地' : (healthNeedsCheck ? '需检查' : '已同步'),
      healthTone,
      cacheReady,
      total: summaries.length,
      limit: meta ? meta.limit || summaries.length : summaries.length,
      syncedCount: cacheReady ? summaries.length : lastRunSyncedCount,
      imageCachedCount: cacheReady ? imageCachedTotal : lastRunImageCachedCount,
      imageUploadedCount: lastRunImageUploadedCount,
      imageReusedCount: lastRunImageReusedCount,
      imageCacheFailedCount: lastRunImageCacheFailedCount,
      failedCount: lastRunFailedCount,
      missingImageCount: missingImageTotal,
      missingCachedImageCount: missingCachedImageTotal,
      lastRunSyncedCount,
      lastRunImageCachedCount,
      lastRunImageUploadedCount,
      lastRunImageReusedCount,
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
    source: 'cloud'
  };
}

async function getSyncRuns(event = {}) {
  const limit = Math.max(1, Math.min(Number(event.limit || 5), 20));
  const runs = await readCollection('sync_runs', {
    pageSize: 100,
    maxPages: 5
  });
  const items = sortRunsByTime(runs)
    .slice(0, limit)
    .map(formatSyncRun);

  return {
    items,
    total: runs.length,
    source: 'cloud'
  };
}

async function validateCache(event = {}) {
  const expectedCount = event.expectedCount ? Number(event.expectedCount) : 151;
  const sampleIds = (event.sampleIds || [1, 4, 7, 25, 151]).map(Number).filter(Boolean);
  const maxSyncAgeHours = Number(event.maxSyncAgeHours || 30);
  const detailCheckLimit = Math.min(expectedCount, Number(event.detailCheckLimit || expectedCount));
  const detailCheckIds = (event.detailCheckIds || Array.from({ length: detailCheckLimit }, (_, index) => index + 1))
    .map(Number)
    .filter(Boolean);
  const summaries = await getSummaries();
  const cloudReady = summaries !== seed.pokemon;
  const summaryIds = new Set(summaries.map((pokemon) => Number(pokemon.id)));
  const missingSummaryIds = [];
  const missingDetailIds = [];
  const invalidEvolutionIds = [];
  const missingImageIds = [];
  const missingCachedImageIds = [];
  const sampleDetails = [];

  if (expectedCount > 0) {
    for (let id = 1; id <= expectedCount; id += 1) {
      if (!summaryIds.has(id)) {
        missingSummaryIds.push(id);
      }
    }
  }

  for (const pokemon of summaries) {
    if (!pokemon.image) {
      missingImageIds.push(Number(pokemon.id));
    }
    if (pokemon.image_remote && !pokemon.image_cached) {
      missingCachedImageIds.push(Number(pokemon.id));
    }
  }

  const detailById = new Map();
  for (const id of uniqueSortedIds([...detailCheckIds, ...sampleIds])) {
    const detail = await getDetail(id);
    if (!detail.item || detail.source !== 'cloud') {
      if (detailCheckIds.includes(id)) {
        missingDetailIds.push(id);
      }
      continue;
    }
    detailById.set(id, detail.item);
  }

  for (const id of sampleIds) {
    const detailItem = detailById.get(id);
    if (!detailItem) {
      if (!missingDetailIds.includes(id)) {
        missingDetailIds.push(id);
      }
      continue;
    }
    const evolution = await resolveEvolution(detailItem.evolution_chain);
    if ((detailItem.evolution_chain || []).length && evolution.length !== detailItem.evolution_chain.length) {
      invalidEvolutionIds.push(id);
    }
    sampleDetails.push({
      id,
      name_zh: detailItem.name_zh,
      evolution: evolution.map((item) => item.id),
      imageCached: Boolean(detailItem.image_cached)
    });
  }

  let status = null;
  try {
    status = (await getSyncStatus({ maxSyncAgeHours })).item;
  } catch (error) {
    status = null;
  }

  const syncFailedCount = status ? Number(status.failedCount || 0) : 0;
  const imageCacheFailedCount = status ? Number(status.imageCacheFailedCount || 0) : 0;
  const syncStale = !status || Boolean(status.syncStale);
  const checks = {
    cloudReady,
    expectedCount,
    maxSyncAgeHours,
    detailCheckCount: detailCheckIds.length,
    actualCount: summaries.length,
    countOk: expectedCount ? summaries.length >= expectedCount : summaries.length > 0,
    missingSummaryIds,
    missingDetailIds,
    invalidEvolutionIds,
    missingImageIds,
    missingCachedImageIds,
    syncFailedCount,
    syncFresh: status ? Boolean(status.syncFresh) : false,
    syncStale,
    syncAgeHours: status ? status.syncAgeHours : null,
    imageCacheFailedCount,
    sampleDetails
  };
  const repair = buildRepairPlan(checks, event);

  return {
    ok: checks.cloudReady &&
      checks.countOk &&
      missingSummaryIds.length === 0 &&
      missingDetailIds.length === 0 &&
      invalidEvolutionIds.length === 0 &&
      missingImageIds.length === 0 &&
      missingCachedImageIds.length === 0 &&
      !syncStale &&
      syncFailedCount === 0 &&
      imageCacheFailedCount === 0,
    checks,
    status,
    repair
  };
}

exports.main = async (event = {}) => {
  const action = event.action || 'listPokemon';
  if (action === 'listPokemon') return listPokemon(event);
  if (action === 'getPokemon') return getPokemon(event);
  if (action === 'getEvolutionChain') return getEvolutionChain(event);
  if (action === 'getTypes') return getTypes(event);
  if (action === 'getTypeRelations') return getTypeRelations(event);
  if (action === 'getDailyQuiz') return getDailyQuiz(event);
  if (action === 'submitDailyQuiz') return submitDailyQuiz(event);
  if (action === 'analyzeTeam') return analyzeTeam(event);
  if (action === 'getSyncStatus') return getSyncStatus(event);
  if (action === 'getSyncRuns') return getSyncRuns(event);
  if (action === 'validateCache') return validateCache(event);
  return { error: `Unknown action: ${action}` };
};
