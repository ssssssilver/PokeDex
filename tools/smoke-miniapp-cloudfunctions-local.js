const assert = require('assert');
const Module = require('module');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMockCloud() {
  const collections = new Map();
  const uploads = [];

  function ensureCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name);
  }

  class Query {
    constructor(name, offset = 0, size = Infinity) {
      this.name = name;
      this.offset = offset;
      this.size = size;
    }

    skip(offset) {
      return new Query(this.name, offset, this.size);
    }

    limit(size) {
      return new Query(this.name, this.offset, size);
    }

    doc(id) {
      const name = this.name;
      return {
        async get() {
          const collection = ensureCollection(name);
          if (!collection.has(String(id))) {
            throw new Error(`Document not found: ${name}/${id}`);
          }
          return { data: clone(collection.get(String(id))) };
        },
        async set(payload) {
          const collection = ensureCollection(name);
          collection.set(String(id), clone(payload.data));
          return {};
        },
        async update(payload) {
          const collection = ensureCollection(name);
          const previous = collection.get(String(id)) || {};
          collection.set(String(id), Object.assign({}, clone(previous), clone(payload.data)));
          return {};
        }
      };
    }

    async get() {
      const collection = ensureCollection(this.name);
      const rows = Array.from(collection.values()).map(clone);
      return {
        data: rows.slice(this.offset, Number.isFinite(this.size) ? this.offset + this.size : undefined)
      };
    }
  }

  const db = {
    async createCollection(name) {
      ensureCollection(name);
      return {};
    },
    collection(name) {
      ensureCollection(name);
      return new Query(name);
    }
  };

  return {
    DYNAMIC_CURRENT_ENV: 'local-mock',
    init() {},
    database() {
      return db;
    },
    async uploadFile(options) {
      uploads.push({
        cloudPath: options.cloudPath,
        bytes: options.fileContent ? options.fileContent.length : 0
      });
      return {
        fileID: `cloud://local-mock/${options.cloudPath}`
      };
    },
    __debug: {
      collections,
      uploads
    }
  };
}

function installMockCloud(mockCloud) {
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'wx-server-sdk') {
      return mockCloud;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}

async function main() {
  const mockCloud = createMockCloud();
  const restore = installMockCloud(mockCloud);

  try {
    const syncPokeapi = require('../wechat-miniapp/cloudfunctions/syncPokeapi/index');
    const pokedex = require('../wechat-miniapp/cloudfunctions/pokedex/index');

    const syncResult = await syncPokeapi.main({
      limit: 3,
      concurrency: 2,
      retries: 1,
      timeoutMs: 15000,
      cacheImages: true,
      strictImageCache: true,
      force: true
    });

    assert.strictEqual(syncResult.ok, true);
    assert.strictEqual(syncResult.syncedCount, 3);
    assert.strictEqual(syncResult.failedCount, 0);
    assert.strictEqual(syncResult.imageCachedCount, 3);
    assert.strictEqual(syncResult.imageUploadedCount, 3);
    assert.strictEqual(syncResult.imageReusedCount, 0);
    assert.strictEqual(mockCloud.__debug.uploads.length, 3);

    const listResult = await pokedex.main({
      action: 'listPokemon',
      sort: 'id'
    });
    assert.strictEqual(listResult.items.length, 3);
    assert.strictEqual(listResult.items[0].name_zh, '妙蛙种子');
    assert.strictEqual(listResult.items[0].image.startsWith('cloud://local-mock/'), true);

    const detailResult = await pokedex.main({
      action: 'getPokemon',
      id: 1
    });
    assert.strictEqual(detailResult.source, 'cloud');
    assert.strictEqual(detailResult.item.name_zh, '妙蛙种子');
    assert.deepStrictEqual(detailResult.item.evolution.map((item) => item.id), [1, 2, 3]);

    const statusResult = await pokedex.main({
      action: 'getSyncStatus'
    });
    assert.strictEqual(statusResult.item.cacheReady, true);
    assert.strictEqual(statusResult.item.total, 3);
    assert.strictEqual(statusResult.item.syncedCount, 3);
    assert.strictEqual(statusResult.item.imageCachedCount, 3);
    assert.strictEqual(statusResult.item.syncFresh, true);
    assert.strictEqual(statusResult.item.syncStale, false);
    assert.strictEqual(statusResult.item.healthTone, 'ready');

    const repeatCacheResult = await syncPokeapi.main({
      limit: 2,
      concurrency: 2,
      retries: 1,
      timeoutMs: 15000,
      cacheImages: true,
      force: true
    });
    assert.strictEqual(repeatCacheResult.ok, true);
    assert.strictEqual(repeatCacheResult.syncedCount, 2);
    assert.strictEqual(repeatCacheResult.imageCachedCount, 2);
    assert.strictEqual(repeatCacheResult.imageUploadedCount, 0);
    assert.strictEqual(repeatCacheResult.imageReusedCount, 2);
    assert.strictEqual(mockCloud.__debug.uploads.length, 3);

    const validationResult = await pokedex.main({
      action: 'validateCache',
      expectedCount: 3,
      sampleIds: [1, 2, 3],
      maxSyncAgeHours: 30
    });
    assert.strictEqual(validationResult.ok, true);
    assert.strictEqual(validationResult.checks.actualCount, 3);
    assert.deepStrictEqual(validationResult.checks.missingSummaryIds, []);
    assert.deepStrictEqual(validationResult.checks.missingDetailIds, []);
    assert.deepStrictEqual(validationResult.checks.invalidEvolutionIds, []);
    assert.strictEqual(validationResult.checks.syncFresh, true);
    assert.strictEqual(validationResult.checks.syncStale, false);
    assert.strictEqual(validationResult.repair.needed, false);

    const summaryCollection = mockCloud.__debug.collections.get('pokemon_summary');
    const savedSummaryOne = summaryCollection.get('1');
    summaryCollection.set('1', Object.assign({}, savedSummaryOne, {
      image: savedSummaryOne.image_remote,
      image_cached: false,
      image_file_id: ''
    }));
    const missingCachedImageValidation = await pokedex.main({
      action: 'validateCache',
      expectedCount: 3,
      sampleIds: [1, 2, 3],
      maxSyncAgeHours: 30
    });
    assert.strictEqual(missingCachedImageValidation.ok, false);
    assert.deepStrictEqual(missingCachedImageValidation.checks.missingCachedImageIds, [1]);
    assert.strictEqual(missingCachedImageValidation.repair.needed, true);
    assert.deepStrictEqual(missingCachedImageValidation.repair.imageIds, [1]);
    assert.deepStrictEqual(missingCachedImageValidation.repair.payloads[0], {
      startId: 1,
      endId: 1,
      retries: 2,
      concurrency: 3,
      cacheImages: true,
      strictImageCache: false,
      force: true
    });
    const missingCachedImageStatus = await pokedex.main({
      action: 'getSyncStatus'
    });
    assert.strictEqual(missingCachedImageStatus.item.missingCachedImageCount, 1);
    assert.strictEqual(missingCachedImageStatus.item.healthTone, 'stale');
    assert.strictEqual(missingCachedImageStatus.item.healthLabel, '需检查');
    summaryCollection.set('1', savedSummaryOne);

    const detailCollection = mockCloud.__debug.collections.get('pokemon_detail');
    const savedDetailTwo = detailCollection.get('2');
    detailCollection.delete('2');
    const repairValidationResult = await pokedex.main({
      action: 'validateCache',
      expectedCount: 3,
      sampleIds: [1, 2, 3],
      maxSyncAgeHours: 30
    });
    assert.strictEqual(repairValidationResult.ok, false);
    assert.deepStrictEqual(repairValidationResult.checks.missingDetailIds, [2]);
    assert.strictEqual(repairValidationResult.repair.needed, true);
    assert.deepStrictEqual(repairValidationResult.repair.ids, [2]);
    assert.deepStrictEqual(repairValidationResult.repair.payloads[0], {
      startId: 2,
      endId: 2,
      retries: 2,
      concurrency: 3,
      cacheImages: true,
      strictImageCache: false,
      force: true
    });
    detailCollection.set('2', savedDetailTwo);

    const refreshResult = await syncPokeapi.main({
      limit: 2,
      concurrency: 2,
      retries: 1,
      timeoutMs: 15000,
      cacheImages: false,
      force: true
    });
    assert.strictEqual(refreshResult.ok, true);
    assert.strictEqual(refreshResult.syncedCount, 2);
    assert.strictEqual(refreshResult.imageCachedCount, 2);
    assert.strictEqual(refreshResult.imageUploadedCount, 0);
    assert.strictEqual(refreshResult.imageReusedCount, 2);

    const refreshedListResult = await pokedex.main({
      action: 'listPokemon',
      sort: 'id'
    });
    assert.strictEqual(refreshedListResult.items.length, 3);
    assert.strictEqual(refreshedListResult.items[0].image.startsWith('cloud://local-mock/'), true);

    const refreshedStatusResult = await pokedex.main({
      action: 'getSyncStatus'
    });
    assert.strictEqual(refreshedStatusResult.item.syncedCount, 3);
    assert.strictEqual(refreshedStatusResult.item.imageCachedCount, 3);
    assert.strictEqual(refreshedStatusResult.item.lastRunSyncedCount, 2);
    assert.strictEqual(refreshedStatusResult.item.lastRunImageCachedCount, 2);
    assert.strictEqual(refreshedStatusResult.item.imageUploadedCount, 0);
    assert.strictEqual(refreshedStatusResult.item.imageReusedCount, 2);

    const syncRunsResult = await pokedex.main({
      action: 'getSyncRuns',
      limit: 3
    });
    assert.strictEqual(syncRunsResult.items.length, 3);
    assert.strictEqual(syncRunsResult.items.some((item) => item.runId === refreshResult.runId), true);
    assert.strictEqual(syncRunsResult.items.every((item) => item.statusText), true);
    assert.strictEqual(syncRunsResult.items.every((item) => item.countText), true);

    const metaCollection = mockCloud.__debug.collections.get('sync_meta');
    const previousMeta = metaCollection.get('pokeapi');
    metaCollection.set('pokeapi', Object.assign({}, previousMeta, {
      status: 'running',
      runId: 'manual-running-lock',
      startedAt: new Date().toISOString()
    }));
    const skippedResult = await syncPokeapi.main({
      limit: 1
    });
    assert.strictEqual(skippedResult.ok, false);
    assert.strictEqual(skippedResult.status, 'skipped');
    assert.strictEqual(skippedResult.skipped, true);
    assert.strictEqual(skippedResult.runningRunId, 'manual-running-lock');
    const skippedMeta = metaCollection.get('pokeapi');
    assert.strictEqual(skippedMeta.status, 'running');
    assert.strictEqual(skippedMeta.runId, 'manual-running-lock');
    const skippedRunsResult = await pokedex.main({
      action: 'getSyncRuns',
      limit: 1
    });
    assert.strictEqual(skippedRunsResult.items[0].status, 'skipped');
    assert.strictEqual(skippedRunsResult.items[0].statusText, '已跳过');
    metaCollection.set('pokeapi', previousMeta);

    metaCollection.set('pokeapi', Object.assign({}, previousMeta, {
      syncedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    }));

    const staleValidationResult = await pokedex.main({
      action: 'validateCache',
      expectedCount: 3,
      sampleIds: [1, 2, 3],
      maxSyncAgeHours: 30
    });
    assert.strictEqual(staleValidationResult.ok, false);
    assert.strictEqual(staleValidationResult.checks.syncFresh, false);
    assert.strictEqual(staleValidationResult.checks.syncStale, true);

    const fatalResult = await syncPokeapi.main({
      limit: 1,
      force: true,
      __testFatalAfterRunStart: true
    });
    assert.strictEqual(fatalResult.ok, false);
    assert.strictEqual(fatalResult.status, 'failed');
    assert.strictEqual(fatalResult.fatal, true);
    assert.strictEqual(fatalResult.failedCount, 1);

    const failedMeta = metaCollection.get('pokeapi');
    assert.strictEqual(failedMeta.status, 'failed');
    assert.strictEqual(failedMeta.runId, fatalResult.runId);

    const failedStatusResult = await pokedex.main({
      action: 'getSyncStatus'
    });
    assert.strictEqual(failedStatusResult.item.failedCount, 1);
    assert.strictEqual(failedStatusResult.item.healthTone, 'stale');
    assert.strictEqual(failedStatusResult.item.healthLabel, '需检查');

    const failedRunsResult = await pokedex.main({
      action: 'getSyncRuns',
      limit: 1
    });
    assert.strictEqual(failedRunsResult.items.length, 1);
    assert.strictEqual(failedRunsResult.items[0].status, 'failed');
    assert.strictEqual(failedRunsResult.items[0].failedCount, 1);

    console.log(JSON.stringify({
      ok: true,
      syncedCount: syncResult.syncedCount,
      imageCachedCount: syncResult.imageCachedCount,
      listCount: listResult.items.length,
      first: listResult.items[0].name_zh,
      evolution: detailResult.item.evolution.map((item) => item.id),
      validationOk: validationResult.ok,
      missingCachedImageValidationOk: missingCachedImageValidation.ok,
      missingCachedImageHealthTone: missingCachedImageStatus.item.healthTone,
      repairPayload: repairValidationResult.repair.payloads[0],
      repeatCacheImageReusedCount: repeatCacheResult.imageReusedCount,
      refreshImageReusedCount: refreshResult.imageReusedCount,
      refreshedAvailableCount: refreshedStatusResult.item.syncedCount,
      refreshedLastRunSyncedCount: refreshedStatusResult.item.lastRunSyncedCount,
      recentSyncRuns: syncRunsResult.items.map((item) => item.status),
      skippedStatus: skippedResult.status,
      staleValidationOk: staleValidationResult.ok,
      staleSyncAgeHours: staleValidationResult.checks.syncAgeHours,
      fatalStatus: fatalResult.status,
      failedHealthTone: failedStatusResult.item.healthTone,
      latestRunAfterFatal: failedRunsResult.items[0].status,
      uploadedBytes: mockCloud.__debug.uploads.reduce((sum, item) => sum + item.bytes, 0)
    }, null, 2));
  } finally {
    restore();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
