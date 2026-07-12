const fs = require('fs');
const path = require('path');
const {
  SOURCE_URLS,
  extractRaenonxMessages,
  normalizePocketData,
  requestJson,
  requestText
} = require('./pocket-source');
const { validatePocketSnapshot } = require('./data-quality');

const SOURCE_PLAN = [
  { name: 'raenonxMaster', format: 'json' },
  { name: 'raenonxEvents', format: 'json' },
  { name: 'raenonxLocale', format: 'html' },
  { name: 'raenonxLocaleEn', format: 'html' },
  { name: 'chaseCards', format: 'json' },
  { name: 'chaseExpansions', format: 'json' },
  { name: 'flibustierSets', format: 'json' },
  { name: 'flibustierRarities', format: 'json' },
  { name: 'flibustierPullRates', format: 'json' },
  { name: 'limitlessDecks', format: 'html' }
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeAtomic(filePath, content) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, filePath);
}

function runId() {
  return `pocket-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function sourcePath(dataDir, source) {
  return path.join(dataDir, 'pocket-sources', `${source.name}.${source.format === 'html' ? 'html' : 'json'}`);
}

function parseSource(source, text) {
  return source.format === 'json' ? JSON.parse(text) : text;
}

function loadPokedexRows(dataDir) {
  const filePath = path.join(dataDir, 'pokedex-cache.json');
  const cache = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const rows = Object.values(cache.pokemon_summary || {});
  if (!rows.length) throw new Error(`Pokedex cache has no Pokemon summaries: ${filePath}`);
  return rows;
}

async function fetchSource(source, options) {
  const filePath = sourcePath(options.dataDir, source);
  try {
    const resource = source.format === 'json'
      ? await requestJson(SOURCE_URLS[source.name], options)
      : await requestText(SOURCE_URLS[source.name], Object.assign({}, options, { accept: 'text/html' }));
    if (!options.dryRun) writeAtomic(filePath, resource.text);
    return {
      name: source.name,
      data: source.format === 'json' ? resource.data : resource.text,
      meta: {
        source: source.name,
        url: resource.url,
        status: 'fresh',
        fetchedAt: resource.fetchedAt,
        bytes: resource.bytes,
        sha256: resource.sha256,
        etag: resource.etag,
        lastModified: resource.lastModified,
        snapshotFile: filePath
      }
    };
  } catch (error) {
    if (!fs.existsSync(filePath)) throw error;
    const text = fs.readFileSync(filePath, 'utf8');
    return {
      name: source.name,
      data: parseSource(source, text),
      meta: {
        source: source.name,
        url: SOURCE_URLS[source.name],
        status: 'stale-cache',
        fetchedAt: fs.statSync(filePath).mtime.toISOString(),
        bytes: Buffer.byteLength(text),
        error: error.message,
        snapshotFile: filePath
      }
    };
  }
}

function counts(snapshot) {
  return {
    cardCount: snapshot.cards.length,
    expansionCount: snapshot.expansions.length,
    packCount: snapshot.packs.length,
    eventCount: snapshot.events.length,
    missionCount: snapshot.collections.missions.length,
    battleCount: snapshot.collections.battles.length,
    shopCount: snapshot.collections.shops.length,
    wonderPickCount: snapshot.collections.wonder_picks.length,
    profileDecorationCount: snapshot.collections.profile_decorations.length,
    peripheralGoodsCount: snapshot.collections.peripheral_goods.length,
    rentalDeckCount: snapshot.collections.rental_decks.length,
    presetDeckCount: snapshot.collections.preset_decks.length,
    hotDeckCount: snapshot.collections.hot_decks.length
  };
}

async function syncPocket(store, event = {}, context = {}) {
  const id = runId();
  const startedAt = new Date();
  const options = {
    dataDir: context.dataDir || path.join(__dirname, '.data'),
    dryRun: Boolean(event.dryRun),
    timeoutMs: Number(event.timeoutMs || 45000),
    attempts: Number(event.attempts || 3),
    userAgent: event.userAgent || 'PokeChill/1.0 (+local Pocket data cache)'
  };
  const running = {
    runId: id,
    status: 'running',
    source: 'multi-source-pocket',
    startedAt,
    dryRun: options.dryRun
  };
  store.setMeta('pocket', running);
  store.writeRun(id, running);

  try {
    const resources = await Promise.all(SOURCE_PLAN.map((source) => fetchSource(source, options)));
    const payload = Object.fromEntries(resources.map((resource) => [resource.name, resource.data]));
    payload.locale = extractRaenonxMessages(payload.raenonxLocale);
    payload.localeEn = extractRaenonxMessages(payload.raenonxLocaleEn);
    payload.pokedex = loadPokedexRows(options.dataDir);
    const normalized = normalizePocketData(payload);
    normalized.sourceMeta = Object.fromEntries(resources.map((resource) => [resource.name, resource.meta]));
    const staleSourceCount = resources.filter((resource) => resource.meta.status !== 'fresh').length;
    const quality = validatePocketSnapshot(normalized, {
      minimumCount: Number(event.minimumCardCount || 3000),
      previousCount: store.getCards().length,
      staleSourceCount,
      maxCountChangeRatio: Number(event.maxCountChangeRatio || 0.2)
    });
    if (!quality.ok) throw new Error(`Pocket quality gate failed: ${quality.errors.map((check) => check.id).join(', ')}`);
    normalized.release = {
      id,
      source: 'multi-source-pocket',
      publishedAt: new Date().toISOString(),
      quality
    };
    if (!options.dryRun) store.replaceSnapshot(normalized);

    const finishedAt = new Date();
    const summary = Object.assign({
      ok: true,
      runId: id,
      status: 'success',
      source: 'multi-source-pocket',
      startedAt,
      finishedAt,
      syncedAt: finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      dryRun: options.dryRun,
      staleSourceCount,
      quality,
      sources: normalized.sourceMeta,
      localeCounts: normalized.auxiliary.locale_counts
    }, counts(normalized));
    store.setMeta('pocket', summary);
    store.writeRun(id, summary);
    return summary;
  } catch (error) {
    const finishedAt = new Date();
    const summary = {
      ok: false,
      runId: id,
      status: 'failed',
      source: 'multi-source-pocket',
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      dryRun: options.dryRun,
      message: error.message || 'Pocket sync failed'
    };
    store.setMeta('pocket', summary);
    store.writeRun(id, summary);
    return summary;
  }
}

module.exports = {
  SOURCE_PLAN,
  syncPocket
};
