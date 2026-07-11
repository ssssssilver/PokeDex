import withWeapp, { getTarget, cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
const api = require('../../services/api.js')
const storage = require('../../utils/storage.js')
const { getLocale, localize } = require('../../i18n/index.js')
import './index.scss'
cacheOptions.setOptionsToCache({
  data: {
    quiz: null,
    selectedId: 0,
    result: null,
    revealedHints: 2,
  },
  onLoad() {
    this.loadQuiz()
  },
  loadQuiz() {
    this.setData({
      quiz: null,
      selectedId: 0,
      result: null,
      revealedHints: 2,
    })
    api
      .getDailyQuiz({
        seed: `${Date.now()}-${Math.random()}`,
      })
      .then((result) => {
        const quiz = result.item
        if (quiz && getLocale() === 'en') {
          const answer = (quiz.options || []).find(item => Number(item.id) === Number(quiz.answerId)) || {}
          quiz.hints = [
            `Type: ${(answer.types || []).map(type => type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')).join(' / ') || 'Unknown'}`,
            `Generation: ${answer.generation || 'Unknown'}`,
            `Base stat total: ${answer.stat_total || 'Unknown'}`
          ]
        }
        this.setData({
          quiz,
        })
      })
  },
  chooseOption(event) {
    if (this.data.result) return
    this.setData({
      selectedId: Number(getTarget(event.currentTarget, Taro).dataset.id),
    })
  },
  submitAnswer() {
    if (!this.data.selectedId) {
      Taro.showToast({
        title: '先选一个答案',
        icon: 'none',
      })
      return
    }
    api
      .submitDailyQuiz({
        quizId: this.data.quiz.quizId,
        selectedId: this.data.selectedId,
        answerId: this.data.quiz.answerId,
      })
      .then((response) => {
        this.setData({
          result: response.item,
          revealedHints: this.data.quiz.hints.length,
        })
        storage.saveQuizResult(this.data.quiz.quizId, response.item)
      })
  },
  revealHint() {
    this.setData({
      revealedHints: Math.min(
        this.data.quiz.hints.length,
        this.data.revealedHints + 1
      ),
    })
  },
  openAnswer() {
    Taro.navigateTo({
      url: `/pages/pokemon-detail/index?id=${this.data.quiz.answerId}`,
    })
  },
  nextQuiz() {
    this.loadQuiz()
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { quiz, result, revealedHints, selectedId } = this.data
    return (
      quiz && (
        <View className="page quiz-page">
          <View className="card quiz-card">
            <View className="muted">随机挑战</View>
            <View className="quiz-title">猜猜这是谁？</View>
            <Image
              className={'silhouette ' + (result ? 'revealed' : '')}
              src={quiz.silhouette}
              mode="aspectFit"
            ></Image>
          </View>
          <View className="card hint-card">
            {quiz.hints.map((item, index) => {
              return (
                <Block>
                  {index < revealedHints && (
                    <View className="hint-row" key={item}>
                      {item}
                    </View>
                  )}
                </Block>
              )
            })}
            {revealedHints < quiz.hints.length && !result && (
              <View className="button-secondary" onClick={this.revealHint}>
                再看一个提示
              </View>
            )}
          </View>
          <View className="option-grid">
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
                  <View className="option-name">{localize(item)}</View>
                  <View className="muted">{'#' + item.id}</View>
                </View>
              )
            })}
          </View>
          {!result && (
            <View
              className="button-primary submit-button"
              onClick={this.submitAnswer}
            >
              提交答案
            </View>
          )}
          {result && (
            <View className="card result-card">
              <View
                className={
                  'result-title ' + (result.correct ? 'correct' : 'wrong')
                }
              >
                {result.correct ? '猜对了' : '猜错了'}
              </View>
              <View className="muted">{result.message}</View>
              <View className="result-actions">
                <View className="button-secondary" onClick={this.openAnswer}>
                  查看详情
                </View>
                <View className="button-primary" onClick={this.nextQuiz}>
                  再猜一题
                </View>
              </View>
            </View>
          )}
        </View>
      )
    )
  }
}
export default _C
