import React from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { t } from '../../i18n'
import './index.scss'

export default class MonstersChill extends React.Component {
  state = { loaded: false, fullscreen: false }

  componentDidMount() {
    document.addEventListener('fullscreenchange', this.syncFullscreen)
  }

  componentWillUnmount() {
    document.removeEventListener('fullscreenchange', this.syncFullscreen)
  }

  syncFullscreen = () => this.setState({ fullscreen: Boolean(document.fullscreenElement) })

  goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/home/index' })
    })
  }

  toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.()
      return
    }
    await this.gameContainer?.requestFullscreen?.()
  }

  render() {
    const { loaded, fullscreen } = this.state
    return (
      <View className="monsters-chill-page">
        <View className="game-shell" ref={(node) => { this.gameContainer = node }}>
          <View className="game-toolbar">
            <button className="game-tool-button game-back" onClick={this.goBack} aria-label={t('gameBack')}>
              <Text aria-hidden="true">‹</Text>
              <Text>{t('gameBack')}</Text>
            </button>
            <View className="game-heading">
              <Text className="game-title">{t('monstersChill')}</Text>
              <Text className="game-save-hint">{t('gameHint')}</Text>
            </View>
            <button className="game-tool-button" onClick={this.toggleFullscreen} aria-label={fullscreen ? t('gameExitFullscreen') : t('gameFullscreen')}>
              <Text aria-hidden="true">{fullscreen ? '×' : '⛶'}</Text>
              <Text className="game-tool-label">{fullscreen ? t('gameExitFullscreen') : t('gameFullscreen')}</Text>
            </button>
          </View>
          {!loaded && <View className="game-loading">{t('gameLoading')}</View>}
          <iframe
            className={`game-frame ${loaded ? 'loaded' : ''}`}
            src="/games/monsters-and-chill/index.html"
            title={t('monstersChill')}
            allow="fullscreen"
            onLoad={() => this.setState({ loaded: true })}
          />
        </View>
      </View>
    )
  }
}
