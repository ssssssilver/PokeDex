const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultProject = path.join(repoRoot, 'wechat-miniapp');
const defaultCliCandidates = [
  path.join(process.env['ProgramFiles(x86)'] || '', 'Tencent', '微信web开发者工具', 'cli.bat'),
  path.join(process.env.ProgramFiles || '', 'Tencent', '微信web开发者工具', 'cli.bat'),
  path.join(process.env.LOCALAPPDATA || '', '微信开发者工具', 'cli.bat')
].filter(Boolean);

function parseArgs(argv) {
  const args = {
    project: defaultProject,
    cli: '',
    port: 9420,
    enableServicePort: false,
    strict: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--strict') {
      args.strict = true;
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

function quoteCmdArg(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
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
  if (process.platform === 'win32') {
    const command = [cliPath, ...args].map(quoteCmdArg).join(' ');
    return {
      executable: 'cmd.exe',
      args: ['/d', '/c', `call ${command}`]
    };
  }
  return {
    executable: cliPath,
    args
  };
}

function runCli(cliPath, args, options = {}) {
  const invocation = resolveCliInvocation(cliPath, args);
  const result = spawnSync(invocation.executable, invocation.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input: options.input || '',
    timeout: options.timeoutMs || 12000,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  return {
    ok: result.status === 0,
    status: result.status,
    signal: result.signal || '',
    error: result.error ? result.error.message : '',
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function textOf(result) {
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

function commandProducedSignal(result) {
  return result.status !== null ||
    Boolean(result.stdout) ||
    Boolean(result.stderr) ||
    Boolean(result.error);
}

function hasServicePortDisabled(text) {
  return /service port disabled|服务端口已关闭/i.test(text);
}

function hasCommandPathError(text) {
  return /not recognized as an internal or external command|不是内部或外部命令/i.test(text);
}

function hasLoginSignal(text) {
  return /login|登录|islogin|need.*login/i.test(text);
}

function hasCliErrorSignal(text) {
  return /(^|\n)\s*(\[error\]|×)|Base resp abnormal|system error/i.test(text);
}

function parseActiveIdePort(text) {
  const match = String(text || '').match(/127\.0\.0\.1:(\d+)/);
  return match ? Number(match[1]) : 0;
}

function requiredChecksOk(checks) {
  return checks.every((item) => item.required === false || item.ok);
}

function probe(args) {
  const cliPath = findCli(args.cli);
  const checks = [];
  const nextActions = [];

  checks.push({
    ok: Boolean(cliPath),
    label: 'WeChat DevTools CLI exists',
    details: cliPath || 'cli.bat not found in common install paths'
  });

  if (!cliPath) {
    nextActions.push('Install WeChat DevTools or pass --cli=<path-to-cli.bat>.');
    return {
      ok: false,
      cliReady: false,
      cliPath,
      project: args.project,
      checks,
      nextActions
    };
  }

  const help = runCli(cliPath, ['--help'], { timeoutMs: 10000 });
  const helpText = textOf(help);
  checks.push({
    ok: help.ok && helpText.includes('cloud'),
    label: 'CLI exposes cloud commands',
    details: help.ok ? 'cloud command detected' : (help.error || helpText.trim().slice(0, 200))
  });

  const projectExists = fs.existsSync(args.project);
  checks.push({
    ok: projectExists,
    label: 'Miniapp project path exists',
    details: args.project
  });

  if (!projectExists) {
    nextActions.push('Pass --project=<wechat-miniapp-path> or run from the repo root.');
    return {
      ok: false,
      cliReady: false,
      cliPath,
      project: args.project,
      checks,
      nextActions
    };
  }

  let resolvedPort = args.port;
  let baseArgs = ['--project', args.project, '--port', String(resolvedPort)];
  const login = runCli(cliPath, ['islogin', ...baseArgs], {
    input: args.enableServicePort ? 'y\n' : 'n\n',
    timeoutMs: 12000
  });
  let loginText = textOf(login);
  let finalLogin = login;

  if (args.enableServicePort && hasServicePortDisabled(loginText)) {
    const confirmLogin = runCli(cliPath, ['islogin', ...baseArgs], {
      input: 'n\n',
      timeoutMs: 12000
    });
    finalLogin = confirmLogin;
    loginText = textOf(confirmLogin);
  }

  const activePort = parseActiveIdePort(loginText);
  if (activePort && activePort !== resolvedPort) {
    resolvedPort = activePort;
    baseArgs = ['--project', args.project, '--port', String(resolvedPort)];
    finalLogin = runCli(cliPath, ['islogin', ...baseArgs], {
      input: 'n\n',
      timeoutMs: 12000
    });
    loginText = textOf(finalLogin);
  }

  const loginRan = commandProducedSignal(finalLogin);
  const commandPathOk = !hasCommandPathError(loginText) && !finalLogin.error;
  const servicePortEnabled = loginRan && commandPathOk && !hasServicePortDisabled(loginText);
  checks.push({
    ok: servicePortEnabled,
    label: 'IDE service port is enabled',
    details: servicePortEnabled
      ? `port=${resolvedPort}`
      : (login.error || 'Open WeChat DevTools -> Settings -> Security Settings -> Service Port')
  });

  if (!servicePortEnabled) {
    nextActions.push('Open WeChat DevTools, go to Settings -> Security Settings, and turn Service Port on.');
    nextActions.push('Or explicitly allow the CLI prompt: node tools\\check-wechat-devtools-cli.js --strict --enable-service-port');
    nextActions.push(`After enabling it, rerun: node tools\\check-wechat-devtools-cli.js --strict --port=${args.port}`);
    return {
      ok: false,
      cliReady: false,
      cliPath,
      project: args.project,
      port: resolvedPort,
      requestedPort: args.port,
      enableServicePort: args.enableServicePort,
      checks,
      nextActions,
      raw: {
        islogin: textOf(login).trim().slice(0, 1200),
        confirmIslogin: finalLogin === login ? '' : loginText.trim().slice(0, 1200)
      }
    };
  }

  const loginOk = finalLogin.ok && !hasCliErrorSignal(loginText);
  checks.push({
    ok: loginOk,
    label: 'CLI login probe completed',
    details: loginOk ? 'islogin exited 0' : loginText.trim().slice(0, 200)
  });

  const envList = runCli(cliPath, ['cloud', 'env', 'list', ...baseArgs], {
    input: 'n\n',
    timeoutMs: 20000
  });
  const envText = textOf(envList);
  const envListOk = envList.ok && !hasCliErrorSignal(envText);
  checks.push({
    ok: envListOk,
    required: false,
    label: envListOk ? 'Cloud environment list is queryable' : 'Cloud environment list query returned a warning',
    details: envText.trim().slice(0, 400)
  });

  if (!envListOk) {
    nextActions.push('Cloud environment listing returned a warning; deployment may still work when --cloud-env is provided explicitly.');
  }

  return {
    ok: requiredChecksOk(checks),
    cliReady: requiredChecksOk(checks),
    cliPath,
    project: args.project,
    port: resolvedPort,
    requestedPort: args.port,
    enableServicePort: args.enableServicePort,
    checks,
    nextActions
  };
}

function runSelfTest() {
  const servicePortText = 'IDE service port disabled 服务端口已关闭';
  if (!hasServicePortDisabled(servicePortText)) {
    throw new Error('self-test failed: service port detection');
  }
  if (parseActiveIdePort('IDE server has started on http://127.0.0.1:58905') !== 58905) {
    throw new Error('self-test failed: active port detection');
  }
  if (!hasCliErrorSignal('[error] system error')) {
    throw new Error('self-test failed: CLI error detection');
  }
  const args = parseArgs([
    '--project=F:\\repo\\wechat-miniapp',
    '--port=9001',
    '--strict',
    '--enable-service-port'
  ]);
  if (args.project !== 'F:\\repo\\wechat-miniapp' || args.port !== 9001 || !args.strict || !args.enableServicePort) {
    throw new Error('self-test failed: arg parsing');
  }
  console.log(JSON.stringify({
    ok: true,
    servicePortDetection: true,
    activePortDetection: true,
    cliErrorDetection: true,
    argParsing: true
  }, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const result = probe(args);
  console.log(JSON.stringify(result, null, 2));
  if (args.strict && !result.ok) {
    process.exitCode = 1;
  }
}

main();
