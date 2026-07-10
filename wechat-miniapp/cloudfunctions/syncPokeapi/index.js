const cloud = require('wx-server-sdk');
const {
  applyCachedImage,
  buildImageCloudPath,
  buildSyncPlan,
  createPokeapiClient,
  requestBuffer,
  reuseExistingCachedImage,
  transformPokemonBundle,
  sleep
} = require('./lib/pokeapi');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const LOCK_TTL_MS = 20 * 60 * 1000;

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    // Collection already exists or current role cannot create it.
  }
}

async function ensureCollections() {
  await Promise.all([
    ensureCollection('pokemon_summary'),
    ensureCollection('pokemon_detail'),
    ensureCollection('sync_meta'),
    ensureCollection('sync_runs')
  ]);
}

async function getMeta() {
  try {
    const result = await db.collection('sync_meta').doc('pokeapi').get();
    return result.data || null;
  } catch (error) {
    return null;
  }
}

function isFreshRunningMeta(meta, now) {
  if (!meta || meta.status !== 'running' || !meta.startedAt) return false;
  const startedAt = new Date(meta.startedAt).getTime();
  if (Number.isNaN(startedAt)) return false;
  return now.getTime() - startedAt < LOCK_TTL_MS;
}

async function upsert(collection, id, data) {
  const ref = db.collection(collection).doc(String(id));
  try {
    await ref.set({ data });
  } catch (error) {
    await ref.update({ data });
  }
}

async function writeRun(runId, data) {
  await upsert('sync_runs', runId, data);
}

function buildPlanSnapshot(plan) {
  return {
    startId: plan.startId,
    endId: plan.endId,
    limit: plan.ids.length,
    concurrency: plan.concurrency,
    retries: plan.retries,
    dryRun: plan.dryRun,
    cacheImages: plan.cacheImages,
    refreshImages: plan.refreshImages,
    strictImageCache: plan.strictImageCache,
    imageCloudPathPrefix: plan.imageCloudPathPrefix
  };
}

function buildRunningMeta(plan, runId, startedAt) {
  return Object.assign({
    status: 'running',
    runId,
    startedAt,
    source: 'pokeapi'
  }, buildPlanSnapshot(plan));
}

function buildFatalSummary(error, plan, runId, startedAt) {
  const finishedAt = new Date();
  const message = error && error.message ? error.message : 'Unknown sync fatal error';
  return Object.assign({
    ok: false,
    status: 'failed',
    runId,
    failedCount: plan.ids.length,
    failed: [{
      id: 0,
      message
    }],
    syncedCount: 0,
    evolutionCacheSize: 0,
    imageCachedCount: 0,
    imageUploadedCount: 0,
    imageReusedCount: 0,
    imageCacheFailedCount: 0,
    imageCacheFailed: [],
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    fatal: true,
    message,
    source: 'pokeapi'
  }, buildPlanSnapshot(plan));
}

function buildSkippedSummary(meta, plan, runId, startedAt) {
  const finishedAt = new Date();
  return Object.assign({
    ok: false,
    status: 'skipped',
    skipped: true,
    runId,
    failedCount: 0,
    failed: [],
    syncedCount: 0,
    evolutionCacheSize: 0,
    imageCachedCount: 0,
    imageUploadedCount: 0,
    imageReusedCount: 0,
    imageCacheFailedCount: 0,
    imageCacheFailed: [],
    startedAt,
    finishedAt,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    reason: 'Another sync is still marked running',
    runningRunId: meta && meta.runId ? meta.runId : '',
    runningSince: meta && meta.startedAt ? meta.startedAt : '',
    source: 'pokeapi'
  }, buildPlanSnapshot(plan));
}

async function writeFailureSummary(summary) {
  try {
    await upsert('sync_meta', 'pokeapi', Object.assign({}, summary, {
      syncedAt: summary.finishedAt
    }));
    await writeRun(summary.runId, summary);
    return true;
  } catch (error) {
    summary.failureRecordError = error.message;
    return false;
  }
}

async function readExistingPokemon(id) {
  const existing = {
    summary: null,
    detail: null
  };

  try {
    const result = await db.collection('pokemon_summary').doc(String(id)).get();
    existing.summary = result.data || null;
  } catch (error) {
    existing.summary = null;
  }

  try {
    const result = await db.collection('pokemon_detail').doc(String(id)).get();
    existing.detail = result.data || null;
  } catch (error) {
    existing.detail = null;
  }

  return existing;
}

async function mapLimit(items, limit, iterator) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await iterator(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

async function cacheArtwork(pokemon, transformed, plan) {
  const imageUrl = transformed.detail.image_remote || transformed.detail.image;
  if (!plan.cacheImages || plan.dryRun || !imageUrl) {
    return {
      transformed,
      cached: false
    };
  }

  try {
    const downloaded = await requestBuffer(imageUrl, {
      timeoutMs: plan.timeoutMs,
      userAgent: plan.userAgent
    });
    const cloudPath = buildImageCloudPath(pokemon, imageUrl, {
      prefix: plan.imageCloudPathPrefix,
      contentType: downloaded.contentType
    });
    const uploadResult = await cloud.uploadFile({
      cloudPath,
      fileContent: downloaded.buffer
    });

    return {
      transformed: applyCachedImage(transformed, {
        fileID: uploadResult.fileID,
        cloudPath
      }),
      cached: true,
      cloudPath,
      fileID: uploadResult.fileID
    };
  } catch (error) {
    if (plan.strictImageCache) {
      throw error;
    }
    return {
      transformed,
      cached: false,
      error: error.message
    };
  }
}

async function syncOne(id, plan, client) {
  let lastError = null;

  for (let attempt = 1; attempt <= plan.retries + 1; attempt += 1) {
    try {
      const bundle = await client.fetchPokemonBundle(id);
      const transformed = transformPokemonBundle(bundle);
      const existing = plan.dryRun ? null : await readExistingPokemon(id);
      const existingCachedImage = plan.refreshImages
        ? { transformed, reused: false, fileID: '' }
        : reuseExistingCachedImage(transformed, existing);
      const cachedImage = existingCachedImage.reused
        ? {
          transformed: existingCachedImage.transformed,
          cached: false
        }
        : await cacheArtwork(bundle.pokemon, transformed, plan);
      let imageReused = false;
      let imageReusedFileID = '';

      if (existingCachedImage.reused) {
        imageReused = true;
        imageReusedFileID = existingCachedImage.fileID;
      } else if (!cachedImage.cached && !plan.dryRun) {
        const reused = reuseExistingCachedImage(cachedImage.transformed, existing);
        cachedImage.transformed = reused.transformed;
        imageReused = reused.reused;
        imageReusedFileID = reused.fileID;
      }

      if (!plan.dryRun) {
        await upsert('pokemon_summary', id, cachedImage.transformed.summary);
        await upsert('pokemon_detail', id, cachedImage.transformed.detail);
      }
      return {
        id,
        ok: true,
        attempt,
        imageCached: cachedImage.cached || imageReused,
        imageUploaded: cachedImage.cached,
        imageReused,
        imageCacheError: cachedImage.error || '',
        imageCloudPath: cachedImage.cloudPath || '',
        imageReusedFileID,
        summary: cachedImage.transformed.summary
      };
    } catch (error) {
      lastError = error;
      if (attempt <= plan.retries) {
        await sleep(plan.retryDelayMs * attempt);
      }
    }
  }

  return {
    id,
    ok: false,
    message: lastError ? lastError.message : 'Unknown sync error'
  };
}

exports.main = async (event = {}) => {
  const now = new Date();
  const plan = buildSyncPlan(event);
  const pokeapi = createPokeapiClient({
    timeoutMs: plan.timeoutMs,
    userAgent: plan.userAgent
  });
  const runId = `pokeapi-${now.toISOString().replace(/[:.]/g, '-')}`;

  await ensureCollections();

  const meta = await getMeta();
  if (!plan.force && isFreshRunningMeta(meta, now)) {
    const skipped = buildSkippedSummary(meta, plan, runId, now);
    await writeRun(runId, skipped);
    return skipped;
  }

  try {
    await upsert('sync_meta', 'pokeapi', buildRunningMeta(plan, runId, now));

    await writeRun(runId, {
      runId,
      status: 'running',
      startedAt: now,
      source: 'pokeapi',
      plan: buildPlanSnapshot(plan)
    });

    if (event.__testFatalAfterRunStart) {
      throw new Error('Simulated fatal sync error');
    }

    const results = await mapLimit(plan.ids, plan.concurrency, (id) => syncOne(id, plan, pokeapi));
    const synced = results.filter((result) => result.ok);
    const imageCached = synced.filter((result) => result.imageCached);
    const imageUploaded = synced.filter((result) => result.imageUploaded);
    const imageReused = synced.filter((result) => result.imageReused);
    const imageCacheFailed = synced.filter((result) => result.imageCacheError).map((result) => ({
      id: result.id,
      message: result.imageCacheError
    }));
    const failed = results.filter((result) => !result.ok).map((result) => ({
      id: result.id,
      message: result.message
    }));
    const finishedAt = new Date();
    const status = failed.length ? 'partial' : 'success';

    const summary = Object.assign({
      ok: failed.length === 0,
      status,
      runId,
      syncedCount: synced.length,
      evolutionCacheSize: pokeapi.evolutionCache.size,
      imageCachedCount: imageCached.length,
      imageUploadedCount: imageUploaded.length,
      imageReusedCount: imageReused.length,
      imageCacheFailedCount: imageCacheFailed.length,
      imageCacheFailed,
      failedCount: failed.length,
      failed,
      startedAt: now,
      finishedAt,
      durationMs: finishedAt.getTime() - now.getTime(),
      source: 'pokeapi'
    }, buildPlanSnapshot(plan));

    await upsert('sync_meta', 'pokeapi', Object.assign({}, summary, {
      syncedAt: finishedAt
    }));
    await writeRun(runId, summary);

    return summary;
  } catch (error) {
    const summary = buildFatalSummary(error, plan, runId, now);
    await writeFailureSummary(summary);
    return summary;
  }
};
