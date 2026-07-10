const api = require('../../services/api');
const storage = require('../../utils/storage');

Page({
  data: {
    favorites: [],
    cardFavorites: [],
    recent: [],
    recentCards: [],
    progress: 0,
    total: 0,
    cardProgress: 0,
    cardTotal: 0,
    ownedCount: 0,
    syncStatus: null,
    ptcgStatus: null,
    syncRuns: [],
    ptcgRuns: [],
    cacheCheck: null,
    checkingCache: false,
    cacheCheckButtonText: '立即自检'
  },

  onShow() {
    this.loadProfile();
  },

  loadProfile() {
    const favoriteIds = storage.getFavorites();
    const cardFavoriteIds = storage.getCardFavorites();
    const ownedCards = storage.getOwnedCards();
    Promise.all([
      api.listPokemon({ sort: 'id' }),
      api.getSyncStatus(),
      api.getSyncRuns({ limit: 3 }),
      cardFavoriteIds.length
        ? api.listCards({ ids: cardFavoriteIds.join(','), pageSize: Math.max(cardFavoriteIds.length, 1) })
        : Promise.resolve({ items: [] }),
      api.getPtcgSyncStatus(),
      api.getPtcgSyncRuns({ limit: 3 })
    ]).then(([result, statusResult, runsResult, cardResult, ptcgStatusResult, ptcgRunsResult]) => {
      const all = result.items || [];
      this.setData({
        favorites: all.filter((item) => favoriteIds.includes(item.id)),
        cardFavorites: cardResult.items || [],
        recent: storage.getRecentViews(),
        recentCards: storage.getRecentCards(),
        progress: favoriteIds.length,
        total: all.length,
        cardProgress: cardFavoriteIds.length,
        ownedCount: ownedCards.length,
        cardTotal: Number((ptcgStatusResult.item || {}).total || 0),
        syncStatus: statusResult.item,
        ptcgStatus: ptcgStatusResult.item,
        syncRuns: runsResult.items || [],
        ptcgRuns: ptcgRunsResult.items || []
      });
    });
  },

  buildCacheCheckView(result) {
    const checks = result.checks || {};
    const status = result.status || {};
    const ok = Boolean(result.ok);
    const missingCount = (checks.missingSummaryIds || []).length +
      (checks.missingDetailIds || []).length +
      (checks.invalidEvolutionIds || []).length +
      (checks.missingImageIds || []).length +
      (checks.missingCachedImageIds || []).length;
    const failedCount = Number(checks.syncFailedCount || 0) + Number(checks.imageCacheFailedCount || 0);
    const expectedCount = checks.expectedCount || 1025;
    const actualCount = checks.actualCount || 0;
    const maxSyncAgeHours = checks.maxSyncAgeHours || status.maxSyncAgeHours || 30;
    const syncAgeText = status.syncAgeText || '-';

    return {
      tone: ok ? 'ready' : 'stale',
      label: ok ? '通过' : '需检查',
      title: ok ? '云缓存达标' : '云缓存需检查',
      countText: `${actualCount} / ${expectedCount}`,
      syncText: `${syncAgeText} / ${maxSyncAgeHours}h`,
      issueText: `${missingCount} 项缺失 / ${failedCount} 项失败`,
      sourceText: result.source || 'cloud'
    };
  },

  runCacheCheck() {
    if (this.data.checkingCache) return;
    this.setData({
      checkingCache: true,
      cacheCheckButtonText: '检查中'
    });

    api.validateCache({
      expectedCount: 1025,
      sampleIds: [1, 4, 7, 25, 1025],
      maxSyncAgeHours: 30
    }).then((result) => {
      this.setData({
        cacheCheck: this.buildCacheCheckView(result || {}),
        checkingCache: false,
        cacheCheckButtonText: '重新自检'
      });
    }).catch(() => {
      this.setData({
        cacheCheck: {
          tone: 'stale',
          label: '失败',
          title: '云缓存自检失败',
          countText: '-',
          syncText: '-',
          issueText: '云函数未返回有效结果',
          sourceText: 'local'
        },
        checkingCache: false,
        cacheCheckButtonText: '重新自检'
      });
    });
  },

  openPokemon(event) {
    wx.navigateTo({ url: `/pages/pokemon-detail/index?id=${event.currentTarget.dataset.id}` });
  },

  openPokedex() {
    wx.switchTab({ url: '/pages/pokedex/index' });
  },

  openCarddex() {
    wx.switchTab({ url: '/pages/carddex/index' });
  },

  openCard(event) {
    wx.navigateTo({ url: `/pages/card-detail/index?id=${encodeURIComponent(event.currentTarget.dataset.id)}` });
  },

  openPlay() {
    wx.navigateTo({ url: '/pages/play/index' });
  }
});
