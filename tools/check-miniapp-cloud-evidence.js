const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultPayloadDir = path.join(repoRoot, 'tmp', 'wechat-cloud-payloads');

function parseArgs(argv) {
  const args = {
    payloadDir: defaultPayloadDir,
    minCount: 151,
    minImageCached: 151,
    maxImageCacheFailures: 0,
    maxSyncAgeHours: 30,
    skipVerify: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--self-test') {
      args.selfTest = true;
      return;
    }
    if (arg === '--skip-verify') {
      args.skipVerify = true;
      return;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];

    if (key === 'payloadDir') {
      args.payloadDir = path.resolve(value);
    } else if (['minCount', 'minImageCached', 'maxImageCacheFailures', 'maxSyncAgeHours'].includes(key)) {
      args[key] = Number(value);
    } else {
      args[key] = value;
    }
  });

  return args;
}

function check(condition, label, details = '') {
  return {
    ok: Boolean(condition),
    label,
    details
  };
}

function readManifest(payloadDir) {
  const manifestFile = path.join(payloadDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestFile)) {
    return null;
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    return Object.assign({ manifestFile }, manifest);
  } catch (error) {
    return {
      manifestFile,
      parseError: error.message,
      steps: []
    };
  }
}

function manifestStep(manifest, type) {
  if (!manifest || !Array.isArray(manifest.steps)) return null;
  return manifest.steps.find((step) => step.type === type) || null;
}

function manifestSteps(manifest, type) {
  if (!manifest || !Array.isArray(manifest.steps)) return [];
  return manifest.steps.filter((step) => step.type === type);
}

function manifestPath(payloadDir, step, key, fallback) {
  if (!step || !step[key]) return fallback;
  return path.join(payloadDir, String(step[key]).replace(/\//g, path.sep));
}

function listSyncPayloads(payloadDir, manifest) {
  const syncSteps = manifestSteps(manifest, 'sync');
  if (syncSteps.length) {
    return syncSteps.map((step) => ({
      payloadFile: manifestPath(payloadDir, step, 'payloadFile', ''),
      resultFile: manifestPath(payloadDir, step, 'resultFile', ''),
      range: path.basename(step.payloadFile || step.resultFile || `step-${step.step || ''}`).replace(/^syncPokeapi-/, '').replace(/\.json$/, '')
    }));
  }

  if (!fs.existsSync(payloadDir)) return [];
  const payloads = fs.readdirSync(payloadDir)
    .filter((name) => /^syncPokeapi-\d{3}-\d{3}\.json$/.test(name))
    .sort()
    .map((name) => {
      const match = name.match(/^syncPokeapi-(\d{3})-(\d{3})\.json$/);
      return {
        payloadFile: path.join(payloadDir, name),
        resultFile: path.join(payloadDir, 'results', `wechat-cloud-sync-${match[1]}-${match[2]}.json`),
        range: `${match[1]}-${match[2]}`
      };
    });
  const timerPayload = path.join(payloadDir, 'syncPokeapi-timer-default.json');
  if (fs.existsSync(timerPayload)) {
    payloads.push({
      payloadFile: timerPayload,
      resultFile: path.join(payloadDir, 'results', 'wechat-cloud-sync-timer-default.json'),
      range: 'timer-default'
    });
  }
  return payloads;
}

function inspectEvidence(options) {
  const payloadDir = options.payloadDir;
  const resultsDir = path.join(payloadDir, 'results');
  const manifest = readManifest(payloadDir);
  const syncPayloads = listSyncPayloads(payloadDir, manifest);
  const validateStep = manifestStep(manifest, 'validate');
  const statusStep = manifestStep(manifest, 'status');
  const runsStep = manifestStep(manifest, 'runs');
  const validatePayload = manifestPath(payloadDir, validateStep, 'payloadFile', path.join(payloadDir, 'pokedex-validate-cache.json'));
  const validateResult = manifestPath(payloadDir, validateStep, 'resultFile', path.join(resultsDir, 'wechat-cloud-validate-result.json'));
  const statusPayload = manifestPath(payloadDir, statusStep, 'payloadFile', path.join(payloadDir, 'pokedex-get-sync-status.json'));
  const statusResult = manifestPath(payloadDir, statusStep, 'resultFile', path.join(resultsDir, 'wechat-cloud-sync-status-result.json'));
  const runsPayload = manifestPath(payloadDir, runsStep, 'payloadFile', path.join(payloadDir, 'pokedex-get-sync-runs.json'));
  const runsResult = manifestPath(payloadDir, runsStep, 'resultFile', path.join(resultsDir, 'wechat-cloud-sync-runs-result.json'));
  const summaryResult = path.join(resultsDir, 'wechat-cloud-evidence-summary.json');
  const readme = path.join(payloadDir, 'README.md');
  const runbook = path.join(payloadDir, 'RUNBOOK.md');
  const manifestFile = path.join(payloadDir, 'MANIFEST.json');

  const checks = [
    check(fs.existsSync(payloadDir), 'payload directory exists', payloadDir),
    check(fs.existsSync(readme), 'payload README exists', readme),
    check(fs.existsSync(runbook), 'payload runbook exists', runbook),
    check(fs.existsSync(manifestFile), 'payload manifest exists', manifestFile),
    check(manifest && !manifest.parseError, 'payload manifest parses as JSON', manifest && manifest.parseError ? manifest.parseError : manifestFile),
    check(manifestSteps(manifest, 'sync').length > 0, 'payload manifest includes sync steps', `count=${manifestSteps(manifest, 'sync').length}`),
    check(Boolean(validateStep), 'payload manifest includes validate step'),
    check(Boolean(statusStep), 'payload manifest includes status step'),
    check(Boolean(runsStep), 'payload manifest includes runs step'),
    check(syncPayloads.length > 0, 'syncPokeapi payload files exist', `count=${syncPayloads.length}`),
    check(fs.existsSync(validatePayload), 'validateCache payload exists', validatePayload),
    check(fs.existsSync(statusPayload), 'getSyncStatus payload exists', statusPayload),
    check(fs.existsSync(runsPayload), 'getSyncRuns payload exists', runsPayload),
    check(fs.existsSync(resultsDir), 'results directory exists', resultsDir),
    check(fs.existsSync(validateResult), 'validateCache result exists', validateResult),
    check(fs.existsSync(statusResult), 'getSyncStatus result exists', statusResult),
    check(fs.existsSync(runsResult), 'getSyncRuns result exists', runsResult)
  ];

  syncPayloads.forEach((item) => {
    checks.push(check(fs.existsSync(item.resultFile), `sync result exists for ${item.range}`, item.resultFile));
  });

  return {
    payloadDir,
    resultsDir,
    syncPayloads,
    validateResult,
    statusResult,
    runsResult,
    summaryResult,
    manifest,
    checks
  };
}

function runVerifier(evidence, options) {
  const args = [
    path.join('tools', 'verify-miniapp-cloud-deploy-result.js'),
    ...evidence.syncPayloads.map((item) => `--sync=${item.resultFile}`),
    `--validate=${evidence.validateResult}`,
    `--status=${evidence.statusResult}`,
    `--runs=${evidence.runsResult}`,
    `--summary=${evidence.summaryResult}`,
    `--min-count=${options.minCount}`,
    `--min-image-cached=${options.minImageCached}`,
    `--max-image-cache-failures=${options.maxImageCacheFailures}`,
    `--max-sync-age-hours=${options.maxSyncAgeHours}`
  ];
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    ok: result.status === 0,
    status: result.status,
    error: result.error ? result.error.message : ''
  };
}

function printChecks(checks) {
  checks.forEach((item) => {
    console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}${item.details ? ` - ${item.details}` : ''}`);
  });
}

function createValidResultFiles(payloadDir) {
  fs.mkdirSync(path.join(payloadDir, 'results'), { recursive: true });
  const batches = [
    [1, 50],
    [51, 100],
    [101, 151]
  ];

  fs.writeFileSync(path.join(payloadDir, 'README.md'), '# test\n', 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'RUNBOOK.md'), '# test runbook\n', 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'MANIFEST.json'), JSON.stringify({
    version: 1,
    summaryFile: 'results/wechat-cloud-evidence-summary.json',
    steps: [
      {
        step: 1,
        cloudFunction: 'syncPokeapi',
        payloadFile: 'syncPokeapi-001-050.json',
        resultFile: 'results/wechat-cloud-sync-001-050.json',
        type: 'sync',
        required: true
      },
      {
        step: 2,
        cloudFunction: 'syncPokeapi',
        payloadFile: 'syncPokeapi-051-100.json',
        resultFile: 'results/wechat-cloud-sync-051-100.json',
        type: 'sync',
        required: true
      },
      {
        step: 3,
        cloudFunction: 'syncPokeapi',
        payloadFile: 'syncPokeapi-101-151.json',
        resultFile: 'results/wechat-cloud-sync-101-151.json',
        type: 'sync',
        required: true
      },
      {
        step: 4,
        cloudFunction: 'syncPokeapi',
        payloadFile: 'syncPokeapi-timer-default.json',
        resultFile: 'results/wechat-cloud-sync-timer-default.json',
        type: 'sync',
        required: true
      },
      {
        step: 5,
        cloudFunction: 'pokedex',
        payloadFile: 'pokedex-validate-cache.json',
        resultFile: 'results/wechat-cloud-validate-result.json',
        type: 'validate',
        required: true
      },
      {
        step: 6,
        cloudFunction: 'pokedex',
        payloadFile: 'pokedex-get-sync-status.json',
        resultFile: 'results/wechat-cloud-sync-status-result.json',
        type: 'status',
        required: true
      },
      {
        step: 7,
        cloudFunction: 'pokedex',
        payloadFile: 'pokedex-get-sync-runs.json',
        resultFile: 'results/wechat-cloud-sync-runs-result.json',
        type: 'runs',
        required: true
      }
    ]
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'pokedex-validate-cache.json'), JSON.stringify({
    action: 'validateCache',
    expectedCount: 151,
    sampleIds: [1, 4, 7, 25, 151],
    maxSyncAgeHours: 30
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'pokedex-get-sync-runs.json'), JSON.stringify({
    action: 'getSyncRuns',
    limit: 5
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'pokedex-get-sync-status.json'), JSON.stringify({
    action: 'getSyncStatus',
    maxSyncAgeHours: 30
  }, null, 2), 'utf8');

  batches.forEach(([startId, endId]) => {
    const count = endId - startId + 1;
    const start = String(startId).padStart(3, '0');
    const end = String(endId).padStart(3, '0');
    const runId = `pokeapi-${startId}-${endId}`;
    fs.writeFileSync(path.join(payloadDir, `syncPokeapi-${start}-${end}.json`), JSON.stringify({
      startId,
      endId,
      cacheImages: true
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(payloadDir, 'results', `wechat-cloud-sync-${start}-${end}.json`), JSON.stringify({
      ok: true,
      status: 'success',
      runId,
      dryRun: false,
      source: 'pokeapi',
      startId,
      endId,
      limit: count,
      syncedCount: count,
      failedCount: 0,
      failed: [],
      cacheImages: true,
      imageCachedCount: count,
      imageCacheFailedCount: 0,
      imageCacheFailed: []
    }, null, 2), 'utf8');
  });

  fs.writeFileSync(path.join(payloadDir, 'syncPokeapi-timer-default.json'), JSON.stringify({}, null, 2), 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'results', 'wechat-cloud-sync-timer-default.json'), JSON.stringify({
    ok: true,
    status: 'success',
    runId: 'pokeapi-timer-default',
    dryRun: false,
    source: 'pokeapi',
    startId: 1,
    endId: 151,
    limit: 151,
    concurrency: 6,
    retries: 2,
    cacheImages: true,
    refreshImages: false,
    strictImageCache: false,
    syncedCount: 151,
    failedCount: 0,
    failed: [],
    imageCachedCount: 151,
    imageCacheFailedCount: 0,
    imageCacheFailed: []
  }, null, 2), 'utf8');

  fs.writeFileSync(path.join(payloadDir, 'results', 'wechat-cloud-validate-result.json'), JSON.stringify({
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
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'results', 'wechat-cloud-sync-status-result.json'), JSON.stringify({
    item: {
      mode: 'cloud',
      label: '云开发缓存数据',
      healthLabel: '已同步',
      healthTone: 'ready',
      cacheReady: true,
      total: 151,
      limit: 151,
      syncedCount: 151,
      imageCachedCount: 151,
      imageUploadedCount: 0,
      imageReusedCount: 151,
      imageCacheFailedCount: 0,
      failedCount: 0,
      missingImageCount: 0,
      missingCachedImageCount: 0,
      lastRunSyncedCount: 151,
      lastRunImageCachedCount: 151,
      lastRunImageUploadedCount: 0,
      lastRunImageReusedCount: 151,
      lastRunImageCacheFailedCount: 0,
      lastRunFailedCount: 0,
      cacheImages: true,
      strictImageCache: false,
      syncedAtText: '2026-07-08 03:30',
      maxSyncAgeHours: 30,
      syncAgeHours: 0.5,
      syncAgeText: '0.5h',
      syncFresh: true,
      syncStale: false
    },
    source: 'cloud'
  }, null, 2), 'utf8');
  fs.writeFileSync(path.join(payloadDir, 'results', 'wechat-cloud-sync-runs-result.json'), JSON.stringify({
    items: [
      {
        runId: 'pokeapi-timer-default',
        status: 'success',
        statusText: '成功',
        failedCount: 0,
        imageFailedCount: 0,
        countText: '151 / 151',
        imageText: '151 / 0'
      },
      ...batches.map(([startId, endId]) => ({
        runId: `pokeapi-${startId}-${endId}`,
        status: 'success',
        statusText: '成功',
        failedCount: 0,
        imageFailedCount: 0,
        countText: `${endId - startId + 1} / ${endId - startId + 1}`,
        imageText: `${endId - startId + 1} / 0`
      })).reverse()
    ],
    total: batches.length + 1,
    source: 'cloud'
  }, null, 2), 'utf8');
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokechill-evidence-'));
  try {
    createValidResultFiles(tempDir);
    const evidence = inspectEvidence(Object.assign(parseArgs([]), { payloadDir: tempDir }));
    const failed = evidence.checks.filter((item) => !item.ok);
    if (failed.length) {
      throw new Error(`self-test failed: ${failed.map((item) => item.label).join(', ')}`);
    }
    const verifier = runVerifier(evidence, parseArgs([]));
    if (!verifier.ok) {
      throw new Error(`self-test verifier failed with status ${verifier.status}`);
    }
    const summary = JSON.parse(fs.readFileSync(evidence.summaryResult, 'utf8'));
    if (!summary.ok || summary.summary.total < 60) {
      throw new Error('self-test failed: summary file missing passing verifier details');
    }
    console.log(JSON.stringify({
      ok: true,
      payloadDir: tempDir,
      syncResults: evidence.syncPayloads.length,
      summary: evidence.summaryResult
    }, null, 2));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const evidence = inspectEvidence(options);
  console.log('PokeChill miniapp cloud evidence check');
  console.log(JSON.stringify({
    payloadDir: evidence.payloadDir,
    resultsDir: evidence.resultsDir,
    syncResultCount: evidence.syncPayloads.length,
    manifest: evidence.manifest && evidence.manifest.manifestFile ? evidence.manifest.manifestFile : '',
    statusResult: evidence.statusResult,
    runsResult: evidence.runsResult,
    summaryResult: evidence.summaryResult
  }, null, 2));
  printChecks(evidence.checks);

  const failed = evidence.checks.filter((item) => !item.ok);
  if (failed.length) {
    const missingResults = failed.filter((item) => /result exists/.test(item.label));
    const missingSetup = failed.filter((item) => !/result exists/.test(item.label));

    console.log('\nNext actions');
    if (missingSetup.length) {
      console.log('- Run: node tools\\generate-miniapp-cloud-payloads.js');
      console.log('- Confirm tmp\\wechat-cloud-payloads\\MANIFEST.json and RUNBOOK.md exist before collecting cloud results.');
    }
    if (missingResults.length) {
      console.log('- Optional: set POKECHILL_CLOUD_ENV once, then omit --cloud-env in workflow commands.');
      console.log('- Overall status: node tools\\miniapp-cloud-workflow.js status');
      console.log('- Prepare after you have a cloud env: node tools\\miniapp-cloud-workflow.js prepare --cloud-env=<your-env-id>');
      console.log('- Deploy after prepare: node tools\\miniapp-cloud-workflow.js deploy --cloud-env=<your-env-id> --execute');
      console.log('- Enable WeChat DevTools Service Port, or explicitly confirm the CLI prompt: node tools\\check-wechat-devtools-cli.js --strict --enable-service-port');
      console.log('- Verify CLI access: node tools\\check-wechat-devtools-cli.js --strict');
      console.log('- Deploy cloud functions: node tools\\deploy-wechat-cloudfunctions.js --cloud-env=<your-env-id> --execute');
      console.log('- Open tmp\\wechat-cloud-payloads\\RUNBOOK.md and execute the 7 payloads in the WeChat DevTools cloud function test panel.');
      console.log('- Use node tools\\collect-miniapp-cloud-result.js --show-payload to see the next payload.');
      console.log('- After copying each returned JSON, save it with: node tools\\collect-miniapp-cloud-result.js --step=<n> --from-clipboard');
      console.log('- Re-run: node tools\\check-miniapp-cloud-evidence.js');
    }
    process.exitCode = 1;
    return;
  }

  if (!options.skipVerify) {
    console.log('\nRunning deploy result verifier');
    const verifier = runVerifier(evidence, options);
    if (!verifier.ok) {
      process.exitCode = verifier.status || 1;
    }
  }
}

main();
