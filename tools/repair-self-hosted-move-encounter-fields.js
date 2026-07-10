const path = require('path');
const { CacheStore } = require('../server/cache-store');
const {
  buildMoveDetailFields,
  localizeEncounterSummary,
  requestJson,
  versionGroupLabel
} = require('../wechat-miniapp/cloudfunctions/syncPokeapi/lib/pokeapi');

const repoRoot = path.resolve(__dirname, '..');
const dataDir = path.join(repoRoot, 'server', '.data');
const API_BASE = 'https://pokeapi.co/api/v2';

function parseArgs(argv) {
  const args = {
    concurrency: 8,
    timeoutMs: 30000
  };

  argv.forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];
    if (['concurrency', 'timeoutMs'].includes(key)) args[key] = Number(value);
  });

  return args;
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

function buildLearnTime(move) {
  return [
    move.method_name,
    Number(move.level || 0) ? `Lv.${Number(move.level)}` : '',
    move.version_group_name
  ].filter(Boolean).join(' / ');
}

function mergeMove(move, detail) {
  if (!detail) return Object.assign({}, move, {
    version_group_name: move.version_group ? versionGroupLabel(move.version_group) : move.version_group_name,
    learn_time: move.learn_time || buildLearnTime(move)
  });

  const next = Object.assign({}, move, buildMoveDetailFields(move.key, detail), {
    method: move.method,
    method_name: move.method_name,
    level: move.level,
    version_group: move.version_group,
    version_group_name: move.version_group ? versionGroupLabel(move.version_group) : move.version_group_name,
    learn_count: move.learn_count
  });
  next.learn_time = buildLearnTime(next);
  return next;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = new CacheStore({
    filePath: path.join(dataDir, 'pokedex-cache.json')
  });
  const state = store.load();
  const details = Object.values(state.pokemon_detail || {});
  const moveKeys = Array.from(new Set(details.flatMap((pokemon) => (
    (pokemon.moves || []).map((move) => move.key).filter(Boolean)
  )))).sort();
  const startedAt = Date.now();
  const failed = [];
  const rows = await mapLimit(moveKeys, args.concurrency, async (key) => {
    try {
      const detail = await requestJson(`${API_BASE}/move/${encodeURIComponent(key)}`, {
        timeoutMs: args.timeoutMs
      });
      return { key, detail };
    } catch (error) {
      failed.push({ key, message: error.message });
      return { key, detail: null };
    }
  });
  const detailByKey = new Map(rows.map((row) => [row.key, row.detail]));
  let pokemonUpdated = 0;
  let movesUpdated = 0;
  let encountersUpdated = 0;

  details.forEach((pokemon) => {
    const moves = pokemon.moves || [];
    if (moves.length) {
      pokemon.moves = moves.map((move) => {
        movesUpdated += 1;
        return mergeMove(move, detailByKey.get(move.key));
      });
      pokemon.moves_summary = pokemon.moves.slice(0, 8).map((move) => move.name);
    }

    if (pokemon.encounters) {
      pokemon.encounters = localizeEncounterSummary(pokemon.encounters);
      encountersUpdated += 1;
    }

    const summary = state.pokemon_summary[String(pokemon.id)];
    if (summary) {
      summary.moves_summary = pokemon.moves_summary || summary.moves_summary;
      summary.move_count = pokemon.move_count || summary.move_count;
    }
    pokemonUpdated += 1;
  });

  store.save();
  console.log(JSON.stringify({
    ok: true,
    pokemonUpdated,
    movesUpdated,
    encountersUpdated,
    uniqueMoves: moveKeys.length,
    failedCount: failed.length,
    failed: failed.slice(0, 10),
    durationMs: Date.now() - startedAt,
    cacheFile: store.filePath
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
