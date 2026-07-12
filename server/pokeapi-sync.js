const fs = require('fs');
const path = require('path');
const {
  buildSyncPlan,
  createPokeapiClient,
  requestBuffer,
  sleep,
  transformPokemonBundle
} = require('../wechat-miniapp/cloudfunctions/syncPokeapi/lib/pokeapi');
const { validatePokedex } = require('./data-quality');

const LOCK_TTL_MS = 20 * 60 * 1000;

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sanitizeFilePart(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function imageExtension(url, contentType) {
  const cleanUrl = String(url || '').split('?')[0];
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  if (match) return match[1].toLowerCase();
  if (String(contentType).includes('jpeg')) return 'jpg';
  if (String(contentType).includes('webp')) return 'webp';
  return 'png';
}

function isFreshRunningMeta(meta, now) {
  if (!meta || meta.status !== 'running' || !meta.startedAt) return false;
  const startedAt = new Date(meta.startedAt).getTime();
  if (Number.isNaN(startedAt)) return false;
  return now.getTime() - startedAt < LOCK_TTL_MS;
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
    strictImageCache: plan.strictImageCache
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

function buildFatalSummary(error, plan, runId, startedAt) {
  const finishedAt = new Date();
  const message = error && error.message ? error.message : 'Unknown sync fatal error';
  return Object.assign({
    ok: false,
    status: 'failed',
    runId,
    failedCount: plan.ids.length,
    failed: [{ id: 0, message }],
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

function existingCachedAsset(existing) {
  const source = existing && (existing.detail || existing.summary || existing);
  if (!source) return null;
  if (source.image_cached && source.image_asset_path) {
    return {
      image_asset_path: source.image_asset_path,
      image_file_path: source.image_file_path || '',
      image_cached: true
    };
  }
  return null;
}

function applyLocalImage(transformed, asset) {
  if (!asset || !asset.image_asset_path) return transformed;
  const patch = {
    image: asset.image_asset_path,
    image_asset_path: asset.image_asset_path,
    image_file_path: asset.image_file_path || '',
    image_cached: true
  };
  return {
    summary: Object.assign({}, transformed.summary, patch),
    detail: Object.assign({}, transformed.detail, patch)
  };
}

async function cacheArtwork(bundle, transformed, plan, options) {
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
    const ext = imageExtension(imageUrl, downloaded.contentType);
    const fileName = `${String(bundle.pokemon.id).padStart(4, '0')}-${sanitizeFilePart(bundle.pokemon.name)}.${ext}`;
    const assetDir = path.join(options.dataDir, 'artwork');
    const filePath = path.join(assetDir, fileName);
    ensureDir(assetDir);
    fs.writeFileSync(filePath, downloaded.buffer);
    const asset = {
      image_asset_path: `/assets/pokemon/artwork/${fileName}`,
      image_file_path: filePath,
      image_cached: true
    };

    return {
      transformed: applyLocalImage(transformed, asset),
      cached: true,
      assetPath: asset.image_asset_path,
      filePath
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

async function syncOne(id, plan, client, store, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= plan.retries + 1; attempt += 1) {
    try {
      const bundle = await client.fetchPokemonBundle(id);
      let transformed = transformPokemonBundle(bundle);
      const existing = plan.dryRun ? null : {
        summary: store.getSummary(id),
        detail: store.getDetail(id)
      };
      const reusableAsset = plan.refreshImages ? null : existingCachedAsset(existing);
      let imageReused = false;
      let cachedImage = {
        transformed,
        cached: false
      };

      if (reusableAsset) {
        transformed = applyLocalImage(transformed, reusableAsset);
        cachedImage = {
          transformed,
          cached: false
        };
        imageReused = true;
      } else {
        cachedImage = await cacheArtwork(bundle, transformed, plan, options);
      }

      if (!plan.dryRun) {
        store.upsertPokemon(id, cachedImage.transformed);
      }

      return {
        id,
        ok: true,
        attempt,
        imageCached: cachedImage.cached || imageReused,
        imageUploaded: cachedImage.cached,
        imageReused,
        imageCacheError: cachedImage.error || '',
        imageAssetPath: cachedImage.assetPath || (reusableAsset && reusableAsset.image_asset_path) || '',
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

async function syncPokeapi(store, event = {}, options = {}) {
  const now = new Date();
  const plan = buildSyncPlan(event);
  const client = createPokeapiClient({
    timeoutMs: plan.timeoutMs,
    userAgent: plan.userAgent
  });
  const dataDir = options.dataDir || path.join(__dirname, '.data');
  const runId = `pokeapi-${now.toISOString().replace(/[:.]/g, '-')}`;
  const meta = store.getMeta('pokeapi');

  if (!plan.force && isFreshRunningMeta(meta, now)) {
    const skipped = buildSkippedSummary(meta, plan, runId, now);
    store.writeRun(runId, skipped);
    return skipped;
  }

  try {
    store.setMeta('pokeapi', buildRunningMeta(plan, runId, now));
    store.writeRun(runId, {
      runId,
      status: 'running',
      startedAt: now,
      source: 'pokeapi',
      plan: buildPlanSnapshot(plan)
    });

    let results = await mapLimit(plan.ids, plan.concurrency, (id) => syncOne(id, plan, client, store, {
      dataDir
    }));
    const initialFailed = results.filter((result) => !result.ok);
    if (initialFailed.length && event.recover !== false) {
      const recoveryPlan = Object.assign({}, plan, {
        retries: Math.min(5, plan.retries + 1),
        timeoutMs: Math.min(60000, Math.max(plan.timeoutMs, Math.round(plan.timeoutMs * 1.5)))
      });
      const recovered = await mapLimit(initialFailed.map((item) => item.id), Math.min(2, plan.concurrency), (id) =>
        syncOne(id, recoveryPlan, client, store, { dataDir }));
      const recoveredById = new Map(recovered.map((item) => [item.id, item]));
      results = results.map((item) => item.ok ? item : recoveredById.get(item.id) || item);
    }
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
    const quality = validatePokedex(store, {
      minimumCount: Math.max(1, plan.ids.length),
      expectedIds: plan.ids
    });
    const summary = Object.assign({
      ok: failed.length === 0,
      status,
      runId,
      syncedCount: synced.length,
      evolutionCacheSize: client.evolutionCache.size,
      moveCacheSize: client.moveCache ? client.moveCache.size : 0,
      imageCachedCount: imageCached.length,
      imageUploadedCount: imageUploaded.length,
      imageReusedCount: imageReused.length,
      imageCacheFailedCount: imageCacheFailed.length,
      imageCacheFailed,
      failedCount: failed.length,
      failed,
      initialFailedCount: initialFailed.length,
      recoveredCount: initialFailed.length - failed.length,
      retryQueue: failed.map((item) => item.id),
      publishStatus: quality.ok ? (failed.length ? 'degraded-fallback' : 'published') : 'rejected',
      quality,
      startedAt: now,
      finishedAt,
      syncedAt: finishedAt,
      durationMs: finishedAt.getTime() - now.getTime(),
      source: 'pokeapi'
    }, buildPlanSnapshot(plan));

    store.setMeta('pokeapi', summary);
    store.writeRun(runId, summary);
    return summary;
  } catch (error) {
    const summary = buildFatalSummary(error, plan, runId, now);
    store.setMeta('pokeapi', Object.assign({}, summary, {
      syncedAt: summary.finishedAt
    }));
    store.writeRun(runId, summary);
    return summary;
  }
}

module.exports = {
  syncPokeapi
};
