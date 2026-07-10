const api = require('../../services/api');
const storage = require('../../utils/storage');

function teamTabs(teams, activeId) {
  return (teams || []).map((team) => Object.assign({}, team, {
    active: team.id === activeId,
    count: (team.memberIds || []).length
  }));
}

Page({
  data: {
    pokemon: [],
    teams: [],
    activeTeamId: '',
    activeTeamName: '',
    selectedIds: [],
    selectedMembers: [],
    teamSlots: [],
    analysis: null
  },

  onShow() {
    api.listPokemon({ sort: 'id' }).then((result) => {
      this.refreshTeamState(result.items || []);
    });
  },

  refreshTeamState(pokemon) {
    const allPokemon = pokemon || this.data.pokemon;
    const teams = storage.getTeams();
    const activeTeam = storage.getActiveTeam();
    const selectedIds = (activeTeam.memberIds || []).slice();
    const selectedMembers = selectedIds.map((id) => allPokemon.find((item) => item.id === id)).filter(Boolean);
    const teamSlots = Array.from({ length: 6 }, (unused, index) => ({
      index,
      pokemon: selectedMembers[index] || null
    }));
    this.setData({
      pokemon: this.decorateSelection(allPokemon, selectedIds),
      teams: teamTabs(teams, activeTeam.id),
      activeTeamId: activeTeam.id,
      activeTeamName: activeTeam.name,
      selectedIds,
      selectedMembers,
      teamSlots
    });
    this.runAnalysis();
  },

  decorateSelection(items, selectedIds) {
    return items.map((item) => Object.assign({}, item, { selected: selectedIds.includes(item.id) }));
  },

  selectTeam(event) {
    if (!storage.setActiveTeamId(event.currentTarget.dataset.id)) return;
    this.refreshTeamState();
  },

  createTeam() {
    const team = storage.createTeam();
    if (!team) {
      wx.showToast({ title: '最多创建 8 个队伍', icon: 'none' });
      return;
    }
    this.refreshTeamState();
  },

  renameTeam() {
    wx.showModal({
      title: '重命名队伍',
      editable: true,
      placeholderText: this.data.activeTeamName,
      success: (result) => {
        if (!result.confirm) return;
        if (!storage.renameTeam(this.data.activeTeamId, result.content)) {
          wx.showToast({ title: '请输入队伍名称', icon: 'none' });
          return;
        }
        this.refreshTeamState();
      }
    });
  },

  deleteTeam() {
    if (this.data.teams.length <= 1) {
      wx.showToast({ title: '至少保留一个队伍', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '删除队伍',
      content: `确定删除“${this.data.activeTeamName}”吗？`,
      success: (result) => {
        if (!result.confirm) return;
        storage.deleteTeam(this.data.activeTeamId);
        this.refreshTeamState();
      }
    });
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
    storage.setTeamSlots(selected, this.data.activeTeamId);
    this.refreshTeamState();
  },

  removeMember(event) {
    const id = Number(event.currentTarget.dataset.id);
    storage.setTeamSlots(this.data.selectedIds.filter((item) => item !== id), this.data.activeTeamId);
    this.refreshTeamState();
  },

  runAnalysis() {
    if (!this.data.selectedIds.length) {
      this.setData({ analysis: null });
      return;
    }
    api.analyzeTeam(this.data.selectedIds).then((result) => this.setData({ analysis: result.item }));
  },

  openPokemon(event) {
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${event.currentTarget.dataset.id}` });
  }
});
