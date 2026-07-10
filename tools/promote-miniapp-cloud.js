const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultPayloadDir = path.join(repoRoot, 'tmp', 'wechat-cloud-payloads');
const node = process.execPath;

function parseArgs(argv) {
  const args = {
    payloadDir: defaultPayloadDir,
    cloudEnv: process.env.POKECHILL_CLOUD_ENV || process.env.WECHAT_CLOUD_ENV || '',
    pageSize: '',
    minCount: 151,
    minImageCached: 151,
    maxImageCacheFailures: 0,
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

function runNodeScript(script, args) {
  const result = spawnSync(node, [script, ...args], {
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

function assertOk(result, label) {
  if (!result.ok) {
    throw new Error(`${label} failed${result.error ? `: ${result.error}` : ''}`);
  }
}

function runEvidenceCheck(args) {
  return runNodeScript(path.join('tools', 'check-miniapp-cloud-evidence.js'), [
    `--payload-dir=${args.payloadDir}`,
    `--min-count=${args.minCount}`,
    `--min-image-cached=${args.minImageCached}`,
    `--max-image-cache-failures=${args.maxImageCacheFailures}`,
    `--max-sync-age-hours=${args.maxSyncAgeHours}`
  ]);
}

function runConfigure(args) {
  const configureArgs = [
    `--cloud-env=${args.cloudEnv}`,
    '--use-cloud-api=true'
  ];
  if (args.pageSize) {
    configureArgs.push(`--page-size=${args.pageSize}`);
  }
  if (args.dryRun) {
    configureArgs.push('--dry-run');
  }
  return runNodeScript(path.join('tools', 'configure-miniapp-cloud-local.js'), configureArgs);
}

function runCloudReadiness() {
  return runNodeScript(path.join('tools', 'check-miniapp-cloud-readiness.js'), ['--mode=cloud']);
}

function runSelfTest() {
  const evidence = runNodeScript(path.join('tools', 'check-miniapp-cloud-evidence.js'), ['--self-test']);
  assertOk(evidence, 'evidence self-test');
  const configure = runNodeScript(path.join('tools', 'configure-miniapp-cloud-local.js'), [
    '--cloud-env=self-test-env',
    '--use-cloud-api=true',
    '--dry-run'
  ]);
  assertOk(configure, 'config dry-run self-test');
  console.log(JSON.stringify({
    ok: true,
    evidenceChecked: true,
    configDryRun: true
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  if (!String(args.cloudEnv || '').trim()) {
    console.error('cloudEnv is required. Example: node tools\\promote-miniapp-cloud.js --cloud-env=prod-abc123 or set POKECHILL_CLOUD_ENV=prod-abc123');
    process.exitCode = 1;
    return;
  }

  console.log('PokeChill miniapp cloud promotion');
  console.log(JSON.stringify({
    payloadDir: args.payloadDir,
    cloudEnv: args.cloudEnv,
    dryRun: args.dryRun,
    minCount: args.minCount,
    minImageCached: args.minImageCached,
    maxImageCacheFailures: args.maxImageCacheFailures,
    maxSyncAgeHours: args.maxSyncAgeHours
  }, null, 2));

  console.log('\n[1/3] Checking real cloud evidence');
  const evidence = runEvidenceCheck(args);
  if (!evidence.ok) {
    process.exitCode = evidence.status || 1;
    return;
  }

  console.log('\n[2/3] Writing cloud config');
  const configure = runConfigure(args);
  if (!configure.ok) {
    process.exitCode = configure.status || 1;
    return;
  }

  if (args.dryRun) {
    console.log('\nDry run complete. Re-run without --dry-run to switch useCloudApi on.');
    return;
  }

  console.log('\n[3/3] Checking cloud-mode readiness');
  const readiness = runCloudReadiness();
  if (!readiness.ok) {
    process.exitCode = readiness.status || 1;
    return;
  }

  console.log('\nCloud promotion complete. Recompile the miniapp in WeChat DevTools and run the in-page cloud cache self-check.');
}

main();
