const path = require('path');
const { CacheStore } = require('../server/cache-store');
const { PokemonModel3dService } = require('../server/projectpokemon-3d-service');

function parseArgs(argv) {
  const options = {};
  argv.forEach((arg) => {
    if (arg === '--refresh') {
      options.refresh = true;
      return;
    }
    if (arg === '--metadata-only') {
      options.downloadImages = false;
      return;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1];
    const value = match[2];
    if (key === 'generation' || key === 'generations') {
      options.generations = value.split(',').map((item) => Number(item.trim())).filter(Boolean);
      return;
    }
    if (key === 'concurrency') {
      options.concurrency = Number(value);
      return;
    }
    if (key === 'public-base-url') {
      options.publicBaseUrl = value;
      return;
    }
  });
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const dataDir = process.env.POKECHILL_DATA_DIR || path.join(__dirname, '..', 'server', '.data');
  const publicBaseUrl = options.publicBaseUrl || process.env.POKECHILL_PUBLIC_BASE_URL || 'http://127.0.0.1:8787';
  const store = new CacheStore({
    filePath: path.join(dataDir, 'pokedex-cache.json')
  });
  const service = new PokemonModel3dService({
    dataDir,
    publicBaseUrl,
    pokemonStore: store
  });

  console.log('Syncing ProjectPokemon 3D GIF cache...');
  const result = await service.sync(options);
  const item = result.item || {};
  console.log(JSON.stringify({
    ok: result.ok,
    modelCount: item.modelCount,
    pokemonMatchedCount: item.pokemonMatchedCount,
    downloadedCount: item.downloadedCount,
    downloadJobCount: item.downloadJobCount,
    failedCount: item.failedCount,
    syncedAt: item.syncedAt
  }, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
