const api = require('../../services/api');
const storage = require('../../utils/storage');

const PAGE_SIZE = 30;
const TYPE_META = {
  1: { name: '草', color: '#2f9e55', iconType: 'Grass' }, 2: { name: '火', color: '#df5b45', iconType: 'Fire' },
  3: { name: '水', color: '#3d82d7', iconType: 'Water' }, 4: { name: '雷', color: '#c89116', iconType: 'Lightning' },
  5: { name: '超', color: '#b45088', iconType: 'Psychic' }, 6: { name: '斗', color: '#b16d3b', iconType: 'Fighting' },
  7: { name: '恶', color: '#4c5563', iconType: 'Darkness' }, 8: { name: '钢', color: '#718096', iconType: 'Metal' },
  9: { name: '无色', color: '#8a919b', iconType: 'Colorless' }
};

function optionRows(object) {
  return Object.keys(object || {}).map((id) => ({ id, name: (object[id] || {}).label || id }));
}

function markOptions(items, selected) {
  return (items || []).map((item) => Object.assign({}, item, { selected: String(item.id) === String(selected) }));
}

function activeFilterCount(data) {
  return [data.activeExpansion, data.activeRarity, data.activeType, data.activePokemonId,
    data.activeSort && data.activeSort !== 'set' ? data.activeSort : ''].filter(Boolean).length;
}

function decorateCard(card, favorites, owned) {
  const collection = (card.collections || [])[0] || {};
  const typeBadges = (card.types || []).map((id) => Object.assign({ id }, TYPE_META[id] || TYPE_META[9]));
  return Object.assign({}, card, {
    collection,
    title: card.name_zh || card.name_en,
    subtitle: card.name_en && card.name_en !== card.name_zh ? card.name_en : '',
    setText: [collection.expansion_name_zh || collection.expansion_id, collection.number ? `#${collection.number}` : ''].filter(Boolean).join(' · '),
    metaText: [card.rarity, card.card_type === 'pokemon' ? '宝可梦' : '训练家', card.hp ? `HP ${card.hp}` : ''].filter(Boolean).join(' · '),
    typeBadges,
    favorite: favorites.includes(String(card.id)),
    owned: owned.includes(String(card.id))
  });
}

Page({
  searchTimer: null,
  requestId: 0,
  data: {
    keyword: '',
    activeExpansion: '',
    activeRarity: '',
    activeType: '',
    activePokemonId: 0,
    activeSort: 'set',
    draftExpansion: '',
    draftRarity: '',
    draftType: '',
    draftSort: 'set',
    filterVisible: false,
    filterCount: 0,
    cards: [],
    page: 0,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false,
    error: '',
    expansionOptions: [],
    rarityOptions: [],
    typeOptions: [
      { id: 'pokemon', name: '宝可梦' },
      { id: 'trainer', name: '训练家' }
    ],
    sortOptions: [
      { id: 'set', name: '系列编号' },
      { id: 'name', name: '名称' },
      { id: 'number', name: '编号' },
      { id: 'rarity', name: '稀有度' }
    ],
    filterExpansions: [],
    filterRarities: [],
    filterTypes: [],
    filterSorts: []
  },

  onLoad() {
    Promise.all([api.listPocketExpansions({ page: 1, pageSize: 50 }), api.getPocketRarities()])
      .then(([expansionResult, rarityResult]) => {
        const expansions = (expansionResult.items || []).map((item) => ({
          id: item.id,
          name: item.name_long_zh || item.name_zh || item.id,
          code: item.id
        }));
        const rarities = optionRows(rarityResult.item || {});
        this.setData({
          expansionOptions: expansions,
          rarityOptions: rarities,
          filterExpansions: markOptions(expansions, this.data.activeExpansion),
          filterRarities: markOptions(rarities, this.data.activeRarity),
          filterTypes: markOptions(this.data.typeOptions, this.data.activeType),
          filterSorts: markOptions(this.data.sortOptions, this.data.activeSort)
        });
      });
  },

  onShow() {
    let keyword = '';
    let pokemonId = 0;
    try {
      keyword = wx.getStorageSync('pokechill:pendingPocketSearch') || '';
      pokemonId = Number(wx.getStorageSync('pokechill:pendingPocketPokemonId') || 0);
      if (keyword) wx.removeStorageSync('pokechill:pendingPocketSearch');
      if (pokemonId) wx.removeStorageSync('pokechill:pendingPocketPokemonId');
    } catch (error) {
      keyword = '';
      pokemonId = 0;
    }
    const next = {
      keyword: keyword || this.data.keyword,
      activePokemonId: pokemonId || this.data.activePokemonId
    };
    next.filterCount = activeFilterCount(Object.assign({}, this.data, next));
    this.setData(next);
    this.loadCards(true);
  },

  onPullDownRefresh() {
    this.loadCards(true).finally(() => wx.stopPullDownRefresh());
  },

  onReachBottom() { this.loadCards(false); },
  onUnload() { if (this.searchTimer) clearTimeout(this.searchTimer); },

  loadCards(reset) {
    if (!reset && (!this.data.hasMore || this.data.loading || this.data.loadingMore)) return Promise.resolve();
    const page = reset ? 1 : this.data.page + 1;
    const requestId = ++this.requestId;
    this.setData(reset ? { loading: true, error: '', page: 0, hasMore: false } : { loadingMore: true });
    return api.listPocketCards({
      keyword: String(this.data.keyword || '').trim(),
      expansion: this.data.activeExpansion,
      rarity: this.data.activeRarity,
      type: this.data.activeType,
      pokemonId: this.data.activePokemonId || '',
      sort: this.data.activeSort,
      page,
      pageSize: PAGE_SIZE
    }).then((result) => {
      if (requestId !== this.requestId) return;
      const favorites = storage.getPocketFavorites();
      const owned = storage.getPocketOwned();
      const rows = (result.items || []).map((card) => decorateCard(card, favorites, owned));
      this.setData({
        loading: false,
        loadingMore: false,
        cards: reset ? rows : this.data.cards.concat(rows),
        page: Number(result.page || page),
        total: Number(result.total || rows.length),
        hasMore: Boolean(result.hasMore)
      });
    }).catch(() => {
      if (requestId !== this.requestId) return;
      this.setData({ loading: false, loadingMore: false, cards: reset ? [] : this.data.cards, error: '卡牌加载失败，点击重试' });
    });
  },

  scheduleLoad() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadCards(true), 260);
  },

  onKeywordInput(event) {
    const next = { keyword: event.detail.value, activePokemonId: 0 };
    next.filterCount = activeFilterCount(Object.assign({}, this.data, next));
    this.setData(next);
    this.scheduleLoad();
  },

  submitSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.loadCards(true);
  },

  openFilter() {
    this.setData({
      filterVisible: true,
      draftExpansion: this.data.activeExpansion,
      draftRarity: this.data.activeRarity,
      draftType: this.data.activeType,
      draftSort: this.data.activeSort,
      filterExpansions: markOptions(this.data.expansionOptions, this.data.activeExpansion),
      filterRarities: markOptions(this.data.rarityOptions, this.data.activeRarity),
      filterTypes: markOptions(this.data.typeOptions, this.data.activeType),
      filterSorts: markOptions(this.data.sortOptions, this.data.activeSort)
    });
  },

  closeFilter() { this.setData({ filterVisible: false }); },
  stopTap() {},

  selectDraft(event) {
    const field = event.currentTarget.dataset.field;
    const id = event.currentTarget.dataset.id || '';
    const dataField = `draft${field}`;
    const isSort = field === 'Sort';
    const next = isSort ? id : (this.data[dataField] === id ? '' : id);
    const sources = { Expansion: this.data.expansionOptions, Rarity: this.data.rarityOptions, Type: this.data.typeOptions, Sort: this.data.sortOptions };
    const lists = { Expansion: 'filterExpansions', Rarity: 'filterRarities', Type: 'filterTypes', Sort: 'filterSorts' };
    this.setData({ [dataField]: next, [lists[field]]: markOptions(sources[field], next) });
  },

  clearDraft() {
    this.setData({
      draftExpansion: '', draftRarity: '', draftType: '', draftSort: 'set',
      filterExpansions: markOptions(this.data.expansionOptions, ''),
      filterRarities: markOptions(this.data.rarityOptions, ''),
      filterTypes: markOptions(this.data.typeOptions, ''),
      filterSorts: markOptions(this.data.sortOptions, 'set')
    });
  },

  confirmFilter() {
    const next = {
      activeExpansion: this.data.draftExpansion,
      activeRarity: this.data.draftRarity,
      activeType: this.data.draftType,
      activeSort: this.data.draftSort,
      filterVisible: false
    };
    next.filterCount = activeFilterCount(Object.assign({}, this.data, next));
    this.setData(next);
    this.loadCards(true);
  },

  resetFilters() {
    this.setData({
      activeExpansion: '', activeRarity: '', activeType: '', activePokemonId: 0, activeSort: 'set',
      draftExpansion: '', draftRarity: '', draftType: '', draftSort: 'set', filterCount: 0
    });
    this.loadCards(true);
  },

  openCard(event) {
    wx.navigateTo({ url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },

  toggleFavorite(event) {
    const id = event.currentTarget.dataset.id;
    const favorite = storage.togglePocketFavorite(id);
    const favorites = storage.getPocketFavorites();
    this.setData({ cards: this.data.cards.map((card) => Object.assign({}, card, { favorite: card.id === id ? favorite : favorites.includes(String(card.id)) })) });
  },

  toggleOwned(event) {
    const id = event.currentTarget.dataset.id;
    const ownedState = storage.togglePocketOwned(id);
    const owned = storage.getPocketOwned();
    this.setData({ cards: this.data.cards.map((card) => Object.assign({}, card, { owned: card.id === id ? ownedState : owned.includes(String(card.id)) })) });
  }
});
