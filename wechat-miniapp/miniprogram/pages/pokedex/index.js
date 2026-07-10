const api = require('../../services/api');
const storage = require('../../utils/storage');

const PAGE_SIZE = 40;
const MAX_TYPE_FILTERS = 2;
const POKEDEX_GROUPS = {
  national: ['national'],
  kanto: ['kanto', 'letsgo-kanto'],
  johto: ['original-johto', 'updated-johto'],
  hoenn: ['hoenn', 'updated-hoenn'],
  sinnoh: ['original-sinnoh', 'extended-sinnoh'],
  unova: ['original-unova', 'updated-unova'],
  kalos: ['kalos-central', 'kalos-coastal', 'kalos-mountain'],
  alola: ['original-alola', 'original-melemele', 'original-akala', 'original-ulaula', 'original-poni', 'updated-alola', 'updated-melemele', 'updated-akala', 'updated-ulaula', 'updated-poni'],
  galar: ['galar', 'isle-of-armor', 'crown-tundra'],
  hisui: ['hisui'],
  paldea: ['paldea']
};

function padId(id) {
  return String(id || 0).padStart(4, '0');
}

function sourceText(source) {
  if (source === 'remote-cache') return '自有服务缓存';
  if (source === 'local-snapshot') return '本地快照';
  if (source === 'local-seed' || source === 'local') return '本地备份';
  return '图鉴数据';
}

function pickRegionalDex(item, activePokedex) {
  if (item.active_regional_dex) return item.active_regional_dex;
  const dexes = item.regional_dexes || [];
  if (!dexes.length) return null;
  const group = POKEDEX_GROUPS[activePokedex] || (activePokedex ? [activePokedex] : ['national']);
  return dexes.find((dex) => group.includes(dex.key)) ||
    dexes.find((dex) => dex.key === 'national') ||
    dexes[0];
}

function markTypeOptions(types, selectedTypes) {
  return (types || []).map((item) => Object.assign({}, item, {
    selected: selectedTypes.includes(item.id)
  }));
}

function typeNames(types, selectedTypes) {
  return selectedTypes
    .map((id) => ((types || []).find((item) => item.id === id) || {}).name)
    .filter(Boolean);
}

function filterCount(data) {
  return (data.activeTypes || []).length +
    (data.activeGeneration ? 1 : 0) +
    (data.activePokedex && data.activePokedex !== 'national' ? 1 : 0) +
    (data.activeSort && data.activeSort !== 'id' ? 1 : 0);
}

function decorateRow(item, favoriteIds, activePokedex) {
  const regionalDex = pickRegionalDex(item, activePokedex);
  return Object.assign({}, item, {
    idText: `#${padId(item.id)}`,
    liked: favoriteIds.includes(item.id),
    generationText: item.generation ? `第 ${item.generation} 世代` : '世代未知',
    regionalDexText: item.regional_dex_text ||
      (regionalDex ? `${regionalDex.name} #${regionalDex.entry_number}` : '未收录地区编号'),
    moveText: item.move_count ? `${item.move_count} 招式` : '',
    statText: item.stat_total ? `种族值 ${item.stat_total}` : ''
  });
}

function resultCountText(loaded, total) {
  if (!total) return `${loaded} 只宝可梦`;
  return `${loaded} / ${total} 只宝可梦`;
}

Page({
  searchTimer: null,
  requestId: 0,

  data: {
    keyword: '',
    activeTypes: [],
    activeGeneration: 0,
    activePokedex: 'national',
    activeSort: 'id',
    draftTypes: [],
    draftGeneration: 0,
    draftPokedex: 'national',
    draftSort: 'id',
    activeFilterCount: 0,
    activeTypeText: '',
    filterVisible: false,
    sourceText: '',
    resultCountText: '0 只宝可梦',
    types: [],
    filterTypes: [],
    generationOptions: [
      { id: 0, name: '全部' },
      { id: 1, name: '第一世代' },
      { id: 2, name: '第二世代' },
      { id: 3, name: '第三世代' },
      { id: 4, name: '第四世代' },
      { id: 5, name: '第五世代' },
      { id: 6, name: '第六世代' },
      { id: 7, name: '第七世代' },
      { id: 8, name: '第八世代' },
      { id: 9, name: '第九世代' }
    ],
    pokedexOptions: [
      { id: 'national', name: '全国' },
      { id: 'kanto', name: '关都' },
      { id: 'johto', name: '城都' },
      { id: 'hoenn', name: '丰缘' },
      { id: 'sinnoh', name: '神奥' },
      { id: 'unova', name: '合众' },
      { id: 'kalos', name: '卡洛斯' },
      { id: 'alola', name: '阿罗拉' },
      { id: 'galar', name: '伽勒尔' },
      { id: 'hisui', name: '洗翠' },
      { id: 'paldea', name: '帕底亚' }
    ],
    sortOptions: [
      { id: 'id', name: '编号' },
      { id: 'name', name: '名称' },
      { id: 'power', name: '种族值' }
    ],
    pokemon: [],
    favoriteIds: [],
    page: 0,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: false,
    loading: true,
    loadingMore: false
  },

  onLoad() {
    api.getTypes().then((result) => {
      const types = result.items || [];
      this.setData({
        types,
        filterTypes: markTypeOptions(types, this.data.draftTypes)
      });
    });
  },

  onShow() {
    let pendingSearch = '';
    try {
      pendingSearch = wx.getStorageSync('pokechill:pendingSearch') || '';
      if (pendingSearch) wx.removeStorageSync('pokechill:pendingSearch');
    } catch (error) {
      pendingSearch = '';
    }
    this.setData({
      keyword: pendingSearch || this.data.keyword,
      favoriteIds: storage.getFavorites()
    });
    this.loadPokemon(true);
  },

  onUnload() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  },

  onReachBottom() {
    this.loadPokemon(false);
  },

  loadPokemon(reset) {
    if (!reset && (!this.data.hasMore || this.data.loadingMore || this.data.loading)) return Promise.resolve();
    const targetPage = reset ? 1 : this.data.page + 1;
    const requestId = this.requestId + 1;
    this.requestId = requestId;
    this.setData(reset ? {
      loading: true,
      loadingMore: false,
      page: 0,
      hasMore: false
    } : {
      loadingMore: true
    });

    return api.listPokemon({
      keyword: this.data.keyword,
      type: this.data.activeTypes.join(','),
      generation: this.data.activeGeneration,
      pokedex: this.data.activePokedex,
      sort: this.data.activeSort,
      page: targetPage,
      pageSize: this.data.pageSize
    }).then((result) => {
      if (requestId !== this.requestId) return;
      const favoriteIds = storage.getFavorites();
      const rows = (result.items || []).map((item) => decorateRow(item, favoriteIds, this.data.activePokedex));
      const pokemon = reset ? rows : this.data.pokemon.concat(rows);
      const total = Number(result.total || pokemon.length);
      this.setData({
        loading: false,
        loadingMore: false,
        favoriteIds,
        sourceText: sourceText(result.source),
        pokemon,
        page: Number(result.page || targetPage),
        total,
        hasMore: Boolean(result.hasMore),
        resultCountText: resultCountText(pokemon.length, total)
      });
    }).catch(() => {
      if (requestId !== this.requestId) return;
      this.setData({
        loading: false,
        loadingMore: false,
        pokemon: reset ? [] : this.data.pokemon,
        sourceText: '加载失败',
        resultCountText: reset ? '0 只宝可梦' : this.data.resultCountText
      });
    });
  },

  scheduleLoad() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadPokemon(true), 250);
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
    this.scheduleLoad();
  },

  submitSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.loadPokemon(true);
  },

  openFilter() {
    this.setData({
      filterVisible: true,
      draftTypes: this.data.activeTypes.slice(),
      draftGeneration: this.data.activeGeneration,
      draftPokedex: this.data.activePokedex,
      draftSort: this.data.activeSort,
      filterTypes: markTypeOptions(this.data.types, this.data.activeTypes)
    });
  },

  closeFilter() {
    this.setData({ filterVisible: false });
  },

  stopTap() {},

  toggleDraftType(event) {
    const type = event.currentTarget.dataset.type;
    const draftTypes = this.data.draftTypes.slice();
    const index = draftTypes.indexOf(type);
    if (index >= 0) {
      draftTypes.splice(index, 1);
    } else if (draftTypes.length < MAX_TYPE_FILTERS) {
      draftTypes.push(type);
    } else {
      wx.showToast({ title: `最多选择 ${MAX_TYPE_FILTERS} 个属性`, icon: 'none' });
      return;
    }
    this.setData({
      draftTypes,
      filterTypes: markTypeOptions(this.data.types, draftTypes)
    });
  },

  selectDraftGeneration(event) {
    this.setData({ draftGeneration: Number(event.currentTarget.dataset.generation || 0) });
  },

  selectDraftPokedex(event) {
    this.setData({ draftPokedex: event.currentTarget.dataset.pokedex || 'national' });
  },

  selectDraftSort(event) {
    this.setData({ draftSort: event.currentTarget.dataset.sort || 'id' });
  },

  clearDraftFilters() {
    this.setData({
      draftTypes: [],
      draftGeneration: 0,
      draftPokedex: 'national',
      draftSort: 'id',
      filterTypes: markTypeOptions(this.data.types, [])
    });
  },

  confirmFilters() {
    const next = {
      activeTypes: this.data.draftTypes.slice(),
      activeGeneration: this.data.draftGeneration,
      activePokedex: this.data.draftPokedex,
      activeSort: this.data.draftSort,
      filterVisible: false
    };
    next.activeFilterCount = filterCount(next);
    next.activeTypeText = typeNames(this.data.types, next.activeTypes).join(' / ');
    this.setData(next);
    this.loadPokemon(true);
  },

  resetFilters() {
    const next = {
      activeTypes: [],
      activeGeneration: 0,
      activePokedex: 'national',
      activeSort: 'id',
      draftTypes: [],
      draftGeneration: 0,
      draftPokedex: 'national',
      draftSort: 'id',
      activeFilterCount: 0,
      activeTypeText: '',
      filterTypes: markTypeOptions(this.data.types, [])
    };
    this.setData(next);
    this.loadPokemon(true);
  },

  openPokemon(event) {
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${event.currentTarget.dataset.id}` });
  },

  toggleFavorite(event) {
    const id = Number(event.currentTarget.dataset.id);
    const liked = storage.toggleFavorite(id);
    const favoriteIds = storage.getFavorites();
    this.setData({
      favoriteIds,
      pokemon: this.data.pokemon.map((item) => Object.assign({}, item, {
        liked: item.id === id ? liked : favoriteIds.includes(item.id)
      }))
    });
    wx.showToast({
      title: liked ? '已收藏' : '已取消',
      icon: 'none'
    });
  }
});
