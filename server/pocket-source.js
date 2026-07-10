const crypto = require('crypto');

const SOURCE_URLS = {
  raenonxMaster: 'https://ptcgp.raenonx.cc/api/data/global-master',
  raenonxEvents: 'https://ptcgp.raenonx.cc/api/data/event-brief',
  raenonxLocale: 'https://ptcgp.raenonx.cc/zh/card',
  chaseCards: 'https://raw.githubusercontent.com/chase-mew/pokemon-tcg-pocket-cards/main/v4.json',
  chaseExpansions: 'https://raw.githubusercontent.com/chase-mew/pokemon-tcg-pocket-cards/main/expansions.json',
  flibustierSets: 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/sets.json',
  flibustierRarities: 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/rarities.json',
  flibustierPullRates: 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/pullRates.json',
  deckgymCards: 'https://raw.githubusercontent.com/bcollazo/deckgym-core/main/database.json',
  limitlessDecks: 'https://play.limitlesstcg.com/decks?game=POCKET'
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestText(url, options = {}) {
  const attempts = Math.max(1, Number(options.attempts || 3));
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs || 30000));
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: options.accept || 'application/json,text/html;q=0.9,*/*;q=0.8',
          'User-Agent': options.userAgent || 'PokeChill/1.0 (+local Pocket data cache)'
        }
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`${response.status} ${text.slice(0, 200)}`);
      return {
        url,
        text,
        bytes: Buffer.byteLength(text),
        sha256: crypto.createHash('sha256').update(text).digest('hex'),
        etag: response.headers.get('etag') || '',
        lastModified: response.headers.get('last-modified') || '',
        fetchedAt: new Date().toISOString()
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(500 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError.message}`);
}

async function requestJson(url, options = {}) {
  const resource = await requestText(url, options);
  try {
    return Object.assign(resource, { data: JSON.parse(resource.text) });
  } catch (error) {
    throw new Error(`Invalid JSON from ${url}: ${error.message}`);
  }
}

function extractBalancedObject(source, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error('Unable to locate complete RaenonX messages object');
}

function extractRaenonxMessages(html) {
  const chunks = [];
  const pattern = /<script>(self\.__next_f\.push\([\s\S]*?\))<\/script>/g;
  for (const match of html.matchAll(pattern)) {
    const call = match[1];
    try {
      const payload = JSON.parse(call.slice('self.__next_f.push('.length, -1));
      if (payload[0] === 1 && typeof payload[1] === 'string') chunks.push(payload[1]);
    } catch (error) {
      // Not every Next.js flight script is a JSON-only payload.
    }
  }
  const flight = chunks.join('');
  const marker = '"messages":';
  const markerIndex = flight.indexOf(marker);
  if (markerIndex < 0) throw new Error('RaenonX localization messages were not found');
  const start = flight.indexOf('{', markerIndex + marker.length);
  const messages = JSON.parse(extractBalancedObject(flight, start));
  if (!messages.Game || !messages.Game.Master) {
    throw new Error('RaenonX game localization master was not found');
  }
  return messages.Game.Master;
}

function collectionKey(set, number) {
  const normalizedSet = String(set || '')
    .replace(/^PROMO-/i, 'P')
    .replace(/[^a-z0-9]/gi, '')
    .toUpperCase();
  return `${normalizedSet}-${String(Number(number) || number || '').padStart(3, '0')}`;
}

function chaseKey(card) {
  const match = String(card.id || '').match(/^([a-z0-9]+)-(\d+)$/i);
  return match ? collectionKey(match[1], match[2]) : '';
}

function deckgymEntry(row) {
  if (!row || typeof row !== 'object') return null;
  const kind = Object.keys(row)[0];
  const card = row[kind];
  if (!card) return null;
  const match = String(card.id || '').match(/^(\S+)\s+(\d+)$/);
  return match ? { key: collectionKey(match[1], match[2]), kind, card } : null;
}

function localizeText(dictionary, id) {
  if (id === undefined || id === null || id === '') return '';
  return String((dictionary || {})[String(id)] || '');
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function normalizeHotDecks(html) {
  const table = String(html || '').match(/<table class="meta">([\s\S]*?)<\/table>/i);
  if (!table) throw new Error('Limitless Pocket deck table was not found');
  const items = Array.from(table[1].matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi)).map((row) => {
    const cells = Array.from(row[2].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map((cell) => cell[1]);
    if (cells.length < 7) return null;
    const link = cells[2].match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const score = stripTags(cells[5]);
    const scoreMatch = score.match(/([\d,]+)\s*-\s*([\d,]+)\s*-\s*([\d,]+)/);
    const images = Array.from(cells[1].matchAll(/<img[^>]+src="([^"]+)"/gi)).map((match) => decodeHtml(match[1]));
    const href = link ? decodeHtml(link[1]) : '';
    return {
      id: href ? href.split('?')[0].replace(/^\/decks\//, '') : `rank-${stripTags(cells[0])}`,
      rank: Number(stripTags(cells[0])) || 0,
      name: link ? stripTags(link[2]) : stripTags(cells[2]),
      count: Number(stripTags(cells[3]).replace(/,/g, '')) || 0,
      share: Number(stripTags(cells[4]).replace('%', '')) || 0,
      wins: scoreMatch ? Number(scoreMatch[1].replace(/,/g, '')) : 0,
      losses: scoreMatch ? Number(scoreMatch[2].replace(/,/g, '')) : 0,
      ties: scoreMatch ? Number(scoreMatch[3].replace(/,/g, '')) : 0,
      win_rate: Number(stripTags(cells[6]).replace('%', '')) || 0,
      images,
      url: href ? new URL(href, 'https://play.limitlesstcg.com').toString() : '',
      source: 'Limitless Pocket'
    };
  }).filter((item) => item && item.name);
  const totals = String(html || '').match(/([\d,]+) tournaments, ([\d,]+) players, ([\d,]+) matches/i);
  return {
    items,
    meta: {
      tournaments: totals ? Number(totals[1].replace(/,/g, '')) : 0,
      players: totals ? Number(totals[2].replace(/,/g, '')) : 0,
      matches: totals ? Number(totals[3].replace(/,/g, '')) : 0,
      source_url: SOURCE_URLS.limitlessDecks
    }
  };
}

function normalizeAttack(attack, locale) {
  return {
    id: attack.id,
    name_zh: localizeText(locale.Attack && locale.Attack.Name, attack.nameI18nId),
    description_zh_template: localizeText(locale.Attack && locale.Attack.Description, attack.descriptionI18nId),
    energy: attack.energy || {},
    energy_total: Number(attack.energyTotal || 0),
    damage: attack.damageMarking || null,
    move: attack.move || null
  };
}

function normalizeAbility(ability, locale) {
  return {
    id: ability.id,
    name_zh: localizeText(locale.Ability && locale.Ability.Name, ability.nameI18nId),
    description_zh_template: localizeText(locale.Ability && locale.Ability.Description, ability.descriptionI18nId),
    effect: ability.effect || ability.move || null
  };
}

function nationalDexNumber(pokemonId) {
  const match = String(pokemonId || '').match(/^PK_(\d+)$/i);
  if (!match) return null;
  const encoded = Number(match[1]);
  return Number.isFinite(encoded) ? Math.floor(encoded / 10) : null;
}

function normalizeCards(master, locale, chaseCards, deckgymCards) {
  const chaseMap = new Map(chaseCards.map((card) => [chaseKey(card), card]).filter(([key]) => key));
  const deckgymMap = new Map(deckgymCards.map(deckgymEntry).filter(Boolean).map((entry) => [entry.key, entry]));
  return Object.values(master.cardEntryMap || {}).map((card) => {
    const play = card.play || {};
    const collections = (card.collectionNums || []).map((entry) => ({
      expansion_id: entry.expansion && entry.expansion.id,
      expansion_name_zh: localizeText(locale.Expansion, `LONG_${entry.expansion && entry.expansion.nameI18nId}`) ||
        localizeText(locale.Expansion, entry.expansion && entry.expansion.nameI18nId),
      number: Number(entry.num || 0),
      key: collectionKey(entry.expansion && entry.expansion.id, entry.num)
    }));
    const primary = collections[0] || {};
    const chase = chaseMap.get(primary.key) || null;
    const deckgym = deckgymMap.get(primary.key) || null;
    const nameId = play.characterI18nId;
    const pokemonId = play.pokemonId || '';
    return {
      id: card.cardId,
      name_zh: localizeText(locale.Card && locale.Card.Name, nameId),
      name_en: (chase && chase.name) || (deckgym && deckgym.card.name) || '',
      card_type: card.cardType || '',
      rarity: card.rarity || '',
      series_id: card.seriesId || '',
      collections,
      image: chase ? chase.image : '',
      artist: chase ? chase.artist : '',
      pack_name_en: chase ? chase.pack : '',
      fullart: chase ? chase.fullart === 'Yes' : false,
      is_ex: chase ? chase.ex === 'Yes' : false,
      mirror_type: card.mirrorType || '',
      is_tradable: Boolean(card.isTradable),
      promotion: card.promotion || null,
      source: card.source || {},
      hp: play.hp === undefined ? null : Number(play.hp),
      pokemon_id: pokemonId,
      national_pokedex_number: nationalDexNumber(pokemonId),
      types: play.types || [],
      evolution: play.evolution || null,
      retreat: play.retreat === undefined ? null : Number(play.retreat),
      weakness: play.weakness || null,
      attacks: (play.attacks || []).map((attack) => normalizeAttack(attack, locale)),
      abilities: (play.abilities || []).map((ability) => normalizeAbility(ability, locale)),
      variant: play.variant || '',
      rules: deckgym ? deckgym.card : null,
      provenance: {
        game_data: 'raenonx-global-master',
        locale_zh: 'raenonx-zh-flight-messages',
        image: chase ? 'chase-mew' : '',
        english_rules: deckgym ? 'deckgym-core' : ''
      }
    };
  });
}

function normalizeExpansions(master, locale, flibustierSets) {
  const supplemental = Object.values(flibustierSets || {}).flat();
  const supplementalMap = new Map(supplemental.map((set) => [String(set.code || '').toUpperCase(), set]));
  return Object.values(master.cardExpansionMap || {}).map((expansion) => {
    const extra = supplementalMap.get(String(expansion.id || '').toUpperCase()) || {};
    return {
      id: expansion.id,
      name_zh: localizeText(locale.Expansion, expansion.nameI18nId),
      name_long_zh: localizeText(locale.Expansion, `LONG_${expansion.nameI18nId}`),
      name: extra.name || {},
      series: expansion.series || '',
      release_date: extra.releaseDate || '',
      card_count: (expansion.cardsInExpansion || []).length,
      base_card_count: (expansion.baseCardsInExpansion || []).length,
      card_ids: expansion.cardsInExpansion || [],
      pack_ids: expansion.packsInExpansion || [],
      logo_image_name: expansion.logoImageName || '',
      badge_image_name: expansion.badgeImageName || ''
    };
  });
}

function normalizePacks(master, locale, chaseExpansions, cards) {
  const packNameAliases = {
    dialga: '帝牙盧卡',
    palkia: '帕路奇亞',
    solgaleo: '索爾迦雷歐',
    lunala: '露奈雅拉',
    'mega blaziken': '超級火焰雞',
    'mega gyarados': '超級暴鯉龍',
    'mega altaria': '超級七夕青鳥'
  };
  const expansionMap = new Map((chaseExpansions || []).map((expansion) => [String(expansion.id || '').toUpperCase(), expansion]));
  const chineseNameByEnglish = new Map((cards || [])
    .filter((card) => card.name_en && card.name_zh)
    .map((card) => [String(card.name_en).toLowerCase(), card.name_zh]));

  function chasePack(pack, nameZh) {
    const expansionId = String(pack.expansionId || '').toUpperCase();
    if (expansionId.startsWith('PROMO-')) {
      const promo = expansionMap.get('PROMO');
      const suffix = expansionId.slice(-1).toLowerCase();
      return promo && (promo.packs || []).find((item) => String(item.id).toLowerCase() === `promo-${suffix}`);
    }
    const expansion = expansionMap.get(expansionId);
    const candidates = (expansion && expansion.packs) || [];
    const named = candidates.find((item) => {
      const englishName = String(item.name || '').toLowerCase();
      const translated = chineseNameByEnglish.get(englishName) || packNameAliases[englishName];
      return translated && String(nameZh || '').includes(translated);
    });
    return named || (candidates.length === 1 ? candidates[0] : null);
  }

  return Object.values(master.cardPackMap || {}).map((pack) => ({
    ...(() => {
      const nameZh = localizeText(locale.Pack && locale.Pack.Name, pack.nameI18nId);
      const matched = chasePack(pack, nameZh);
      return {
        name_zh: nameZh,
        image: matched ? matched.image || '' : '',
        image_source_id: matched ? matched.id || '' : ''
      };
    })(),
    id: pack.id,
    expansion_id: pack.expansionId || '',
    description_zh: localizeText(locale.Pack && locale.Pack.Description, pack.descriptionId),
    timeframe: pack.timeframe || null,
    released_at: pack.releasedAtEpochMs ? new Date(pack.releasedAtEpochMs).toISOString() : '',
    card_ids: (pack.cards && pack.cards.available) || [],
    highlight_card_ids: (pack.cards && pack.cards.highlight) || [],
    point_group_id: pack.pointGroupId || '',
    shop_points: pack.shopPoints || {},
    is_regular: Boolean(pack.isRegular),
    is_promo: String(pack.expansionId || '').toUpperCase().startsWith('PROMO-') ||
      String(localizeText(locale.Pack && locale.Pack.Name, pack.nameI18nId)).includes('特典')
  }));
}

function eventName(event, locale, cardNameMap) {
  const data = event.data || {};
  const resolvers = {
    itemShop: locale.Shop && locale.Shop.Tab,
    pokeGoldShop: locale.Shop && locale.Shop.PokeGold,
    soloBattle: locale.Battle && locale.Battle.SoloEvent,
    pvpEmblemBattle: locale.Battle && locale.Battle.PvpEmblem,
    missionGroup: locale.Mission && locale.Mission.Group,
    rankedPvpSeason: locale.RankedPvp && locale.RankedPvp.Season
  };
  const dictionary = resolvers[event.type] || {};
  const direct = localizeText(dictionary,
    data.nameI18nId || (data.meta && data.meta.nameI18nId) || data.id || data.groupId || data.seasonId);
  if (direct) return direct;
  if (event.type === 'wonderPickFree' || event.type === 'wonderPickChansey') {
    const cardNames = Array.from(new Set((data.packs || []).flatMap((pack) => (pack.contents || [])
      .filter((content) => content.cardId)
      .map((content) => cardNameMap.get(content.cardId))
      .filter(Boolean))));
    const label = event.type === 'wonderPickChansey' ? '吉利蛋得卡挑戰' : '免費得卡挑戰';
    return cardNames.length ? `${cardNames.join('、')} ${label}` : label;
  }
  return event.type;
}

function normalizeEvents(events, locale, cards) {
  const cardNameMap = new Map((cards || []).map((card) => [card.id, card.name_zh]));
  return (events || []).map((event, index) => {
    const data = event.data || {};
    const timeframe = data.timeframe || data.eventTimeframe || null;
    return {
      id: `${event.type}:${data.id || data.groupId || data.seasonId || index}`,
      type: event.type,
      name_zh: eventName(event, locale, cardNameMap),
      timeframe,
      start_epoch: timeframe ? Number(timeframe.startEpoch || 0) : 0,
      end_epoch: timeframe && timeframe.endEpoch ? Number(timeframe.endEpoch) : null,
      data
    };
  });
}

function normalizeNamedMap(map, dictionary) {
  return Object.values(map || {}).map((item) => ({
    id: item.id,
    name_zh: localizeText(dictionary, item.nameI18nId || item.id),
    data: item
  }));
}

function normalizePocketData(payload) {
  const master = payload.raenonxMaster;
  const locale = payload.locale;
  const cards = normalizeCards(master, locale, payload.chaseCards, payload.deckgymCards);
  const events = normalizeEvents(payload.raenonxEvents, locale, cards);
  const hotDecks = normalizeHotDecks(payload.limitlessDecks);
  return {
    cards,
    expansions: normalizeExpansions(master, locale, payload.flibustierSets),
    packs: normalizePacks(master, locale, payload.chaseExpansions, cards),
    events,
    collections: {
      missions: events.filter((event) => event.type === 'missionGroup'),
      battles: events.filter((event) => ['soloBattle', 'pvpEmblemBattle', 'rankedPvpSeason'].includes(event.type)),
      shops: events.filter((event) => ['itemShop', 'pokeGoldShop'].includes(event.type)),
      wonder_picks: events.filter((event) => ['wonderPickFree', 'wonderPickChansey'].includes(event.type)),
      profile_decorations: normalizeNamedMap(master.profileDecorationMap, locale.Item && locale.Item.ProfileDecoration),
      peripheral_goods: normalizeNamedMap(master.peripheralGoodsMap, locale.Item && locale.Item.Peripheral),
      rental_decks: normalizeNamedMap(master.rentalDeckMap, locale.Deck && locale.Deck.Rental),
      preset_decks: normalizeNamedMap(master.presetDeckMap, locale.Deck && locale.Deck.Preset),
      pvp_ranks: normalizeNamedMap(master.pvpRankDataMap, locale.RankedPvp && locale.RankedPvp.Rank),
      hot_decks: hotDecks.items
    },
    auxiliary: {
      rarities: payload.flibustierRarities,
      pull_rates: payload.flibustierPullRates,
      chase_expansions: payload.chaseExpansions,
      hot_deck_meta: hotDecks.meta,
      locale_counts: {
        card_names: Object.keys((locale.Card && locale.Card.Name) || {}).length,
        attack_names: Object.keys((locale.Attack && locale.Attack.Name) || {}).length,
        attack_descriptions: Object.keys((locale.Attack && locale.Attack.Description) || {}).length,
        ability_names: Object.keys((locale.Ability && locale.Ability.Name) || {}).length,
        mission_entries: Object.keys((locale.Mission && locale.Mission.Entry) || {}).length
      }
    }
  };
}

module.exports = {
  SOURCE_URLS,
  extractRaenonxMessages,
  normalizePocketData,
  normalizeHotDecks,
  requestJson,
  requestText
};
