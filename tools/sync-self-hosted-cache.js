const path = require('path');
const { CacheStore } = require('../server/cache-store');
const { syncPokeapi } = require('../server/pokeapi-sync');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'server', '.data');

function parseArgs(argv) {
  const args = {
    startId: 1,
    endId: 1025,
    concurrency: 6,
    retries: 2,
    timeoutMs: 20000,
    cacheImages: false,
    strictImageCache: false,
    refreshImages: false,
    force: true
  };

  argv.forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) {
      if (arg === '--cache-images') args.cacheImages = true;
      if (arg === '--strict-image-cache') args.strictImageCache = true;
      if (arg === '--refresh-images') args.refreshImages = true;
      if (arg === '--no-force') args.force = false;
      return;
    }

    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];
    if (['startId', 'endId', 'limit', 'concurrency', 'retries', 'timeoutMs'].includes(key)) {
      args[key] = Number(value);
      return;
    }
    if (['cacheImages', 'strictImageCache', 'refreshImages', 'force'].includes(key)) {
      args[key] = value === 'true';
    }
  });

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = new CacheStore({
    filePath: path.join(dataDir, 'pokedex-cache.json')
  });
  const result = await syncPokeapi(store, args, { dataDir });

  console.log(JSON.stringify({
    ok: result.ok,
    status: result.status,
    runId: result.runId,
    startId: result.startId,
    endId: result.endId,
    syncedCount: result.syncedCount,
    failedCount: result.failedCount,
    failed: (result.failed || []).slice(0, 10),
    moveCacheSize: result.moveCacheSize,
    imageCachedCount: result.imageCachedCount,
    imageCacheFailedCount: result.imageCacheFailedCount,
    imageCacheFailed: (result.imageCacheFailed || []).slice(0, 10),
    durationMs: result.durationMs,
    cacheFile: store.filePath
  }, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
