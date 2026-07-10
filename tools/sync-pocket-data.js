const path = require('path');
const { PocketCacheStore } = require('../server/pocket-cache-store');
const { syncPocket } = require('../server/pocket-sync');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

async function main() {
  const dataDir = path.resolve(option('data-dir', path.join(__dirname, '..', 'server', '.data')));
  const store = new PocketCacheStore({ filePath: path.join(dataDir, 'pocket-cache.json') });
  const result = await syncPocket(store, {
    dryRun: process.argv.includes('--dry-run'),
    timeoutMs: Number(option('timeout-ms', 45000)),
    attempts: Number(option('attempts', 3))
  }, { dataDir });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
