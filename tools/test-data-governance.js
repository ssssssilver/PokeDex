const assert = require('assert');
const { SOURCES, sourceManifest } = require('../server/data-source-registry');
const { validatePocketSnapshot, validatePtcgSnapshot } = require('../server/data-quality');

assert.strictEqual(SOURCES.ptcgChsReference.enabled, false);
assert.strictEqual(SOURCES.ptcgChsReference.importForbidden, true);
assert.strictEqual(SOURCES.deckgym.enabled, false);
assert.ok(sourceManifest('pocket').some((source) => source.id === 'chase-mew'));

const ptcg = validatePtcgSnapshot([
  { summary: { id: 'set-1', name: 'Card', image_small_remote: 'https://example.test/card.png' } }
], [{ id: 'set' }], { minimumCount: 1 });
assert.strictEqual(ptcg.ok, true);

const pocketCard = {
  id: '1',
  name_en: 'Bulbasaur',
  name_zh: '妙蛙種子',
  image: 'https://example.test/card.png',
  card_type: 'pokemon',
  national_pokedex_number: 1
};
const pocket = validatePocketSnapshot({ cards: [pocketCard] }, { minimumCount: 1 });
assert.strictEqual(pocket.ok, true);
const rejected = validatePocketSnapshot({ cards: [Object.assign({}, pocketCard, { image: '' })] }, { minimumCount: 1 });
assert.strictEqual(rejected.ok, false);
assert.ok(rejected.errors.some((check) => check.id === 'required-card-fields'));

process.stdout.write(`${JSON.stringify({
  ok: true,
  sourceCount: sourceManifest().length,
  enabledSourceCount: sourceManifest().filter((source) => source.enabled).length
}, null, 2)}\n`);
