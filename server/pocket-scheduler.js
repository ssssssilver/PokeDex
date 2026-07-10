const { syncPocket } = require('./pocket-sync');

function booleanOption(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberOption(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(number, max));
}

function buildOptions(options = {}, env = process.env) {
  return {
    enabled: booleanOption(options.enabled !== undefined ? options.enabled : env.POKECHILL_POCKET_SYNC_SCHEDULER, true),
    syncOnStart: booleanOption(options.syncOnStart !== undefined ? options.syncOnStart : env.POKECHILL_POCKET_SYNC_ON_START, true),
    intervalHours: numberOption(options.intervalHours || env.POKECHILL_POCKET_SYNC_INTERVAL_HOURS, 6, 0.25, 168),
    maxSyncAgeHours: numberOption(options.maxSyncAgeHours || env.POKECHILL_POCKET_MAX_SYNC_AGE_HOURS, 8, 0.25, 720),
    minimumCardCount: numberOption(options.minimumCardCount || env.POKECHILL_POCKET_MIN_CARD_COUNT, 3000, 1, 10000),
    timeoutMs: numberOption(options.timeoutMs || env.POKECHILL_POCKET_SYNC_TIMEOUT_MS, 45000, 5000, 120000),
    attempts: numberOption(options.attempts || env.POKECHILL_POCKET_SYNC_ATTEMPTS, 3, 1, 10)
  };
}

class PocketScheduler {
  constructor(options) {
    this.store = options.store;
    this.dataDir = options.dataDir;
    this.options = buildOptions(options.scheduler || {});
    this.timer = null;
    this.state = {
      started: false,
      running: false,
      checkCount: 0,
      runCount: 0,
      skippedCount: 0,
      lastCheckAt: '',
      lastRunStartedAt: '',
      lastRunFinishedAt: '',
      lastReason: '',
      lastError: '',
      lastResult: null,
      nextCheckAt: ''
    };
  }

  due() {
    const cardCount = this.store.getCards().length;
    const meta = this.store.getMeta('pocket');
    const syncedAt = new Date(meta && (meta.syncedAt || meta.finishedAt));
    const validDate = !Number.isNaN(syncedAt.getTime());
    const ageHours = validDate ? Math.max(0, (Date.now() - syncedAt.getTime()) / 3600000) : null;
    if (cardCount < this.options.minimumCardCount) {
      return { due: true, reason: 'cache-incomplete', cardCount, syncedAt: validDate ? syncedAt.toISOString() : '', ageHours };
    }
    if (!validDate) return { due: true, reason: 'never-synced', cardCount, syncedAt: '', ageHours: null };
    if (ageHours > this.options.maxSyncAgeHours) {
      return { due: true, reason: 'sync-stale', cardCount, syncedAt: syncedAt.toISOString(), ageHours };
    }
    return { due: false, reason: 'fresh', cardCount, syncedAt: syncedAt.toISOString(), ageHours };
  }

  status() {
    return {
      enabled: this.options.enabled,
      syncOnStart: this.options.syncOnStart,
      intervalHours: this.options.intervalHours,
      maxSyncAgeHours: this.options.maxSyncAgeHours,
      minimumCardCount: this.options.minimumCardCount,
      due: this.due(),
      state: Object.assign({}, this.state)
    };
  }

  scheduleNext() {
    this.state.nextCheckAt = new Date(Date.now() + this.options.intervalHours * 3600000).toISOString();
  }

  start() {
    if (!this.options.enabled || this.timer) return this.status();
    this.state.started = true;
    this.scheduleNext();
    this.timer = setInterval(() => {
      this.runIfDue('interval').catch((error) => {
        this.state.lastError = error.message || String(error);
      });
      this.scheduleNext();
    }, this.options.intervalHours * 3600000);
    if (typeof this.timer.unref === 'function') this.timer.unref();
    if (this.options.syncOnStart) {
      setTimeout(() => this.runIfDue('startup').catch((error) => {
        this.state.lastError = error.message || String(error);
      }), 500);
    }
    return this.status();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.state.started = false;
    this.state.nextCheckAt = '';
    return this.status();
  }

  async runIfDue(reason = 'scheduled', overrides = {}) {
    this.state.checkCount += 1;
    this.state.lastCheckAt = new Date().toISOString();
    const due = this.due();
    if (!due.due && !overrides.force) {
      this.state.skippedCount += 1;
      this.state.lastReason = due.reason;
      return { ok: true, skipped: true, reason: due.reason, due, scheduler: this.status() };
    }
    if (this.state.running) return { ok: false, skipped: true, reason: 'scheduler-running', scheduler: this.status() };

    this.state.running = true;
    this.state.lastRunStartedAt = new Date().toISOString();
    this.state.lastReason = reason;
    this.state.lastError = '';
    try {
      const result = await syncPocket(this.store, {
        timeoutMs: overrides.timeoutMs || this.options.timeoutMs,
        attempts: overrides.attempts || this.options.attempts
      }, { dataDir: this.dataDir });
      this.state.runCount += 1;
      this.state.lastResult = result;
      this.state.lastRunFinishedAt = new Date().toISOString();
      return result;
    } catch (error) {
      this.state.lastError = error.message || String(error);
      this.state.lastRunFinishedAt = new Date().toISOString();
      throw error;
    } finally {
      this.state.running = false;
    }
  }
}

module.exports = {
  PocketScheduler,
  buildOptions
};
