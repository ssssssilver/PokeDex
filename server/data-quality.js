function ratioChange(previous, next) {
  if (!previous) return next ? 1 : 0;
  return Math.abs(next - previous) / previous;
}

function result(checks, metrics) {
  const errors = checks.filter((check) => !check.ok && check.level === 'error');
  const warnings = checks.filter((check) => !check.ok && check.level !== 'error');
  return { ok: errors.length === 0, checks, errors, warnings, metrics };
}

function validatePokedex(store, options = {}) {
  const summaries = store.getSummaries();
  const expectedIds = options.expectedIds || [];
  const missingIds = expectedIds.filter((id) => !store.getSummary(id) || !store.getDetail(id));
  const checks = [
    { id: 'minimum-count', level: 'error', ok: summaries.length >= Number(options.minimumCount || 1), actual: summaries.length },
    { id: 'requested-ids-present', level: 'error', ok: missingIds.length === 0, missingIds },
    { id: 'localized-names', level: 'error', ok: summaries.every((item) => item.name_en && item.name_zh), missing: summaries.filter((item) => !item.name_en || !item.name_zh).length }
  ];
  return result(checks, { count: summaries.length, missingIds });
}

function validatePtcgSnapshot(cards, sets, options = {}) {
  const previousCount = Number(options.previousCount || 0);
  const cardCount = cards.length;
  const duplicateCount = cardCount - new Set(cards.map((item) => item && item.summary && item.summary.id)).size;
  const missingCore = cards.filter((item) => !item || !item.summary || !item.summary.id || !item.summary.name || !item.summary.image_small_remote).length;
  const delta = ratioChange(previousCount, cardCount);
  const checks = [
    { id: 'minimum-card-count', level: 'error', ok: cardCount >= Number(options.minimumCount || 1), actual: cardCount },
    { id: 'sets-present', level: 'error', ok: sets.length > 0, actual: sets.length },
    { id: 'unique-card-ids', level: 'error', ok: duplicateCount === 0, duplicateCount },
    { id: 'required-card-fields', level: 'error', ok: missingCore === 0, missingCore },
    { id: 'catalog-count-change', level: 'error', ok: !previousCount || delta <= Number(options.maxCountChangeRatio || 0.2), previousCount, cardCount, delta }
  ];
  return result(checks, { cardCount, setCount: sets.length, duplicateCount, missingCore, countChangeRatio: delta });
}

function validatePocketSnapshot(snapshot, options = {}) {
  const cards = snapshot.cards || [];
  const previousCount = Number(options.previousCount || 0);
  const duplicateCount = cards.length - new Set(cards.map((card) => String(card.id))).size;
  const missingCore = cards.filter((card) => !card.id || !card.name_en || !card.name_zh || !card.image).length;
  const pokemonCards = cards.filter((card) => card.card_type === 'pokemon');
  const missingDex = pokemonCards.filter((card) => !card.national_pokedex_number).length;
  const staleSourceCount = Number(options.staleSourceCount || 0);
  const delta = ratioChange(previousCount, cards.length);
  const checks = [
    { id: 'minimum-card-count', level: 'error', ok: cards.length >= Number(options.minimumCount || 3000), actual: cards.length },
    { id: 'unique-card-ids', level: 'error', ok: duplicateCount === 0, duplicateCount },
    { id: 'required-card-fields', level: 'error', ok: missingCore === 0, missingCore },
    { id: 'pokemon-dex-links', level: 'error', ok: missingDex === 0, missingDex },
    { id: 'fresh-required-sources', level: 'error', ok: staleSourceCount === 0, staleSourceCount },
    { id: 'catalog-count-change', level: 'error', ok: !previousCount || delta <= Number(options.maxCountChangeRatio || 0.2), previousCount, cardCount: cards.length, delta }
  ];
  return result(checks, { cardCount: cards.length, pokemonCardCount: pokemonCards.length, duplicateCount, missingCore, missingDex, countChangeRatio: delta });
}

module.exports = { ratioChange, validatePokedex, validatePocketSnapshot, validatePtcgSnapshot };
