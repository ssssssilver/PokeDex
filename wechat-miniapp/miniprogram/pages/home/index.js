const api = require('../../services/api');
const storage = require('../../utils/storage');

function safe(promise, fallback) {
  return promise.catch(() => fallback);
}

function dailyItem(items) {
  if (!items.length) return null;
  const now = new Date();
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
  return items[day % items.length];
}

function decoratePocketEvent(event) {
  return Object.assign({}, event, {
    typeText: { missionGroup: '任务', soloBattle: '单人战', pvpEmblemBattle: '徽章战', rankedPvpSeason: '排位', itemShop: '商店', wonderPickFree: '得卡挑战', wonderPickChansey: '吉利蛋挑战' }[event.type] || '活动',
    statusText: event.status === 'upcoming' ? '即将开始' : '进行中'
  });
}

Page({
  data: {
    loading: true,
    keyword: '',
    homeMode: 'pokemon',
    dailyPokemon: null,
    dailyCard: null,
    dailyPocketCard: null,
    hotDecks: [],
    pocketEvents: [],
    pocketDecks: [],
    recent: [],
    recentCards: [],
    recentPocketCards: []
  },

  onShow() { this.loadHome(); },

  loadHome() {
    this.setData({ loading: true });
    Promise.all([
      safe(api.listPokemon({ sort: 'id' }), { items: [] }),
      safe(api.listCards({ sort: 'releaseDate', page: 1, pageSize: 20 }), { items: [] }),
      safe(api.getHotDecks({ limit: 4 }), { items: [] }),
      safe(api.listPocketCards({ page: 1, pageSize: 60 }), { items: [] }),
      safe(api.listPocketEvents({ page: 1, pageSize: 8 }), { items: [] }),
      safe(api.listPocketHotDecks({ page: 1, pageSize: 3 }), { items: [] })
    ]).then(([pokemonResult, cardResult, deckResult, pocketCardResult, pocketEventResult, pocketDeckResult]) => {
      const pokemon = pokemonResult.items || [];
      const cards = cardResult.items || [];
      const pocketCards = pocketCardResult.items || [];
      this.setData({
        loading: false,
        dailyPokemon: dailyItem(pokemon),
        dailyCard: dailyItem(cards),
        dailyPocketCard: dailyItem(pocketCards),
        hotDecks: deckResult.items || [],
        pocketEvents: (pocketEventResult.items || []).slice(0, 3).map(decoratePocketEvent),
        pocketDecks: pocketDeckResult.items || [],
        recent: storage.getRecentViews(),
        recentCards: storage.getRecentCards(),
        recentPocketCards: storage.getPocketRecent()
      });
    });
  },

  onKeywordInput(event) { this.setData({ keyword: event.detail.value }); },
  switchHomeMode(event) { this.setData({ homeMode: event.currentTarget.dataset.target || 'pokemon', keyword: '' }); },

  submitSearch() {
    const keyword = String(this.data.keyword || '').trim();
    if (this.data.homeMode === 'pocket') {
      if (keyword) wx.setStorageSync('pokechill:pendingPocketSearch', keyword);
      wx.navigateTo({ url: '/pages/pocket-carddex/index' });
      return;
    }
    if (this.data.homeMode === 'card') {
      if (keyword) wx.setStorageSync('pokechill:pendingCardSearch', keyword);
      wx.switchTab({ url: '/pages/carddex/index' });
      return;
    }
    if (keyword) wx.setStorageSync('pokechill:pendingSearch', keyword);
    wx.switchTab({ url: '/pages/pokedex/index' });
  },

  openPokemon(event) { wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${event.currentTarget.dataset.id}` }); },
  openPokedex() { wx.switchTab({ url: '/pages/pokedex/index' }); },
  openCarddex() { wx.switchTab({ url: '/pages/carddex/index' }); },
  openCard(event) { wx.navigateTo({ url: `/pages/card-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
  openQuiz() { wx.navigateTo({ url: '/pages/quiz/index' }); },
  openTeam() { wx.navigateTo({ url: '/pages/team/index' }); },
  openTypes() { wx.navigateTo({ url: '/pages/type-chart/index' }); },
  openCardQuiz() { wx.navigateTo({ url: '/pages/card-quiz/index' }); },
  openCardPack() {
    wx.navigateTo({ url: this.data.homeMode === 'pocket' ? '/pages/pocket-pack/index' : '/pages/card-pack/index' });
  },
  openPlay() { wx.navigateTo({ url: `/pages/play/index?category=${this.data.homeMode}` }); },
  scrollToHotDecks() { wx.pageScrollTo({ selector: '#physical-hot-decks', duration: 260 }); },
  openDeck(event) {
    const deck = event.currentTarget.dataset || {};
    wx.navigateTo({ url: `/pages/deck-detail/index?url=${encodeURIComponent(deck.url || '')}&name=${encodeURIComponent(deck.name || '')}&rank=${deck.rank || ''}&points=${deck.points || ''}&share=${encodeURIComponent(deck.share || '')}` });
  },
  openPocket() { wx.switchTab({ url: '/pages/pocket/index' }); },
  openPocketCarddex() { wx.switchTab({ url: '/pages/pocket/index' }); },
  openPocketCard(event) { wx.navigateTo({ url: `/pages/pocket-card-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }); },
  openPocketEvents(event) { wx.navigateTo({ url: `/pages/pocket-events/index?tab=${event.currentTarget.dataset.tab || 'events'}` }); },
  openPocketDecks() { wx.navigateTo({ url: '/pages/pocket-hot-decks/index' }); },
  openPocketDeck(event) { wx.navigateTo({ url: `/pages/pocket-deck-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` }); }
});
