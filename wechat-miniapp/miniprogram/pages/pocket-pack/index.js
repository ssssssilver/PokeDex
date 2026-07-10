const api = require('../../services/api');

function selectRows(items, id) {
  return (items || []).map((item) => Object.assign({}, item, { selected: item.id === id }));
}

function decorateCard(card) {
  const collection = (card.collections || [])[0] || {};
  return Object.assign({}, card, {
    title: card.name_zh || card.name_en,
    setText: `${collection.expansion_id || ''} #${collection.number || ''}`
  });
}

Page({
  data: { loading: true, opening: false, error: '', packs: [], selectedPack: null, result: null, cards: [] },
  onLoad() {
    api.listPocketPacks({ page: 1, pageSize: 100 }).then((result) => {
      const formal = (result.items || []).filter((pack) => pack.is_regular && pack.name_zh);
      const packs = formal.length ? formal : (result.items || []).filter((pack) => pack.name_zh);
      const selectedPack = packs[0] || null;
      this.setData({ loading: false, selectedPack, packs: selectRows(packs, selectedPack && selectedPack.id) });
    }).catch(() => this.setData({ loading: false, error: '卡包加载失败' }));
  },
  selectPack(event) {
    const id = event.currentTarget.dataset.id;
    const selectedPack = this.data.packs.find((pack) => pack.id === id) || null;
    this.setData({ selectedPack, packs: selectRows(this.data.packs, id), result: null, cards: [] });
  },
  openPack() {
    if (this.data.opening || !this.data.selectedPack) return;
    this.setData({ opening: true, error: '' });
    api.openPocketPack({ packId: this.data.selectedPack.id }).then((response) => {
      const result = response.item;
      this.setData({ opening: false, result, cards: result ? (result.cards || []).map(decorateCard) : [] });
    }).catch(() => this.setData({ opening: false, error: '开包失败，请重试' }));
  },
  openCard(event) {
    wx.navigateTo({ url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  }
});
