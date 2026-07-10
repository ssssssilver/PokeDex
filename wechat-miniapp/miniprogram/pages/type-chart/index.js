const api = require('../../services/api');
const pokemonUtils = require('../../utils/pokemon');

const TYPE_META = pokemonUtils.TYPE_META || {};

function multiplierText(multiplier) {
  if (multiplier === 0) return '×0';
  if (multiplier === 0.25) return '×0.25';
  if (multiplier === 0.5) return '×0.5';
  if (multiplier === 4) return '×4';
  if (multiplier === 2) return '×2';
  return `×${multiplier}`;
}

function typeChip(type, multiplier) {
  const meta = TYPE_META[type] || {};
  return {
    id: type,
    name: meta.name || type,
    color: meta.color || '#64748b',
    multiplier,
    multiplierText: multiplierText(multiplier)
  };
}

function cellTone(multiplier) {
  if (multiplier === 0) return 'zero';
  if (multiplier > 1) return 'super';
  if (multiplier < 1) return 'resist';
  return 'normal';
}

function buildTypeColumns() {
  return Object.keys(TYPE_META).map((type) => typeChip(type, 1));
}

function buildTypeTable() {
  const types = Object.keys(TYPE_META);
  return types.map((attackingType) => {
    const attack = typeChip(attackingType, 1);
    return Object.assign({}, attack, {
      cells: types.map((defenderType) => {
        const multiplier = pokemonUtils.getDamageMultiplier(attackingType, [defenderType]);
        return {
          key: `${attackingType}-${defenderType}`,
          text: multiplierText(multiplier),
          tone: cellTone(multiplier)
        };
      })
    });
  });
}

function decorateRelation(relation) {
  const item = relation || {};
  return Object.assign({}, item, {
    weakTo: (item.weakTo || []).map((type) => typeChip(type.id, 2)),
    resists: (item.resists || []).map((type) => typeChip(type.id, 0.5)),
    immuneTo: (item.immuneTo || []).map((type) => typeChip(type.id, 0))
  });
}

Page({
  data: {
    types: pokemonUtils.getAllTypes(),
    activeType: 'fire',
    relation: null,
    typeColumns: buildTypeColumns(),
    typeRows: buildTypeTable()
  },

  onLoad(options) {
    const activeType = (options && options.type) || this.data.activeType;
    this.setData({ activeType });
    api.getTypes().then((result) => {
      this.setData({ types: result.items || this.data.types });
      this.loadRelation();
    });
  },

  selectType(event) {
    this.setData({ activeType: event.currentTarget.dataset.type });
    this.loadRelation();
  },

  loadRelation() {
    api.getTypeRelations(this.data.activeType).then((result) => {
      this.setData({ relation: decorateRelation(result.item) });
    });
  }
});
