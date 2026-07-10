const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CacheStore } = require('../server/cache-store');
const { createSyncScheduler } = require('../server/sync-scheduler');

function fakePokemon(id) {
  return {
    id,
    slug: `test-${id}`,
    name_en: `Test ${id}`,
    name_zh: `测试 ${id}`,
    image: `/fake/${id}.png`,
    image_remote: `/fake/${id}.png`,
    image_cached: false,
    types: ['normal'],
    generation: 1,
    stat_total: 300 + id,
    category: 'Test',
    stats: {
      hp: 50,
      attack: 50,
      defense: 50,
      specialAttack: 50,
      specialDefense: 50,
      speed: 50
    },
    evolution_chain: [id],
    synced_from: 'fake',
    synced_at: new Date().toISOString()
  };
}

async function fakeSync(store, event) {
  const startedAt = new Date();
  const startId = Number(event.startId || 1);
  const endId = Number(event.endId || 3);

  for (let id = startId; id <= endId; id += 1) {
    const pokemon = fakePokemon(id);
    store.upsertPokemon(id, {
      summary: pokemon,
      detail: pokemon
    });
  }

  const finishedAt = new Date();
  const result = {
    ok: true,
    status: 'success',
    runId: `fake-${finishedAt.getTime()}`,
    startId,
    endId,
    limit: endId - startId + 1,
    syncedCount: endId - startId + 1,
    failedCount: 0,
    failed: [],
    imageCachedCount: 0,
    imageCacheFailedCount: 0,
    startedAt,
    finishedAt,
    syncedAt: finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    source: 'fake'
  };

  store.setMeta('pokeapi', result);
  store.writeRun(result.runId, result);
  return result;
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokechill-scheduler-'));
  const store = new CacheStore({
    filePath: path.join(dataDir, 'cache.json')
  });
  const scheduler = createSyncScheduler({
    store,
    dataDir,
    syncFn: fakeSync,
    scheduler: {
      enabled: true,
      syncOnStart: false,
      expectedCount: 3,
      endId: 3,
      intervalHours: 24,
      maxSyncAgeHours: 30
    }
  });

  const emptyStatus = scheduler.status();
  assert.strictEqual(emptyStatus.due.due, true);
  assert.strictEqual(emptyStatus.due.reason, 'cache-incomplete');

  const firstRun = await scheduler.runIfDue('test-empty-cache');
  assert.strictEqual(firstRun.ok, true);
  assert.strictEqual(firstRun.syncedCount, 3);
  assert.strictEqual(scheduler.status().due.due, false);
  assert.strictEqual(scheduler.status().state.runCount, 1);

  const freshSkip = await scheduler.runIfDue('test-fresh-cache');
  assert.strictEqual(freshSkip.skipped, true);
  assert.strictEqual(freshSkip.reason, 'fresh');
  assert.strictEqual(scheduler.status().state.runCount, 1);

  const previousMeta = store.getMeta('pokeapi');
  store.setMeta('pokeapi', Object.assign({}, previousMeta, {
    syncedAt: new Date(Date.now() - 48 * 3600000).toISOString()
  }));

  const staleStatus = scheduler.status();
  assert.strictEqual(staleStatus.due.due, true);
  assert.strictEqual(staleStatus.due.reason, 'sync-stale');

  const staleRun = await scheduler.runIfDue('test-stale-cache');
  assert.strictEqual(staleRun.ok, true);
  assert.strictEqual(scheduler.status().state.runCount, 2);

  console.log(JSON.stringify({
    ok: true,
    cacheFile: store.filePath,
    runCount: scheduler.status().state.runCount,
    finalDue: scheduler.status().due
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
