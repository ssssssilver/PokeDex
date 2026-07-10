const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = {
  card_summary: {},
  card_detail: {},
  card_sets: {},
  sync_meta: {},
  sync_runs: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sortByReleaseAndNumber(items) {
  return items.slice().sort((a, b) => {
    const aRelease = String(a.set_release_date || a.release_date || '');
    const bRelease = String(b.set_release_date || b.release_date || '');
    if (aRelease !== bRelease) return bRelease.localeCompare(aRelease);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
}

class PtcgCacheStore {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(__dirname, '.data', 'ptcg-cache.json');
    this.state = null;
  }

  load() {
    if (this.state) return this.state;

    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state = Object.assign({}, clone(DEFAULT_STATE), parsed || {});
    } catch (error) {
      this.state = clone(DEFAULT_STATE);
    }

    return this.state;
  }

  save() {
    ensureDir(path.dirname(this.filePath));
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(this.load(), null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.filePath);
  }

  reset() {
    this.state = clone(DEFAULT_STATE);
    this.save();
  }

  getCardSummaries() {
    return sortByReleaseAndNumber(Object.values(this.load().card_summary || {}).map(clone));
  }

  getCardSummary(id) {
    const item = this.load().card_summary[String(id)];
    return item ? clone(item) : null;
  }

  getCardDetail(id) {
    const item = this.load().card_detail[String(id)];
    return item ? clone(item) : null;
  }

  upsertCards(cards) {
    const state = this.load();
    (cards || []).forEach((transformed) => {
      if (!transformed || !transformed.summary || !transformed.summary.id) return;
      state.card_summary[String(transformed.summary.id)] = clone(transformed.summary);
      state.card_detail[String(transformed.summary.id)] = clone(transformed.detail || transformed.summary);
    });
    this.save();
  }

  getSets() {
    return sortByReleaseAndNumber(Object.values(this.load().card_sets || {}).map(clone));
  }

  getSet(id) {
    const item = this.load().card_sets[String(id)];
    return item ? clone(item) : null;
  }

  upsertSets(sets) {
    const state = this.load();
    (sets || []).forEach((set) => {
      if (!set || !set.id) return;
      state.card_sets[String(set.id)] = clone(set);
    });
    this.save();
  }

  getMeta(key = 'ptcg') {
    const item = this.load().sync_meta[key];
    return item ? clone(item) : null;
  }

  setMeta(key, value) {
    this.load().sync_meta[key] = clone(value);
    this.save();
  }

  writeRun(runId, value) {
    this.load().sync_runs[String(runId)] = clone(value);
    this.save();
  }

  getRuns() {
    return Object.values(this.load().sync_runs || {}).map(clone);
  }
}

module.exports = {
  PtcgCacheStore
};
