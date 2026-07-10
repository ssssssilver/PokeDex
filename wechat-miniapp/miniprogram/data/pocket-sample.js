const CARDS = [
  {
    id: 'PK_10_000010_00',
    name_zh: '妙蛙種子',
    name_en: 'Bulbasaur',
    card_type: 'pokemon',
    rarity: 'C',
    hp: 70,
    types: [1],
    retreat: 1,
    image: 'https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/images/cards/a1-001.png',
    collections: [{ expansion_id: 'A1', expansion_name_zh: '最強的基因', number: 1 }],
    attacks: [{ name_zh: '藤鞭', energy_total: 2, damage: { value: 40 }, description_zh_template: '' }],
    abilities: []
  },
  {
    id: 'PK_10_000040_00',
    name_zh: '妙蛙花ex',
    name_en: 'Venusaur ex',
    card_type: 'pokemon',
    rarity: 'RR',
    hp: 190,
    types: [1],
    retreat: 3,
    image: 'https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/images/cards/a1-004.png',
    collections: [{ expansion_id: 'A1', expansion_name_zh: '最強的基因', number: 4 }],
    attacks: [{ name_zh: '巨大綻放', energy_total: 4, damage: { value: 100 }, description_zh_template: '將這隻寶可夢恢復30HP。' }],
    abilities: []
  },
  {
    id: 'PK_10_000330_00',
    name_zh: '小火龍',
    name_en: 'Charmander',
    card_type: 'pokemon',
    rarity: 'C',
    hp: 60,
    types: [2],
    retreat: 1,
    image: 'https://raw.githubusercontent.com/chase-manning/pokemon-tcg-pocket-cards/refs/heads/main/images/cards/a1-033.png',
    collections: [{ expansion_id: 'A1', expansion_name_zh: '最強的基因', number: 33 }],
    attacks: [{ name_zh: '火花', energy_total: 1, damage: { value: 30 }, description_zh_template: '' }],
    abilities: []
  }
];

const EXPANSIONS = [
  { id: 'A1', name_zh: 'A1', name_long_zh: '最強的基因', series: 'A', release_date: '2024-10-30', card_count: 286 }
];

const PACKS = [
  { id: 'AN001_0010_00_000', expansion_id: 'A1', name_zh: '最強的基因 超夢', description_zh: '「最強的基因 超夢」的卡牌包。', is_regular: true, card_ids: CARDS.map((card) => card.id) }
];

const EVENTS = [
  { id: 'missionGroup:sample', type: 'missionGroup', name_zh: '期間任務', status: 'current', start_epoch: 0, end_epoch: null, data: {} },
  { id: 'soloBattle:sample', type: 'soloBattle', name_zh: '掉落活動', status: 'upcoming', start_epoch: 0, end_epoch: null, data: {} }
];

const HOT_DECKS = [
  { id: 'sample-pocket-deck', rank: 1, name: 'Mewtwo ex Gardevoir', count: 100, share: 12.5, wins: 200, losses: 160, ties: 5, win_rate: 54.8, images: [], url: '' }
];

module.exports = { CARDS, EXPANSIONS, PACKS, EVENTS, HOT_DECKS };
