const api = require('../../services/api');
const storage = require('../../utils/storage');

const ENERGY_BY_NAME = {
  '草': { id: 'Grass', name: '草', symbol: '草', color: '#2f9e44' },
  '火': { id: 'Fire', name: '火', symbol: '火', color: '#e85d3f' },
  '水': { id: 'Water', name: '水', symbol: '水', color: '#2f80ed' },
  '雷': { id: 'Lightning', name: '雷', symbol: '雷', color: '#d99a00' },
  '电': { id: 'Lightning', name: '雷', symbol: '雷', color: '#d99a00' },
  '超': { id: 'Psychic', name: '超', symbol: '超', color: '#db2777' },
  '超能力': { id: 'Psychic', name: '超', symbol: '超', color: '#db2777' },
  '斗': { id: 'Fighting', name: '斗', symbol: '斗', color: '#c2410c' },
  '恶': { id: 'Darkness', name: '恶', symbol: '恶', color: '#374151' },
  '钢': { id: 'Metal', name: '钢', symbol: '钢', color: '#64748b' },
  '妖': { id: 'Fairy', name: '妖', symbol: '妖', color: '#ec4899' },
  '妖精': { id: 'Fairy', name: '妖', symbol: '妖', color: '#ec4899' },
  '龙': { id: 'Dragon', name: '龙', symbol: '龙', color: '#2563eb' },
  '无色': { id: 'Colorless', name: '无色', symbol: '无', color: '#8a8f98' }
};

function valueText(value) {
  if (value === undefined || value === null || value === '') return '';
  return `${value}`;
}

function row(label, value) {
  const text = valueText(value);
  return text ? { label, value: text } : null;
}

function joinValues(items) {
  return (items || []).filter(Boolean).join('、');
}

function normalizeEnergy(item) {
  const source = item || {};
  const name = source.name || source.id || '';
  return {
    id: source.id || name,
    name,
    symbol: source.symbol || String(name).slice(0, 1),
    color: source.color || '#64748b'
  };
}

function normalizeEnergies(items, text) {
  if (items && items.length) return items.map(normalizeEnergy);
  return String(text || '')
    .split('、')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((name) => normalizeEnergy(ENERGY_BY_NAME[name] || { name }));
}

function buildInfoRows(card) {
  return [
    row('卡牌编号', card.number ? `${card.set_id || ''} #${card.number}` : card.id),
    row('系列', [card.set_name, card.set_series].filter(Boolean).join(' / ')),
    row('稀有度', card.rarity_name || card.rarity),
    row('画师', card.artist),
    row('卡牌类型', [card.supertype_name, ...(card.subtype_names || [])].filter(Boolean).join(' / ')),
    row('HP', card.hp),
    row('规则标记', card.regulation_mark),
    row('发售日期', card.set_release_date || (card.set && card.set.release_date))
  ].filter(Boolean);
}

function buildBattleRows(card) {
  return [
    row('进化自', card.evolves_from),
    row('可进化为', joinValues(card.evolves_to)),
    row('全国图鉴', (card.national_pokedex_numbers || []).map((id) => `#${id}`).join('、'))
  ].filter(Boolean);
}

function decorateCard(card) {
  const title = card.display_name || card.name_zh || card.name;
  const descriptionText = card.description_zh || card.flavor_text || '';
  const descriptionEnglish = card.description_zh ? (card.flavor_text_en || card.flavor_text || '') : '';
  const decorateTextBlock = (item) => Object.assign({}, item, {
    display_name: item.name_zh || item.name,
    english_name: item.name_zh && item.name_zh !== item.name ? item.name : '',
    display_text: item.text_zh || item.text || item.original_text || '',
    english_text: item.text_zh ? (item.original_text || item.text || '') : ''
  });
  const ruleBlocks = (card.rule_blocks || (card.rules || []).map((rule) => ({ original_text: rule })))
    .map((rule, index) => ({
      key: `${index}-${rule.text_zh || rule.original_text || ''}`,
      display_text: rule.text_zh || rule.original_text || '',
      english_text: rule.text_zh ? rule.original_text || '' : ''
    }));
  return Object.assign({
    type_energy: [],
    abilities: [],
    attacks: [],
    weaknesses: [],
    resistances: [],
    rules: [],
    retreat_cost_energy: [],
    pokemon_refs: [],
    national_pokedex_numbers: [],
    legalities_text: []
  }, card, {
    title,
    subtitle: card.name_zh && card.name_zh !== card.name ? card.name : '',
    type_energy: normalizeEnergies(card.type_energy),
    abilities: (card.abilities || []).map(decorateTextBlock),
    attacks: (card.attacks || []).map((attack) => Object.assign({}, decorateTextBlock(attack), {
      cost_energy: normalizeEnergies(attack.cost_energy, attack.cost_text)
    })),
    ruleBlocks,
    retreat_cost_energy: normalizeEnergies(card.retreat_cost_energy, card.retreat_cost_text),
    descriptionText,
    descriptionEnglish,
    descriptionSource: card.description_source || (descriptionText ? '原卡牌描述' : ''),
    typeText: (card.type_names || []).join(' / '),
    legalitiesText: (card.legalities_text || []).map((item) => `${item.name}${item.status_name ? `：${item.status_name}` : ''}`).join('、')
  });
}

Page({
  data: {
    id: '',
    card: null,
    infoRows: [],
    battleRows: [],
    favorite: false,
    owned: false,
    wishlisted: false
  },

  onLoad(options) {
    this.setData({ id: decodeURIComponent(options.id || '') });
    this.loadCard();
  },

  loadCard() {
    api.getCardById(this.data.id).then((result) => {
      const raw = result.item;
      if (!raw) return;
      const card = decorateCard(raw);
      this.setData({
        card,
        infoRows: buildInfoRows(card),
        battleRows: buildBattleRows(card),
        favorite: storage.isCardFavorite(card.id),
        owned: storage.isCardOwned(card.id),
        wishlisted: storage.isCardWishlisted(card.id)
      });
      storage.addRecentCard(card);
    });
  },

  previewImage() {
    const card = this.data.card || {};
    const url = card.image_large || card.image || card.image_small;
    if (!url) return;
    wx.previewImage({
      urls: [url],
      current: url
    });
  },

  toggleFavorite() {
    const favorite = storage.toggleCardFavorite(this.data.card.id);
    this.setData({ favorite });
    wx.showToast({ title: favorite ? '已收藏' : '已取消', icon: 'none' });
  },

  toggleOwned() {
    const owned = storage.toggleCardOwned(this.data.card.id);
    this.setData({ owned });
    wx.showToast({ title: owned ? '已标记拥有' : '已取消拥有', icon: 'none' });
  },

  toggleWishlist() {
    const wishlisted = storage.toggleCardWishlist(this.data.card.id);
    this.setData({ wishlisted });
    wx.showToast({ title: wishlisted ? '已加入愿望单' : '已移出愿望单', icon: 'none' });
  },

  openPokemon(event) {
    const id = Number(event.currentTarget.dataset.id || 0);
    if (!id) return;
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${id}` });
  }
});
