const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const node = process.execPath;

const miniappToolScripts = [
  'tools/validate-miniapp-pokemon-snapshot.js',
  'tools/test-miniapp-sync-core.js',
  'tools/smoke-miniapp-pokeapi-sync.js',
  'tools/smoke-miniapp-cloudfunctions-local.js',
  'tools/generate-miniapp-pokemon-snapshot.js',
  'tools/configure-miniapp-cloud-local.js',
  'tools/promote-miniapp-cloud.js',
  'tools/miniapp-cloud-workflow.js',
  'tools/generate-miniapp-cloud-payloads.js',
  'tools/collect-miniapp-cloud-result.js',
  'tools/check-miniapp-cloud-evidence.js',
  'tools/check-miniapp-cloud-readiness.js',
  'tools/verify-miniapp-cloud-deploy-result.js',
  'tools/check-wechat-devtools-cli.js',
  'tools/deploy-wechat-cloudfunctions.js',
  'tools/preflight-miniapp-cloud.js'
];

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

function walkFiles(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) {
    return output;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, output);
    } else if (predicate(fullPath)) {
      output.push(fullPath);
    }
  }

  return output;
}

function printChildOutput(result) {
  if (result.stdout && result.stdout.trim()) {
    process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  }
  if (result.stderr && result.stderr.trim()) {
    process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
  }
}

function runNodeScript(script, args = [], options = {}) {
  const result = spawnSync(node, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: options.timeoutMs || 180000,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  printChildOutput(result);

  if (result.error) {
    return {
      ok: false,
      details: result.error.message
    };
  }

  return {
    ok: result.status === 0,
    details: result.status === 0 ? '' : `exit code ${result.status}`
  };
}

function runJsSyntaxCheck() {
  const jsFiles = walkFiles(
    path.join(repoRoot, 'wechat-miniapp'),
    (filePath) => filePath.endsWith('.js')
  );

  for (const script of miniappToolScripts) {
    const fullPath = path.join(repoRoot, script);
    if (fs.existsSync(fullPath) && !jsFiles.includes(fullPath)) {
      jsFiles.push(fullPath);
    }
  }

  const failures = [];
  for (const filePath of jsFiles.sort()) {
    const result = spawnSync(node, ['--check', filePath], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (result.status !== 0 || result.error) {
      failures.push({
        file: relative(filePath),
        error: result.error ? result.error.message : `${result.stdout || ''}${result.stderr || ''}`.trim()
      });
    }
  }

  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    return {
      ok: false,
      details: `${failures.length} JS syntax check(s) failed`
    };
  }

  console.log(`Checked ${jsFiles.length} JS files.`);
  return { ok: true, details: '' };
}

function runWxmlExpressionScan() {
  const wxmlFiles = walkFiles(
    path.join(repoRoot, 'wechat-miniapp', 'miniprogram'),
    (filePath) => filePath.endsWith('.wxml')
  );
  const riskyExpressionPattern = /\b(?:map|join|indexOf)\s*\(|\bfunction\b/;
  const matches = [];

  for (const filePath of wxmlFiles.sort()) {
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    lines.forEach((line, index) => {
      if (riskyExpressionPattern.test(line)) {
        matches.push({
          file: relative(filePath),
          line: index + 1,
          text: line.trim()
        });
      }
    });
  }

  if (matches.length) {
    console.error(JSON.stringify({ matches }, null, 2));
    return {
      ok: false,
      details: `${matches.length} risky WXML expression(s) found`
    };
  }

  console.log(`Scanned ${wxmlFiles.length} WXML files.`);
  return { ok: true, details: '' };
}

function runConfigShapeCheck() {
  const configPath = path.join(repoRoot, 'wechat-miniapp', 'miniprogram', 'config.js');
  const config = require(configPath);
  const issues = [];

  if (typeof config.cloudEnv !== 'string') {
    issues.push('cloudEnv must be a string');
  }
  if (typeof config.useCloudApi !== 'boolean') {
    issues.push('useCloudApi must be a boolean');
  }
  if (!Number.isInteger(config.pageSize) || config.pageSize <= 0) {
    issues.push('pageSize must be a positive integer');
  }

  if (issues.length) {
    console.error(JSON.stringify({ issues }, null, 2));
    return {
      ok: false,
      details: `${issues.length} config issue(s) found`
    };
  }

  console.log(JSON.stringify({
    ok: true,
    cloudEnvConfigured: Boolean(config.cloudEnv),
    useCloudApi: config.useCloudApi,
    pageSize: config.pageSize
  }, null, 2));
  return { ok: true, details: '' };
}

function main() {
  const steps = [
    {
      name: 'Miniapp config shape',
      run: runConfigShapeCheck
    },
    {
      name: 'Generated PokeAPI snapshot validation',
      run: () => runNodeScript('tools/validate-miniapp-pokemon-snapshot.js')
    },
    {
      name: 'Sync core unit tests',
      run: () => runNodeScript('tools/test-miniapp-sync-core.js')
    },
    {
      name: 'Live PokeAPI dry-run transform',
      run: () => runNodeScript('tools/smoke-miniapp-pokeapi-sync.js', ['3'], { timeoutMs: 240000 })
    },
    {
      name: 'Local cloudfunction loop smoke test',
      run: () => runNodeScript('tools/smoke-miniapp-cloudfunctions-local.js', [], { timeoutMs: 240000 })
    },
    {
      name: 'Cloud deployment artifact readiness',
      run: () => runNodeScript('tools/check-miniapp-cloud-readiness.js')
    },
    {
      name: 'Local cloud config generator self-test',
      run: () => runNodeScript('tools/configure-miniapp-cloud-local.js', ['--self-test'])
    },
    {
      name: 'Evidence-gated cloud promotion self-test',
      run: () => runNodeScript('tools/promote-miniapp-cloud.js', ['--self-test'])
    },
    {
      name: 'Miniapp cloud workflow self-test',
      run: () => runNodeScript('tools/miniapp-cloud-workflow.js', ['--self-test'])
    },
    {
      name: 'WeChat cloud payload generator self-test',
      run: () => runNodeScript('tools/generate-miniapp-cloud-payloads.js', ['--self-test'])
    },
    {
      name: 'WeChat cloud result collector self-test',
      run: () => runNodeScript('tools/collect-miniapp-cloud-result.js', ['--self-test'])
    },
    {
      name: 'WeChat cloud evidence checker self-test',
      run: () => runNodeScript('tools/check-miniapp-cloud-evidence.js', ['--self-test'])
    },
    {
      name: 'Real cloud deploy result verifier self-test',
      run: () => runNodeScript('tools/verify-miniapp-cloud-deploy-result.js', ['--self-test'])
    },
    {
      name: 'WeChat DevTools CLI probe self-test',
      run: () => runNodeScript('tools/check-wechat-devtools-cli.js', ['--self-test'])
    },
    {
      name: 'WeChat cloudfunction deploy helper self-test',
      run: () => runNodeScript('tools/deploy-wechat-cloudfunctions.js', ['--self-test'])
    },
    {
      name: 'JS syntax checks',
      run: runJsSyntaxCheck
    },
    {
      name: 'WXML expression scan',
      run: runWxmlExpressionScan
    }
  ];

  const results = [];

  console.log('PokeChill miniapp cloud preflight');
  console.log(`Repo: ${repoRoot}`);

  for (const [index, step] of steps.entries()) {
    console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
    const startedAt = Date.now();
    const result = step.run();
    const durationMs = Date.now() - startedAt;

    results.push({
      name: step.name,
      ok: result.ok,
      durationMs,
      details: result.details || ''
    });

    console.log(result.ok ? `PASS ${step.name} (${durationMs} ms)` : `FAIL ${step.name} (${durationMs} ms)`);

    if (!result.ok) {
      break;
    }
  }

  console.log('\nPreflight summary');
  console.table(results.map((item) => ({
    step: item.name,
    ok: item.ok,
    ms: item.durationMs,
    details: item.details
  })));

  if (results.some((item) => !item.ok) || results.length !== steps.length) {
    process.exitCode = 1;
    return;
  }

  console.log('Miniapp cloud preflight passed.');
}

main();
