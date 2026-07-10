const api = require('../../services/api');
const storage = require('../../utils/storage');

Page({
  data: {
    quiz: null,
    selectedId: 0,
    result: null,
    revealedHints: 2
  },

  onLoad() {
    api.getDailyQuiz().then((result) => {
      this.setData({ quiz: result.item });
    });
  },

  chooseOption(event) {
    if (this.data.result) return;
    this.setData({ selectedId: Number(event.currentTarget.dataset.id) });
  },

  submitAnswer() {
    if (!this.data.selectedId) {
      wx.showToast({ title: '先选一个答案', icon: 'none' });
      return;
    }
    api.submitDailyQuiz({
      quizId: this.data.quiz.quizId,
      selectedId: this.data.selectedId,
      answerId: this.data.quiz.answerId
    }).then((response) => {
      this.setData({ result: response.item, revealedHints: this.data.quiz.hints.length });
      storage.saveQuizResult(this.data.quiz.quizId, response.item);
    });
  },

  revealHint() {
    this.setData({
      revealedHints: Math.min(this.data.quiz.hints.length, this.data.revealedHints + 1)
    });
  },

  openAnswer() {
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${this.data.quiz.answerId}` });
  }
});

