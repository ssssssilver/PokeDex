const api = require('../../services/api');

function decorate(deck) {
  return Object.assign({}, deck, {
    shareText: deck.share || `${Number(deck.share_value || 0).toFixed(2)}%`,
    pointsText: `${Number(deck.points || 0)} 分`
  });
}

Page({
  data: { loading: true, error: '', decks: [], total: 0 },

  onLoad() { this.loadDecks(); },
  onPullDownRefresh() { this.loadDecks().finally(() => wx.stopPullDownRefresh()); },

  loadDecks() {
    this.setData({ loading: true, error: '' });
    return api.getHotDecks({ limit: 100 }).then((result) => {
      const decks = (result.items || []).map(decorate);
      this.setData({ loading: false, decks, total: decks.length });
    }).catch(() => this.setData({ loading: false, error: '热门卡组加载失败' }));
  },

  openDeck(event) {
    const deck = event.currentTarget.dataset || {};
    wx.navigateTo({ url: `/pages/deck-detail/index?url=${encodeURIComponent(deck.url || '')}&name=${encodeURIComponent(deck.name || '')}&rank=${deck.rank || ''}&points=${deck.points || ''}&share=${encodeURIComponent(deck.share || '')}` });
  },

  retry() { this.loadDecks(); }
});
