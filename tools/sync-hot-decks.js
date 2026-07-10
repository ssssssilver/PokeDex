const path = require('path');
const { HotDeckService } = require('../server/deck-service');
const { PocketCacheStore } = require('../server/pocket-cache-store');
const { PocketDeckService } = require('../server/pocket-deck-service');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

async function runPool(items, concurrency, handler) {
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await handler(items[index], index);
    }
  }));
}

async function main() {
  const dataDir = path.resolve(option('data-dir', path.join(__dirname, '..', 'server', '.data')));
  const target = option('target', 'all');
  const limit = Math.max(0, Number(option('limit', 0)));
  // Both deck services persist a shared JSON object; serialize writes to avoid lost updates.
  const concurrency = 1;
  const refresh = process.argv.includes('--refresh');
  const stats = { physical: { total: 0, synced: 0, failed: 0 }, pocket: { total: 0, synced: 0, failed: 0 }, failures: [] };

  if (target === 'all' || target === 'ptcg') {
    const service = new HotDeckService({ dataDir, publicBaseUrl: '' });
    const result = await service.listHotDecks({ limit: 25, refresh });
    const decks = limit ? result.items.slice(0, limit) : result.items;
    stats.physical.total = decks.length;
    await runPool(decks, concurrency, async (deck) => {
      try {
        await service.getDeckDetail({ url: deck.url, name: deck.name, rank: deck.rank, refresh });
        stats.physical.synced += 1;
      } catch (error) {
        stats.physical.failed += 1;
        if (stats.failures.length < 20) stats.failures.push(`PTCG ${deck.name}: ${error.message}`);
      }
    });
  }

  if (target === 'all' || target === 'pocket') {
    const store = new PocketCacheStore({ filePath: path.join(dataDir, 'pocket-cache.json') });
    const service = new PocketDeckService(store, { dataDir, publicBaseUrl: '' });
    const allDecks = store.getCollection('hot_decks');
    const decks = limit ? allDecks.slice(0, limit) : allDecks;
    stats.pocket.total = decks.length;
    await runPool(decks, concurrency, async (deck) => {
      try {
        await service.getDetail(deck.id, { refresh });
        stats.pocket.synced += 1;
      } catch (error) {
        stats.pocket.failed += 1;
        if (stats.failures.length < 20) stats.failures.push(`Pocket ${deck.name}: ${error.message}`);
      }
    });
  }

  const ok = stats.physical.failed === 0 && stats.pocket.failed === 0;
  process.stdout.write(`${JSON.stringify({ ok, stats }, null, 2)}\n`);
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
