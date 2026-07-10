const api = require('../../services/api');
const storage = require('../../utils/storage');

Page({
  data: {
    loading: true,
    keyword: '',
    homeMode: 'pokemon',
    dailyPokemon: null,
    dailyCard: null,
    quiz: null,
    featured: [],
    featuredCards: [],
    hotDecks: [],
    recent: [],
    recentCards: []
  },

  onShow() {
    this.loadHome();
  },

  loadHome() {
    this.setData({ loading: true });
    Promise.all([
      api.listPokemon({ sort: 'id' }),
      api.getDailyQuiz(),
      api.listCards({ sort: 'releaseDate', page: 1, pageSize: 6 }),
      api.getHotDecks({ limit: 6 })
    ]).then(([pokemonResult, quizResult, cardResult, deckResult]) => {
      const allPokemon = pokemonResult.items || [];
      const allCards = cardResult.items || [];
      const featured = allPokemon.slice(0, 6);
      const featuredCards = allCards.slice(0, 4);
      const quiz = quizResult.item;
      const dailyPokemon = allPokemon.find((item) => item.id === quiz.answerId) || featured[0];
      const dailyCard = featuredCards[0] || null;
      this.setData({
        loading: false,
        featured,
        featuredCards,
        hotDecks: deckResult.items || [],
        quiz,
        dailyPokemon,
        dailyCard,
        recent: storage.getRecentViews(),
        recentCards: storage.getRecentCards()
      });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
  },

  switchHomeMode(event) {
    this.setData({ homeMode: event.currentTarget.dataset.target || 'pokemon' });
  },

  submitSearch() {
    const keyword = this.data.keyword.trim();
    if (this.data.homeMode === 'card') {
      if (keyword) wx.setStorageSync('pokechill:pendingCardSearch', keyword);
      wx.switchTab({ url: '/pages/carddex/index' });
      return;
    }
    if (keyword) wx.setStorageSync('pokechill:pendingSearch', keyword);
    wx.switchTab({
      url: '/pages/pokedex/index'
    });
  },

  openPokemon(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${id}` });
  },

  openQuiz() {
    wx.navigateTo({ url: '/pages/quiz/index' });
  },

  openTeam() {
    wx.navigateTo({ url: '/pages/team/index' });
  },

  openTypes() {
    wx.navigateTo({ url: '/pages/type-chart/index' });
  },

  openPokedex() {
    wx.switchTab({ url: '/pages/pokedex/index' });
  },

  openCarddex() {
    wx.switchTab({ url: '/pages/carddex/index' });
  },

  openCard(event) {
    wx.navigateTo({ url: `/pages/card-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },

  openCardQuiz() {
    wx.navigateTo({ url: '/pages/card-quiz/index' });
  },

  openCardPack() {
    wx.navigateTo({ url: '/pages/card-pack/index' });
  },

  openPlay() {
    wx.navigateTo({ url: '/pages/play/index' });
  }
});
