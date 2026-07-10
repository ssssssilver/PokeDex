const path = require('path');
const { CacheStore } = require('../server/cache-store');
const {
  createPokeapiClient,
  transformPokemonBundle
} = require('../wechat-miniapp/cloudfunctions/syncPokeapi/lib/pokeapi');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'server', '.data');

function parseArgs(argv) {
  const args = {
    concurrency: 4,
    timeoutMs: 30000,
    ids: []
  };

  argv.forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];
    if (['concurrency', 'timeoutMs'].includes(key)) {
      args[key] = Number(value);
      return;
    }
    if (key === 'ids') {
      args.ids = value.split(',').map((id) => Number(id)).filter(Boolean);
    }
  });

  return args;
}

function needsRepair(detail) {
  if (!detail) return false;
  if (!Array.isArray(detail.evolution_conditions)) return true;
  return (detail.moves || []).some((move) => move.name_en === undefined);
}

function findRepairIds(store) {
  const state = store.load();
  return Object.values(state.pokemon_detail || {})
    .filter(needsRepair)
    .map((item) => Number(item.id))
    .filter(Boolean)
    .sort((a, b) => a - b);
}

async function mapLimit(items, limit, iterator) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await iterator(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = new CacheStore({
    filePath: path.join(dataDir, 'pokedex-cache.json')
  });
  const ids = args.ids.length ? args.ids : findRepairIds(store);
  const startedAt = new Date();
  const runId = `repair-pokeapi-${startedAt.toISOString().replace(/[:.]/g, '-')}`;
  const client = createPokeapiClient({
    timeoutMs: args.timeoutMs
  });

  store.writeRun(runId, {
    runId,
    status: 'running',
    startedAt,
    source: 'pokeapi',
    plan: {
      ids,
      concurrency: args.concurrency,
      timeoutMs: args.timeoutMs,
      cacheImages: false,
      strictImageCache: false
    }
  });

  const results = await mapLimit(ids, args.concurrency, async (id) => {
    try {
      const bundle = await client.fetchPokemonBundle(id);
      const transformed = transformPokemonBundle(bundle);
      store.upsertPokemon(id, transformed);
      return { id, ok: true };
    } catch (error) {
      return { id, ok: false, message: error.message };
    }
  });

  const failed = results.filter((item) => !item.ok).map((item) => ({
    id: item.id,
    message: item.message
  }));
  const synced = results.filter((item) => item.ok);
  const finishedAt = new Date();
  const summaries = store.getSummaries();
  const summary = {
    ok: failed.length === 0,
    status: failed.length ? 'partial' : 'success',
    runId,
    syncedCount: synced.length,
    repairedCount: synced.length,
    failedCount: failed.length,
    failed,
    moveCacheSize: client.moveCache ? client.moveCache.size : 0,
    imageCachedCount: 0,
    imageUploadedCount: 0,
    imageReusedCount: 0,
    imageCacheFailedCount: 0,
    imageCacheFailed: [],
    cacheImages: false,
    strictImageCache: false,
    startedAt,
    finishedAt,
    syncedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totalCachedCount: summaries.length
  };

  store.writeRun(runId, summary);
  if (summary.ok) {
    const previous = store.getMeta('pokeapi') || {};
    store.setMeta('pokeapi', Object.assign({}, previous, summary, {
      syncedCount: summaries.length,
      limit: summaries.length,
      failed: [],
      failedCount: 0
    }));
  }

  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
