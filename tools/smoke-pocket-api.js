const path = require('path');
const { createApp } = require('../server');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function postJson(baseUrl, pathname, data) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {})
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname} returned ${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

async function main() {
  const app = createApp({
    host: '127.0.0.1',
    port: 0,
    publicBaseUrl: 'http://127.0.0.1',
    dataDir: path.join(__dirname, '..', 'server', '.data')
  });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });
  const baseUrl = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const meta = await json(baseUrl, '/api/pocket/meta');
    const cards = await json(baseUrl, '/api/pocket/cards?q=Bulbasaur&pageSize=2');
    const chineseSearch = await json(baseUrl, `/api/pocket/cards?keyword=${encodeURIComponent('妙蛙種子')}&pageSize=20`);
    const expansionFilter = await json(baseUrl, '/api/pocket/cards?expansion=A1a&pageSize=20');
    const trainerFilter = await json(baseUrl, '/api/pocket/cards?type=trainer&pageSize=20');
    const pullRates = await json(baseUrl, '/api/pocket/pull-rates?expansion=A1');
    const detail = await json(baseUrl, '/api/pocket/cards/PK_10_000010_00');
    const events = await json(baseUrl, '/api/pocket/events?status=upcoming&pageSize=50');
    const missions = await json(baseUrl, '/api/pocket/missions?pageSize=20');
    const wonderPicks = await json(baseUrl, '/api/pocket/wonder-picks?pageSize=20');
    const hotDecks = await json(baseUrl, '/api/pocket/hot-decks?pageSize=20');
    const hotDeckDetail = await json(baseUrl, `/api/pocket/hot-decks/${encodeURIComponent(hotDecks.items[0].id)}`);
    const packs = await json(baseUrl, '/api/pocket/packs?pageSize=100');
    const regularPack = packs.items.find((pack) => pack.is_regular && !pack.is_promo);
    const promoPack = packs.items.find((pack) => pack.is_promo);
    const openedPack = await postJson(baseUrl, '/api/pocket/open-pack', { packId: regularPack.id });
    const openedPromoPack = await postJson(baseUrl, '/api/pocket/open-pack', { packId: promoPack.id });
    const relatedCards = await json(baseUrl, '/api/pocket/cards?pokemonId=1&pageSize=20');
    const cardImage = await fetch(`${baseUrl}/assets/pocket/cards/PK_10_000010_00`);
    const packImage = await fetch(`${baseUrl}/assets/pocket/packs/${encodeURIComponent(promoPack.id)}`);

    assert(meta.counts.cards >= 3000, 'Pocket meta card count is incomplete');
    assert(Object.keys(meta.sources || {}).length === 11, 'Pocket source metadata is incomplete');
    assert(cards.total > 0, 'Pocket card search returned no data');
    assert(chineseSearch.total > 0, 'Pocket Chinese card search returned no data');
    assert(expansionFilter.total > 0 && expansionFilter.items.every((card) => card.collections.some((entry) => entry.expansion_id === 'A1a')), 'Pocket expansion filter is ineffective');
    assert(trainerFilter.total > 0 && trainerFilter.items.every((card) => card.card_type === 'trainer'), 'Pocket card-type filter is ineffective');
    assert(pullRates.item, 'Pocket pull rates are unavailable');
    assert(detail.item && detail.item.name_zh === '妙蛙種子', 'Pocket Chinese card detail is unavailable');
    assert(detail.item.attacks[0].name_zh === '藤鞭', 'Pocket Chinese attack name is unavailable');
    assert(events.total > 0, 'Pocket upcoming events are unavailable');
    assert(missions.total > 0, 'Pocket missions are unavailable');
    assert(wonderPicks.total > 0, 'Pocket wonder picks are unavailable');
    assert(hotDecks.total >= 20, 'Pocket hot decks are unavailable');
    assert(hotDecks.items.every((deck) => deck.images.length && deck.images.every((image) => image.includes('/assets/limitless/pokemon/'))), 'Pocket hot-deck icons are not self-hosted');
    assert(hotDeckDetail.item && hotDeckDetail.item.total_cards === 20, 'Pocket hot-deck detail is unavailable');
    assert(hotDeckDetail.item.cards.every((card) => card.name_zh && card.image), 'Pocket hot-deck cards are not localized');
    assert(openedPack.item && openedPack.item.cards.length >= 5 && openedPack.item.count === openedPack.item.cards.length,
      'Pocket regular pack simulation returned an invalid card count');
    assert(openedPromoPack.item && openedPromoPack.item.cards.length === 1, 'Pocket promo pack did not return exactly one card');
    assert(openedPromoPack.item.is_promo && !openedPromoPack.item.is_rare_pack, 'Pocket promo pack was incorrectly treated as a rare pack');
    assert(relatedCards.total > 0 && relatedCards.items.every((card) => card.national_pokedex_number === 1), 'Pocket cards cannot be linked by National Pokédex number');
    assert(cardImage.ok && Number(cardImage.headers.get('content-length') || 1) > 0, 'Pocket card image proxy is unavailable');
    assert(packImage.ok && Number(packImage.headers.get('content-length') || 1) > 0, 'Pocket pack image proxy is unavailable');

    process.stdout.write(`${JSON.stringify({
      ok: true,
      baseUrl,
      cards: meta.counts.cards,
      packs: meta.counts.packs,
      events: meta.counts.events,
      searchTotal: cards.total,
      chineseSearchTotal: chineseSearch.total,
      expansionFilterTotal: expansionFilter.total,
      trainerFilterTotal: trainerFilter.total,
      sampleCard: detail.item.name_zh,
      sampleAttack: detail.item.attacks[0].name_zh,
      upcomingEvents: events.total,
      missions: missions.total,
      wonderPicks: wonderPicks.total,
      hotDecks: hotDecks.total,
      sampleHotDeckCards: hotDeckDetail.item.total_cards,
      openedPackCards: openedPack.item.cards.length,
      openedPackType: openedPack.item.pack_type,
      openedPromoPackCards: openedPromoPack.item.cards.length,
      relatedBulbasaurCards: relatedCards.total
    }, null, 2)}\n`);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
