const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const node = process.execPath;
const defaultProject = path.join(repoRoot, 'wechat-miniapp');
const defaultFunctions = ['pokedex', 'syncPokeapi'];
const defaultCliCandidates = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Tencent', '微信web开发者工具', 'cli.bat'),
  path.join(process.env.ProgramFiles || '', 'Tencent', '微信web开发者工具', 'cli.bat'),
  path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'cli.bat')
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    cloudEnv: process.env.POKECHILL_CLOUD_ENV || process.env.WECHAT_CLOUD_ENV || '',
    project: defaultProject,
    cli: '',
    port: 9420,
    functions: defaultFunctions.slice(),
    remoteNpmInstall: true,
    enableServicePort: false,
    execute: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--execute') {
      args.execute = true;
      return;
    }
    if (arg === '--no-remote-npm-install') {
      args.remoteNpmInstall = false;
      return;
    }
    if (arg === '--enable-service-port') {
      args.enableServicePort = true;
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
    if (key === 'port') {
      args.port = Number(value);
    } else if (key === 'functions') {
      args.functions = value.split(',').map((item) => item.trim()).filter(Boolean);
    } else {
      args[key] = value;
    }
  });

  return args;
}

function findCli(explicitPath) {
  const candidates = explicitPath ? [explicitPath] : defaultCliCandidates;
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || '';
}

function resolveCliInvocation(cliPath, args) {
  if (process.platform === 'win32' && /\.bat$/i.test(cliPath)) {
    const dir = path.dirname(cliPath);
    const nodeExe = path.join(dir, 'node.exe');
    const cliJs = path.join(dir, 'cli.js');
    if (fs.existsSync(nodeExe) && fs.existsSync(cliJs)) {
      return {
        executable: nodeExe,
        args: [cliJs, ...args]
      };
    }
  }
  return {
    executable: cliPath,
    args
  };
}

function shellQuote(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text.replace(/"/g, '\\"')}"` : text;
}

function buildDeployArgs(args) {
  const cliArgs = [
    'cloud',
    'functions',
    'deploy',
    '--env',
    args.cloudEnv,
    '--names',
    ...args.functions
  ];
  if (args.remoteNpmInstall) {
    cliArgs.push('--remote-npm-install');
  }
  cliArgs.push('--project', args.project, '--port', String(args.port));
  return cliArgs;
}

function commandPreview(cliPath, cliArgs) {
  const invocation = resolveCliInvocation(cliPath, cliArgs);
  return [invocation.executable, ...invocation.args].map(shellQuote).join(' ');
}

function runNodeScript(script, args) {
  const result = spawnSync(node, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30000
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    ok: result.status === 0,
    status: result.status,
    error: result.error ? result.error.message : '',
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function parseJsonOutput(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function runCli(cliPath, cliArgs) {
  const invocation = resolveCliInvocation(cliPath, cliArgs);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input: '',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15 * 60 * 1000
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return {
    ok: result.status === 0,
    status: result.status,
    error: result.error ? result.error.message : ''
  };
}

function validateArgs(args, cliPath) {
  const issues = [];
  if (!cliPath) {
    issues.push('WeChat DevTools CLI was not found. Pass --cli=<path-to-cli.bat>.');
  }
  if (!String(args.cloudEnv || '').trim()) {
    issues.push('cloudEnv is required. Example: --cloud-env=prod-abc123 or set POKECHILL_CLOUD_ENV=prod-abc123');
  }
  if (!fs.existsSync(args.project)) {
    issues.push(`project path does not exist: ${args.project}`);
  }
  if (!args.functions.length) {
    issues.push('at least one cloud function name is required');
  }
  return issues;
}

function runSelfTest() {
  const args = parseArgs([
    '--cloud-env=test-env',
    '--functions=pokedex,syncPokeapi',
    '--port=9001',
    '--no-remote-npm-install'
  ]);
  const deployArgs = buildDeployArgs(args);
  if (!deployArgs.includes('--env') || !deployArgs.includes('test-env')) {
    throw new Error('self-test failed: env missing');
  }
  if (!deployArgs.includes('pokedex') || !deployArgs.includes('syncPokeapi')) {
    throw new Error('self-test failed: functions missing');
  }
  if (deployArgs.includes('--remote-npm-install')) {
    throw new Error('self-test failed: remote npm flag should be omitted');
  }
  const parsed = parseJsonOutput('{"port":58905}');
  if (!parsed || parsed.port !== 58905) {
    throw new Error('self-test failed: probe JSON parsing');
  }
  console.log(JSON.stringify({
    ok: true,
    commandArgs: deployArgs.length,
    functions: args.functions
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const cliPath = findCli(args.cli);
  const issues = validateArgs(args, cliPath);
  const deployArgs = buildDeployArgs(args);
  const preview = cliPath ? commandPreview(cliPath, deployArgs) : '';

  console.log(JSON.stringify({
    ok: issues.length === 0,
    execute: args.execute,
    cliPath,
    project: args.project,
    cloudEnv: args.cloudEnv,
    functions: args.functions,
    remoteNpmInstall: args.remoteNpmInstall,
    enableServicePort: args.enableServicePort,
    command: preview,
    issues
  }, null, 2));

  if (issues.length) {
    process.exitCode = 1;
    return;
  }

  if (!args.execute) {
    console.log(args.enableServicePort
      ? '\nDry run only. Re-run with --execute to confirm the Service Port prompt and deploy.'
      : '\nDry run only. Re-run with --execute after WeChat DevTools Service Port is enabled.');
    return;
  }

  const probe = runNodeScript(path.join('tools', 'check-wechat-devtools-cli.js'), [
    '--strict',
    `--project=${args.project}`,
    `--port=${args.port}`,
    args.enableServicePort ? '--enable-service-port' : '',
    args.cli ? `--cli=${args.cli}` : ''
  ].filter(Boolean));
  if (!probe.ok) {
    process.exitCode = probe.status || 1;
    return;
  }

  const probeResult = parseJsonOutput(probe.stdout);
  const resolvedPort = probeResult && Number(probeResult.port) ? Number(probeResult.port) : args.port;
  const resolvedArgs = Object.assign({}, args, { port: resolvedPort });
  const resolvedDeployArgs = buildDeployArgs(resolvedArgs);
  console.log('\nUsing WeChat DevTools port for deploy:', resolvedPort);
  console.log(commandPreview(cliPath, resolvedDeployArgs));

  const deploy = runCli(cliPath, resolvedDeployArgs);
  if (!deploy.ok) {
    process.exitCode = deploy.status || 1;
    return;
  }

  console.log('\nCloud function deploy command completed.');
}

main();
