import withWeapp, { cacheOptions } from '@tarojs/with-weapp'
import { Block, View, Image } from '@tarojs/components'
import React from 'react'
import Taro from '@tarojs/taro'
import './index.scss'
const TYPE_ALIASES = {
  fire: 'fire',
  water: 'water',
  grass: 'grass',
  lightning: 'lightning',
  electric: 'lightning',
  psychic: 'psychic',
  fighting: 'fighting',
  colorless: 'colorless',
  metal: 'metal',
  steel: 'metal',
  darkness: 'darkness',
  dark: 'darkness',
  dragon: 'dragon',
  fairy: 'fairy',
}
function normalizeType(value) {
  return TYPE_ALIASES[String(value || 'colorless').toLowerCase()] || 'colorless'
}
cacheOptions.setOptionsToCache({
  properties: {
    type: {
      type: String,
      value: 'colorless',
      observer(value) {
        this.setData({
          iconType: normalizeType(value),
        })
      },
    },
    label: {
      type: String,
      value: '',
    },
  },
  data: {
    iconType: 'colorless',
  },
  lifetimes: {
    attached() {
      this.setData({
        iconType: normalizeType(this.properties.type),
      })
    },
  },
})
@withWeapp(cacheOptions.getOptionsFromCache())
class _C extends React.Component {
  render() {
    const { iconType, label, type } = this.data
    return (
      <View
        className={'energy-symbol energy-' + iconType}
        ariaLabel={label || type}
      >
        <Image
          src={require('../../assets/energy/energy-icons.jpg')}
          mode="widthFix"
        ></Image>
      </View>
    )
  }
}
export default _C
