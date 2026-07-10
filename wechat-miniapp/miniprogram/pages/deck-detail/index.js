const api = require('../../services/api');

function safeDecode(value) {
  try {
    return decodeURIComponent(value || '');
  } catch (error) {
    return value || '';
  }
}

function sectionCount(section) {
  const explicit = Number(section && section.count);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return (section.cards || []).reduce((sum, card) => sum + Number(card.count || 0), 0);
}

function normalizeSection(section) {
  const count = sectionCount(section || {});
  return Object.assign({}, section, {
    displayTitle: section.displayTitle || section.title || '牌表',
    count,
    countText: `${count} 张`,
    cards: (section.cards || []).map((card) => Object.assign({}, card, {
      setLine: [card.set, card.number].filter(Boolean).join(' '),
      line: card.line || `${card.count} ${card.name} ${card.set || ''} ${card.number || ''}`.replace(/\s+/g, ' ').trim()
    }))
  });
}

function galleryCards(sections) {
  return sections.reduce((items, section) => items.concat(
    section.cards.filter((card) => card.image).map((card) => ({
      count: card.count,
      name: card.name,
      setLine: card.setLine,
      image: card.image
    }))
  ), []);
}

function normalizeDeck(item, initialDeck) {
  const source = item || {};
  const initial = initialDeck || {};
  const sections = (source.sections || []).map(normalizeSection);
  const latest = source.latestResult || null;

  return Object.assign({}, source, {
    rank: source.rank || initial.rank || '',
    name: source.name || initial.name || '卡组详情',
    points: source.points || initial.points || '',
    share: source.share || initial.share || '',
    url: source.url || initial.url || source.overviewUrl || source.decklistUrl || '',
    source: source.source || 'Limitless TCG',
    sourceUrl: source.sourceUrl || source.decklistUrl || source.overviewUrl || initial.url || '',
    totalCards: source.totalCards || sections.reduce((sum, section) => sum + section.count, 0),
    sections,
    galleryCards: galleryCards(sections),
    latestText: latest && (latest.place || latest.player)
      ? [latest.place, latest.player].filter(Boolean).join(' · ')
      : '',
    description: source.description || ''
  });
}

Page({
  data: {
    loading: true,
    deck: null,
    initialDeck: null,
    error: ''
  },

  onLoad(options) {
    const initialDeck = {
      url: safeDecode(options.url),
      name: safeDecode(options.name),
      rank: safeDecode(options.rank),
      points: safeDecode(options.points),
      share: safeDecode(options.share)
    };
    this.setData({ initialDeck });
    wx.setNavigationBarTitle({ title: initialDeck.name || '卡组详情' });
    this.loadDeck(initialDeck);
  },

  loadDeck(deck) {
    this.setData({ loading: true, error: '' });
    api.getHotDeckDetail(deck).then((result) => {
      const normalized = normalizeDeck(result.item, deck);
      this.setData({
        loading: false,
        deck: normalized,
        error: result.message || ''
      });
      wx.setNavigationBarTitle({ title: normalized.name || '卡组详情' });
    }).catch((error) => {
      this.setData({
        loading: false,
        error: error.message || '卡组详情加载失败',
        deck: null
      });
    });
  },

  retry() {
    this.loadDeck(this.data.initialDeck || {});
  },

  copyDeck() {
    const deck = this.data.deck || {};
    const text = deck.copyText || '';
    if (!text) {
      wx.showToast({ title: '暂无可复制牌表', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: text,
      success() {
        wx.showToast({ title: '已复制卡组', icon: 'success' });
      },
      fail() {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  copySource() {
    const deck = this.data.deck || {};
    const url = deck.sourceUrl || deck.url || '';
    if (!url) {
      wx.showToast({ title: '暂无来源链接', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: url,
      success() {
        wx.showToast({ title: '已复制来源', icon: 'success' });
      },
      fail() {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  previewCard(event) {
    const current = event.currentTarget.dataset.src;
    const urls = ((this.data.deck && this.data.deck.galleryCards) || []).map((card) => card.image).filter(Boolean);
    if (!current || !urls.length) return;
    wx.previewImage({ current, urls });
  }
});
