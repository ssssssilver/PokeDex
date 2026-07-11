import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const { localize } = require('../../i18n/index.js')
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    quiz: null,
    selectedId: '',
    result: null,
    revealed: false,
  },
  onLoad() {
    this.loadQuiz()
  },
  loadQuiz() {
    api.getDailyCardQuiz().then((result) => {
      this.setData({
        quiz: result.item,
        selectedId: '',
        result: null,
        revealed: false,
      })
    })
  },
  chooseOption(event) {
    if (this.data.result) return
    this.setData({
      selectedId: getTarget(event.currentTarget, Taro).dataset.id || '',
    })
  },
  submitAnswer() {
    if (!this.data.quiz || !this.data.selectedId) {
      Taro.showToast({
        title: '先选一张卡牌',
        icon: 'none',
      })
      return
    }
    api
      .submitDailyCardQuiz({
        quizId: this.data.quiz.quizId,
        answerId: this.data.quiz.answerId,
        selectedId: this.data.selectedId,
      })
      .then((result) => {
        this.setData({
          result: result.item,
          revealed: true,
        })
      })
  },
  openAnswer() {
    if (!this.data.quiz) return
    Taro.navigateTo({
      url: `/pages/card-detail/index?id=${encodeURIComponent(
        this.data.quiz.answerId
      )}`,
    })
  },
  reloadQuiz() {
    this.loadQuiz()
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { quiz, revealed, selectedId, result } = this.data
    return (
      <View className="page card-quiz-page">
        {quiz && (
          <View className="card quiz-card">
            <View className="quiz-head">
              <View>
                <View className="muted">今日卡牌挑战</View>
                <View className="quiz-title">猜出这张卡牌</View>
              </View>
              <View className="quiz-pill">4 选 1</View>
            </View>
            <View className="quiz-art-wrap">
              <Image
                className={'quiz-art ' + (revealed ? 'revealed' : 'hidden')}
                src={quiz.image}
                mode="aspectFit"
              ></Image>
            </View>
          </View>
        )}
        {quiz && (
          <View className="card hint-card">
            <View className="hint-title">提示</View>
            {quiz.hints.map((item, index) => {
              return (
                <View key={item} className="hint-row">
                  {item}
                </View>
              )
            })}
          </View>
        )}
        {quiz && (
          <View className="option-list">
            {quiz.options.map((item, index) => {
              return (
                <View
                  key={item.id}
                  className={
                    'option-card card ' +
                    (selectedId === item.id ? 'active' : '')
                  }
                  data-id={item.id}
                  onClick={this.chooseOption}
                >
                  <View>
                    <View className="option-name">
                      {localize(item) || item.display_name}
                    </View>
                    <View className="muted">
                      {item.set_name + ' #' + item.number}
                    </View>
                  </View>
                </View>
              )
            })}
          </View>
        )}
        {quiz && !result && (
          <View
            className="button-primary submit-button"
            onClick={this.submitAnswer}
          >
            确认答案
          </View>
        )}
        {result && (
          <View className="card result-card">
            <View className="result-title">
              {result.correct ? '猜对了' : '差一点'}
            </View>
            <View className="muted">{result.message}</View>
            <View className="result-actions">
              <View className="button-primary" onClick={this.openAnswer}>
                查看卡牌
              </View>
              <View className="button-secondary" onClick={this.reloadQuiz}>
                再看一次
              </View>
            </View>
          </View>
        )}
        {!quiz && (
          <View className="card empty-state">
            <View className="title">卡牌题目未准备好</View>
            <View className="hint">先同步 PTCG 卡牌数据，再回来挑战。</View>
          </View>
        )}
      </View>
    )
  }
}
export default _C
