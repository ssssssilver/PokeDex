const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'wechat-miniapp', 'miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const expectedPages = [
  'pages/pocket/index',
  'pages/pocket-carddex/index',
  'pages/pocket-card-detail/index',
  'pages/pocket-events/index',
  'pages/pocket-hot-decks/index',
  'pages/pocket-deck-detail/index',
  'pages/pocket-pack/index'
];
const expectedApiMethods = [
  'listPocketCards', 'getPocketCard', 'getPocketMeta', 'listPocketExpansions',
  'listPocketPacks', 'getPocketPullRates', 'getPocketRarities', 'openPocketPack',
  'listPocketEvents', 'listPocketMissions', 'listPocketBattles', 'listPocketShops',
  'listPocketWonderPicks', 'listPocketHotDecks', 'getPocketHotDeck'
];

function check(condition, label, details = '') {
  return { ok: Boolean(condition), label, details };
}

function balancedWxml(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const stack = [];
  for (const match of source.matchAll(/<\/?([a-zA-Z][\w-]*)(?:\s[^<>]*?)?\/?\s*>/g)) {
    const raw = match[0];
    const tag = match[1];
    if (raw.startsWith('</')) {
      if (stack.pop() !== tag) return false;
    } else if (!/\/\s*>$/.test(raw) && !['input', 'image'].includes(tag)) {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

const api = require(path.join(root, 'services', 'api'));
const checks = [];
checks.push(check(app.tabBar.list.length === 5, 'tab bar uses all five supported slots', `actual=${app.tabBar.list.length}`));
checks.push(check(app.tabBar.list.some((item) => item.pagePath === 'pages/pocket/index'), 'Pocket is an independent tab'));
checks.push(check(app.tabBar.list[3].pagePath === 'pages/pocket/index', 'Pocket tab is immediately before profile'));
checks.push(check(app.tabBar.list.find((item) => item.pagePath === 'pages/pocket/index').text === 'Pocket图鉴', 'Pocket tab is labeled as a dex'));
checks.push(check(app.tabBar.list.every((item) => item.iconPath && item.selectedIconPath), 'every tab has normal and selected icons'));

expectedPages.forEach((page) => {
  checks.push(check(app.pages.includes(page), `${page} is registered`));
  ['js', 'json', 'wxml', 'wxss'].forEach((extension) => {
    const filePath = path.join(root, `${page}.${extension}`);
    checks.push(check(fs.existsSync(filePath), `${page}.${extension} exists`));
    if (extension === 'wxml' && fs.existsSync(filePath)) {
      checks.push(check(balancedWxml(filePath), `${page}.wxml has balanced tags`));
    }
  });
});

expectedApiMethods.forEach((method) => {
  checks.push(check(typeof api[method] === 'function', `Pocket API method ${method} is exported`));
});

const pocketSources = expectedPages.map((page) => fs.readFileSync(path.join(root, `${page}.js`), 'utf8')).join('\n');
const pocketTabWxml = fs.readFileSync(path.join(root, 'pages', 'pocket', 'index.wxml'), 'utf8');
const pokemonDetailWxml = fs.readFileSync(path.join(root, 'pages', 'pokemon-detail', 'index.wxml'), 'utf8');
checks.push(check(!pocketSources.includes('/pages/card-detail/index'), 'Pocket pages do not open physical-card detail'));
checks.push(check(!pocketSources.includes('/pages/card-pack/index'), 'Pocket pages do not open physical-card pack simulator'));
checks.push(check(pocketTabWxml.includes('card-list') && pocketTabWxml.includes('card-row'), 'Pocket tab uses the physical-card dex list pattern'));
checks.push(check(!pocketTabWxml.includes('LIVE'), 'Pocket dex has no channel LIVE treatment'));
checks.push(check(pocketTabWxml.includes('resetFilters') && pocketTabWxml.includes('filter-panel'), 'Pocket search filters expose applied state and reset controls'));
checks.push(check(!pokemonDetailWxml.includes('model-preview-button'), 'Pokemon 3D controls do not duplicate the hero preview button'));
checks.push(check(pokemonDetailWxml.includes('detail-image-wrap') && pokemonDetailWxml.includes('bindtap="previewModel3d"'), 'Pokemon hero image keeps 3D preview interaction'));

const failed = checks.filter((item) => !item.ok);
process.stdout.write(`${JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2)}\n`);
if (failed.length) process.exitCode = 1;
