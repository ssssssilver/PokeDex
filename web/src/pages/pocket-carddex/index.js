import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { View } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import './index.scss'

cacheOptions.setOptionsToCache({
  onLoad() {
    Taro.switchTab({ url: '/pages/pocket/index' })
  },
})

@withWeapp(cacheOptions.getOptionsFromCache())
class PocketCarddexRedirect extends React.Component {
  render() {
    return <View className="page pocket-redirect">Pocket</View>
  }
}

export default PocketCarddexRedirect
