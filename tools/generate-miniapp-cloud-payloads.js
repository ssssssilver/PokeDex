const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const defaultOutputDir = path.join(repoRoot, 'tmp', 'wechat-cloud-payloads');

function parseArgs(argv) {
  const args = {
    outputDir: defaultOutputDir,
    batchSize: null,
    startId: 1,
    endId: 151,
    concurrency: 3,
    retries: 2,
    cacheImages: true,
    strictImageCache: false,
    maxSyncAgeHours: 30,
    dryRun: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--dry-run') {
      args.dryRun = true;
      return;
    }
    if (arg === '--self-test') {
      args.selfTest = true;
      return;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = match[2];

    if (['batchSize', 'startId', 'endId', 'concurrency', 'retries', 'maxSyncAgeHours'].includes(key)) {
      args[key] = Number(value);
    } else if (['cacheImages', 'strictImageCache'].includes(key)) {
      args[key] = value === 'true';
    } else if (key === 'outputDir') {
      args.outputDir = path.resolve(value);
    } else {
      args[key] = value;
    }
  });

  return args;
}

function padId(id) {
  return String(id).padStart(3, '0');
}

function buildBatches(options) {
  const batches = [];
  const ranges = [];

  if (!options.batchSize && options.startId === 1 && options.endId === 151) {
    ranges.push([1, 50], [51, 100], [101, 151]);
  } else {
    const batchSize = options.batchSize || 50;
    for (let startId = options.startId; startId <= options.endId; startId += batchSize) {
      ranges.push([startId, Math.min(options.endId, startId + batchSize - 1)]);
    }
  }

  ranges.forEach(([startId, endId]) => {
    batches.push({
      startId,
      endId,
      payload: {
        startId,
        endId,
        retries: options.retries,
        concurrency: options.concurrency,
        cacheImages: options.cacheImages,
        strictImageCache: options.strictImageCache
      },
      payloadFile: `syncPokeapi-${padId(startId)}-${padId(endId)}.json`,
      resultFile: `wechat-cloud-sync-${padId(startId)}-${padId(endId)}.json`
    });
  });
  return batches;
}

function buildTimerDefault() {
  return {
    payload: {},
    payloadFile: 'syncPokeapi-timer-default.json',
    resultFile: 'wechat-cloud-sync-timer-default.json'
  };
}

function buildManifest(options, batches, timerDefault, verifyCommand) {
  const steps = [];

  batches.forEach((batch, index) => {
    steps.push({
      step: index + 1,
      cloudFunction: 'syncPokeapi',
      payloadFile: batch.payloadFile,
      resultFile: `results/${batch.resultFile}`,
      type: 'sync',
      required: true,
      mustLookLike: 'ok=true, status=success, runId present, failedCount=0, imageCacheFailedCount=0'
    });
  });

  steps.push(
    {
      step: steps.length + 1,
      cloudFunction: 'syncPokeapi',
      payloadFile: timerDefault.payloadFile,
      resultFile: `results/${timerDefault.resultFile}`,
      type: 'sync',
      required: true,
      mustLookLike: `empty event path: startId=1, endId=${options.endId}, concurrency=6, cacheImages=true, status=success`
    },
    {
      step: steps.length + 2,
      cloudFunction: 'pokedex',
      payloadFile: 'pokedex-validate-cache.json',
      resultFile: 'results/wechat-cloud-validate-result.json',
      type: 'validate',
      required: true,
      mustLookLike: 'ok=true, cloudReady=true, syncFresh=true'
    },
    {
      step: steps.length + 3,
      cloudFunction: 'pokedex',
      payloadFile: 'pokedex-get-sync-status.json',
      resultFile: 'results/wechat-cloud-sync-status-result.json',
      type: 'status',
      required: true,
      mustLookLike: 'source=cloud, mode=cloud, healthTone=ready, cacheReady=true'
    },
    {
      step: steps.length + 4,
      cloudFunction: 'pokedex',
      payloadFile: 'pokedex-get-sync-runs.json',
      resultFile: 'results/wechat-cloud-sync-runs-result.json',
      type: 'runs',
      required: true,
      mustLookLike: 'latest status=success, includes each syncPokeapi runId, no partial/failed/running recent runs'
    }
  );

  return {
    version: 1,
    app: 'PokeChill WeChat miniapp',
    minCount: options.endId,
    minImageCached: options.endId,
    maxImageCacheFailures: 0,
    maxSyncAgeHours: options.maxSyncAgeHours,
    verifyCommand,
    summaryFile: 'results/wechat-cloud-evidence-summary.json',
    steps
  };
}

function buildRunbook(options, batches, timerDefault, verifyCommand) {
  const lines = [
    '# PokeChill WeChat Cloud Runbook',
    '',
    'Use this checklist in WeChat DevTools after `pokedex` and `syncPokeapi` are deployed.',
    '',
    '## Before Running',
    '',
    '- Keep `useCloudApi` false until this runbook passes.',
    '- Open the cloud function test panel in WeChat DevTools.',
    '- `MANIFEST.json` is the machine-readable source of truth for payload and result filenames.',
    '- Optional CLI probe: run `node tools\\check-wechat-devtools-cli.js` from the repo root.',
    '- Optional explicit Service Port enable: run `node tools\\check-wechat-devtools-cli.js --strict --enable-service-port`.',
    '- Optional CLI deploy dry-run: `node tools\\deploy-wechat-cloudfunctions.js --cloud-env=<your-env-id>`.',
    '- Optional workflow status: run `node tools\\miniapp-cloud-workflow.js status`.',
    '- Optional env var shortcut: set `POKECHILL_CLOUD_ENV=<your-env-id>` once, then omit `--cloud-env` in workflow commands.',
    '- The WeChat DevTools CLI can deploy functions, but this CLI version does not expose a cloud function invoke command; execute the payloads in the DevTools test panel.',
    '- Use `node tools\\collect-miniapp-cloud-result.js` to see progress and the next missing result.',
    '- Copy each payload JSON exactly from this directory.',
    '- After each run, copy the returned JSON and save it with `node tools\\collect-miniapp-cloud-result.js --step=<step> --from-clipboard`.',
    '',
    '## Execution Checklist',
    '',
    '| Step | Cloud function | Payload file | Save result as | Must look like |',
    '| --- | --- | --- | --- | --- |'
  ];

  batches.forEach((batch, index) => {
    lines.push(`| ${index + 1} | syncPokeapi | ${batch.payloadFile} | results/${batch.resultFile} | ok=true, status=success, runId present, failedCount=0, imageCacheFailedCount=0 |`);
  });

  lines.push(
    `| ${batches.length + 1} | syncPokeapi | ${timerDefault.payloadFile} | results/${timerDefault.resultFile} | empty event path: startId=1, endId=${options.endId}, concurrency=6, cacheImages=true, status=success |`,
    `| ${batches.length + 2} | pokedex | pokedex-validate-cache.json | results/wechat-cloud-validate-result.json | ok=true, cloudReady=true, syncFresh=true |`,
    `| ${batches.length + 3} | pokedex | pokedex-get-sync-status.json | results/wechat-cloud-sync-status-result.json | source=cloud, mode=cloud, healthTone=ready, cacheReady=true |`,
    `| ${batches.length + 4} | pokedex | pokedex-get-sync-runs.json | results/wechat-cloud-sync-runs-result.json | latest status=success, includes each syncPokeapi runId, no partial/failed/running recent runs |`,
    '',
    '## Verify Evidence',
    '',
    'Run this from the repo root after saving all required result files:',
    '',
    '```powershell',
    'node tools\\check-miniapp-cloud-evidence.js',
    '```',
    '',
    'Direct verifier command:',
    '',
    '```powershell',
    verifyCommand,
    '```',
    '',
    'Successful verification writes `results/wechat-cloud-evidence-summary.json`.',
    '',
    'Shortcut while collecting results:',
    '',
    '```powershell',
    'node tools\\miniapp-cloud-workflow.js status',
    'node tools\\miniapp-cloud-workflow.js prepare --cloud-env=<your-env-id>',
    'node tools\\miniapp-cloud-workflow.js deploy --cloud-env=<your-env-id> --execute',
    'node tools\\miniapp-cloud-workflow.js payload',
    'node tools\\miniapp-cloud-workflow.js collect --step=<step> --from-clipboard',
    'node tools\\miniapp-cloud-workflow.js verify',
    '```',
    '',
    'Direct collector commands:',
    '',
    '```powershell',
    'node tools\\collect-miniapp-cloud-result.js',
    'node tools\\collect-miniapp-cloud-result.js --show-payload',
    'node tools\\collect-miniapp-cloud-result.js --step=<step> --from-clipboard',
    '```',
    '',
    '## Promote To Cloud Reads',
    '',
    'Only after verification passes:',
    '',
    '```powershell',
    'node tools\\promote-miniapp-cloud.js --cloud-env=<your-env-id> --dry-run',
    'node tools\\promote-miniapp-cloud.js --cloud-env=<your-env-id>',
    '```',
    '',
    '## Page Acceptance',
    '',
    '- Recompile the miniapp in WeChat DevTools.',
    '- Open the Profile tab.',
    '- Confirm data source is cloud cache, health is ready, and cloud cache self-check passes.',
    `- Expected count: ${options.endId} / ${options.endId}.`,
    ''
  );

  return lines.join('\n');
}

function buildFiles(options) {
  const batches = buildBatches(options);
  const timerDefault = buildTimerDefault();
  const files = [];

  batches.forEach((batch) => {
    files.push({
      name: batch.payloadFile,
      content: batch.payload
    });
  });

  files.push({
    name: timerDefault.payloadFile,
    content: timerDefault.payload
  });

  files.push({
    name: 'pokedex-validate-cache.json',
    content: {
      action: 'validateCache',
      expectedCount: options.endId,
      sampleIds: [1, 4, 7, 25, options.endId],
      maxSyncAgeHours: options.maxSyncAgeHours
    }
  });

  files.push({
    name: 'pokedex-get-sync-status.json',
    content: {
      action: 'getSyncStatus',
      maxSyncAgeHours: options.maxSyncAgeHours
    }
  });

  files.push({
    name: 'pokedex-get-sync-runs.json',
    content: {
      action: 'getSyncRuns',
      limit: 5
    }
  });

  const syncArgs = batches
    .map((batch) => `--sync=tmp\\wechat-cloud-payloads\\results\\${batch.resultFile}`)
    .join(' ');
  const timerSyncArg = `--sync=tmp\\wechat-cloud-payloads\\results\\${timerDefault.resultFile}`;
  const statusArg = '--status=tmp\\wechat-cloud-payloads\\results\\wechat-cloud-sync-status-result.json';
  const runsArg = '--runs=tmp\\wechat-cloud-payloads\\results\\wechat-cloud-sync-runs-result.json';
  const verifyCommand = `node tools\\verify-miniapp-cloud-deploy-result.js ${syncArgs} ${timerSyncArg} --validate=tmp\\wechat-cloud-payloads\\results\\wechat-cloud-validate-result.json ${statusArg} ${runsArg}`;
  const manifest = buildManifest(options, batches, timerDefault, verifyCommand);

  files.push({
    name: 'MANIFEST.json',
    content: manifest
  });

  files.push({
    name: 'README.md',
    text: [
      '# WeChat Cloud Payloads',
      '',
      'Use these JSON files in WeChat DevTools cloud function test panel.',
      'The machine-readable checklist is `MANIFEST.json`; `RUNBOOK.md` is the human-friendly version.',
      'Optional local CLI probe: `node tools\\check-wechat-devtools-cli.js`.',
      'Optional explicit Service Port enable: `node tools\\check-wechat-devtools-cli.js --strict --enable-service-port`.',
      'Optional deploy dry-run: `node tools\\deploy-wechat-cloudfunctions.js --cloud-env=<your-env-id>`.',
      'Optional workflow status: `node tools\\miniapp-cloud-workflow.js status`.',
      'Optional env var shortcut: set `POKECHILL_CLOUD_ENV=<your-env-id>` once, then omit `--cloud-env` in workflow commands.',
      'This WeChat DevTools CLI can deploy cloud functions, but it does not expose a cloud function invoke command; execute these payloads in the DevTools cloud function test panel.',
      'Use `node tools\\collect-miniapp-cloud-result.js` to see the next payload and result collection progress.',
      '',
      '1. Run each `syncPokeapi-*.json` payload against `syncPokeapi`.',
      '2. Copy each result JSON from WeChat DevTools, then save it with `node tools\\collect-miniapp-cloud-result.js --step=<step> --from-clipboard`.',
      '   Keep the returned `runId`; verification checks that those run IDs appear in `getSyncRuns`.',
      '   `syncPokeapi-timer-default.json` is an empty event. It verifies the same default path used by the daily timer trigger.',
      '3. Run `pokedex-validate-cache.json` against `pokedex`.',
      '4. Save that result as `tmp/wechat-cloud-payloads/results/wechat-cloud-validate-result.json`.',
      '5. Run `pokedex-get-sync-status.json` against `pokedex`.',
      '6. Save that result as `tmp/wechat-cloud-payloads/results/wechat-cloud-sync-status-result.json`.',
      '7. Run `pokedex-get-sync-runs.json` against `pokedex`.',
      '8. Save that result as `tmp/wechat-cloud-payloads/results/wechat-cloud-sync-runs-result.json`.',
      '9. Verify:',
      '',
      '```powershell',
      verifyCommand,
      '```',
      '',
      'A passing check writes `tmp/wechat-cloud-payloads/results/wechat-cloud-evidence-summary.json` for release review.',
      '',
      '10. Promote the miniapp to cloud reads after verification passes:',
      '',
      '```powershell',
      'node tools\\promote-miniapp-cloud.js --cloud-env=<your-env-id>',
      '```',
      ''
    ].join('\n')
  });

  files.push({
    name: 'RUNBOOK.md',
    text: buildRunbook(options, batches, timerDefault, verifyCommand)
  });

  return {
    batches,
    files,
    verifyCommand
  };
}

function writeFiles(outputDir, files) {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, 'results'), { recursive: true });
  files.forEach((file) => {
    const filePath = path.join(outputDir, file.name);
    const body = file.text || `${JSON.stringify(file.content, null, 2)}\n`;
    fs.writeFileSync(filePath, body, 'utf8');
  });
}

function runSelfTest() {
  const result = buildFiles({
    outputDir: defaultOutputDir,
    batchSize: null,
    startId: 1,
    endId: 151,
    concurrency: 3,
    retries: 2,
    cacheImages: true,
    strictImageCache: false,
    maxSyncAgeHours: 30
  });

  const names = result.files.map((file) => file.name);
  const required = [
    'syncPokeapi-001-050.json',
    'syncPokeapi-051-100.json',
    'syncPokeapi-101-151.json',
    'syncPokeapi-timer-default.json',
    'pokedex-validate-cache.json',
    'pokedex-get-sync-status.json',
    'pokedex-get-sync-runs.json',
    'MANIFEST.json',
    'README.md',
    'RUNBOOK.md'
  ];
  required.forEach((name) => {
    if (!names.includes(name)) {
      throw new Error(`self-test failed: missing ${name}`);
    }
  });
  if (!result.verifyCommand.includes('wechat-cloud-sync-001-050.json') ||
    !result.verifyCommand.includes('wechat-cloud-sync-timer-default.json') ||
    !result.verifyCommand.includes('wechat-cloud-validate-result.json') ||
    !result.verifyCommand.includes('wechat-cloud-sync-status-result.json') ||
    !result.verifyCommand.includes('wechat-cloud-sync-runs-result.json')) {
    throw new Error('self-test failed: verify command is incomplete');
  }

  console.log(JSON.stringify({
    ok: true,
    files: names.length,
    batches: result.batches.length,
    manifest: names.includes('MANIFEST.json')
  }, null, 2));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.selfTest) {
    runSelfTest();
    return;
  }

  const result = buildFiles(options);
  if (!options.dryRun) {
    writeFiles(options.outputDir, result.files);
  }

  console.log(JSON.stringify({
    ok: true,
    dryRun: options.dryRun,
    outputDir: options.outputDir,
    files: result.files.map((file) => file.name),
    verifyCommand: result.verifyCommand
  }, null, 2));
}

main();
