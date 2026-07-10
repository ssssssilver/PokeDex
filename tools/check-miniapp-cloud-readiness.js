const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'local';
const validModes = new Set(['local', 'deploy', 'cloud']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function check(condition, label, options = {}) {
  return {
    label,
    ok: Boolean(condition),
    level: options.level || 'error',
    details: options.details || ''
  };
}

function getConfig() {
  const configPath = path.join(repoRoot, 'wechat-miniapp', 'miniprogram', 'config.js');
  delete require.cache[configPath];
  return require(configPath);
}

function checkProjectConfig() {
  const projectPath = path.join(repoRoot, 'wechat-miniapp', 'project.config.json');
  const project = readJson(projectPath);
  return [
    check(project.compileType === 'miniprogram', 'project.config.json compileType is miniprogram'),
    check(project.miniprogramRoot === 'miniprogram/', 'project.config.json miniprogramRoot points to miniprogram/'),
    check(project.cloudfunctionRoot === 'cloudfunctions/', 'project.config.json cloudfunctionRoot points to cloudfunctions/'),
    check(typeof project.appid === 'string' && /^wx/.test(project.appid), 'project.config.json has a WeChat appid')
  ];
}

function checkMiniappConfig() {
  const config = getConfig();
  const checks = [
    check(typeof config.cloudEnv === 'string', 'miniprogram/config.js cloudEnv is a string'),
    check(typeof config.useCloudApi === 'boolean', 'miniprogram/config.js useCloudApi is a boolean'),
    check(Number.isInteger(config.pageSize) && config.pageSize > 0, 'miniprogram/config.js pageSize is positive')
  ];

  if (mode === 'deploy' || mode === 'cloud') {
    checks.push(check(Boolean(config.cloudEnv), 'cloudEnv is configured for real WeChat cloud deployment'));
  } else {
    const hasCloudEnv = Boolean(config.cloudEnv);
    checks.push(check(hasCloudEnv, hasCloudEnv ? 'cloudEnv is configured' : 'cloudEnv is not configured yet', {
      level: 'warning',
      details: hasCloudEnv ? '' : 'Fill this before deploying cloud functions to a real environment.'
    }));
  }

  if (mode === 'cloud') {
    checks.push(check(config.useCloudApi === true, 'useCloudApi is true for cloud-mode page verification'));
  } else {
    const stillLocalReads = config.useCloudApi === false;
    checks.push(check(stillLocalReads, stillLocalReads ? 'useCloudApi is still false before final cloud switch' : 'useCloudApi is true before evidence promotion', {
      level: 'warning',
      details: 'This should stay false until syncPokeapi and validateCache pass in the real cloud environment.'
    }));
  }

  return checks;
}

function checkPrivateConfigSupport() {
  const configSource = fs.readFileSync(path.join(repoRoot, 'wechat-miniapp', 'miniprogram', 'config.js'), 'utf8');
  const gitignorePath = path.join(repoRoot, '.gitignore');
  const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  const localConfigPath = path.join(repoRoot, 'wechat-miniapp', 'miniprogram', 'config.local.js');
  const localConfigDetails = mode === 'local'
    ? 'Run tools/configure-miniapp-cloud-local.js --init-empty before opening in WeChat DevTools.'
    : 'Generate it with tools/configure-miniapp-cloud-local.js and your real cloud environment ID before deployment.';

  return [
    check(configSource.includes("require('./config.local')"), 'config.js supports optional config.local.js override'),
    check(exists('wechat-miniapp/miniprogram/config.local.example.js'), 'config.local.example.js documents private cloud config'),
    check(gitignore.includes('wechat-miniapp/miniprogram/config.local.js'), '.gitignore excludes config.local.js'),
    check(gitignore.includes('tmp/'), '.gitignore excludes tmp verification artifacts'),
    check(fs.existsSync(localConfigPath), 'config.local.js exists on this machine', {
      level: mode === 'local' ? 'warning' : 'error',
      details: localConfigDetails
    })
  ];
}

function checkCloudFunction(name, options = {}) {
  const base = `wechat-miniapp/cloudfunctions/${name}`;
  const packagePath = `${base}/package.json`;
  const checks = [
    check(exists(base), `${name} cloud function directory exists`),
    check(exists(`${base}/index.js`), `${name} cloud function has index.js`),
    check(exists(packagePath), `${name} cloud function has package.json`)
  ];

  if (exists(packagePath)) {
    const pkg = readJson(path.join(repoRoot, packagePath));
    checks.push(check(pkg.main === 'index.js', `${name} package.json main is index.js`));
    checks.push(check(pkg.dependencies && pkg.dependencies['wx-server-sdk'], `${name} depends on wx-server-sdk`));
  }

  if (options.requiresTrigger) {
    const triggerPath = `${base}/config.json`;
    checks.push(check(exists(triggerPath), `${name} has config.json trigger config`));
    if (exists(triggerPath)) {
      const config = readJson(path.join(repoRoot, triggerPath));
      const triggers = Array.isArray(config.triggers) ? config.triggers : [];
      const dailyTrigger = triggers.find((trigger) => trigger.name === 'dailyPokeapiSync' && trigger.type === 'timer');
      checks.push(check(Boolean(dailyTrigger), `${name} has dailyPokeapiSync timer trigger`));
      checks.push(check(dailyTrigger && dailyTrigger.config === '0 30 3 * * * *', `${name} timer runs daily at 03:30`));
    }
  }

  return checks;
}

function checkPokedexActions() {
  const sourcePath = path.join(repoRoot, 'wechat-miniapp', 'cloudfunctions', 'pokedex', 'index.js');
  const source = fs.readFileSync(sourcePath, 'utf8');
  return [
    check(source.includes("action === 'validateCache'"), 'pokedex exposes validateCache action'),
    check(source.includes("action === 'getSyncRuns'"), 'pokedex exposes getSyncRuns action'),
    check(source.includes('getSyncFreshness'), 'pokedex validates sync freshness'),
    check(source.includes('readCollection'), 'pokedex reads cloud summaries with pagination')
  ];
}

function checkGeneratedSnapshot() {
  const snapshotPath = path.join(repoRoot, 'wechat-miniapp', 'miniprogram', 'data', 'generated-pokemon.js');
  const snapshot = require(snapshotPath);
  return [
    check(Array.isArray(snapshot.pokemon), 'generated-pokemon.js exports pokemon array'),
    check(Number(snapshot.count) >= 151, 'generated snapshot contains at least 151 Pokemon'),
    check(!Array.isArray(snapshot.failed) || snapshot.failed.length === 0, 'generated snapshot has no failed entries')
  ];
}

function summarize(checks) {
  const errors = checks.filter((item) => !item.ok && item.level !== 'warning');
  const warnings = checks.filter((item) => !item.ok && item.level === 'warning');
  const passed = checks.filter((item) => item.ok);
  return { passed, warnings, errors };
}

function printSection(title, checks) {
  console.log(`\n${title}`);
  checks.forEach((item) => {
    const prefix = item.ok ? 'PASS' : (item.level === 'warning' ? 'WARN' : 'FAIL');
    console.log(`${prefix} ${item.label}${item.details ? ` - ${item.details}` : ''}`);
  });
}

function printNextActions(summary) {
  const actions = [];
  if (mode !== 'local' && summary.errors.some((item) => item.label.includes('cloudEnv'))) {
    actions.push('Generate wechat-miniapp/miniprogram/config.local.js with your real WeChat cloud environment ID.');
  }
  if (summary.errors.some((item) => item.label.includes('config.local.js exists')) ||
    summary.warnings.some((item) => item.label.includes('config.local.js exists'))) {
    if (mode === 'local') {
      actions.push('Run: node tools\\configure-miniapp-cloud-local.js --init-empty');
    } else {
      actions.push('Run: node tools\\configure-miniapp-cloud-local.js --cloud-env=<your-env-id> --use-cloud-api=false');
    }
  }
  if (mode === 'cloud' && summary.errors.some((item) => item.label.includes('useCloudApi'))) {
    actions.push('Set useCloudApi: true only after syncPokeapi limit:151 and validateCache pass in WeChat DevTools.');
  }
  if (summary.warnings.some((item) => item.label.includes('useCloudApi'))) {
    actions.push('Keep useCloudApi false until the real cloud cache has passed validateCache.');
  }
  actions.push('Deploy pokedex and syncPokeapi in WeChat DevTools, then run syncPokeapi with limit:151.');
  actions.push('Run pokedex validateCache with expectedCount:151, sampleIds:[1,4,7,25,151], maxSyncAgeHours:30.');

  console.log('\nNext actions');
  actions.forEach((action) => console.log(`- ${action}`));
}

function main() {
  if (!validModes.has(mode)) {
    console.error(`Invalid mode "${mode}". Use local, deploy, or cloud.`);
    process.exitCode = 1;
    return;
  }

  const groups = [
    ['Project config', checkProjectConfig()],
    ['Private cloud config support', checkPrivateConfigSupport()],
    ['Miniapp cloud config', checkMiniappConfig()],
    ['pokedex cloud function', checkCloudFunction('pokedex')],
    ['syncPokeapi cloud function', checkCloudFunction('syncPokeapi', { requiresTrigger: true })],
    ['pokedex cloud validation actions', checkPokedexActions()],
    ['Local PokeAPI fallback snapshot', checkGeneratedSnapshot()]
  ];

  const checks = groups.flatMap((group) => group[1]);
  const summary = summarize(checks);

  console.log(`PokeChill miniapp cloud readiness (${mode})`);
  console.log(`Repo: ${repoRoot}`);
  groups.forEach(([title, items]) => printSection(title, items));

  console.log('\nReadiness summary');
  console.log(JSON.stringify({
    mode,
    passed: summary.passed.length,
    warnings: summary.warnings.length,
    errors: summary.errors.length,
    ready: summary.errors.length === 0
  }, null, 2));
  printNextActions(summary);

  if (summary.errors.length) {
    process.exitCode = 1;
  }
}

main();
