const FAVORITES_KEY = 'pokechill:favorites';
const RECENT_KEY = 'pokechill:recent';
const TEAM_KEY = 'pokechill:team';
const QUIZ_KEY = 'pokechill:quiz';
const CARD_FAVORITES_KEY = 'pokechill:card:favorites';
const CARD_RECENT_KEY = 'pokechill:card:recent';
const CARD_OWNED_KEY = 'pokechill:card:owned';
const CARD_WISHLIST_KEY = 'pokechill:card:wishlist';

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key);
    return value || fallback;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    // Local persistence failure should not block the main flow.
  }
}

function getFavorites() {
  return read(FAVORITES_KEY, []);
}

function isFavorite(id) {
  return getFavorites().includes(Number(id));
}

function toggleFavorite(id) {
  const numericId = Number(id);
  const favorites = getFavorites();
  const exists = favorites.includes(numericId);
  const next = exists ? favorites.filter((item) => item !== numericId) : favorites.concat(numericId);
  write(FAVORITES_KEY, next);
  return !exists;
}

function getRecentViews() {
  return read(RECENT_KEY, []);
}

function addRecent(pokemon) {
  if (!pokemon) return;
  const compact = {
    id: pokemon.id,
    name_zh: pokemon.name_zh,
    name_en: pokemon.name_en,
    image: pokemon.image,
    types: pokemon.types,
    typeNames: pokemon.typeNames || []
  };
  const rest = getRecentViews().filter((item) => item.id !== compact.id);
  write(RECENT_KEY, [compact].concat(rest).slice(0, 8));
}

function getTeamSlots() {
  return read(TEAM_KEY, []);
}

function setTeamSlots(ids) {
  write(TEAM_KEY, (ids || []).map(Number).slice(0, 6));
}

function addTeamSlot(id) {
  const numericId = Number(id);
  const ids = getTeamSlots();
  if (ids.includes(numericId)) {
    return { ok: true, message: '已经在队伍分析里了' };
  }
  if (ids.length >= 6) {
    return { ok: false, message: '队伍最多选择 6 只' };
  }
  setTeamSlots(ids.concat(numericId));
  return { ok: true, message: '已加入队伍分析' };
}

function getQuizHistory() {
  return read(QUIZ_KEY, {});
}

function saveQuizResult(quizId, result) {
  const history = getQuizHistory();
  history[quizId] = Object.assign({}, result, { updatedAt: Date.now() });
  write(QUIZ_KEY, history);
}

function getCardFavorites() {
  return read(CARD_FAVORITES_KEY, []);
}

function isCardFavorite(id) {
  return getCardFavorites().includes(String(id));
}

function toggleCardFavorite(id) {
  const key = String(id);
  const favorites = getCardFavorites();
  const exists = favorites.includes(key);
  const next = exists ? favorites.filter((item) => item !== key) : favorites.concat(key);
  write(CARD_FAVORITES_KEY, next);
  return !exists;
}

function getRecentCards() {
  return read(CARD_RECENT_KEY, []);
}

function addRecentCard(card) {
  if (!card) return;
  const compact = {
    id: card.id,
    name: card.name,
    name_zh: card.name_zh,
    display_name: card.display_name || card.name_zh || card.name,
    image: card.image || card.image_small,
    set_name: card.set_name,
    number: card.number,
    rarity_name: card.rarity_name
  };
  const rest = getRecentCards().filter((item) => item.id !== compact.id);
  write(CARD_RECENT_KEY, [compact].concat(rest).slice(0, 8));
}

function getOwnedCards() {
  return read(CARD_OWNED_KEY, []);
}

function isCardOwned(id) {
  return getOwnedCards().includes(String(id));
}

function toggleCardOwned(id) {
  const key = String(id);
  const owned = getOwnedCards();
  const exists = owned.includes(key);
  const next = exists ? owned.filter((item) => item !== key) : owned.concat(key);
  write(CARD_OWNED_KEY, next);
  return !exists;
}

function getWishlistCards() {
  return read(CARD_WISHLIST_KEY, []);
}

function isCardWishlisted(id) {
  return getWishlistCards().includes(String(id));
}

function toggleCardWishlist(id) {
  const key = String(id);
  const wishlist = getWishlistCards();
  const exists = wishlist.includes(key);
  const next = exists ? wishlist.filter((item) => item !== key) : wishlist.concat(key);
  write(CARD_WISHLIST_KEY, next);
  return !exists;
}

module.exports = {
  getFavorites,
  isFavorite,
  toggleFavorite,
  getRecentViews,
  addRecent,
  getTeamSlots,
  setTeamSlots,
  addTeamSlot,
  getQuizHistory,
  saveQuizResult,
  getCardFavorites,
  isCardFavorite,
  toggleCardFavorite,
  getRecentCards,
  addRecentCard,
  getOwnedCards,
  isCardOwned,
  toggleCardOwned,
  getWishlistCards,
  isCardWishlisted,
  toggleCardWishlist
};
