Page({
  openQuiz() {
    wx.navigateTo({ url: '/pages/quiz/index' });
  },

  openTeam() {
    wx.navigateTo({ url: '/pages/team/index' });
  },

  openTypes() {
    wx.navigateTo({ url: '/pages/type-chart/index' });
  },

  openCardQuiz() {
    wx.navigateTo({ url: '/pages/card-quiz/index' });
  },

  openCardPack() {
    wx.navigateTo({ url: '/pages/card-pack/index' });
  },

  showChallenge() {
    wx.showToast({ title: '随机挑战下一版接入', icon: 'none' });
  }
});
