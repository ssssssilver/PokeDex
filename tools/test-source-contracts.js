const assert = require('assert');
const { SOURCE_URLS, normalizeHotDecks } = require('../server/pocket-source');

assert.ok(!SOURCE_URLS.chaseCards.includes('/main/'), 'chase-mew source must be pinned');
assert.ok(!SOURCE_URLS.flibustierSets.includes('/main/'), 'flibustier source must be pinned');

const html = `
  <div>1 tournaments, 2 players, 3 matches</div>
  <table class="meta"><tr>
    <td>1</td><td><img src="/img/pikachu.png"></td>
    <td><a href="/decks/pikachu-ex">Pikachu ex</a></td>
    <td>120</td><td>12.5%</td><td>30 - 20 - 1</td><td>60%</td>
  </tr></table>`;
const parsed = normalizeHotDecks(html);
assert.strictEqual(parsed.items.length, 1);
assert.strictEqual(parsed.items[0].id, 'pikachu-ex');
assert.strictEqual(parsed.items[0].wins, 30);
assert.throws(() => normalizeHotDecks('<html></html>'), /table was not found/);

process.stdout.write(`${JSON.stringify({ ok: true, deckCount: parsed.items.length }, null, 2)}\n`);
