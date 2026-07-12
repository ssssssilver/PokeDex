const fs = require('fs');
const path = require('path');

const DEFAULT_FILE = path.join(__dirname, 'data', 'ptcg-official-zh-cn.json');

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function validateEntry(key, entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') return [`${key}: entry must be an object`];
  if (!entry.name_zh_cn) errors.push(`${key}: name_zh_cn is required`);
  if (!entry.source || !entry.source.url) errors.push(`${key}: official source.url is required`);
  if (!entry.source || !entry.source.publisher) errors.push(`${key}: source.publisher is required`);
  if (!entry.reviewedAt || Number.isNaN(new Date(entry.reviewedAt).getTime())) errors.push(`${key}: reviewedAt must be an ISO date`);
  return errors;
}

function validateCatalog(catalog) {
  const errors = [];
  if (!catalog || catalog.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  if (!catalog || catalog.locale !== 'zh-CN') errors.push('locale must be zh-CN');
  if (!catalog || catalog.policy !== 'official-simplified-chinese-only') errors.push('invalid localization policy');
  Object.entries((catalog && catalog.cards) || {}).forEach(([key, entry]) => errors.push(...validateEntry(key, entry)));
  return { ok: errors.length === 0, errors, count: Object.keys((catalog && catalog.cards) || {}).length };
}

class PtcgLocalizationStore {
  constructor(options = {}) {
    this.filePath = options.filePath || DEFAULT_FILE;
    this.catalog = null;
  }

  load() {
    if (this.catalog) return this.catalog;
    const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    const validation = validateCatalog(parsed);
    if (!validation.ok) throw new Error(`Invalid official PTCG localization catalog: ${validation.errors.join('; ')}`);
    this.catalog = parsed;
    return this.catalog;
  }

  get(card) {
    if (!card) return null;
    const cards = this.load().cards || {};
    const byId = cards[String(card.id || '')];
    const byNumber = cards[`${card.set_id || ''}:${card.number || ''}`];
    return clone(byId || byNumber || null);
  }

  status() {
    const validation = validateCatalog(this.load());
    return Object.assign({ file: path.basename(this.filePath), policy: this.load().policy }, validation);
  }
}

module.exports = { DEFAULT_FILE, PtcgLocalizationStore, validateCatalog, validateEntry };
