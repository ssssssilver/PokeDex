const { transformCard, transformSet } = require('./ptcg-utils');

const API_BASE = 'https://api.pokemontcg.io/v2';
const DEFAULT_PAGE_SIZE = 250;
const CARD_SELECT_FIELDS = [
  'id',
  'name',
  'supertype',
  'subtypes',
  'level',
  'hp',
  'types',
  'evolvesFrom',
  'evolvesTo',
  'rules',
  'ancientTrait',
  'abilities',
  'attacks',
  'weaknesses',
  'resistances',
  'retreatCost',
  'convertedRetreatCost',
  'set',
  'number',
  'artist',
  'rarity',
  'flavorText',
  'nationalPokedexNumbers',
  'legalities',
  'regulationMark',
  'images'
];

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.floor(number), max));
}

function buildUrl(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      url.searchParams.set(key, params[key]);
    }
  });
  return url.toString();
}

function runId(prefix) {
  return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 30000));
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: Object.assign({
        Accept: 'application/json',
        'User-Agent': options.userAgent || 'PokeChill/1.0'
      }, options.apiKey ? {
        'X-Api-Key': options.apiKey
      } : {})
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`PTCG API ${response.status}: ${body.slice(0, 300)}`);
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(timeout);
  }
}

function buildPlan(event = {}) {
  const pageSize = boundedInteger(event.pageSize, DEFAULT_PAGE_SIZE, 1, 250);
  const maxPages = event.full === true
    ? 0
    : boundedInteger(event.maxPages === undefined ? event.pages : event.maxPages, 2, 0, 10000);
  const startPage = boundedInteger(event.startPage, 1, 1, 10000);

  return {
    source: event.source || 'pokemontcg-api',
    dryRun: Boolean(event.dryRun),
    pageSize,
    startPage,
    maxPages,
    syncSets: event.syncSets !== false,
    syncCards: event.syncCards !== false,
    query: event.query || event.q || '',
    orderBy: event.orderBy || '',
    apiKey: event.apiKey || process.env.POKEMONTCG_API_KEY || '',
    timeoutMs: Number(event.timeoutMs || 30000),
    userAgent: event.userAgent || 'PokeChill/1.0'
  };
}

async function fetchPaged(path, params, plan, pageHandler) {
  let page = plan.startPage;
  let totalCount = 0;
  let fetchedCount = 0;
  let fetchedPages = 0;

  while (true) {
    const payload = await requestJson(buildUrl(path, Object.assign({}, params, {
      page,
      pageSize: plan.pageSize
    })), plan);
    const rows = payload.data || [];
    totalCount = Number(payload.totalCount || totalCount || rows.length || 0);
    fetchedCount += rows.length;
    fetchedPages += 1;
    await pageHandler(rows, payload, page);

    const reachedExplicitLimit = plan.maxPages > 0 && fetchedPages >= plan.maxPages;
    const reachedTotal = fetchedCount >= totalCount || rows.length === 0;
    if (reachedExplicitLimit || reachedTotal) {
      return {
        totalCount,
        fetchedCount,
        fetchedPages,
        lastPage: page
      };
    }
    page += 1;
  }
}

async function syncSets(store, plan) {
  let syncedCount = 0;
  const result = await fetchPaged('/sets', {}, Object.assign({}, plan, {
    startPage: 1,
    maxPages: 0
  }), async (rows) => {
    const sets = rows.map(transformSet);
    if (!plan.dryRun) store.upsertSets(sets);
    syncedCount += sets.length;
  });

  return Object.assign({}, result, {
    syncedCount
  });
}

async function syncCards(store, plan) {
  let syncedCount = 0;
  const params = {
    select: CARD_SELECT_FIELDS.join(',')
  };
  if (plan.query) params.q = plan.query;
  if (plan.orderBy) params.orderBy = plan.orderBy;

  const result = await fetchPaged('/cards', params, plan, async (rows) => {
    const cards = rows.map(transformCard);
    if (!plan.dryRun) store.upsertCards(cards);
    syncedCount += cards.length;
  });

  return Object.assign({}, result, {
    syncedCount
  });
}

function buildSummary(status, plan, id, startedAt, patch = {}) {
  const finishedAt = new Date();
  return Object.assign({
    ok: status === 'success',
    status,
    runId: id,
    source: plan.source,
    dryRun: plan.dryRun,
    pageSize: plan.pageSize,
    startPage: plan.startPage,
    maxPages: plan.maxPages,
    query: plan.query,
    startedAt,
    finishedAt,
    syncedAt: finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime()
  }, patch);
}

async function syncPtcg(store, event = {}) {
  const plan = buildPlan(event);
  const startedAt = new Date();
  const id = runId('ptcg');

  store.setMeta('ptcg', {
    status: 'running',
    runId: id,
    startedAt,
    source: plan.source,
    pageSize: plan.pageSize,
    startPage: plan.startPage,
    maxPages: plan.maxPages,
    query: plan.query
  });
  store.writeRun(id, {
    runId: id,
    status: 'running',
    startedAt,
    source: plan.source
  });

  try {
    const setResult = plan.syncSets
      ? await syncSets(store, plan)
      : { syncedCount: 0, totalCount: store.getSets().length, fetchedPages: 0 };
    const cardResult = plan.syncCards
      ? await syncCards(store, plan)
      : { syncedCount: 0, totalCount: store.getCardSummaries().length, fetchedPages: 0 };

    const summary = buildSummary('success', plan, id, startedAt, {
      setSyncedCount: setResult.syncedCount,
      setTotalCount: setResult.totalCount,
      setFetchedPages: setResult.fetchedPages,
      cardSyncedCount: cardResult.syncedCount,
      cardTotalCount: cardResult.totalCount,
      cardFetchedPages: cardResult.fetchedPages,
      cacheCardCount: store.getCardSummaries().length,
      cacheSetCount: store.getSets().length
    });
    store.setMeta('ptcg', summary);
    store.writeRun(id, summary);
    return summary;
  } catch (error) {
    const summary = buildSummary('failed', plan, id, startedAt, {
      ok: false,
      message: error.message || 'PTCG sync failed',
      failedCount: 1,
      cacheCardCount: store.getCardSummaries().length,
      cacheSetCount: store.getSets().length
    });
    store.setMeta('ptcg', summary);
    store.writeRun(id, summary);
    return summary;
  }
}

module.exports = {
  buildPlan,
  requestJson,
  syncPtcg
};
