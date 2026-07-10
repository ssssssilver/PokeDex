const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'oss'));
const config = require('../wechat-miniapp/miniprogram/config');
const apiSource = fs.readFileSync(path.join(__dirname, '..', 'wechat-miniapp', 'miniprogram', 'services', 'api.js'), 'utf8');
assert(!/^(?:const|let|var)\s+staticApi\s*=\s*require\(['"]\.\/static-api['"]\)/m.test(apiSource), 'static API must not be eagerly required');
config.useStaticApi = true;
config.useRemoteApi = false;
config.useCloudApi = false;
config.staticBaseUrl = 'https://oss.test/pokechill';

let requestCount = 0;
global.wx = {
  request(options) {
    requestCount += 1;
    try {
      const url = new URL(options.url);
      const relative = decodeURIComponent(url.pathname.replace(/^\/pokechill\//, ''));
      const filePath = path.join(root, ...relative.split('/'));
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      options.success({ statusCode: 200, data });
    } catch (error) {
      if (options.fail) options.fail(error);
    }
  }
};

const staticApi = require('../wechat-miniapp/miniprogram/services/static-api');

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.schemaVersion, 1);
  assert.strictEqual(manifest.datasets.pokemon.count, 1025);
  assert.strictEqual(manifest.datasets.ptcg.count, 20359);
  assert.strictEqual(manifest.datasets.pocket.count, 3305);

  const pokemonPage = await staticApi.call('listPokemon', { page: 1, pageSize: 40, sort: 'id', pokedex: 'national' });
  assert.strictEqual(pokemonPage.items.length, 40);
  assert.strictEqual(pokemonPage.total, 1025);
  assert.strictEqual(pokemonPage.items[0].id, 1);
  assert(requestCount <= 2, `default Pokemon page used ${requestCount} requests`);
  const allPokemon = await staticApi.call('listPokemon', { sort: 'id' });
  assert.strictEqual(allPokemon.items.length, 1025);
  assert.strictEqual(allPokemon.hasMore, false);

  const pokemonDetail = await staticApi.call('getPokemon', { id: 1 });
  assert.strictEqual(pokemonDetail.item.id, 1);
  assert(pokemonDetail.item.model3d);
  assert(String(pokemonDetail.item.model3d.image).startsWith(config.staticBaseUrl));

  const pokemonFilter = await staticApi.call('listPokemon', { keyword: '\u76ae\u5361\u4e18', page: 1, pageSize: 40 });
  assert(pokemonFilter.items.some((item) => Number(item.id) === 25));

  const cardPage = await staticApi.call('listCards', { page: 1, pageSize: 30, sort: 'releaseDate' });
  assert.strictEqual(cardPage.items.length, 30);
  assert.strictEqual(cardPage.total, 20359);
  const cardDetail = await staticApi.call('getCard', { id: cardPage.items[0].id });
  assert(cardDetail.item && cardDetail.item.id === cardPage.items[0].id);
  const cardQuizRequestStart = requestCount;
  const cardQuiz = await staticApi.call('getDailyCardQuiz', {});
  assert.strictEqual(cardQuiz.item.options.length, 4);
  assert(requestCount - cardQuizRequestStart <= 4, 'daily card quiz should read at most four list chunks');
  const cardSearch = await staticApi.call('listCards', { keyword: 'Pikachu', page: 1, pageSize: 20 });
  assert(cardSearch.total > 0);
  const relatedCards = await staticApi.call('getPokemonCards', { id: 25, page: 1, pageSize: 6 });
  assert(relatedCards.total > 0);

  const pocketPage = await staticApi.call('listPocketCards', { page: 1, pageSize: 30, sort: 'number' });
  assert.strictEqual(pocketPage.items.length, 30);
  assert.strictEqual(pocketPage.total, 3305);
  const pocketSearch = await staticApi.call('listPocketCards', { keyword: '\u5999\u86d9', page: 1, pageSize: 20 });
  assert(pocketSearch.total > 0);
  const pikachuPocketCards = await staticApi.call('listPocketCards', { pokemonId: 25, page: 1, pageSize: 100 });
  assert(pikachuPocketCards.total > 0);
  assert(pikachuPocketCards.items.every((card) => /^Pikachu(?: ex)?$/i.test(card.name_en)),
    `Pikachu Pocket relation contains unrelated cards: ${pikachuPocketCards.items.map((card) => `${card.name_en}:${card.national_pokedex_number}`).join(', ')}`);
  const scytherPocketCards = await staticApi.call('listPocketCards', { pokemonId: 123, page: 1, pageSize: 100 });
  assert(scytherPocketCards.items.every((card) => /^Scyther(?: ex)?$/i.test(card.name_en)),
    `Scyther Pocket relation contains unrelated cards: ${scytherPocketCards.items.map((card) => `${card.name_en}:${card.national_pokedex_number}`).join(', ')}`);
  const pocketDetail = await staticApi.call('getPocketCard', { id: pocketSearch.items[0].id });
  assert(pocketDetail.item);

  const [types, ptcgMeta, pocketMeta, events, decks, pocketDecks] = await Promise.all([
    staticApi.call('getTypes', {}),
    staticApi.call('getPtcgMeta', {}),
    staticApi.call('getPocketMeta', {}),
    staticApi.call('listPocketEvents', { page: 1, pageSize: 8 }),
    staticApi.call('getHotDecks', { limit: 4 }),
    staticApi.call('listPocketHotDecks', { page: 1, pageSize: 10 })
  ]);
  assert(types.items.length >= 18);
  assert(ptcgMeta.item.sets.length > 100);
  assert.strictEqual(pocketMeta.counts.cards, 3305);
  assert(events.items.length > 0);
  assert.strictEqual(decks.items.length, 4);
  assert(pocketDecks.total >= 300);

  const quiz = await staticApi.call('getDailyQuiz', { seed: 'pokemon-random-a' });
  const nextQuiz = await staticApi.call('getDailyQuiz', { seed: 'pokemon-random-b' });
  assert.strictEqual(quiz.item.options.length, 4);
  assert.strictEqual(nextQuiz.item.options.length, 4);
  assert.notStrictEqual(quiz.item.answerId, nextQuiz.item.answerId, 'Pokemon quiz seeds should produce independent questions');
  const team = await staticApi.call('analyzeTeam', { ids: [1, 6, 25] });
  assert.strictEqual(team.item.members.length, 3);
  const physicalPack = await staticApi.call('openCardPack', { setId: cardPage.items[0].set_id, count: 10 });
  assert.strictEqual(physicalPack.item.cards.length, 10);
  const packs = await staticApi.call('listPocketPacks', { page: 1, pageSize: 100 });
  const regular = packs.items.find((item) => item.is_regular) || packs.items[0];
  const pocketPack = await staticApi.call('openPocketPack', { packId: regular.id });
  assert(pocketPack.item.cards.length >= 5);
  const promo = packs.items.find((item) => item.is_promo);
  assert(promo);
  const promoPack = await staticApi.call('openPocketPack', { packId: promo.id });
  assert.strictEqual(promoPack.item.cards.length, 1);
  const deckDetail = await staticApi.call('getHotDeckDetail', { url: decks.items[0].url });
  assert(deckDetail.item && deckDetail.item.sections.length > 0);
  const pocketDeckDetail = await staticApi.call('getPocketHotDeck', { id: pocketDecks.items[0].id });
  assert(pocketDeckDetail.item && pocketDeckDetail.item.cards.length > 0);

  const files = fs.readdirSync(path.join(root, manifest.releaseBase, 'ptcg', 'list'));
  assert.strictEqual(files.length, manifest.datasets.ptcg.listChunks);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    version: manifest.version,
    requests: requestCount,
    counts: {
      pokemon: pokemonPage.total,
      ptcg: cardPage.total,
      pocket: pocketPage.total,
      pocketDecks: pocketDecks.total
    }
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
