const api = require('../../services/api');

function decorate(deck) {
  return Object.assign({}, deck, {
    shareText: `${Number(deck.share || 0).toFixed(2)}%`,
    winRateText: `${Number(deck.win_rate || 0).toFixed(2)}%`,
    scoreText: `${Number(deck.wins || 0)} - ${Number(deck.losses || 0)} - ${Number(deck.ties || 0)}`
  });
}

Page({
  data: { loading: true, error: '', decks: [], total: 0 },
  onLoad() { this.loadDecks(); },
  onPullDownRefresh() { this.loadDecks().finally(() => wx.stopPullDownRefresh()); },
  loadDecks() {
    this.setData({ loading: true, error: '' });
    return api.listPocketHotDecks({ page: 1, pageSize: 100 }).then((result) => {
      this.setData({ loading: false, decks: (result.items || []).map(decorate), total: Number(result.total || 0) });
    }).catch(() => this.setData({ loading: false, error: '热门卡组加载失败' }));
  },
  openDeck(event) {
    wx.navigateTo({ url: `/pages/pocket-deck-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },
  retry() { this.loadDecks(); }
});
