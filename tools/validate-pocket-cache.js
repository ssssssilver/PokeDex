const path = require('path');
const { CacheStore } = require('../server/cache-store');
const { PocketCacheStore } = require('../server/pocket-cache-store');
const { buildNationalDexResolver } = require('../server/pocket-source');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function check(condition, message, evidence) {
  if (!condition) {
    const error = new Error(message);
    error.evidence = evidence;
    throw error;
  }
}

function main() {
  const dataDir = path.resolve(option('data-dir', path.join(__dirname, '..', 'server', '.data')));
  const store = new PocketCacheStore({ filePath: path.join(dataDir, 'pocket-cache.json') });
  const pokemonStore = new CacheStore({ filePath: path.join(dataDir, 'pokedex-cache.json') });
  const cards = store.getCards();
  const pokemonCards = cards.filter((card) => card.card_type === 'pokemon');
  const resolveNationalDexNumber = buildNationalDexResolver(pokemonStore.getSummaries());
  const dexMappingMismatches = pokemonCards.filter((card) =>
    Number(card.national_pokedex_number || 0) !== Number(resolveNationalDexNumber(card) || 0));
  const associationSamples = Object.fromEntries([1, 25, 95, 123, 150].map((id) => [
    id,
    Array.from(new Set(pokemonCards
      .filter((card) => Number(card.national_pokedex_number) === id)
      .map((card) => card.name_en)))
  ]));
  const packs = store.getPacks();
  const events = store.getEvents();
  const sources = store.getSourceMeta();
  const metrics = {
    cards: cards.length,
    cardsWithChineseName: cards.filter((card) => card.name_zh).length,
    cardsWithEnglishName: cards.filter((card) => card.name_en).length,
    cardsWithImage: cards.filter((card) => card.image).length,
    cardsWithRules: cards.filter((card) => card.rules).length,
    expansions: store.getExpansions().length,
    packs: packs.length,
    packsWithImage: packs.filter((pack) => pack.image).length,
    promoPacks: packs.filter((pack) => pack.is_promo).length,
    pokemonCards: pokemonCards.length,
    pokemonCardsWithDexNumber: pokemonCards.filter((card) => card.national_pokedex_number).length,
    dexMappingMismatchCount: dexMappingMismatches.length,
    associationSamples,
    events: events.length,
    missions: store.getCollection('missions').length,
    battles: store.getCollection('battles').length,
    shops: store.getCollection('shops').length,
    wonderPicks: store.getCollection('wonder_picks').length,
    hotDecks: store.getCollection('hot_decks').length,
    sourceCount: Object.keys(sources).length,
    staleSources: Object.values(sources).filter((source) => source.status !== 'fresh').map((source) => source.source),
    pullRateSets: Object.keys(store.getAuxiliary('pull_rates') || {}).length
  };

  check(metrics.cards >= 3000, 'Pocket card cache is unexpectedly small', metrics.cards);
  check(metrics.cardsWithChineseName === metrics.cards, 'Some Pocket cards have no Chinese name', metrics);
  check(metrics.cardsWithEnglishName === metrics.cards, 'Some Pocket cards have no English fallback name', metrics);
  check(metrics.cardsWithImage === metrics.cards, 'Some Pocket cards have no image', metrics);
  check(metrics.cardsWithRules === metrics.cards, 'Some Pocket cards have no DeckGym rule data', metrics);
  check(metrics.expansions >= 20 && metrics.packs >= 50, 'Pocket expansion or pack coverage is incomplete', metrics);
  check(metrics.packsWithImage === metrics.packs, 'Some Pocket packs have no image', metrics);
  check(metrics.promoPacks > 0, 'Pocket promo packs are not identified', metrics);
  check(metrics.pokemonCardsWithDexNumber === metrics.pokemonCards, 'Some Pocket Pokemon cards have no National Pokedex mapping', metrics);
  check(metrics.dexMappingMismatchCount === 0, 'Pocket card National Pokedex mappings do not match card names', dexMappingMismatches.slice(0, 20));
  check((associationSamples[25] || []).every((name) => /^Pikachu(?: ex)?$/i.test(name)), 'Pikachu has unrelated Pocket cards', associationSamples[25]);
  check((associationSamples[95] || []).every((name) => /^Onix(?: ex)?$/i.test(name)), 'Onix has unrelated Pocket cards', associationSamples[95]);
  check((associationSamples[123] || []).every((name) => /^Scyther(?: ex)?$/i.test(name)), 'Scyther has unrelated Pocket cards', associationSamples[123]);
  check((associationSamples[150] || []).every((name) => /^Mewtwo(?: ex)?$/i.test(name)), 'Mewtwo has unrelated Pocket cards', associationSamples[150]);
  check(metrics.events > 0 && metrics.missions > 0 && metrics.battles > 0, 'Pocket live operation data is incomplete', metrics);
  check(metrics.shops > 0 && metrics.wonderPicks > 0, 'Pocket shop or wonder-pick data is incomplete', metrics);
  check(metrics.sourceCount === 11, 'Not all configured Pocket sources were recorded', metrics);
  check(metrics.hotDecks >= 20, 'Pocket hot-deck data is incomplete', metrics.hotDecks);
  check(metrics.pullRateSets >= 15, 'Pocket pull-rate data is incomplete', metrics.pullRateSets);

  process.stdout.write(`${JSON.stringify({ ok: true, metrics }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    message: error.message,
    evidence: error.evidence || null
  }, null, 2));
  process.exitCode = 1;
}
