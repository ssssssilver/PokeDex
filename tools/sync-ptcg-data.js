const path = require('path');
const { PtcgCacheStore } = require('../server/ptcg-cache-store');
const { syncPtcg } = require('../server/ptcg-sync');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

async function main() {
  const dataDir = path.resolve(option('data-dir', path.join(__dirname, '..', 'server', '.data')));
  const store = new PtcgCacheStore({ filePath: path.join(dataDir, 'ptcg-cache.json') });
  const result = await syncPtcg(store, {
    full: !process.argv.includes('--incremental'),
    dryRun: process.argv.includes('--dry-run'),
    pageSize: Number(option('page-size', 250)),
    timeoutMs: Number(option('timeout-ms', 30000)),
    attempts: Number(option('attempts', 3))
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
