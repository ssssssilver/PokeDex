const api = require('../../services/api');

function decorate(item) {
  const source = item || {};
  return Object.assign({}, source, {
    shareText: source.archetype ? `${Number(source.archetype.share || 0).toFixed(2)}%` : '',
    winRateText: source.archetype ? `${Number(source.archetype.win_rate || 0).toFixed(2)}%` : '',
    resultText: source.representative ? [source.representative.player, source.representative.place ? `第 ${source.representative.place} 名` : ''].filter(Boolean).join(' · ') : '',
    cards: (source.cards || []).map((card) => Object.assign({}, card, {
      displayName: card.name_zh || card.name,
      setText: `${card.set || ''} #${card.number || ''}`
    }))
  });
}

Page({
  data: { loading: true, error: '', deck: null },
  onLoad(options) { this.deckId = decodeURIComponent(options.id || ''); this.loadDeck(); },
  loadDeck() {
    this.setData({ loading: true, error: '' });
    api.getPocketHotDeck(this.deckId).then((result) => {
      if (!result.item) throw new Error('卡组不存在');
      const deck = decorate(result.item);
      this.setData({ loading: false, deck });
      wx.setNavigationBarTitle({ title: deck.name || 'Pocket 卡组详情' });
    }).catch((error) => this.setData({ loading: false, error: error.message || '卡组详情加载失败' }));
  },
  copyDeck() {
    const text = this.data.deck && this.data.deck.copy_text;
    if (!text) return;
    wx.setClipboardData({ data: text, success: () => wx.showToast({ title: '牌表已复制', icon: 'success' }) });
  },
  openCard(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(id)}` });
  },
  previewCard(event) {
    const current = event.currentTarget.dataset.src;
    const urls = (this.data.deck.cards || []).map((card) => card.image).filter(Boolean);
    if (current) wx.previewImage({ current, urls });
  },
  retry() { this.loadDeck(); }
});
