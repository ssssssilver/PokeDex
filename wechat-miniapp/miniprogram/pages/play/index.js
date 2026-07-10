Page({
  data: {
    activeCategory: 'pokemon',
    categories: [
      { id: 'pokemon', name: '宝可梦' },
      { id: 'card', name: '实体卡牌' },
      { id: 'pocket', name: 'Pocket' }
    ]
  },

  onLoad(options) {
    const category = ['pokemon', 'card', 'pocket'].includes(options.category) ? options.category : 'pokemon';
    this.setData({ activeCategory: category });
  },

  selectCategory(event) { this.setData({ activeCategory: event.currentTarget.dataset.id }); },
  openQuiz() { wx.navigateTo({ url: '/pages/quiz/index' }); },
  openTeam() { wx.navigateTo({ url: '/pages/team/index' }); },
  openTypes() { wx.navigateTo({ url: '/pages/type-chart/index' }); },
  openCardQuiz() { wx.navigateTo({ url: '/pages/card-quiz/index' }); },
  openCardPack() { wx.navigateTo({ url: '/pages/card-pack/index' }); },
  openHotDecks() { wx.navigateTo({ url: '/pages/hot-decks/index' }); },
  openPocketPack() { wx.navigateTo({ url: '/pages/pocket-pack/index' }); },
  openPocketEvents(event) { wx.navigateTo({ url: `/pages/pocket-events/index?tab=${event.currentTarget.dataset.tab || 'events'}` }); },
  openPocketDecks() { wx.navigateTo({ url: '/pages/pocket-hot-decks/index' }); }
});
