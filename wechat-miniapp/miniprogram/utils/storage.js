const FAVORITES_KEY = 'pokechill:favorites';
const RECENT_KEY = 'pokechill:recent';
const TEAM_KEY = 'pokechill:team';
const TEAMS_KEY = 'pokechill:teams';
const ACTIVE_TEAM_KEY = 'pokechill:team:active';
const QUIZ_KEY = 'pokechill:quiz';
const CARD_FAVORITES_KEY = 'pokechill:card:favorites';
const CARD_RECENT_KEY = 'pokechill:card:recent';
const CARD_OWNED_KEY = 'pokechill:card:owned';
const CARD_WISHLIST_KEY = 'pokechill:card:wishlist';
const POCKET_FAVORITES_KEY = 'pokechill:pocket:favorites';
const POCKET_RECENT_KEY = 'pokechill:pocket:recent';
const POCKET_OWNED_KEY = 'pokechill:pocket:owned';

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

function normalizeTeam(team, index) {
  return {
    id: String((team && team.id) || `team-${index + 1}`),
    name: String((team && team.name) || `队伍 ${index + 1}`).slice(0, 12),
    memberIds: ((team && team.memberIds) || []).map(Number).filter(Boolean).slice(0, 6)
  };
}

function getTeams() {
  const saved = read(TEAMS_KEY, []);
  if (Array.isArray(saved) && saved.length) return saved.map(normalizeTeam);
  const migrated = [normalizeTeam({ id: 'team-1', name: '队伍 1', memberIds: read(TEAM_KEY, []) }, 0)];
  write(TEAMS_KEY, migrated);
  write(ACTIVE_TEAM_KEY, migrated[0].id);
  return migrated;
}

function saveTeams(teams) {
  const normalized = (teams || []).map(normalizeTeam).slice(0, 8);
  write(TEAMS_KEY, normalized.length ? normalized : [normalizeTeam({}, 0)]);
  return normalized;
}

function getActiveTeamId() {
  const teams = getTeams();
  const saved = String(read(ACTIVE_TEAM_KEY, ''));
  return teams.some((team) => team.id === saved) ? saved : teams[0].id;
}

function setActiveTeamId(id) {
  const team = getTeams().find((item) => item.id === String(id));
  if (!team) return false;
  write(ACTIVE_TEAM_KEY, team.id);
  write(TEAM_KEY, team.memberIds);
  return true;
}

function getActiveTeam() {
  const teams = getTeams();
  return teams.find((team) => team.id === getActiveTeamId()) || teams[0];
}

function createTeam() {
  const teams = getTeams();
  if (teams.length >= 8) return null;
  const id = `team-${Date.now()}`;
  const team = normalizeTeam({ id, name: `队伍 ${teams.length + 1}`, memberIds: [] }, teams.length);
  saveTeams(teams.concat(team));
  setActiveTeamId(id);
  return team;
}

function renameTeam(id, name) {
  const clean = String(name || '').trim().slice(0, 12);
  if (!clean) return false;
  const teams = getTeams().map((team) => team.id === String(id) ? Object.assign({}, team, { name: clean }) : team);
  saveTeams(teams);
  return true;
}

function deleteTeam(id) {
  const teams = getTeams();
  if (teams.length <= 1) return false;
  const wasActive = getActiveTeamId() === String(id);
  const remaining = teams.filter((team) => team.id !== String(id));
  saveTeams(remaining);
  if (wasActive) setActiveTeamId(remaining[0].id);
  return true;
}

function getTeamSlots() {
  return getActiveTeam().memberIds.slice();
}

function setTeamSlots(ids, teamId) {
  const id = String(teamId || getActiveTeamId());
  const memberIds = (ids || []).map(Number).filter(Boolean).slice(0, 6);
  const teams = getTeams().map((team) => team.id === id ? Object.assign({}, team, { memberIds }) : team);
  saveTeams(teams);
  if (id === getActiveTeamId()) write(TEAM_KEY, memberIds);
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

function getPocketFavorites() {
  return read(POCKET_FAVORITES_KEY, []);
}

function togglePocketFavorite(id) {
  const key = String(id);
  const values = getPocketFavorites();
  const exists = values.includes(key);
  write(POCKET_FAVORITES_KEY, exists ? values.filter((item) => item !== key) : values.concat(key));
  return !exists;
}

function getPocketOwned() {
  return read(POCKET_OWNED_KEY, []);
}

function togglePocketOwned(id) {
  const key = String(id);
  const values = getPocketOwned();
  const exists = values.includes(key);
  write(POCKET_OWNED_KEY, exists ? values.filter((item) => item !== key) : values.concat(key));
  return !exists;
}

function getPocketRecent() {
  return read(POCKET_RECENT_KEY, []);
}

function addPocketRecent(card) {
  if (!card || !card.id) return;
  const collection = (card.collections || [])[0] || {};
  const compact = {
    id: card.id,
    name_zh: card.name_zh,
    name_en: card.name_en,
    image: card.image,
    rarity: card.rarity,
    expansion_id: collection.expansion_id,
    number: collection.number
  };
  const remaining = getPocketRecent().filter((item) => item.id !== compact.id);
  write(POCKET_RECENT_KEY, [compact].concat(remaining).slice(0, 8));
}

module.exports = {
  getFavorites,
  isFavorite,
  toggleFavorite,
  getRecentViews,
  addRecent,
  getTeams,
  getActiveTeamId,
  setActiveTeamId,
  getActiveTeam,
  createTeam,
  renameTeam,
  deleteTeam,
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
  toggleCardWishlist,
  getPocketFavorites,
  togglePocketFavorite,
  getPocketOwned,
  togglePocketOwned,
  getPocketRecent,
  addPocketRecent
};
