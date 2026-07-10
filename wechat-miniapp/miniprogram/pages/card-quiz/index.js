const api = require('../../services/api');

Page({
  data: {
    quiz: null,
    selectedId: '',
    result: null,
    revealed: false
  },

  onLoad() {
    this.loadQuiz();
  },

  loadQuiz() {
    api.getDailyCardQuiz().then((result) => {
      this.setData({
        quiz: result.item,
        selectedId: '',
        result: null,
        revealed: false
      });
    });
  },

  chooseOption(event) {
    if (this.data.result) return;
    this.setData({ selectedId: event.currentTarget.dataset.id || '' });
  },

  submitAnswer() {
    if (!this.data.quiz || !this.data.selectedId) {
      wx.showToast({ title: '先选一张卡牌', icon: 'none' });
      return;
    }

    api.submitDailyCardQuiz({
      quizId: this.data.quiz.quizId,
      answerId: this.data.quiz.answerId,
      selectedId: this.data.selectedId
    }).then((result) => {
      this.setData({
        result: result.item,
        revealed: true
      });
    });
  },

  openAnswer() {
    if (!this.data.quiz) return;
    wx.navigateTo({ url: `/pages/card-detail/index?id=${encodeURIComponent(this.data.quiz.answerId)}` });
  },

  reloadQuiz() {
    this.loadQuiz();
  }
});
