const DEFAULT_EXPECTED_COUNT = 1025;
const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_MAX_SYNC_AGE_HOURS = 30;

function boolOption(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function numberOption(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(number, max));
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value.$date) return new Date(value.$date);
  return new Date(value);
}

function isoOrEmpty(value) {
  const date = normalizeDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function buildSchedulerOptions(options = {}, env = process.env) {
  const expectedCount = numberOption(options.expectedCount || env.POKECHILL_SYNC_EXPECTED_COUNT, DEFAULT_EXPECTED_COUNT, 1, 2000);
  return {
    enabled: boolOption(options.enabled !== undefined ? options.enabled : env.POKECHILL_SYNC_SCHEDULER, true),
    syncOnStart: boolOption(options.syncOnStart !== undefined ? options.syncOnStart : env.POKECHILL_SYNC_ON_START, true),
    intervalHours: numberOption(options.intervalHours || env.POKECHILL_SYNC_INTERVAL_HOURS, DEFAULT_INTERVAL_HOURS, 0.01, 168),
    maxSyncAgeHours: numberOption(options.maxSyncAgeHours || env.POKECHILL_MAX_SYNC_AGE_HOURS, DEFAULT_MAX_SYNC_AGE_HOURS, 0.01, 720),
    expectedCount,
    startId: numberOption(options.startId || env.POKECHILL_SYNC_START_ID, 1, 1, 2000),
    endId: numberOption(options.endId || env.POKECHILL_SYNC_END_ID, expectedCount, 1, 2000),
    concurrency: numberOption(options.concurrency || env.POKECHILL_SYNC_CONCURRENCY, 6, 1, 12),
    retries: numberOption(options.retries || env.POKECHILL_SYNC_RETRIES, 2, 0, 5),
    timeoutMs: numberOption(options.timeoutMs || env.POKECHILL_SYNC_TIMEOUT_MS, 20000, 2000, 30000),
    cacheImages: boolOption(options.cacheImages !== undefined ? options.cacheImages : env.POKECHILL_SYNC_CACHE_IMAGES, false),
    strictImageCache: boolOption(options.strictImageCache !== undefined ? options.strictImageCache : env.POKECHILL_SYNC_STRICT_IMAGE_CACHE, false)
  };
}

class SyncScheduler {
  constructor(options) {
    this.store = options.store;
    this.dataDir = options.dataDir;
    this.syncFn = options.syncFn;
    this.options = buildSchedulerOptions(options.scheduler || {});
    this.intervalMs = Math.max(1000, Math.round(this.options.intervalHours * 3600000));
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

  buildSyncEvent(overrides = {}) {
    return Object.assign({
      startId: this.options.startId,
      endId: this.options.endId,
      concurrency: this.options.concurrency,
      retries: this.options.retries,
      timeoutMs: this.options.timeoutMs,
      cacheImages: this.options.cacheImages,
      strictImageCache: this.options.strictImageCache,
      force: true
    }, overrides || {});
  }

  getDueInfo() {
    const summaries = this.store.getSummaries();
    const meta = this.store.getMeta('pokeapi');
    const syncedAt = normalizeDate(meta && (meta.syncedAt || meta.finishedAt));
    const ageHours = syncedAt && !Number.isNaN(syncedAt.getTime())
      ? Math.max(0, (Date.now() - syncedAt.getTime()) / 3600000)
      : null;

    if (summaries.length < this.options.expectedCount) {
      return {
        due: true,
        reason: 'cache-incomplete',
        cachedCount: summaries.length,
        expectedCount: this.options.expectedCount,
        syncedAt: isoOrEmpty(syncedAt),
        syncAgeHours: ageHours === null ? null : Math.round(ageHours * 100) / 100
      };
    }

    if (!syncedAt || Number.isNaN(syncedAt.getTime())) {
      return {
        due: true,
        reason: 'never-synced',
        cachedCount: summaries.length,
        expectedCount: this.options.expectedCount,
        syncedAt: '',
        syncAgeHours: null
      };
    }

    if (ageHours > this.options.maxSyncAgeHours) {
      return {
        due: true,
        reason: 'sync-stale',
        cachedCount: summaries.length,
        expectedCount: this.options.expectedCount,
        syncedAt: syncedAt.toISOString(),
        syncAgeHours: Math.round(ageHours * 100) / 100
      };
    }

    return {
      due: false,
      reason: 'fresh',
      cachedCount: summaries.length,
      expectedCount: this.options.expectedCount,
      syncedAt: syncedAt.toISOString(),
      syncAgeHours: Math.round(ageHours * 100) / 100
    };
  }

  status() {
    return {
      enabled: this.options.enabled,
      syncOnStart: this.options.syncOnStart,
      intervalHours: this.options.intervalHours,
      maxSyncAgeHours: this.options.maxSyncAgeHours,
      expectedCount: this.options.expectedCount,
      syncPlan: {
        startId: this.options.startId,
        endId: this.options.endId,
        concurrency: this.options.concurrency,
        retries: this.options.retries,
        timeoutMs: this.options.timeoutMs,
        cacheImages: this.options.cacheImages,
        strictImageCache: this.options.strictImageCache
      },
      due: this.getDueInfo(),
      state: Object.assign({}, this.state)
    };
  }

  scheduleNext(fromDate = new Date()) {
    this.state.nextCheckAt = new Date(fromDate.getTime() + this.intervalMs).toISOString();
  }

  start() {
    if (!this.options.enabled || this.timer) {
      return this.status();
    }

    this.state.started = true;
    this.scheduleNext(new Date());
    this.timer = setInterval(() => {
      this.runIfDue('interval').catch((error) => {
        this.state.lastError = error.message || String(error);
      });
      this.scheduleNext(new Date());
    }, this.intervalMs);

    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }

    if (this.options.syncOnStart) {
      setTimeout(() => {
        this.runIfDue('startup').catch((error) => {
          this.state.lastError = error.message || String(error);
        });
      }, 250);
    }

    return this.status();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.started = false;
    this.state.nextCheckAt = '';
    return this.status();
  }

  async runIfDue(reason = 'scheduled', overrides = {}) {
    const now = new Date();
    this.state.checkCount += 1;
    this.state.lastCheckAt = now.toISOString();
    const due = this.getDueInfo();

    if (!due.due && !overrides.forceSchedulerRun) {
      this.state.skippedCount += 1;
      this.state.lastReason = due.reason;
      return {
        ok: true,
        skipped: true,
        reason: due.reason,
        due,
        scheduler: this.status()
      };
    }

    return this.run(reason || due.reason, overrides);
  }

  async run(reason = 'manual', overrides = {}) {
    if (this.state.running) {
      return {
        ok: false,
        skipped: true,
        status: 'skipped',
        reason: 'scheduler-running',
        scheduler: this.status()
      };
    }

    const startedAt = new Date();
    this.state.running = true;
    this.state.lastRunStartedAt = startedAt.toISOString();
    this.state.lastRunFinishedAt = '';
    this.state.lastReason = reason;
    this.state.lastError = '';

    try {
      const event = this.buildSyncEvent(overrides);
      delete event.forceSchedulerRun;
      const result = await this.syncFn(this.store, event, { dataDir: this.dataDir });
      this.state.runCount += 1;
      this.state.lastResult = {
        ok: result.ok,
        status: result.status,
        runId: result.runId,
        syncedCount: result.syncedCount,
        failedCount: result.failedCount,
        imageCachedCount: result.imageCachedCount,
        imageCacheFailedCount: result.imageCacheFailedCount,
        durationMs: result.durationMs
      };
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

function createSyncScheduler(options) {
  return new SyncScheduler(options);
}

module.exports = {
  SyncScheduler,
  buildSchedulerOptions,
  createSyncScheduler
};
