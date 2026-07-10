const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'wechat-miniapp', 'miniprogram', 'config.local.js');

function parseArgs(argv) {
  const args = {
    cloudEnv: process.env.POKECHILL_CLOUD_ENV || process.env.WECHAT_CLOUD_ENV || '',
    useCloudApi: null,
    pageSize: null,
    initEmpty: false,
    dryRun: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--init-empty') {
      args.initEmpty = true;
      return;
    }
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
    args[key] = match[2];
  });

  return args;
}

function parseBoolean(value, label) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${label} must be true or false`);
}

function formatConfig(args) {
  if (args.initEmpty) {
    return 'module.exports = {};\n';
  }

  const cloudEnv = String(args.cloudEnv || '').trim();
  if (!cloudEnv) {
    throw new Error('cloudEnv is required. Example: --cloud-env=prod-abc123 or set POKECHILL_CLOUD_ENV=prod-abc123');
  }

  const fields = [
    `cloudEnv: '${cloudEnv.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`,
    `useCloudApi: ${parseBoolean(args.useCloudApi || false, 'useCloudApi')}`
  ];

  if (args.pageSize !== null && args.pageSize !== undefined) {
    const pageSize = Number(args.pageSize);
    if (!Number.isInteger(pageSize) || pageSize <= 0) {
      throw new Error('pageSize must be a positive integer');
    }
    fields.push(`pageSize: ${pageSize}`);
  }

  return [
    'module.exports = {',
    fields.map((field, index) => `  ${field}${index === fields.length - 1 ? '' : ','}`).join('\n'),
    '};',
    ''
  ].join('\n');
}

function runSelfTest() {
  const emptyOutput = formatConfig({ initEmpty: true });
  if (emptyOutput !== 'module.exports = {};\n') {
    throw new Error('self-test failed: initEmpty output is invalid');
  }

  const output = formatConfig({
    cloudEnv: 'test-env-123',
    useCloudApi: 'true',
    pageSize: '40'
  });
  if (!output.includes("cloudEnv: 'test-env-123'")) {
    throw new Error('self-test failed: cloudEnv missing');
  }
  if (!output.includes('useCloudApi: true')) {
    throw new Error('self-test failed: useCloudApi missing');
  }
  if (!output.includes('pageSize: 40')) {
    throw new Error('self-test failed: pageSize missing');
  }
  console.log(JSON.stringify({
    ok: true,
    emptyBytes: Buffer.byteLength(emptyOutput),
    cloudBytes: Buffer.byteLength(output)
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const config = formatConfig(args);
  if (!args.dryRun) {
    fs.writeFileSync(outputPath, config, 'utf8');
  }
  console.log(JSON.stringify({
    ok: true,
    path: outputPath,
    dryRun: args.dryRun,
    initEmpty: args.initEmpty,
    cloudEnvConfigured: !args.initEmpty,
    useCloudApi: args.initEmpty ? false : parseBoolean(args.useCloudApi || false, 'useCloudApi')
  }, null, 2));
}

main();
