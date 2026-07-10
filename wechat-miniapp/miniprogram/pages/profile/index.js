const config = require('../../config');
const storage = require('../../utils/storage');

Page({
  data: {
    version: config.appVersion,
    pokemonStats: { favorites: 0, teams: 0, quizCount: 0 },
    cardStats: { favorites: 0, owned: 0, wishlist: 0 },
    pocketStats: { favorites: 0, owned: 0 },
    teams: []
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    const teams = storage.getTeams();
    this.setData({
      pokemonStats: {
        favorites: storage.getFavorites().length,
        teams: teams.length,
        quizCount: Object.keys(storage.getQuizHistory()).length
      },
      cardStats: {
        favorites: storage.getCardFavorites().length,
        owned: storage.getOwnedCards().length,
        wishlist: storage.getWishlistCards().length
      },
      pocketStats: {
        favorites: storage.getPocketFavorites().length,
        owned: storage.getPocketOwned().length
      },
      teams: teams.map((team) => Object.assign({}, team, {
        memberCount: team.memberIds.length,
        memberText: team.memberIds.length ? `${team.memberIds.length} / 6` : '未添加'
      }))
    });
  },

  openPokedex() { wx.switchTab({ url: '/pages/pokedex/index' }); },
  openCarddex() { wx.switchTab({ url: '/pages/carddex/index' }); },
  openPocket() { wx.switchTab({ url: '/pages/pocket/index' }); },
  openTeam() { wx.navigateTo({ url: '/pages/team/index' }); },
  openQuiz() { wx.navigateTo({ url: '/pages/quiz/index' }); },
  openPlay() { wx.navigateTo({ url: '/pages/play/index' }); }
});
