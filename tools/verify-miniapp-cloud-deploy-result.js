const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    sync: [],
    runs: '',
    status: '',
    summary: '',
    minCount: 151,
    minImageCached: 151,
    maxImageCacheFailures: 0,
    maxSyncAgeHours: 30,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--self-test') {
      args.selfTest = true;
      return;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];
    if (['minCount', 'minImageCached', 'maxImageCacheFailures', 'maxSyncAgeHours'].includes(key)) {
      args[key] = Number(value);
    } else if (key === 'sync') {
      args.sync.push(...value.split(',').map((item) => item.trim()).filter(Boolean));
    } else {
      args[key] = value;
    }
  });

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function unwrapCloudResult(value) {
  if (value && value.result && typeof value.result === 'object') {
    return value.result;
  }
  return value;
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function check(condition, label, details = '') {
  return {
    ok: Boolean(condition),
    label,
    details
  };
}

function checkSyncResult(syncResult, options) {
  const sync = unwrapCloudResult(syncResult) || {};
  return [
    check(sync.ok === true, 'syncPokeapi result ok is true'),
    check(sync.dryRun === false, 'syncPokeapi was not a dryRun'),
    check(sync.source === 'pokeapi', 'syncPokeapi source is pokeapi'),
    check(Number(sync.limit || 0) >= options.minCount, `syncPokeapi limit is at least ${options.minCount}`, `actual=${sync.limit}`),
    check(Number(sync.syncedCount || 0) >= options.minCount, `syncPokeapi syncedCount is at least ${options.minCount}`, `actual=${sync.syncedCount}`),
    check(Number(sync.failedCount || 0) === 0, 'syncPokeapi failedCount is 0', `actual=${sync.failedCount || 0}`),
    check(arrayLength(sync.failed) === 0, 'syncPokeapi failed list is empty', `actual=${arrayLength(sync.failed)}`),
    check(sync.cacheImages === true, 'syncPokeapi cacheImages is true'),
    check(Number(sync.imageCachedCount || 0) >= options.minImageCached, `syncPokeapi imageCachedCount is at least ${options.minImageCached}`, `actual=${sync.imageCachedCount || 0}`),
    check(Number(sync.imageCacheFailedCount || 0) <= options.maxImageCacheFailures, `syncPokeapi imageCacheFailedCount is at most ${options.maxImageCacheFailures}`, `actual=${sync.imageCacheFailedCount || 0}`),
    check(arrayLength(sync.imageCacheFailed) <= options.maxImageCacheFailures, `syncPokeapi imageCacheFailed list has at most ${options.maxImageCacheFailures} item(s)`, `actual=${arrayLength(sync.imageCacheFailed)}`)
  ];
}

function getCoveredIds(syncResults) {
  const ids = new Set();
  syncResults.forEach((syncResult) => {
    const sync = unwrapCloudResult(syncResult) || {};
    const startId = Number(sync.startId || 0);
    const endId = Number(sync.endId || 0);
    if (!startId || !endId || endId < startId) return;
    for (let id = startId; id <= endId; id += 1) {
      ids.add(id);
    }
  });
  return ids;
}

function missingExpectedIds(coveredIds, minCount) {
  const missing = [];
  for (let id = 1; id <= minCount; id += 1) {
    if (!coveredIds.has(id)) {
      missing.push(id);
    }
  }
  return missing;
}

function summarizeSyncResults(syncResults) {
  return syncResults.map(unwrapCloudResult).filter(Boolean).reduce((summary, sync) => {
    summary.limit += Number(sync.limit || 0);
    summary.syncedCount += Number(sync.syncedCount || 0);
    summary.failedCount += Number(sync.failedCount || 0);
    summary.failedListCount += arrayLength(sync.failed);
    summary.imageCachedCount += Number(sync.imageCachedCount || 0);
    summary.imageCacheFailedCount += Number(sync.imageCacheFailedCount || 0);
    summary.imageCacheFailedListCount += arrayLength(sync.imageCacheFailed);
    return summary;
  }, {
    limit: 0,
    syncedCount: 0,
    failedCount: 0,
    failedListCount: 0,
    imageCachedCount: 0,
    imageCacheFailedCount: 0,
    imageCacheFailedListCount: 0
  });
}

function getSyncRunIds(syncResults) {
  return syncResults
    .map(unwrapCloudResult)
    .filter(Boolean)
    .map((sync) => String(sync.runId || '').trim())
    .filter(Boolean);
}

function isDefaultFullSync(sync, options) {
  return Number(sync.startId || 0) === 1 &&
    Number(sync.endId || 0) >= options.minCount &&
    Number(sync.limit || 0) >= options.minCount &&
    Number(sync.concurrency || 0) === 6 &&
    Number(sync.retries || 0) === 2 &&
    sync.cacheImages === true &&
    sync.refreshImages === false &&
    sync.strictImageCache === false;
}

function checkSyncResults(syncResults, options) {
  const normalized = syncResults.map(unwrapCloudResult).filter(Boolean);
  const summary = summarizeSyncResults(syncResults);
  const coveredIds = getCoveredIds(syncResults);
  const missingIds = missingExpectedIds(coveredIds, options.minCount);
  const syncRunIds = getSyncRunIds(syncResults);
  const defaultFullSyncs = normalized.filter((sync) => isDefaultFullSync(sync, options));
  const checks = [
    check(normalized.length > 0, 'at least one syncPokeapi result was provided'),
    check(normalized.every((sync) => sync.ok === true), 'all syncPokeapi results are ok'),
    check(normalized.every((sync) => sync.status === 'success'), 'all syncPokeapi results have success status'),
    check(syncRunIds.length === normalized.length, 'all syncPokeapi results include runId', `actual=${syncRunIds.length}/${normalized.length}`),
    check(new Set(syncRunIds).size === syncRunIds.length, 'syncPokeapi runIds are unique', `actual=${new Set(syncRunIds).size}/${syncRunIds.length}`),
    check(defaultFullSyncs.length > 0, 'a default full sync result is present for the timer path', `actual=${defaultFullSyncs.length}`),
    check(normalized.every((sync) => sync.dryRun === false), 'all syncPokeapi results were not dryRun'),
    check(normalized.every((sync) => sync.source === 'pokeapi'), 'all syncPokeapi sources are pokeapi'),
    check(normalized.every((sync) => sync.cacheImages === true), 'all syncPokeapi batches used cacheImages true'),
    check(summary.syncedCount >= options.minCount, `combined syncPokeapi syncedCount is at least ${options.minCount}`, `actual=${summary.syncedCount}`),
    check(summary.failedCount === 0, 'combined syncPokeapi failedCount is 0', `actual=${summary.failedCount}`),
    check(summary.failedListCount === 0, 'combined syncPokeapi failed lists are empty', `actual=${summary.failedListCount}`),
    check(summary.imageCachedCount >= options.minImageCached, `combined syncPokeapi imageCachedCount is at least ${options.minImageCached}`, `actual=${summary.imageCachedCount}`),
    check(summary.imageCacheFailedCount <= options.maxImageCacheFailures, `combined syncPokeapi imageCacheFailedCount is at most ${options.maxImageCacheFailures}`, `actual=${summary.imageCacheFailedCount}`),
    check(summary.imageCacheFailedListCount <= options.maxImageCacheFailures, `combined syncPokeapi imageCacheFailed lists have at most ${options.maxImageCacheFailures} item(s)`, `actual=${summary.imageCacheFailedListCount}`)
  ];

  if (normalized.length === 1) {
    checks.push(...checkSyncResult(normalized[0], options));
  } else {
    checks.push(check(coveredIds.size >= options.minCount, `syncPokeapi batches cover at least ${options.minCount} ids`, `actual=${coveredIds.size}`));
    checks.push(check(missingIds.length === 0, `syncPokeapi batches cover ids 1-${options.minCount}`, `missing=${missingIds.slice(0, 12).join(',')}`));
  }

  return checks;
}

function checkValidateResult(validateResult, options) {
  const validation = unwrapCloudResult(validateResult) || {};
  const checks = validation.checks || {};
  const status = validation.status || {};
  return [
    check(validation.ok === true, 'validateCache ok is true'),
    check(checks.cloudReady === true, 'validateCache cloudReady is true'),
    check(Number(checks.actualCount || 0) >= options.minCount, `validateCache actualCount is at least ${options.minCount}`, `actual=${checks.actualCount}`),
    check(checks.countOk === true, 'validateCache countOk is true'),
    check(arrayLength(checks.missingSummaryIds) === 0, 'validateCache missingSummaryIds is empty', `actual=${arrayLength(checks.missingSummaryIds)}`),
    check(arrayLength(checks.missingDetailIds) === 0, 'validateCache missingDetailIds is empty', `actual=${arrayLength(checks.missingDetailIds)}`),
    check(arrayLength(checks.invalidEvolutionIds) === 0, 'validateCache invalidEvolutionIds is empty', `actual=${arrayLength(checks.invalidEvolutionIds)}`),
    check(arrayLength(checks.missingImageIds) === 0, 'validateCache missingImageIds is empty', `actual=${arrayLength(checks.missingImageIds)}`),
    check(arrayLength(checks.missingCachedImageIds) <= options.maxImageCacheFailures, `validateCache missingCachedImageIds has at most ${options.maxImageCacheFailures} item(s)`, `actual=${arrayLength(checks.missingCachedImageIds)}`),
    check(Number(checks.syncFailedCount || 0) === 0, 'validateCache syncFailedCount is 0', `actual=${checks.syncFailedCount || 0}`),
    check(Number(checks.imageCacheFailedCount || 0) <= options.maxImageCacheFailures, `validateCache imageCacheFailedCount is at most ${options.maxImageCacheFailures}`, `actual=${checks.imageCacheFailedCount || 0}`),
    check(checks.syncFresh === true, 'validateCache syncFresh is true'),
    check(checks.syncStale === false, 'validateCache syncStale is false'),
    check(checks.syncAgeHours === null || Number(checks.syncAgeHours) <= options.maxSyncAgeHours, `validateCache syncAgeHours is at most ${options.maxSyncAgeHours}`, `actual=${checks.syncAgeHours}`),
    check(status.cacheReady === true, 'validateCache status.cacheReady is true'),
    check(Number(status.total || 0) >= options.minCount, `validateCache status.total is at least ${options.minCount}`, `actual=${status.total}`),
    check(Number(status.failedCount || 0) === 0, 'validateCache status.failedCount is 0', `actual=${status.failedCount || 0}`),
    check(status.syncFresh === true, 'validateCache status.syncFresh is true'),
    check(status.syncStale === false, 'validateCache status.syncStale is false')
  ];
}

function checkSyncRunsResult(runsResult, options, syncResults = []) {
  const runs = unwrapCloudResult(runsResult) || {};
  const items = Array.isArray(runs.items) ? runs.items : [];
  const latest = items[0] || {};
  const unhealthy = items.filter((item) => ['partial', 'failed'].includes(item.status));
  const running = items.filter((item) => item.status === 'running');
  const itemRunIds = new Set(items.map((item) => String(item.runId || '').trim()).filter(Boolean));
  const syncRunIds = getSyncRunIds(syncResults);
  const missingRunIds = syncRunIds.filter((runId) => !itemRunIds.has(runId));

  return [
    check(runs.source === 'cloud', 'getSyncRuns source is cloud', `actual=${runs.source || 'none'}`),
    check(items.length > 0, 'getSyncRuns returned at least one run', `actual=${items.length}`),
    check(latest.status === 'success', 'latest getSyncRuns item is success', `actual=${latest.status || 'none'}`),
    check(unhealthy.length === 0, 'getSyncRuns recent items have no partial or failed runs', `actual=${unhealthy.length}`),
    check(running.length === 0, 'getSyncRuns recent items have no running runs', `actual=${running.length}`),
    check(missingRunIds.length === 0, 'getSyncRuns includes each provided syncPokeapi runId', `missing=${missingRunIds.join(',')}`),
    check(items.every((item) => Number(item.failedCount || 0) === 0), 'getSyncRuns failedCount is 0 for recent items'),
    check(items.every((item) => Number(item.imageFailedCount || 0) <= options.maxImageCacheFailures), `getSyncRuns imageFailedCount is at most ${options.maxImageCacheFailures} for recent items`)
  ];
}

function checkSyncStatusResult(statusResult, options) {
  const response = unwrapCloudResult(statusResult) || {};
  const item = response.item || {};

  return [
    check(response.source === 'cloud', 'getSyncStatus source is cloud', `actual=${response.source || 'none'}`),
    check(item.mode === 'cloud', 'getSyncStatus mode is cloud', `actual=${item.mode || 'none'}`),
    check(item.cacheReady === true, 'getSyncStatus cacheReady is true'),
    check(item.healthTone === 'ready', 'getSyncStatus healthTone is ready', `actual=${item.healthTone || 'none'}`),
    check(Number(item.total || 0) >= options.minCount, `getSyncStatus total is at least ${options.minCount}`, `actual=${item.total || 0}`),
    check(Number(item.syncedCount || 0) >= options.minCount, `getSyncStatus syncedCount is at least ${options.minCount}`, `actual=${item.syncedCount || 0}`),
    check(Number(item.imageCachedCount || 0) >= options.minImageCached, `getSyncStatus imageCachedCount is at least ${options.minImageCached}`, `actual=${item.imageCachedCount || 0}`),
    check(Number(item.missingImageCount || 0) === 0, 'getSyncStatus missingImageCount is 0', `actual=${item.missingImageCount || 0}`),
    check(Number(item.missingCachedImageCount || 0) <= options.maxImageCacheFailures, `getSyncStatus missingCachedImageCount is at most ${options.maxImageCacheFailures}`, `actual=${item.missingCachedImageCount || 0}`),
    check(Number(item.failedCount || 0) === 0, 'getSyncStatus failedCount is 0', `actual=${item.failedCount || 0}`),
    check(Number(item.imageCacheFailedCount || 0) <= options.maxImageCacheFailures, `getSyncStatus imageCacheFailedCount is at most ${options.maxImageCacheFailures}`, `actual=${item.imageCacheFailedCount || 0}`),
    check(Number(item.lastRunSyncedCount || 0) >= options.minCount, `getSyncStatus lastRunSyncedCount is at least ${options.minCount}`, `actual=${item.lastRunSyncedCount || 0}`),
    check(Number(item.lastRunFailedCount || 0) === 0, 'getSyncStatus lastRunFailedCount is 0', `actual=${item.lastRunFailedCount || 0}`),
    check(Number(item.lastRunImageCacheFailedCount || 0) <= options.maxImageCacheFailures, `getSyncStatus lastRunImageCacheFailedCount is at most ${options.maxImageCacheFailures}`, `actual=${item.lastRunImageCacheFailedCount || 0}`),
    check(item.cacheImages === true, 'getSyncStatus cacheImages is true'),
    check(item.syncFresh === true, 'getSyncStatus syncFresh is true'),
    check(item.syncStale === false, 'getSyncStatus syncStale is false'),
    check(item.syncAgeHours === null || Number(item.syncAgeHours) <= options.maxSyncAgeHours, `getSyncStatus syncAgeHours is at most ${options.maxSyncAgeHours}`, `actual=${item.syncAgeHours}`)
  ];
}

function summarize(groups) {
  const checks = groups.flatMap((group) => group.checks);
  const failures = checks.filter((item) => !item.ok);
  return {
    total: checks.length,
    passed: checks.length - failures.length,
    failures
  };
}

function printGroup(group) {
  console.log(`\n${group.name}`);
  group.checks.forEach((item) => {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}${item.details ? ` - ${item.details}` : ''}`);
  });
}

function writeSummaryFile(filePath, payload) {
  if (!filePath) return;
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function verify(syncResults, validateResult, runsResult, statusResult, options) {
  const normalizedSyncResults = Array.isArray(syncResults) ? syncResults : [syncResults];
  const groups = [
    {
      name: normalizedSyncResults.length > 1 ? 'syncPokeapi results' : 'syncPokeapi result',
      checks: checkSyncResults(normalizedSyncResults, options)
    },
    {
      name: 'pokedex validateCache result',
      checks: checkValidateResult(validateResult, options)
    }
  ];
  if (statusResult) {
    groups.push({
      name: 'pokedex getSyncStatus result',
      checks: checkSyncStatusResult(statusResult, options)
    });
  }
  if (runsResult) {
    groups.push({
      name: 'pokedex getSyncRuns result',
      checks: checkSyncRunsResult(runsResult, options, normalizedSyncResults)
    });
  }
  const summary = summarize(groups);
  return {
    ok: summary.failures.length === 0,
    groups,
    summary
  };
}

function createPassingSample() {
  return {
    sync: {
      ok: true,
      status: 'success',
      runId: 'pokeapi-sample',
      dryRun: false,
      source: 'pokeapi',
      startId: 1,
      endId: 151,
      limit: 151,
      concurrency: 6,
      retries: 2,
      refreshImages: false,
      strictImageCache: false,
      syncedCount: 151,
      failedCount: 0,
      failed: [],
      cacheImages: true,
      imageCachedCount: 151,
      imageCacheFailedCount: 0,
      imageCacheFailed: []
    },
    validation: {
      ok: true,
      checks: {
        cloudReady: true,
        actualCount: 151,
        countOk: true,
        missingSummaryIds: [],
        missingDetailIds: [],
        invalidEvolutionIds: [],
        missingImageIds: [],
        missingCachedImageIds: [],
        syncFailedCount: 0,
        imageCacheFailedCount: 0,
        syncFresh: true,
        syncStale: false,
        syncAgeHours: 0.5
      },
      status: {
        cacheReady: true,
        total: 151,
        failedCount: 0,
        syncFresh: true,
        syncStale: false
      }
    },
    status: {
      item: {
        mode: 'cloud',
        healthTone: 'ready',
        cacheReady: true,
        total: 151,
        syncedCount: 151,
        imageCachedCount: 151,
        imageCacheFailedCount: 0,
        failedCount: 0,
        missingImageCount: 0,
        missingCachedImageCount: 0,
        lastRunSyncedCount: 151,
        lastRunFailedCount: 0,
        lastRunImageCacheFailedCount: 0,
        cacheImages: true,
        syncFresh: true,
        syncStale: false,
        syncAgeHours: 0.5
      },
      source: 'cloud'
    },
    runs: {
      items: [
        {
          runId: 'pokeapi-sample',
          status: 'success',
          statusText: '成功',
          failedCount: 0,
          imageFailedCount: 0,
          countText: '151 / 151',
          imageText: '151 / 0'
        }
      ],
      total: 1,
      source: 'cloud'
    }
  };
}

function createBatchPassingSample() {
  const base = createPassingSample();
  const makeBatch = (startId, endId) => {
    const count = endId - startId + 1;
    return Object.assign({}, base.sync, {
      runId: `pokeapi-${startId}-${endId}`,
      startId,
      endId,
      limit: count,
      syncedCount: count,
      imageCachedCount: count
    });
  };
  const syncs = [
    makeBatch(1, 50),
    makeBatch(51, 100),
    makeBatch(101, 151),
    Object.assign({}, base.sync, {
      runId: 'pokeapi-timer-default',
      startId: 1,
      endId: 151,
      limit: 151,
      concurrency: 6,
      retries: 2,
      syncedCount: 151,
      imageCachedCount: 151
    })
  ];
  return {
    syncs,
    validation: base.validation,
    runs: {
      items: syncs.map((sync) => ({
        runId: sync.runId,
        status: 'success',
        statusText: '成功',
        failedCount: 0,
        imageFailedCount: 0,
        countText: `${sync.syncedCount} / ${sync.limit}`,
        imageText: `${sync.imageCachedCount} / 0`
      })).reverse(),
      total: syncs.length,
      source: 'cloud'
    }
  };
}

function runSelfTest(options) {
  const passing = createPassingSample();
  const passingResult = verify(passing.sync, passing.validation, passing.runs, passing.status, options);
  const legacyPassingResult = verify(passing.sync, passing.validation, null, null, options);
  const stale = createPassingSample();
  stale.validation.ok = false;
  stale.validation.checks.syncFresh = false;
  stale.validation.checks.syncStale = true;
  stale.validation.checks.syncAgeHours = 48;
  stale.validation.status.syncFresh = false;
  stale.validation.status.syncStale = true;
  stale.status.item.healthTone = 'stale';
  stale.status.item.syncFresh = false;
  stale.status.item.syncStale = true;
  stale.status.item.syncAgeHours = 48;
  const staleResult = verify(stale.sync, stale.validation, stale.runs, stale.status, options);

  if (!passingResult.ok) {
    throw new Error('Self-test passing sample did not pass');
  }
  if (!legacyPassingResult.ok) {
    throw new Error('Self-test legacy passing sample without getSyncRuns did not pass');
  }
  if (staleResult.ok) {
    throw new Error('Self-test stale sample did not fail');
  }
  const batchPassing = createBatchPassingSample();
  const batchPassingResult = verify(batchPassing.syncs, batchPassing.validation, batchPassing.runs, passing.status, options);
  if (!batchPassingResult.ok) {
    throw new Error('Self-test batch passing sample did not pass');
  }
  console.log(JSON.stringify({
    ok: true,
    passingChecks: passingResult.summary.total,
    legacyPassingChecks: legacyPassingResult.summary.total,
    batchPassingChecks: batchPassingResult.summary.total,
    staleFailures: staleResult.summary.failures.length
  }, null, 2));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest(options);
    return;
  }

  if (!options.sync.length || !options.validate) {
    console.error('Usage: node tools\\verify-miniapp-cloud-deploy-result.js --sync=sync-result.json --validate=validate-cache-result.json');
    console.error('For batches, repeat --sync or separate files with commas: --sync=batch-1.json --sync=batch-2.json');
    console.error('Optional: --status=get-sync-status-result.json --runs=get-sync-runs-result.json --min-count=151 --min-image-cached=151 --max-image-cache-failures=0 --max-sync-age-hours=30');
    process.exitCode = 1;
    return;
  }

  const syncResults = options.sync.map(readJson);
  const validateResult = readJson(options.validate);
  const runsResult = options.runs ? readJson(options.runs) : null;
  const statusResult = options.status ? readJson(options.status) : null;
  const result = verify(syncResults, validateResult, runsResult, statusResult, options);
  const summaryPayload = {
    generatedAt: new Date().toISOString(),
    ok: result.ok,
    inputs: {
      sync: options.sync.map((filePath) => path.resolve(filePath)),
      validate: path.resolve(options.validate),
      status: options.status ? path.resolve(options.status) : '',
      runs: options.runs ? path.resolve(options.runs) : ''
    },
    thresholds: {
      minCount: options.minCount,
      minImageCached: options.minImageCached,
      maxImageCacheFailures: options.maxImageCacheFailures,
      maxSyncAgeHours: options.maxSyncAgeHours
    },
    summary: result.summary,
    groups: result.groups
  };
  writeSummaryFile(options.summary, summaryPayload);

  console.log('PokeChill miniapp real cloud deploy verification');
  console.log(JSON.stringify({
    sync: options.sync.map((filePath) => path.resolve(filePath)),
    validate: path.resolve(options.validate),
    status: options.status ? path.resolve(options.status) : '',
    runs: options.runs ? path.resolve(options.runs) : '',
    minCount: options.minCount,
    minImageCached: options.minImageCached,
    maxImageCacheFailures: options.maxImageCacheFailures,
    maxSyncAgeHours: options.maxSyncAgeHours
  }, null, 2));
  result.groups.forEach(printGroup);
  console.log('\nVerification summary');
  console.log(JSON.stringify({
    ok: result.ok,
    passed: result.summary.passed,
    total: result.summary.total,
    failures: result.summary.failures.map((item) => item.label),
    summary: options.summary ? path.resolve(options.summary) : ''
  }, null, 2));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main();
