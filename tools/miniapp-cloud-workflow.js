const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const node = process.execPath;
const defaultPayloadDir = path.join(repoRoot, 'tmp', 'wechat-cloud-payloads');

function parseArgs(argv) {
  const args = {
    command: 'status',
    cloudEnv: process.env.POKECHILL_CLOUD_ENV || process.env.WECHAT_CLOUD_ENV || '',
    payloadDir: defaultPayloadDir,
    step: 0,
    saveResult: '',
    fromClipboard: false,
    execute: false,
    enableServicePort: false,
    dryRun: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--self-test') {
      args.selfTest = true;
      return;
    }
    if (arg === '--execute') {
      args.execute = true;
      return;
    }
    if (arg === '--enable-service-port') {
      args.enableServicePort = true;
      return;
    }
    if (arg === '--from-clipboard') {
      args.fromClipboard = true;
      return;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      return;
    }
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const value = match[2];
      if (key === 'payloadDir') {
        args.payloadDir = path.resolve(value);
      } else if (key === 'step') {
        args.step = Number(value);
      } else if (key === 'saveResult') {
        args.saveResult = path.resolve(value);
      } else {
        args[key] = value;
      }
      return;
    }
    if (!arg.startsWith('-')) {
      args.command = arg;
    }
  });

  return args;
}

function runNode(script, args, options = {}) {
  const result = spawnSync(node, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs || 240000
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    ok: result.status === 0,
    status: result.status,
    error: result.error ? result.error.message : ''
  };
}

function requireCloudEnv(args) {
  if (!String(args.cloudEnv || '').trim()) {
    throw new Error('cloudEnv is required. Example: --cloud-env=prod-abc123 or set POKECHILL_CLOUD_ENV=prod-abc123');
  }
}

function printHeader(title) {
  console.log(`\n=== ${title} ===`);
}

function check(result, label, options = {}) {
  if (!result.ok && !options.allowFailure) {
    throw new Error(`${label} failed${result.status !== null && result.status !== undefined ? ` with exit code ${result.status}` : ''}${result.error ? `: ${result.error}` : ''}`);
  }
  return result.ok;
}

function commandStatus(args) {
  printHeader('CLI');
  check(runNode(path.join('tools', 'check-wechat-devtools-cli.js'), [
    '--strict',
    args.enableServicePort ? '--enable-service-port' : ''
  ].filter(Boolean)), 'DevTools CLI probe', { allowFailure: true });

  printHeader('Local Readiness');
  check(runNode(path.join('tools', 'check-miniapp-cloud-readiness.js'), []), 'local readiness', { allowFailure: true });

  printHeader('Result Collection');
  check(runNode(path.join('tools', 'collect-miniapp-cloud-result.js'), [
    `--payload-dir=${args.payloadDir}`
  ]), 'result collection status', { allowFailure: true });

  printHeader('Evidence');
  check(runNode(path.join('tools', 'check-miniapp-cloud-evidence.js'), [
    `--payload-dir=${args.payloadDir}`
  ]), 'cloud evidence check', { allowFailure: true });

  console.log('\nNext high-signal commands');
  console.log('node tools\\miniapp-cloud-workflow.js prepare --cloud-env=<your-env-id>');
  console.log('node tools\\miniapp-cloud-workflow.js deploy --cloud-env=<your-env-id> --execute');
  console.log('node tools\\miniapp-cloud-workflow.js payload');
}

function commandPrepare(args) {
  requireCloudEnv(args);
  printHeader('Write Local Cloud Config');
  check(runNode(path.join('tools', 'configure-miniapp-cloud-local.js'), [
    `--cloud-env=${args.cloudEnv}`,
    '--use-cloud-api=false'
  ]), 'configure local cloud env');

  printHeader('Generate Payloads');
  check(runNode(path.join('tools', 'generate-miniapp-cloud-payloads.js'), [
    `--output-dir=${args.payloadDir}`
  ]), 'generate payloads');

  printHeader('Deploy Readiness');
  check(runNode(path.join('tools', 'check-miniapp-cloud-readiness.js'), ['--mode=deploy']), 'deploy readiness');
}

function commandDeploy(args) {
  requireCloudEnv(args);
  printHeader(args.execute ? 'Deploy Cloud Functions' : 'Preview Cloud Function Deploy');
  check(runNode(path.join('tools', 'deploy-wechat-cloudfunctions.js'), [
    `--cloud-env=${args.cloudEnv}`,
    args.execute ? '--execute' : '',
    args.enableServicePort ? '--enable-service-port' : ''
  ].filter(Boolean), { timeoutMs: 20 * 60 * 1000 }), 'deploy cloud functions');
}

function commandPayload(args) {
  printHeader('Next Payload');
  check(runNode(path.join('tools', 'collect-miniapp-cloud-result.js'), [
    `--payload-dir=${args.payloadDir}`,
    '--show-payload',
    args.step ? `--step=${args.step}` : ''
  ].filter(Boolean)), 'show payload');
}

function commandCollect(args) {
  printHeader('Collect Cloud Function Result');
  check(runNode(path.join('tools', 'collect-miniapp-cloud-result.js'), [
    `--payload-dir=${args.payloadDir}`,
    args.step ? `--step=${args.step}` : '',
    args.fromClipboard ? '--from-clipboard' : '',
    args.saveResult ? `--save-result=${args.saveResult}` : ''
  ].filter(Boolean)), 'collect result');
}

function commandVerify(args) {
  printHeader('Verify Real Cloud Evidence');
  check(runNode(path.join('tools', 'check-miniapp-cloud-evidence.js'), [
    `--payload-dir=${args.payloadDir}`
  ]), 'verify evidence');
}

function commandPromote(args) {
  requireCloudEnv(args);
  printHeader(args.dryRun ? 'Promotion Dry Run' : 'Promote Miniapp To Cloud Reads');
  check(runNode(path.join('tools', 'promote-miniapp-cloud.js'), [
    `--cloud-env=${args.cloudEnv}`,
    `--payload-dir=${args.payloadDir}`,
    args.dryRun ? '--dry-run' : ''
  ].filter(Boolean)), 'promote miniapp cloud');
}

function runSelfTest() {
  const parsed = parseArgs([
    'deploy',
    '--cloud-env=test-env',
    '--execute',
    '--enable-service-port',
    '--step=2'
  ]);
  if (parsed.command !== 'deploy' || parsed.cloudEnv !== 'test-env' || !parsed.execute || !parsed.enableServicePort || parsed.step !== 2) {
    throw new Error('self-test failed: arg parsing');
  }

  console.log(JSON.stringify({
    ok: true,
    commands: ['status', 'prepare', 'deploy', 'payload', 'collect', 'verify', 'promote'],
    argParsing: true
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const commands = {
    status: commandStatus,
    prepare: commandPrepare,
    deploy: commandDeploy,
    payload: commandPayload,
    collect: commandCollect,
    verify: commandVerify,
    promote: commandPromote
  };

  if (!commands[args.command]) {
    throw new Error(`unknown command: ${args.command}. Expected one of: ${Object.keys(commands).join(', ')}`);
  }

  console.log('PokeChill miniapp cloud workflow');
  console.log(JSON.stringify({
    command: args.command,
    cloudEnvConfigured: Boolean(args.cloudEnv),
    payloadDir: args.payloadDir
  }, null, 2));

  commands[args.command](args);
}

main();
