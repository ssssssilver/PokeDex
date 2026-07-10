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
  fairy: 'fairy'
};

function normalizeType(value) {
  return TYPE_ALIASES[String(value || 'colorless').toLowerCase()] || 'colorless';
}

Component({
  properties: {
    type: {
      type: String,
      value: 'colorless',
      observer(value) {
        this.setData({ iconType: normalizeType(value) });
      }
    },
    label: {
      type: String,
      value: ''
    }
  },
  data: {
    iconType: 'colorless'
  },
  lifetimes: {
    attached() {
      this.setData({ iconType: normalizeType(this.properties.type) });
    }
  }
});
