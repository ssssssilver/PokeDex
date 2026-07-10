const api = require('../../services/api');
const storage = require('../../utils/storage');

Page({
  data: {
    pokemon: [],
    selectedIds: [],
    analysis: null
  },

  onShow() {
    this.setData({ selectedIds: storage.getTeamSlots() });
    api.listPokemon({ sort: 'id' }).then((result) => {
      this.setData({ pokemon: this.decorateSelection(result.items || [], this.data.selectedIds) });
      this.runAnalysis();
    });
  },

  decorateSelection(items, selectedIds) {
    return items.map((item) => Object.assign({}, item, {
      selected: selectedIds.includes(item.id)
    }));
  },

  toggleMember(event) {
    const id = Number(event.currentTarget.dataset.id);
    const selected = this.data.selectedIds.slice();
    const index = selected.indexOf(id);
    if (index >= 0) {
      selected.splice(index, 1);
    } else if (selected.length < 6) {
      selected.push(id);
    } else {
      wx.showToast({ title: '最多选择 6 只', icon: 'none' });
      return;
    }
    storage.setTeamSlots(selected);
    this.setData({
      selectedIds: selected,
      pokemon: this.decorateSelection(this.data.pokemon, selected)
    });
    this.runAnalysis();
  },

  runAnalysis() {
    api.analyzeTeam(this.data.selectedIds).then((result) => {
      this.setData({ analysis: result.item });
    });
  },

  openPokemon(event) {
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${event.currentTarget.dataset.id}` });
  }
});
