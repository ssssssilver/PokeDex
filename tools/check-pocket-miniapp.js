const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'wechat-miniapp', 'miniprogram');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const configSource = fs.readFileSync(path.join(root, 'config.js'), 'utf8');
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
checks.push(check(/useStaticApi:\s*true/.test(configSource) && configSource.includes('oss-cn-shenzhen.aliyuncs.com/Server/pokechill'), 'miniapp defaults to the production OSS snapshot'));

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
const homeWxml = fs.readFileSync(path.join(root, 'pages', 'home', 'index.wxml'), 'utf8');
const homeSource = fs.readFileSync(path.join(root, 'pages', 'home', 'index.js'), 'utf8');
const storageSource = fs.readFileSync(path.join(root, 'utils', 'storage.js'), 'utf8');
const profileWxml = fs.readFileSync(path.join(root, 'pages', 'profile', 'index.wxml'), 'utf8');
const quizWxml = fs.readFileSync(path.join(root, 'pages', 'quiz', 'index.wxml'), 'utf8');
const playSource = fs.readFileSync(path.join(root, 'pages', 'play', 'index.js'), 'utf8');
const playWxml = fs.readFileSync(path.join(root, 'pages', 'play', 'index.wxml'), 'utf8');
const physicalHotDeckPage = 'pages/hot-decks/index';
const pocketHotDeckWxml = fs.readFileSync(path.join(root, 'pages', 'pocket-hot-decks', 'index.wxml'), 'utf8');
checks.push(check(!pocketSources.includes('/pages/card-detail/index'), 'Pocket pages do not open physical-card detail'));
checks.push(check(!pocketSources.includes('/pages/card-pack/index'), 'Pocket pages do not open physical-card pack simulator'));
checks.push(check(pocketTabWxml.includes('card-list') && pocketTabWxml.includes('card-row'), 'Pocket tab uses the physical-card dex list pattern'));
checks.push(check(!pocketTabWxml.includes('LIVE'), 'Pocket dex has no channel LIVE treatment'));
checks.push(check(pocketTabWxml.includes('resetFilters') && pocketTabWxml.includes('filter-panel'), 'Pocket search filters expose applied state and reset controls'));
checks.push(check(!pokemonDetailWxml.includes('model-preview-button'), 'Pokemon 3D controls do not duplicate the hero preview button'));
checks.push(check(pokemonDetailWxml.includes('detail-image-wrap') && pokemonDetailWxml.includes('bindtap="previewModel3d"'), 'Pokemon hero image keeps 3D preview interaction'));
checks.push(check(!pokemonDetailWxml.includes('related-card-name'), 'related Pokemon cards do not repeat the Pokemon name'));
checks.push(check(homeWxml.includes('宝可梦猜谜') && !homeWxml.includes('每日猜谜'), 'Pokemon quiz is labeled as a random light game'));
checks.push(check(!homeWxml.includes('快速发现宝可梦'), 'home removes quick Pokemon discovery'));
checks.push(check((homeWxml.match(/pocket-panel-section/g) || []).length === 2, 'Pocket home activity and deck sections use readable white panels'));
checks.push(check(!homeSource.includes('quiz.answerId'), 'daily Pokemon is independent from the quiz answer'));
checks.push(check(homeSource.includes('getRecentViews(pokemon)') && storageSource.includes('currentById'), 'legacy recent Pokemon images migrate to current OSS URLs'));
checks.push(check(balancedWxml(path.join(root, 'pages', 'profile', 'index.wxml')), 'profile WXML has balanced tags'));
checks.push(check(['宝可梦', '实体卡牌', 'Pocket'].every((label) => profileWxml.includes(label)), 'profile groups saved data by product domain'));
checks.push(check(!profileWxml.includes('最近查看') && !profileWxml.includes('数据源') && !profileWxml.includes('同步'), 'profile removes recent and sync diagnostics'));
checks.push(check(profileWxml.includes('open-type="feedback"') && !profileWxml.includes('联系邮箱'), 'profile keeps native feedback without a duplicate contact email'));
checks.push(check(profileWxml.lastIndexOf('用户意见反馈') > profileWxml.lastIndexOf('版本号'), 'profile feedback is the final settings entry'));
checks.push(check(quizWxml.includes('随机挑战') && quizWxml.includes('再猜一题'), 'Pokemon quiz supports repeated random rounds'));
checks.push(check(app.pages.includes(physicalHotDeckPage), 'physical-card hot deck ranking page is registered'));
['js', 'json', 'wxml', 'wxss'].forEach((extension) => {
  const filePath = path.join(root, `${physicalHotDeckPage}.${extension}`);
  checks.push(check(fs.existsSync(filePath), `${physicalHotDeckPage}.${extension} exists`));
  if (extension === 'wxml' && fs.existsSync(filePath)) checks.push(check(balancedWxml(filePath), `${physicalHotDeckPage}.wxml has balanced tags`));
});
checks.push(check(homeSource.includes("/pages/hot-decks/index") && homeWxml.includes('bindtap="openHotDecks"'), 'home physical-card deck ranking entry is wired'));
checks.push(check(playSource.includes("/pages/hot-decks/index") && playWxml.includes('bindtap="openHotDecks"'), 'play box physical-card hot decks open the ranking page'));
checks.push(check(pocketHotDeckWxml.includes('ranking-panel'), 'Pocket hot deck ranking uses a readable white panel'));

const originalWx = global.wx;
const storedValues = new Map([['pokechill:recent', [{ id: 11, name_zh: '铁甲蛹', image: 'http://127.0.0.1:8787/assets/local-pokemon/metapod.png' }]]]);
global.wx = {
  getStorageSync(key) { return storedValues.get(key); },
  setStorageSync(key, value) { storedValues.set(key, value); }
};
const storage = require(path.join(root, 'utils', 'storage'));
const migratedRecent = storage.getRecentViews([{ id: 11, name_zh: '铁甲蛹', name_en: 'Metapod', image: 'https://example.test/metapod.png', types: ['bug'], typeNames: ['虫'] }]);
checks.push(check(migratedRecent[0].image === 'https://example.test/metapod.png', 'stored localhost Pokemon images are migrated to the active dataset URL'));
global.wx = originalWx;

const failed = checks.filter((item) => !item.ok);
process.stdout.write(`${JSON.stringify({ ok: failed.length === 0, checks, failed }, null, 2)}\n`);
if (failed.length) process.exitCode = 1;
