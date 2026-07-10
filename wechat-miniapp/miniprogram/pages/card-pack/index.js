const api = require('../../services/api');

function markSets(sets, selectedId) {
  return (sets || []).map((set) => Object.assign({}, set, {
    selected: String(set.id) === String(selectedId)
  }));
}

function decorateCard(card) {
  return Object.assign({}, card, {
    title: card.display_name || card.name_zh || card.name,
    rarityText: card.rarity_name || card.rarity || ''
  });
}

Page({
  data: {
    loading: true,
    opening: false,
    setOptions: [],
    selectedSetId: '',
    selectedSet: null,
    pack: null,
    cards: [],
    sourceText: ''
  },

  onLoad() {
    api.getPtcgMeta().then((result) => {
      const sets = (result.item && result.item.sets ? result.item.sets : []).slice(0, 24);
      const selectedSet = sets[0] || null;
      this.setData({
        loading: false,
        selectedSetId: selectedSet ? selectedSet.id : '',
        selectedSet,
        setOptions: markSets(sets, selectedSet ? selectedSet.id : '')
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  selectSet(event) {
    const id = event.currentTarget.dataset.id || '';
    const selectedSet = this.data.setOptions.find((set) => String(set.id) === String(id)) || null;
    this.setData({
      selectedSetId: id,
      selectedSet,
      setOptions: markSets(this.data.setOptions, id),
      pack: null,
      cards: []
    });
  },

  openPack() {
    if (this.data.opening) return;
    this.setData({ opening: true });
    api.openCardPack({
      setId: this.data.selectedSetId,
      count: 10
    }).then((result) => {
      const pack = result.item || null;
      this.setData({
        opening: false,
        pack,
        cards: pack ? (pack.cards || []).map(decorateCard) : [],
        sourceText: result.source === 'ptcg-cache' ? 'PTCG 自有缓存' : '本地样例'
      });
    }).catch(() => {
      this.setData({ opening: false });
      wx.showToast({ title: '抽包失败', icon: 'none' });
    });
  },

  openCard(event) {
    const id = event.currentTarget.dataset.id || '';
    if (!id) return;
    wx.navigateTo({ url: `/pages/card-detail/index?id=${encodeURIComponent(id)}` });
  }
});
