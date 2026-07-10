const fs = require('fs');
const path = require('path');
const {
  buildSyncPlan,
  createPokeapiClient,
  transformPokemonBundle
} = require('../wechat-miniapp/cloudfunctions/syncPokeapi/lib/pokeapi');

function parseArgs(argv) {
  const options = {
    limit: 1025,
    startId: 1,
    concurrency: 4,
    timeoutMs: 15000,
    output: path.resolve(__dirname, '../wechat-miniapp/miniprogram/data/generated-pokemon.js'),
    dryRun: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--limit' && next) {
      options.limit = Number(next);
      index += 1;
    } else if (arg === '--start-id' && next) {
      options.startId = Number(next);
      index += 1;
    } else if (arg === '--end-id' && next) {
      options.endId = Number(next);
      index += 1;
    } else if (arg === '--concurrency' && next) {
      options.concurrency = Number(next);
      index += 1;
    } else if (arg === '--timeout-ms' && next) {
      options.timeoutMs = Number(next);
      index += 1;
    } else if (arg === '--output' && next) {
      options.output = path.resolve(next);
      index += 1;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
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

function renderSnapshotModule(snapshot) {
  return [
    'module.exports = ',
    JSON.stringify(snapshot, null, 2),
    ';\n'
  ].join('');
}

async function main() {
  const args = parseArgs(process.argv);
  const plan = buildSyncPlan({
    startId: args.startId,
    endId: args.endId,
    limit: args.limit,
    concurrency: args.concurrency,
    timeoutMs: args.timeoutMs,
    dryRun: true
  });

  const failed = [];
  const pokeapi = createPokeapiClient({
    timeoutMs: plan.timeoutMs,
    userAgent: plan.userAgent
  });
  const pokemon = await mapLimit(plan.ids, plan.concurrency, async (id) => {
    try {
      const bundle = await pokeapi.fetchPokemonBundle(id);
      const transformed = transformPokemonBundle(bundle);
      return transformed.detail;
    } catch (error) {
      failed.push({ id, message: error.message });
      return null;
    }
  });

  const items = pokemon.filter(Boolean).sort((a, b) => a.id - b.id);
  const snapshot = {
    generatedAt: new Date().toISOString(),
    source: 'pokeapi',
    startId: plan.startId,
    endId: plan.endId,
    count: items.length,
    evolutionCacheSize: pokeapi.evolutionCache.size,
    moveCacheSize: pokeapi.moveCache ? pokeapi.moveCache.size : 0,
    failed,
    pokemon: items
  };

  if (args.dryRun) {
    console.log(JSON.stringify({
      output: args.output,
      count: snapshot.count,
      failedCount: failed.length,
      evolutionCacheSize: snapshot.evolutionCacheSize,
      moveCacheSize: snapshot.moveCacheSize,
      first: items[0] ? {
        id: items[0].id,
        name_zh: items[0].name_zh,
        name_en: items[0].name_en,
        evolution_chain: items[0].evolution_chain
      } : null
    }, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, renderSnapshotModule(snapshot), 'utf8');
  console.log(`Wrote ${items.length} Pokemon to ${args.output}`);
  if (failed.length) {
    console.log(`Failed: ${failed.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
