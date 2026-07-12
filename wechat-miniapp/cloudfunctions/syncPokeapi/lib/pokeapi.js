const https = require('https');

const API_BASE = 'https://pokeapi.co/api/v2';
const DEFAULT_USER_AGENT = 'PokeChill MiniApp Sync/0.1';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.floor(number), max));
}

function buildSyncPlan(event = {}) {
  const requestedStart = clampNumber(event.startId, 1, 1, 2000);
  const requestedLimit = clampNumber(event.limit, 1025, 1, 1025);
  const requestedEnd = event.endId
    ? clampNumber(event.endId, requestedStart + requestedLimit - 1, requestedStart, 2000)
    : requestedStart + requestedLimit - 1;
  const endId = Math.min(requestedEnd, 2000);
  const ids = [];

  for (let id = requestedStart; id <= endId; id += 1) {
    ids.push(id);
  }

  return {
    ids,
    startId: requestedStart,
    endId,
    concurrency: clampNumber(event.concurrency, 6, 1, 12),
    retries: clampNumber(event.retries, 2, 0, 5),
    timeoutMs: clampNumber(event.timeoutMs, 10000, 2000, 30000),
    retryDelayMs: clampNumber(event.retryDelayMs, 600, 100, 5000),
    dryRun: Boolean(event.dryRun),
    force: Boolean(event.force),
    cacheImages: event.cacheImages !== false,
    refreshImages: Boolean(event.refreshImages),
    strictImageCache: Boolean(event.strictImageCache),
    imageCloudPathPrefix: sanitizeCloudPathPrefix(event.imageCloudPathPrefix || 'pokemon/artwork'),
    userAgent: event.userAgent || DEFAULT_USER_AGENT
  };
}

function requestJson(url, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'application/json'
      }
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Request failed ${response.statusCode}: ${url}`));
        response.resume();
        return;
      }

      let raw = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        raw += chunk;
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
        }
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timeout after ${timeoutMs}ms: ${url}`));
    });
    request.on('error', reject);
  });
}

function requestBuffer(url, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  const userAgent = options.userAgent || DEFAULT_USER_AGENT;

  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: {
        'User-Agent': userAgent,
        Accept: 'image/*,*/*'
      }
    }, (response) => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        reject(new Error(`Request failed ${response.statusCode}: ${url}`));
        response.resume();
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });
      response.on('end', () => {
        resolve({
          buffer: Buffer.concat(chunks),
          contentType: response.headers['content-type'] || ''
        });
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Request timeout after ${timeoutMs}ms: ${url}`));
    });
    request.on('error', reject);
  });
}

function createPokeapiClient(options = {}) {
  const evolutionCache = new Map();
  const abilityCache = new Map();
  const encountersCache = new Map();
  const moveCache = new Map();

  return {
    async fetchPokemonBundle(id) {
      return fetchPokemonBundle(id, Object.assign({}, options, {
        abilityCache,
        encountersCache,
        evolutionCache,
        moveCache
      }));
    },
    abilityCache,
    encountersCache,
    evolutionCache,
    moveCache
  };
}

async function fetchPokemonBundle(id, options = {}) {
  const [pokemon, species] = await Promise.all([
    requestJson(`${API_BASE}/pokemon/${id}`, options),
    requestJson(`${API_BASE}/pokemon-species/${id}`, options)
  ]);
  const abilityUrls = (pokemon.abilities || [])
    .map((item) => item.ability && item.ability.url)
    .filter(Boolean);
  const moveUrls = (pokemon.moves || [])
    .map((item) => item.move && item.move.url)
    .filter(Boolean);
  const [evolutionChain, abilities, encounters, moveDetails] = await Promise.all([
    fetchEvolutionChain(species.evolution_chain && species.evolution_chain.url, options),
    fetchAbilities(abilityUrls, options),
    fetchEncounters(pokemon.id, options),
    fetchMoveDetails(moveUrls, options)
  ]);
  return { pokemon, species, evolutionChain, abilities, encounters, moveDetails };
}

async function fetchEvolutionChain(url, options = {}) {
  if (!url) return null;
  const cache = options.evolutionCache;
  if (!cache) return requestJson(url, options);
  if (!cache.has(url)) {
    cache.set(url, requestJson(url, options));
  }
  return cache.get(url);
}

async function fetchAbilities(urls, options = {}) {
  const cache = options.abilityCache;
  return Promise.all((urls || []).map((url) => {
    if (!cache) return requestJson(url, options);
    if (!cache.has(url)) {
      cache.set(url, requestJson(url, options));
    }
    return cache.get(url);
  }));
}

async function fetchEncounters(id, options = {}) {
  const url = `${API_BASE}/pokemon/${id}/encounters`;
  const cache = options.encountersCache;
  if (!cache) return requestJson(url, options);
  if (!cache.has(url)) {
    cache.set(url, requestJson(url, options));
  }
  return cache.get(url);
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

async function fetchMoveDetails(urls, options = {}) {
  const uniqueUrls = Array.from(new Set(urls || []));
  const cache = options.moveCache;
  const concurrency = clampNumber(options.moveDetailConcurrency, 8, 1, 16);

  return mapLimit(uniqueUrls, Math.min(concurrency, uniqueUrls.length || 1), async (url) => {
    if (!cache) {
      return requestJson(url, options).catch(() => null);
    }
    if (!cache.has(url)) {
      cache.set(url, requestJson(url, options).catch(() => null));
    }
    return cache.get(url);
  }).then((items) => items.filter(Boolean));
}

function localizedName(species, fallback) {
  const names = species.names || [];
  const match = findLocalized(names, 'name');
  return match ? match.name : fallback;
}

function localizedNameFor(species, language, fallback) {
  const match = findLanguage(species.names || [], 'name', language);
  return match ? match.name : fallback;
}

function englishName(species, fallback) {
  const names = species.names || [];
  const match = findLanguage(names, 'name', 'en');
  return match ? match.name : titleCaseName(fallback);
}

function japaneseName(species, fallback) {
  const names = species.names || [];
  const match = findLanguage(names, 'name', 'ja') || findLanguage(names, 'name', 'ja-hrkt');
  return match ? match.name : fallback;
}

function localizedGenus(species) {
  const genera = species.genera || [];
  const match = findLocalized(genera, 'genus');
  return match ? match.genus : '';
}

function localizedGenusFor(species, language) {
  const match = findLanguage(species.genera || [], 'genus', language);
  return match ? match.genus : '';
}

function localizedFlavor(species) {
  const entries = species.flavor_text_entries || [];
  const match = findLocalized(entries, 'flavor_text');
  return match ? String(match.flavor_text || '').replace(/\s+/g, ' ') : '';
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function resourceId(resource) {
  return resource ? String(resource.name || '') : '';
}

function titleCaseResource(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function versionLabel(value) {
  return VERSION_LABELS[value] || titleCaseResource(value);
}

function versionGroupLabel(value) {
  return VERSION_GROUP_LABELS[value] || titleCaseResource(value);
}

function encounterMethodLabel(value) {
  return ENCOUNTER_METHOD_LABELS[value] || titleCaseResource(value);
}

function localizeLocationName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const parts = normalized.split(' ').filter(Boolean);
  const result = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const next = parts[index + 1];
    if (part === 'route' && /^\d+$/.test(next || '')) {
      result.push(`${next}号道路`);
      index += 1;
      continue;
    }
    if (part === 'sea' && next === 'route' && /^\d+$/.test(parts[index + 2] || '')) {
      result.push(`${parts[index + 2]}号水路`);
      index += 2;
      continue;
    }
    if (/^b\d+f$/.test(part)) {
      result.push(`地下${part.slice(1, -1)}层`);
      continue;
    }
    if (/^\d+f$/.test(part)) {
      result.push(`${part.slice(0, -1)}层`);
      continue;
    }
    if (/^\d+$/.test(part)) {
      result.push(part);
      continue;
    }
    result.push(LOCATION_WORD_LABELS[part] || titleCaseResource(part));
  }

  return result.join(' ').replace(/\s+区域$/, ' 区域').trim();
}

const STAT_LABELS = {
  hp: 'HP',
  attack: '攻击',
  defense: '防御',
  'special-attack': '特攻',
  'special-defense': '特防',
  speed: '速度'
};

const EGG_GROUP_LABELS = {
  monster: '怪兽',
  water1: '水中1',
  bug: '虫',
  flying: '飞行',
  ground: '陆上',
  fairy: '妖精',
  plant: '植物',
  humanshape: '人形',
  water3: '水中3',
  mineral: '矿物',
  indeterminate: '不定形',
  amorphous: '不定形',
  water2: '水中2',
  ditto: '百变怪',
  dragon: '龙',
  no_eggs: '未发现蛋',
  'no-eggs': '未发现蛋'
};

const METHOD_LABELS = {
  'level-up': '升级',
  machine: '招式机',
  egg: '遗传',
  tutor: '教学',
  stadium: '竞技场',
  'light-ball-egg': '电气球遗传',
  form_change: '形态变化',
  'form-change': '形态变化'
};

const DAMAGE_CLASS_LABELS = {
  physical: '物理',
  special: '特殊',
  status: '变化'
};

const MOVE_TARGET_LABELS = {
  'specific-move': '指定招式',
  'selected-pokemon-me-first': '指定宝可梦',
  'ally': '同伴',
  "users-field": '己方场地',
  user: '自身',
  'random-opponent': '随机对手',
  'all-other-pokemon': '自身以外全体',
  'selected-pokemon': '指定目标',
  'all-opponents': '全部对手',
  'entire-field': '全场',
  'user-and-allies': '自身和同伴',
  'all-pokemon': '全体宝可梦',
  'all-allies': '全部同伴',
  'fainting-pokemon': '濒死宝可梦'
};

const MOVE_CATEGORY_LABELS = {
  damage: '伤害',
  ailment: '异常状态',
  'net-good-stats': '能力提升',
  heal: '回复',
  damageailment: '伤害+异常',
  swagger: '混乱+攻击提升',
  damageheal: '吸取回复',
  damagefield: '伤害+场地',
  damageunique: '特殊伤害',
  'whole-field-effect': '全场效果',
  'field-effect': '场地效果',
  'force-switch': '强制替换',
  'unique': '特殊效果'
};

const MOVE_AILMENT_LABELS = {
  none: '无',
  paralysis: '麻痹',
  sleep: '睡眠',
  freeze: '冰冻',
  burn: '灼伤',
  poison: '中毒',
  confusion: '混乱',
  infatuation: '着迷',
  trap: '束缚',
  nightmare: '恶梦',
  torment: '无理取闹',
  disable: '定身法',
  yawn: '哈欠',
  healblock: '回复封锁',
  'no-type-immunity': '无视属性免疫',
  leechseed: '寄生种子',
  embargo: '查封',
  perishsong: '灭亡之歌',
  ingrain: '扎根',
  silence: '沉默',
  tarshot: '沥青射击'
};

const TYPE_LABELS = {
  normal: '一般',
  fire: '火',
  water: '水',
  electric: '电',
  grass: '草',
  ice: '冰',
  fighting: '格斗',
  poison: '毒',
  ground: '地面',
  flying: '飞行',
  psychic: '超能力',
  bug: '虫',
  rock: '岩石',
  ghost: '幽灵',
  dragon: '龙',
  dark: '恶',
  steel: '钢',
  fairy: '妖精'
};

const VERSION_LABELS = {
  red: '红',
  blue: '蓝',
  yellow: '皮卡丘',
  gold: '金',
  silver: '银',
  crystal: '水晶',
  ruby: '红宝石',
  sapphire: '蓝宝石',
  emerald: '绿宝石',
  firered: '火红',
  leafgreen: '叶绿',
  diamond: '钻石',
  pearl: '珍珠',
  platinum: '白金',
  heartgold: '心金',
  soulsilver: '魂银',
  black: '黑',
  white: '白',
  'black-2': '黑2',
  'white-2': '白2',
  x: 'X',
  y: 'Y',
  'omega-ruby': '欧米伽红宝石',
  'alpha-sapphire': '阿尔法蓝宝石',
  sun: '太阳',
  moon: '月亮',
  'ultra-sun': '究极之日',
  'ultra-moon': '究极之月',
  'lets-go-pikachu': "Let's Go 皮卡丘",
  'lets-go-eevee': "Let's Go 伊布",
  sword: '剑',
  shield: '盾',
  'the-isle-of-armor-sword': '剑 铠之孤岛',
  'the-isle-of-armor-shield': '盾 铠之孤岛',
  'the-crown-tundra-sword': '剑 冠之雪原',
  'the-crown-tundra-shield': '盾 冠之雪原',
  'brilliant-diamond': '晶灿钻石',
  'shining-pearl': '明亮珍珠',
  'legends-arceus': '传说 阿尔宙斯',
  scarlet: '朱',
  violet: '紫',
  colosseum: '竞技场',
  xd: 'XD',
  'red-japan': '红（日版）',
  'blue-japan': '蓝（日版）',
  'green-japan': '绿（日版）'
};

const VERSION_GROUP_LABELS = {
  'red-blue': '红/蓝',
  yellow: '皮卡丘',
  'gold-silver': '金/银',
  crystal: '水晶',
  'ruby-sapphire': '红宝石/蓝宝石',
  emerald: '绿宝石',
  'firered-leafgreen': '火红/叶绿',
  'diamond-pearl': '钻石/珍珠',
  platinum: '白金',
  'heartgold-soulsilver': '心金/魂银',
  'black-white': '黑/白',
  'black-2-white-2': '黑2/白2',
  'x-y': 'X/Y',
  'omega-ruby-alpha-sapphire': '欧米伽红宝石/阿尔法蓝宝石',
  'sun-moon': '太阳/月亮',
  'ultra-sun-ultra-moon': '究极之日/究极之月',
  'lets-go-pikachu-lets-go-eevee': "Let's Go 皮卡丘/伊布",
  'sword-shield': '剑/盾',
  'the-isle-of-armor': '铠之孤岛',
  'the-crown-tundra': '冠之雪原',
  'brilliant-diamond-and-shining-pearl': '晶灿钻石/明亮珍珠',
  'legends-arceus': '传说 阿尔宙斯',
  'scarlet-violet': '朱/紫',
  'the-teal-mask': '碧之假面',
  'the-indigo-disk': '蓝之圆盘',
  colosseum: '竞技场',
  xd: 'XD'
};

const ENCOUNTER_METHOD_LABELS = Object.assign({}, METHOD_LABELS, {
  walk: '草丛/洞窟行走',
  'dark-grass': '深色草丛',
  gift: '赠送',
  'gift-egg': '赠送的蛋',
  overworld: '明雷',
  'overworld-water': '水上明雷',
  'overworld-special': '特殊明雷',
  'overworld-dirt': '尘土明雷',
  'overworld-flying': '飞行明雷',
  'overworld-flying-special': '特殊飞行明雷',
  'overworld-water-special': '特殊水上明雷',
  surf: '冲浪',
  'surf-spots': '冲浪水纹',
  seaweed: '海草',
  'old-rod': '破旧钓竿',
  'good-rod': '好钓竿',
  'super-rod': '厉害钓竿',
  'super-rod-spots': '厉害钓竿钓点',
  'feebas-tile-fishing': '丑丑鱼钓点',
  'rock-smash': '碎岩',
  headbutt: '撞树',
  'headbutt-low': '低位撞树',
  'headbutt-high': '高位撞树',
  'honey-tree': '甜甜蜜树',
  horde: '群聚对战',
  'sos-encounter': '闯入对战',
  'sos-from-bubbling-spot': '水泡点闯入',
  'island-scan': '岛屿扫描',
  'hidden-grotto': '隐藏洞穴',
  'npc-trade': 'NPC 交换',
  'only-one': '唯一遇见',
  pokeflute: '宝可梦之笛',
  pokespot: '宝可梦热点',
  'pokemon-ranger': '宝可梦巡护员',
  snag: '夺取',
  'snag-rematch': '再战夺取',
  'colosseum-bonus-disc-jpn': '竞技场特典（日版）',
  'colosseum-bonus-disc-us': '竞技场特典（美版）',
  'devon-scope': '得文侦测镜',
  'squirt-bottle': '杰尼龟喷壶',
  'wailmer-pail': '吼吼鲸喷壶',
  'berry-trees': '树果树',
  'bridge-spots': '桥上阴影',
  'bubbling-spots': '水泡点',
  'cave-spots': '洞窟尘土',
  'grass-spots': '摇动草丛',
  'purple-flowers': '紫色花丛',
  'yellow-flowers': '黄色花丛',
  'roaming-grass': '摇动草丛',
  'rough-terrain': '崎岖地形',
  wanderer: '游荡',
  'wanderer-water': '水上游荡'
});

const LOCATION_WORD_LABELS = {
  kanto: '关都',
  johto: '城都',
  hoenn: '丰缘',
  sinnoh: '神奥',
  unova: '合众',
  kalos: '卡洛斯',
  alola: '阿罗拉',
  galar: '伽勒尔',
  hisui: '洗翠',
  paldea: '帕底亚',
  route: '道路',
  sea: '海',
  city: '市',
  town: '镇',
  village: '村',
  forest: '森林',
  cave: '洞窟',
  cavern: '洞窟',
  tunnel: '隧道',
  island: '岛',
  islands: '群岛',
  lake: '湖',
  mountain: '山',
  mount: '山',
  mt: '山',
  park: '公园',
  garden: '庭园',
  safari: '狩猎地带',
  friend: '朋友',
  area: '区域',
  floor: '层',
  basement: '地下',
  north: '北',
  south: '南',
  east: '东',
  west: '西',
  towards: '通往',
  main: '主区域',
  room: '房间',
  dojo: '道场',
  tower: '塔',
  seafoam: '双子岛',
  viridian: '常青',
  pallet: '真新',
  cerulean: '华蓝',
  vermilion: '枯叶',
  lumiose: '密阿雷',
  ilex: '桐树林',
  national: '自然',
  trophy: '豪宅后花园',
  rage: '愤怒',
  unknown: '未知',
  all: '全部',
  bugs: '虫'
};

const EVOLUTION_TRIGGER_LABELS = {
  'level-up': '升级',
  trade: '通信交换',
  'use-item': '使用道具',
  shed: '队伍有空位',
  spin: '旋转',
  'tower-of-darkness': '挑战恶之塔',
  'tower-of-waters': '挑战水之塔',
  'three-critical-hits': '单场对战击中要害3次后升级',
  'take-damage': '承受伤害后到特定地点',
  'agile-style-move': '使用迅疾招式',
  'strong-style-move': '使用刚猛招式',
  'recoil-damage': '累计反作用力伤害'
};

const EVOLUTION_ITEM_LABELS = {
  'black-augurite': '黑奇石',
  'chipped-pot': '缺损的茶壶',
  'cracked-pot': '破裂的茶壶',
  'dawn-stone': '觉醒之石',
  'deep-sea-scale': '深海鳞片',
  'deep-sea-tooth': '深海之牙',
  'dragon-scale': '龙之鳞片',
  'dubious-disc': '可疑补丁',
  'dusk-stone': '暗之石',
  'electirizer': '电力增幅器',
  'fire-stone': '火之石',
  'galarica-cuff': '伽勒豆蔻手环',
  'galarica-wreath': '伽勒豆蔻花圈',
  'ice-stone': '冰之石',
  'kings-rock': '王者之证',
  'leaf-stone': '叶之石',
  'linking-cord': '联系绳',
  'magmarizer': '熔岩增幅器',
  'malicious-armor': '咒术之铠',
  'metal-coat': '金属膜',
  'moon-stone': '月之石',
  'oval-stone': '浑圆之石',
  'peat-block': '泥炭块',
  'prism-scale': '美丽鳞片',
  protector: '护具',
  'razor-claw': '锐利之爪',
  'razor-fang': '锐利之牙',
  'reaper-cloth': '灵界之布',
  sachet: '香袋',
  'shiny-stone': '光之石',
  'strawberry-sweet': '草莓糖饰',
  'sun-stone': '日之石',
  'sweet-apple': '甜甜苹果',
  'tart-apple': '酸酸苹果',
  'thunder-stone': '雷之石',
  upgrade: '升级数据',
  'water-stone': '水之石',
  'whipped-dream': '泡沫奶油'
};

const TIME_OF_DAY_LABELS = {
  day: '白天',
  night: '夜晚'
};

const POKEDEX_LABELS = {
  national: '全国',
  kanto: '关都',
  'letsgo-kanto': '关都 Let’s Go',
  'original-johto': '城都',
  'updated-johto': '城都 HGSS',
  hoenn: '丰缘',
  'updated-hoenn': '丰缘 ORAS',
  'original-sinnoh': '神奥',
  'extended-sinnoh': '神奥 Pt',
  'original-unova': '合众',
  'updated-unova': '合众 B2W2',
  'kalos-central': '卡洛斯 中央',
  'kalos-coastal': '卡洛斯 海岸',
  'kalos-mountain': '卡洛斯 山岳',
  'original-alola': '阿罗拉',
  'updated-alola': '阿罗拉 USUM',
  galar: '伽勒尔',
  'isle-of-armor': '铠岛',
  'crown-tundra': '王冠雪原',
  hisui: '洗翠',
  paldea: '帕底亚',
  kitakami: '北上乡',
  blueberry: '蓝莓图鉴',
  'lumiose-city': '密阿雷',
  hyperspace: '异次元',
  champions: '冠军'
};

const VERSION_GROUP_ORDER = [
  'red-blue',
  'yellow',
  'gold-silver',
  'crystal',
  'ruby-sapphire',
  'emerald',
  'firered-leafgreen',
  'diamond-pearl',
  'platinum',
  'heartgold-soulsilver',
  'black-white',
  'colosseum',
  'xd',
  'black-2-white-2',
  'x-y',
  'omega-ruby-alpha-sapphire',
  'sun-moon',
  'ultra-sun-ultra-moon',
  'lets-go-pikachu-lets-go-eevee',
  'sword-shield',
  'the-isle-of-armor',
  'the-crown-tundra',
  'brilliant-diamond-and-shining-pearl',
  'legends-arceus',
  'scarlet-violet',
  'the-teal-mask',
  'the-indigo-disk'
];

const VERSION_TO_GENERATION = {
  red: 1,
  blue: 1,
  yellow: 1,
  gold: 2,
  silver: 2,
  crystal: 2,
  ruby: 3,
  sapphire: 3,
  emerald: 3,
  firered: 3,
  leafgreen: 3,
  diamond: 4,
  pearl: 4,
  platinum: 4,
  heartgold: 4,
  soulsilver: 4,
  black: 5,
  white: 5,
  'black-2': 5,
  'white-2': 5,
  x: 6,
  y: 6,
  'omega-ruby': 6,
  'alpha-sapphire': 6,
  sun: 7,
  moon: 7,
  'ultra-sun': 7,
  'ultra-moon': 7,
  'lets-go-pikachu': 7,
  'lets-go-eevee': 7,
  sword: 8,
  shield: 8,
  'brilliant-diamond': 8,
  'shining-pearl': 8,
  'legends-arceus': 8,
  scarlet: 9,
  violet: 9
};

function findLocalized(items, valueKey) {
  const supported = ['zh-hans', 'zh-hant', 'en'];
  for (const language of supported) {
    const match = (items || []).find((item) => {
      const name = item.language && String(item.language.name || '').toLowerCase();
      return name === language && item[valueKey];
    });
    if (match) return match;
  }
  return null;
}

function findLanguage(items, valueKey, language) {
  return (items || []).find((item) => {
    const name = item.language && String(item.language.name || '').toLowerCase();
    return name === language && item[valueKey];
  }) || null;
}

function titleCaseName(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statValue(pokemon, name) {
  const row = (pokemon.stats || []).find((item) => item.stat.name === name);
  return row ? row.base_stat : 0;
}

function statEffort(pokemon, name) {
  const row = (pokemon.stats || []).find((item) => item.stat.name === name);
  return row ? Number(row.effort || 0) : 0;
}

function officialArtwork(pokemon) {
  const sprites = pokemon.sprites || {};
  const other = sprites.other || {};
  const artwork = other['official-artwork'] || {};
  return artwork.front_default || sprites.front_default || '';
}

function imageExtension(url, contentType) {
  const cleanUrl = String(url || '').split('?')[0];
  const match = cleanUrl.match(/\.([a-z0-9]+)$/i);
  if (match) return match[1].toLowerCase();
  if (String(contentType).includes('jpeg')) return 'jpg';
  if (String(contentType).includes('webp')) return 'webp';
  return 'png';
}

function sanitizeCloudPathPrefix(value) {
  return String(value || 'pokemon/artwork')
    .replace(/\\/g, '/')
    .replace(/^\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-zA-Z0-9/_-]/g, '-');
}

function buildImageCloudPath(pokemon, imageUrl, options = {}) {
  const prefix = sanitizeCloudPathPrefix(options.prefix || 'pokemon/artwork');
  const ext = imageExtension(imageUrl, options.contentType);
  const id = String(pokemon.id).padStart(4, '0');
  return `${prefix}/${id}-${pokemon.name}.${ext}`;
}

function applyCachedImage(transformed, cachedImage) {
  if (!cachedImage || !cachedImage.fileID) return transformed;
  const summary = Object.assign({}, transformed.summary, {
    image: cachedImage.fileID,
    image_remote: transformed.summary.image_remote || transformed.summary.image,
    image_file_id: cachedImage.fileID,
    image_cached: true
  });
  const detail = Object.assign({}, transformed.detail, {
    image: cachedImage.fileID,
    image_remote: transformed.detail.image_remote || transformed.detail.image,
    image_file_id: cachedImage.fileID,
    image_cached: true
  });
  return { summary, detail };
}

function existingCachedFileID(existing) {
  if (!existing) return '';
  if (existing.image_cached && existing.image_file_id) {
    return existing.image_file_id;
  }
  if (existing.image_cached && String(existing.image || '').startsWith('cloud://')) {
    return existing.image;
  }
  return '';
}

function reuseExistingCachedImage(transformed, existing) {
  const fileID = existingCachedFileID(existing && (existing.detail || existing.summary)) ||
    existingCachedFileID(existing && existing.detail) ||
    existingCachedFileID(existing && existing.summary);

  if (!fileID) {
    return {
      transformed,
      reused: false,
      fileID: ''
    };
  }

  return {
    transformed: applyCachedImage(transformed, { fileID }),
    reused: true,
    fileID
  };
}

function urlId(resource) {
  if (!resource || !resource.url) return '';
  return String(resource.url).split('/').filter(Boolean).pop() || '';
}

function languageName(items, valueKey, languages) {
  for (const language of languages) {
    const match = findLanguage(items, valueKey, language);
    if (match && match[valueKey]) return match[valueKey];
  }
  return '';
}

function versionGroupOrder(name) {
  const index = VERSION_GROUP_ORDER.indexOf(name);
  return index === -1 ? -1 : index;
}

function latestLocalizedEntry(items, valueKey, languages) {
  const rows = (items || []).filter((entry) => entry && entry[valueKey]);
  for (const language of languages) {
    const matches = rows.filter((entry) => {
      const name = entry.language && String(entry.language.name || '').toLowerCase();
      return name === language;
    });
    if (matches.length) {
      return matches.slice().sort((a, b) => {
        const aGroup = a.version_group && a.version_group.name;
        const bGroup = b.version_group && b.version_group.name;
        return versionGroupOrder(bGroup) - versionGroupOrder(aGroup);
      })[0];
    }
  }
  return null;
}

function effectText(value, effectChance) {
  return cleanText(String(value || '').replace(/\$effect_chance/g, effectChance || 0));
}

function flattenEvolutionChain(evolutionChain) {
  const ids = [];
  const root = evolutionChain && evolutionChain.chain;

  function visit(node) {
    if (!node) return;
    const id = node.species ? Number(urlId(node.species)) : 0;
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
    (node.evolves_to || []).forEach(visit);
  }

  visit(root);
  return ids;
}

function resourceLabel(resource, labels) {
  const key = resource && resource.name;
  if (!key) return '';
  return (labels && labels[key]) || titleCaseResource(key);
}

function physicalStatsCondition(value) {
  const number = Number(value);
  if (number > 0) return '攻击高于防御';
  if (number < 0) return '攻击低于防御';
  return '攻击等于防御';
}

function evolutionDetailText(detail = {}) {
  const trigger = detail.trigger && detail.trigger.name;
  const parts = [];

  if (detail.item) parts.push(`使用${resourceLabel(detail.item, EVOLUTION_ITEM_LABELS)}`);
  if (detail.held_item) parts.push(`携带${resourceLabel(detail.held_item, EVOLUTION_ITEM_LABELS)}`);
  if (detail.min_level) parts.push(`Lv.${Number(detail.min_level)}`);
  if (detail.min_happiness) parts.push(`亲密度 ${Number(detail.min_happiness)}+`);
  if (detail.min_affection) parts.push(`友好度 ${Number(detail.min_affection)}+`);
  if (detail.min_beauty) parts.push(`美丽度 ${Number(detail.min_beauty)}+`);
  if (detail.time_of_day) parts.push(TIME_OF_DAY_LABELS[detail.time_of_day] || detail.time_of_day);
  if (detail.location) parts.push(`在${resourceLabel(detail.location)}附近`);
  if (detail.known_move) parts.push(`学会${titleCaseResource(detail.known_move.name)}`);
  if (detail.known_move_type) {
    const type = detail.known_move_type.name;
    parts.push(`学会${TYPE_LABELS[type] || titleCaseResource(type)}属性招式`);
  }
  if (detail.gender) parts.push(Number(detail.gender) === 1 ? '雌性' : '雄性');
  if (detail.needs_overworld_rain) parts.push('地图下雨');
  if (detail.turn_upside_down) parts.push('倒置设备');
  if (detail.party_species) parts.push(`队伍中有${titleCaseResource(detail.party_species.name)}`);
  if (detail.party_type) {
    const type = detail.party_type.name;
    parts.push(`队伍中有${TYPE_LABELS[type] || titleCaseResource(type)}属性宝可梦`);
  }
  if (detail.trade_species) parts.push(`与${titleCaseResource(detail.trade_species.name)}交换`);
  if (detail.relative_physical_stats !== null && detail.relative_physical_stats !== undefined) {
    parts.push(physicalStatsCondition(detail.relative_physical_stats));
  }

  const triggerLabel = EVOLUTION_TRIGGER_LABELS[trigger] || titleCaseResource(trigger);
  if (triggerLabel && !['level-up', 'use-item'].includes(trigger)) {
    parts.unshift(triggerLabel);
  }
  if (!parts.length && triggerLabel) return triggerLabel;
  return parts.join(' / ');
}

function buildEvolutionConditions(evolutionChain) {
  const rows = [];
  const root = evolutionChain && evolutionChain.chain;

  function visit(node) {
    if (!node) return;
    const fromId = node.species ? Number(urlId(node.species)) : 0;
    (node.evolves_to || []).forEach((child) => {
      const toId = child.species ? Number(urlId(child.species)) : 0;
      const details = child.evolution_details || [];
      const conditions = Array.from(new Set(
        details.map(evolutionDetailText).filter(Boolean)
      ));
      rows.push({
        from_id: fromId,
        to_id: toId,
        text: conditions.length ? conditions.join(' 或 ') : '特殊条件',
        details: conditions
      });
      visit(child);
    });
  }

  visit(root);
  return rows;
}

function buildEvYield(pokemon) {
  return (pokemon.stats || [])
    .map((item) => ({
      key: item.stat.name,
      name: STAT_LABELS[item.stat.name] || item.stat.name,
      value: Number(item.effort || 0)
    }))
    .filter((item) => item.value > 0);
}

function buildAbilities(pokemon, abilityDetails) {
  const detailByName = new Map((abilityDetails || []).map((ability) => [ability.name, ability]));
  return (pokemon.abilities || []).map((item) => {
    const detail = detailByName.get(item.ability.name) || {};
    const shortEffect = languageName(detail.effect_entries || [], 'short_effect', ['zh-hans', 'zh-hant', 'en']);
    const flavor = languageName((detail.flavor_text_entries || []).slice().reverse(), 'flavor_text', ['zh-hans', 'zh-hant', 'en']);
    const nameZh = languageName(detail.names || [], 'name', ['zh-hans', 'zh-hant']) || titleCaseResource(item.ability.name);
    const nameJa = languageName(detail.names || [], 'name', ['ja', 'ja-hrkt']);
    return {
      id: Number(urlId(item.ability)),
      key: item.ability.name,
      name: nameZh,
      name_en: titleCaseResource(item.ability.name),
      name_ja: nameJa,
      is_hidden: Boolean(item.is_hidden),
      slot: Number(item.slot || 0),
      short_effect: cleanText(shortEffect || flavor),
      flavor: cleanText(flavor || shortEffect)
    };
  });
}

function buildRegionalDexes(species) {
  return (species.pokedex_numbers || []).map((item) => ({
    key: item.pokedex.name,
    name: POKEDEX_LABELS[item.pokedex.name] || titleCaseResource(item.pokedex.name),
    entry_number: item.entry_number
  }));
}

function buildFlavorEntries(species) {
  const seen = new Set();
  return (species.flavor_text_entries || [])
    .map((entry) => {
      const version = entry.version && entry.version.name ? entry.version.name : 'unknown';
      return {
        version,
        version_name: titleCaseResource(version),
        generation: VERSION_TO_GENERATION[version] || 0,
        language: entry.language && entry.language.name ? entry.language.name : '',
        text: cleanText(entry.flavor_text)
      };
    })
    .filter((entry) => {
      if (!entry.text) return false;
      const language = String(entry.language || '').toLowerCase();
      if (!['zh-hans', 'zh-hant', 'en', 'ja', 'ja-hrkt'].includes(language)) return false;
      const key = `${entry.version}:${entry.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function latestMoveDetail(details) {
  if (!details || !details.length) return null;
  return details.slice().sort((a, b) => {
    const aIndex = versionGroupOrder(a.version_group && a.version_group.name);
    const bIndex = versionGroupOrder(b.version_group && b.version_group.name);
    return bIndex - aIndex;
  })[0];
}

function numericOrEmpty(value) {
  return value === null || value === undefined ? '' : Number(value);
}

function signedNumber(value) {
  const number = Number(value || 0);
  if (!number) return '';
  return number > 0 ? `+${number}` : `${number}`;
}

function buildMoveDetailFields(key, detail = {}) {
  const nameEn = languageName(detail.names || [], 'name', ['en']) || titleCaseResource(key || detail.name);
  const nameZh = languageName(detail.names || [], 'name', ['zh-hans', 'zh-hant']);
  const nameJa = languageName(detail.names || [], 'name', ['ja', 'ja-hrkt']);
  const type = detail.type ? detail.type.name : '';
  const damageClass = detail.damage_class ? detail.damage_class.name : '';
  const target = detail.target ? detail.target.name : '';
  const effectChance = numericOrEmpty(detail.effect_chance);
  const flavorEntry = latestLocalizedEntry(detail.flavor_text_entries || [], 'flavor_text', ['zh-hans', 'zh-hant', 'en']);
  const shortEffectEntry = latestLocalizedEntry(detail.effect_entries || [], 'short_effect', ['zh-hans', 'zh-hant', 'en']);
  const effectEntry = latestLocalizedEntry(detail.effect_entries || [], 'effect', ['zh-hans', 'zh-hant', 'en']);
  const meta = detail.meta || {};
  const ailment = meta.ailment ? meta.ailment.name : '';
  const category = meta.category ? meta.category.name : '';

  return {
    id: Number(detail.id || 0),
    key: key || detail.name || '',
    name: nameZh || nameEn,
    name_en: nameEn,
    name_ja: nameJa,
    type,
    type_name: TYPE_LABELS[type] || titleCaseResource(type),
    damage_class: damageClass,
    damage_class_name: DAMAGE_CLASS_LABELS[damageClass] || titleCaseResource(damageClass),
    category,
    category_name: MOVE_CATEGORY_LABELS[category] || titleCaseResource(category),
    power: numericOrEmpty(detail.power),
    accuracy: numericOrEmpty(detail.accuracy),
    pp: numericOrEmpty(detail.pp),
    priority: Number(detail.priority || 0),
    target,
    target_name: MOVE_TARGET_LABELS[target] || titleCaseResource(target),
    effect_chance: effectChance,
    description: effectText(flavorEntry && flavorEntry.flavor_text, effectChance),
    description_version_group: flavorEntry && flavorEntry.version_group ? flavorEntry.version_group.name : '',
    description_version_group_name: flavorEntry && flavorEntry.version_group ? versionGroupLabel(flavorEntry.version_group.name) : '',
    short_effect: effectText(shortEffectEntry && shortEffectEntry.short_effect, effectChance),
    effect: effectText(effectEntry && effectEntry.effect, effectChance),
    generation: detail.generation ? Number(urlId(detail.generation)) : 0,
    generation_name: detail.generation ? `第 ${Number(urlId(detail.generation))} 世代` : '',
    machine_count: (detail.machines || []).length,
    ailment,
    ailment_name: MOVE_AILMENT_LABELS[ailment] || titleCaseResource(ailment),
    min_hits: numericOrEmpty(meta.min_hits),
    max_hits: numericOrEmpty(meta.max_hits),
    min_turns: numericOrEmpty(meta.min_turns),
    max_turns: numericOrEmpty(meta.max_turns),
    drain: numericOrEmpty(meta.drain),
    healing: numericOrEmpty(meta.healing),
    crit_rate: numericOrEmpty(meta.crit_rate),
    ailment_chance: numericOrEmpty(meta.ailment_chance),
    flinch_chance: numericOrEmpty(meta.flinch_chance),
    stat_chance: numericOrEmpty(meta.stat_chance),
    stat_changes: (detail.stat_changes || []).map((item) => ({
      stat: item.stat ? item.stat.name : '',
      name: item.stat ? (STAT_LABELS[item.stat.name] || titleCaseResource(item.stat.name)) : '',
      change: Number(item.change || 0),
      change_text: signedNumber(item.change)
    })).filter((item) => item.stat)
  };
}

function buildLearnText(methodName, level, versionGroupName) {
  return [
    methodName,
    Number(level || 0) ? `Lv.${Number(level)}` : '',
    versionGroupName
  ].filter(Boolean).join(' / ');
}

function buildMoves(pokemon, moveDetails) {
  const detailByName = new Map((moveDetails || []).map((move) => [move.name, move]));
  return (pokemon.moves || []).map((item) => {
    const detail = detailByName.get(item.move.name) || {};
    const latest = latestMoveDetail(item.version_group_details || []);
    const method = latest && latest.move_learn_method ? latest.move_learn_method.name : '';
    const level = latest ? Number(latest.level_learned_at || 0) : 0;
    const methodName = METHOD_LABELS[method] || titleCaseResource(method || 'unknown');
    const versionGroup = latest && latest.version_group ? latest.version_group.name : '';
    const versionGroupName = versionGroup ? versionGroupLabel(versionGroup) : '';
    return Object.assign(buildMoveDetailFields(item.move.name, detail), {
      method,
      method_name: methodName,
      level,
      version_group: versionGroup,
      version_group_name: versionGroupName,
      learn_time: buildLearnText(methodName, level, versionGroupName),
      learn_count: (item.version_group_details || []).length
    });
  }).sort((a, b) => {
    if (a.method === 'level-up' && b.method === 'level-up') return a.level - b.level || a.name.localeCompare(b.name);
    if (a.method === 'level-up') return -1;
    if (b.method === 'level-up') return 1;
    return a.method_name.localeCompare(b.method_name) || a.name.localeCompare(b.name);
  });
}

function buildEncounterSummary(encounters) {
  const rows = [];
  (encounters || []).forEach((encounter) => {
    const locationKey = encounter.location_area && encounter.location_area.name;
    const locationName = localizeLocationName(locationKey);
    (encounter.version_details || []).forEach((versionDetail) => {
      const detail = (versionDetail.encounter_details || [])[0] || {};
      const version = versionDetail.version ? versionDetail.version.name : '';
      const method = detail.method ? detail.method.name : '';
      rows.push({
        location: locationName,
        location_key: locationKey || '',
        version,
        version_name: versionLabel(version),
        method,
        method_name: encounterMethodLabel(method),
        min_level: Number(detail.min_level || 0),
        max_level: Number(detail.max_level || 0),
        chance: Number(versionDetail.max_chance || detail.chance || 0)
      });
    });
  });

  return {
    count: rows.length,
    locations: Array.from(new Set(rows.map((row) => row.location).filter(Boolean))).slice(0, 8),
    methods: Array.from(new Set(rows.map((row) => row.method_name).filter(Boolean))).slice(0, 6),
    rows: rows.slice(0, 24)
  };
}

function localizeEncounterSummary(encounters) {
  const rows = (encounters && encounters.rows ? encounters.rows : []).map((row) => {
    const locationKey = row.location_key || row.location || '';
    const version = row.version || '';
    const method = row.method || '';
    return Object.assign({}, row, {
      location: localizeLocationName(locationKey),
      location_key: locationKey,
      version_name: versionLabel(version),
      method_name: encounterMethodLabel(method)
    });
  });

  return {
    count: encounters ? Number(encounters.count || rows.length || 0) : rows.length,
    locations: Array.from(new Set(rows.map((row) => row.location).filter(Boolean))).slice(0, 8),
    methods: Array.from(new Set(rows.map((row) => row.method_name).filter(Boolean))).slice(0, 6),
    rows
  };
}

function genderText(genderRate) {
  const rate = Number(genderRate);
  if (rate < 0) return '无性别';
  const female = Math.round((rate / 8) * 1000) / 10;
  const male = Math.round((100 - female) * 10) / 10;
  return `♂ ${male}% / ♀ ${female}%`;
}

function transformPokemonBundle(bundle) {
  const pokemon = bundle.pokemon;
  const species = bundle.species;
  const stats = {
    hp: statValue(pokemon, 'hp'),
    attack: statValue(pokemon, 'attack'),
    defense: statValue(pokemon, 'defense'),
    specialAttack: statValue(pokemon, 'special-attack'),
    specialDefense: statValue(pokemon, 'special-defense'),
    speed: statValue(pokemon, 'speed')
  };
  const evYield = buildEvYield(pokemon);
  const statTotal = Object.keys(stats).reduce((sum, key) => sum + stats[key], 0);
  const regionalDexes = buildRegionalDexes(species);
  const moves = buildMoves(pokemon, bundle.moveDetails);
  const flavorEntries = buildFlavorEntries(species);
  const primaryFlavor = localizedFlavor(species) || (flavorEntries[0] && flavorEntries[0].text) || '';
  const flavorFor = (language) => {
    const entries = flavorEntries.filter((entry) => entry.language === language);
    return entries.length ? entries[entries.length - 1].text : '';
  };
  const detail = {
    id: pokemon.id,
    slug: pokemon.name,
    name_en: englishName(species, pokemon.name),
    name_zh: localizedName(species, pokemon.name),
    name_zh_cn: localizedNameFor(species, 'zh-hans', localizedName(species, pokemon.name)),
    name_zh_tw: localizedNameFor(species, 'zh-hant', localizedName(species, pokemon.name)),
    name_ja: japaneseName(species, pokemon.name),
    image: officialArtwork(pokemon),
    image_remote: officialArtwork(pokemon),
    image_cached: false,
    types: (pokemon.types || []).map((item) => item.type.name),
    generation: species.generation ? Number(urlId(species.generation)) : 0,
    height: `${pokemon.height / 10} m`,
    weight: `${pokemon.weight / 10} kg`,
    category: localizedGenus(species),
    category_zh_cn: localizedGenusFor(species, 'zh-hans') || localizedGenus(species),
    category_zh_tw: localizedGenusFor(species, 'zh-hant') || localizedGenus(species),
    category_en: localizedGenusFor(species, 'en'),
    color: resourceId(species.color),
    shape: resourceId(species.shape),
    habitat: resourceId(species.habitat),
    capture_rate: Number(species.capture_rate || 0),
    base_happiness: Number(species.base_happiness || 0),
    growth_rate: species.growth_rate ? species.growth_rate.name : '',
    hatch_counter: Number(species.hatch_counter || 0),
    gender_rate: Number(species.gender_rate || -1),
    gender_text: genderText(species.gender_rate),
    egg_groups: (species.egg_groups || []).map((item) => ({
      key: item.name,
      name: EGG_GROUP_LABELS[item.name] || titleCaseResource(item.name)
    })),
    abilities: buildAbilities(pokemon, bundle.abilities),
    stats,
    ev_yield: evYield,
    ev_yield_text: evYield.length ? evYield.map((item) => `${item.name}+${item.value}`).join(' / ') : '-',
    stat_total: statTotal,
    regional_dexes: regionalDexes,
    regional_dex_keys: regionalDexes.map((item) => item.key),
    evolution_chain_id: species.evolution_chain ? urlId(species.evolution_chain) : '',
    evolution_chain: flattenEvolutionChain(bundle.evolutionChain),
    evolution_conditions: buildEvolutionConditions(bundle.evolutionChain),
    moves,
    moves_summary: moves.slice(0, 8).map((item) => item.name),
    move_count: moves.length,
    encounters: buildEncounterSummary(bundle.encounters),
    flavor: primaryFlavor,
    flavor_zh_cn: flavorFor('zh-hans') || primaryFlavor,
    flavor_zh_tw: flavorFor('zh-hant') || primaryFlavor,
    flavor_en: flavorFor('en'),
    flavor_entries: flavorEntries,
    synced_from: 'pokeapi',
    synced_at: new Date().toISOString()
  };
  const summary = {
    id: detail.id,
    slug: detail.slug,
    name_en: detail.name_en,
    name_zh: detail.name_zh,
    name_zh_cn: detail.name_zh_cn,
    name_zh_tw: detail.name_zh_tw,
    name_ja: detail.name_ja,
    image: detail.image,
    image_remote: detail.image_remote,
    image_cached: detail.image_cached,
    types: detail.types,
    generation: detail.generation,
    stat_total: detail.stat_total,
    category: detail.category,
    category_zh_cn: detail.category_zh_cn,
    category_zh_tw: detail.category_zh_tw,
    category_en: detail.category_en,
    regional_dexes: detail.regional_dexes,
    regional_dex_keys: detail.regional_dex_keys,
    capture_rate: detail.capture_rate,
    ev_yield_text: detail.ev_yield_text,
    move_count: detail.move_count,
    synced_from: detail.synced_from,
    synced_at: detail.synced_at
  };
  return { summary, detail };
}

module.exports = {
  applyCachedImage,
  buildImageCloudPath,
  buildMoveDetailFields,
  buildSyncPlan,
  createPokeapiClient,
  buildEvolutionConditions,
  fetchPokemonBundle,
  fetchEvolutionChain,
  fetchMoveDetails,
  flattenEvolutionChain,
  localizedName,
  localizeEncounterSummary,
  localizeLocationName,
  versionGroupLabel,
  versionLabel,
  requestBuffer,
  requestJson,
  reuseExistingCachedImage,
  sleep,
  transformPokemonBundle
};
