const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = {
  pokemon_summary: {},
  pokemon_detail: {},
  sync_meta: {},
  sync_runs: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function sortByNumericId(items) {
  return items.slice().sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
}

class CacheStore {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(__dirname, '.data', 'pokedex-cache.json');
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

  getSummaries() {
    return sortByNumericId(Object.values(this.load().pokemon_summary || {}).map(clone));
  }

  getSummary(id) {
    const item = this.load().pokemon_summary[String(id)];
    return item ? clone(item) : null;
  }

  getDetail(id) {
    const item = this.load().pokemon_detail[String(id)];
    return item ? clone(item) : null;
  }

  upsertPokemon(id, transformed) {
    const state = this.load();
    state.pokemon_summary[String(id)] = clone(transformed.summary);
    state.pokemon_detail[String(id)] = clone(transformed.detail);
    this.save();
  }

  getMeta(key = 'pokeapi') {
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
  CacheStore
};
