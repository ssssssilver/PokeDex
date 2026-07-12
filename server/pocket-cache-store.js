const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = {
  cards: {},
  expansions: {},
  packs: {},
  events: [],
  collections: {},
  auxiliary: {},
  source_meta: {},
  data_release: null,
  sync_meta: {},
  sync_runs: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function objectById(rows) {
  return (rows || []).reduce((result, row) => {
    if (row && row.id) result[String(row.id)] = clone(row);
    return result;
  }, {});
}

class PocketCacheStore {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(__dirname, '.data', 'pocket-cache.json');
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
    const temporary = `${this.filePath}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(this.load(), null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, this.filePath);
  }

  replaceSnapshot(snapshot) {
    const current = this.load();
    this.state = Object.assign({}, current, {
      cards: objectById(snapshot.cards),
      expansions: objectById(snapshot.expansions),
      packs: objectById(snapshot.packs),
      events: clone(snapshot.events || []),
      collections: clone(snapshot.collections || {}),
      auxiliary: clone(snapshot.auxiliary || {}),
      source_meta: clone(snapshot.sourceMeta || {}),
      data_release: clone(snapshot.release || null)
    });
    this.save();
  }

  getCards() {
    return Object.values(this.load().cards || {}).map(clone);
  }

  getCard(id) {
    const card = this.load().cards[String(id)];
    return card ? clone(card) : null;
  }

  getExpansions() {
    return Object.values(this.load().expansions || {}).map(clone);
  }

  getPacks() {
    return Object.values(this.load().packs || {}).map(clone);
  }

  getEvents() {
    return clone(this.load().events || []);
  }

  getCollection(name) {
    return clone((this.load().collections || {})[String(name)] || []);
  }

  getAuxiliary(name) {
    return clone((this.load().auxiliary || {})[String(name)] || null);
  }

  getSourceMeta() {
    return clone(this.load().source_meta || {});
  }

  getRelease() {
    return clone(this.load().data_release || null);
  }

  getMeta(key = 'pocket') {
    const value = this.load().sync_meta[String(key)];
    return value ? clone(value) : null;
  }

  setMeta(key, value) {
    this.load().sync_meta[String(key)] = clone(value);
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
  PocketCacheStore
};
