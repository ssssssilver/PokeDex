const path = require('path');
const { CacheStore } = require('../server/cache-store');
const { PocketCacheStore } = require('../server/pocket-cache-store');
const { buildNationalDexResolver } = require('../server/pocket-source');

const dataDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'server', '.data'));
const pokemonStore = new CacheStore({ filePath: path.join(dataDir, 'pokedex-cache.json') });
const pocketStore = new PocketCacheStore({ filePath: path.join(dataDir, 'pocket-cache.json') });
const resolveNationalDexNumber = buildNationalDexResolver(pokemonStore.getSummaries());
const state = pocketStore.load();
const cards = Object.values(state.cards || {});
let changed = 0;
let pokemonCards = 0;
const unmatched = [];

cards.forEach((card) => {
  if (card.card_type !== 'pokemon') {
    card.national_pokedex_number = null;
    return;
  }
  pokemonCards += 1;
  const next = resolveNationalDexNumber(card);
  if (!next) {
    if (unmatched.length < 30) unmatched.push({ id: card.id, name_en: card.name_en, name_zh: card.name_zh });
    return;
  }
  if (Number(card.national_pokedex_number || 0) !== next) changed += 1;
  card.national_pokedex_number = next;
  card.provenance = Object.assign({}, card.provenance, {
    national_pokedex_number: 'pokedex-name-map'
  });
});

if (unmatched.length) {
  throw new Error(`Unable to map ${unmatched.length} Pocket Pokemon cards: ${JSON.stringify(unmatched)}`);
}

pocketStore.save();
process.stdout.write(`${JSON.stringify({
  ok: true,
  cards: cards.length,
  pokemonCards,
  changed,
  unmatched: 0,
  cacheFile: pocketStore.filePath
}, null, 2)}\n`);
