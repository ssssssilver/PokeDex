const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const defaultPayloadDir = path.join(repoRoot, 'tmp', 'wechat-cloud-payloads');

function parseArgs(argv) {
  const args = {
    payloadDir: defaultPayloadDir,
    step: 0,
    showPayload: false,
    saveResult: '',
    fromClipboard: false,
    selfTest: false
  };

  argv.forEach((arg) => {
    if (arg === '--show-payload') {
      args.showPayload = true;
      return;
    }
    if (arg === '--from-clipboard') {
      args.fromClipboard = true;
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
    } else if (key === 'step') {
      args.step = Number(value);
    } else if (key === 'saveResult') {
      args.saveResult = path.resolve(value);
    } else {
      args[key] = value;
    }
  });

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function manifestPath(payloadDir, manifestRelativePath) {
  return path.join(payloadDir, String(manifestRelativePath || '').replace(/\//g, path.sep));
}

function readManifest(payloadDir) {
  const manifestFile = path.join(payloadDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestFile)) {
    throw new Error(`MANIFEST.json not found: ${manifestFile}`);
  }
  const manifest = readJson(manifestFile);
  if (!Array.isArray(manifest.steps) || !manifest.steps.length) {
    throw new Error(`manifest has no steps: ${manifestFile}`);
  }
  return Object.assign({ manifestFile }, manifest);
}

function getStep(manifest, stepNumber) {
  const step = manifest.steps.find((item) => Number(item.step) === Number(stepNumber));
  if (!step) {
    throw new Error(`step ${stepNumber} not found in manifest`);
  }
  return step;
}

function getStatus(payloadDir, manifest) {
  const steps = manifest.steps.map((step) => {
    const payloadFile = manifestPath(payloadDir, step.payloadFile);
    const resultFile = manifestPath(payloadDir, step.resultFile);
    return {
      step: step.step,
      type: step.type,
      cloudFunction: step.cloudFunction,
      payloadFile,
      resultFile,
      payloadExists: fs.existsSync(payloadFile),
      resultExists: fs.existsSync(resultFile),
      mustLookLike: step.mustLookLike || ''
    };
  });
  const completed = steps.filter((step) => step.resultExists).length;
  return {
    ok: completed === steps.length,
    completed,
    total: steps.length,
    next: steps.find((step) => !step.resultExists) || null,
    steps
  };
}

function printStatus(payloadDir, manifest) {
  const status = getStatus(payloadDir, manifest);
  console.log(JSON.stringify({
    ok: status.ok,
    payloadDir,
    completed: status.completed,
    total: status.total,
    next: status.next ? {
      step: status.next.step,
      cloudFunction: status.next.cloudFunction,
      payloadFile: path.relative(payloadDir, status.next.payloadFile),
      resultFile: path.relative(payloadDir, status.next.resultFile),
      mustLookLike: status.next.mustLookLike
    } : null
  }, null, 2));
  console.table(status.steps.map((step) => ({
    step: step.step,
    fn: step.cloudFunction,
    type: step.type,
    payload: step.payloadExists ? 'yes' : 'missing',
    result: step.resultExists ? 'saved' : 'missing'
  })));
}

function hasKnownResultShape(value) {
  return Boolean(value && typeof value === 'object' && (
    Object.prototype.hasOwnProperty.call(value, 'ok') ||
    Object.prototype.hasOwnProperty.call(value, 'status') ||
    Object.prototype.hasOwnProperty.call(value, 'items') ||
    Object.prototype.hasOwnProperty.call(value, 'item') ||
    Object.prototype.hasOwnProperty.call(value, 'checks') ||
    Object.prototype.hasOwnProperty.call(value, 'source')
  ));
}

function unwrapCloudResult(value) {
  if (value && typeof value === 'object' && value.result && typeof value.result === 'object' && !hasKnownResultShape(value)) {
    return {
      value: value.result,
      unwrapped: true
    };
  }
  return {
    value,
    unwrapped: false
  };
}

function readClipboard() {
  if (process.platform === 'win32') {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000
    });
    if (result.status !== 0 || result.error) {
      throw new Error(result.error ? result.error.message : (result.stderr || 'Get-Clipboard failed'));
    }
    return result.stdout;
  }

  const command = process.platform === 'darwin' ? 'pbpaste' : 'xclip';
  const args = process.platform === 'darwin' ? [] : ['-selection', 'clipboard', '-o'];
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 10000
  });
  if (result.status !== 0 || result.error) {
    throw new Error(result.error ? result.error.message : (result.stderr || `${command} failed`));
  }
  return result.stdout;
}

function readResultText(args) {
  if (args.fromClipboard) {
    return readClipboard();
  }
  if (args.saveResult) {
    return fs.readFileSync(args.saveResult, 'utf8');
  }
  throw new Error('pass --save-result=<json-file> or --from-clipboard');
}

function quickCheck(step, value) {
  const warnings = [];
  if (!value || typeof value !== 'object') {
    warnings.push('result is not a JSON object');
    return warnings;
  }
  if (step.type === 'sync') {
    if (value.ok !== true) warnings.push('sync result ok is not true');
    if (value.status !== 'success') warnings.push('sync result status is not success');
    if (!value.runId) warnings.push('sync result runId is missing');
  } else if (step.type === 'validate') {
    if (value.ok !== true) warnings.push('validateCache ok is not true');
  } else if (step.type === 'status') {
    if (!value.item) warnings.push('getSyncStatus item is missing');
    if (value.source !== 'cloud') warnings.push('getSyncStatus source is not cloud');
  } else if (step.type === 'runs') {
    if (!Array.isArray(value.items)) warnings.push('getSyncRuns items is not an array');
    if (value.source !== 'cloud') warnings.push('getSyncRuns source is not cloud');
  }
  return warnings;
}

function showPayload(payloadDir, manifest, stepNumber) {
  const step = getStep(manifest, stepNumber);
  const payloadFile = manifestPath(payloadDir, step.payloadFile);
  const resultFile = manifestPath(payloadDir, step.resultFile);
  if (!fs.existsSync(payloadFile)) {
    throw new Error(`payload file not found: ${payloadFile}`);
  }
  console.log(JSON.stringify({
    step: step.step,
    cloudFunction: step.cloudFunction,
    payloadFile,
    resultFile,
    mustLookLike: step.mustLookLike || '',
    payload: readJson(payloadFile)
  }, null, 2));
}

function saveResult(payloadDir, manifest, args) {
  if (!args.step) {
    throw new Error('--step=<number> is required when saving a result');
  }
  const step = getStep(manifest, args.step);
  const resultFile = manifestPath(payloadDir, step.resultFile);
  const rawText = readResultText(args).trim();
  if (!rawText) {
    throw new Error('result JSON is empty');
  }
  const parsed = JSON.parse(rawText);
  const unwrapped = unwrapCloudResult(parsed);
  const warnings = quickCheck(step, unwrapped.value);

  fs.mkdirSync(path.dirname(resultFile), { recursive: true });
  fs.writeFileSync(resultFile, `${JSON.stringify(unwrapped.value, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    ok: true,
    step: step.step,
    cloudFunction: step.cloudFunction,
    resultFile,
    unwrapped: unwrapped.unwrapped,
    warnings,
    next: getStatus(payloadDir, manifest).next
  }, null, 2));
}

function runSelfTest() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokechill-collector-'));
  try {
    fs.mkdirSync(path.join(tempDir, 'results'), { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'MANIFEST.json'), JSON.stringify({
      version: 1,
      steps: [
        {
          step: 1,
          cloudFunction: 'syncPokeapi',
          payloadFile: 'syncPokeapi-001-001.json',
          resultFile: 'results/wechat-cloud-sync-001-001.json',
          type: 'sync',
          required: true
        },
        {
          step: 2,
          cloudFunction: 'pokedex',
          payloadFile: 'pokedex-get-sync-status.json',
          resultFile: 'results/wechat-cloud-sync-status-result.json',
          type: 'status',
          required: true
        }
      ]
    }, null, 2), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'syncPokeapi-001-001.json'), JSON.stringify({ startId: 1, endId: 1 }, null, 2), 'utf8');
    fs.writeFileSync(path.join(tempDir, 'pokedex-get-sync-status.json'), JSON.stringify({ action: 'getSyncStatus' }, null, 2), 'utf8');
    const source = path.join(tempDir, 'wrapped-result.json');
    fs.writeFileSync(source, JSON.stringify({
      errMsg: 'cloud.callFunction:ok',
      result: {
        ok: true,
        status: 'success',
        runId: 'self-test-run'
      }
    }, null, 2), 'utf8');

    const manifest = readManifest(tempDir);
    saveResult(tempDir, manifest, Object.assign(parseArgs([]), {
      step: 1,
      saveResult: source
    }));
    const saved = readJson(path.join(tempDir, 'results', 'wechat-cloud-sync-001-001.json'));
    const status = getStatus(tempDir, manifest);
    if (!saved.ok || saved.runId !== 'self-test-run' || status.completed !== 1 || !status.next || status.next.step !== 2) {
      throw new Error('self-test failed: result was not saved or status was wrong');
    }

    console.log(JSON.stringify({
      ok: true,
      payloadDir: tempDir,
      completed: status.completed,
      nextStep: status.next.step
    }, null, 2));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    runSelfTest();
    return;
  }

  const manifest = readManifest(args.payloadDir);
  if (args.showPayload) {
    const status = getStatus(args.payloadDir, manifest);
    const stepNumber = args.step || (status.next && status.next.step);
    if (!stepNumber) {
      throw new Error('all result files already exist; no next payload to show');
    }
    showPayload(args.payloadDir, manifest, stepNumber);
    return;
  }

  if (args.saveResult || args.fromClipboard) {
    saveResult(args.payloadDir, manifest, args);
    return;
  }

  printStatus(args.payloadDir, manifest);
}

main();
