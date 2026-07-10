const DEFAULT_BASE_URL = 'http://127.0.0.1:8787';
const DEFAULT_EXPECTED_COUNT = 1025;

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.POKECHILL_API_BASE_URL || DEFAULT_BASE_URL,
    expectedCount: DEFAULT_EXPECTED_COUNT,
    requireSchedulerStarted: true,
    requireLocalImages: true
  };

  argv.forEach((arg) => {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) {
      const key = match[1];
      const value = match[2];
      if (key === 'base-url') args.baseUrl = value;
      if (key === 'expected-count') args.expectedCount = Number(value);
      return;
    }
    if (arg === '--no-require-scheduler-started') args.requireSchedulerStarted = false;
    if (arg === '--allow-remote-images') args.requireLocalImages = false;
  });

  return args;
}

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(new URL(pathname, baseUrl), {
    method: options.method || 'GET',
    headers: Object.assign({
      Accept: 'application/json'
    }, options.body ? {
      'Content-Type': 'application/json'
    } : {}),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`Invalid JSON from ${pathname}: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${pathname}: ${text}`);
  }
  return data;
}

function check(condition, label, details) {
  return {
    ok: Boolean(condition),
    label,
    details: details || ''
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = [];

  const health = await requestJson(args.baseUrl, '/health');
  checks.push(check(health.ok === true, 'health endpoint is ok'));
  checks.push(check(health.service === 'pokechill-self-hosted-api', 'health endpoint is the self-hosted API'));

  const syncStatus = await requestJson(args.baseUrl, '/api/sync/status');
  const statusItem = syncStatus.item || {};
  checks.push(check(statusItem.mode === 'remote-cache', 'sync status uses remote cache', `actual=${statusItem.mode}`));
  checks.push(check(Number(statusItem.syncedCount || 0) >= args.expectedCount, `synced count is at least ${args.expectedCount}`, `actual=${statusItem.syncedCount}`));
  checks.push(check(statusItem.healthTone === 'ready', 'sync health is ready', `actual=${statusItem.healthTone}`));
  checks.push(check(statusItem.syncFresh === true, 'sync is fresh', `age=${statusItem.syncAgeText}`));

  const validation = await requestJson(args.baseUrl, '/api/cache/validate', {
    method: 'POST',
    body: {
      expectedCount: args.expectedCount,
      sampleIds: [1, 4, 7, 25, args.expectedCount],
      maxSyncAgeHours: 30
    }
  });
  checks.push(check(validation.ok === true, 'cache validation passes'));
  checks.push(check((validation.checks || {}).actualCount >= args.expectedCount, `validation count is at least ${args.expectedCount}`, `actual=${(validation.checks || {}).actualCount}`));

  const scheduler = await requestJson(args.baseUrl, '/api/sync/scheduler');
  checks.push(check(scheduler.enabled === true, 'sync scheduler is enabled'));
  if (args.requireSchedulerStarted) {
    checks.push(check((scheduler.state || {}).started === true, 'sync scheduler is started'));
  }
  checks.push(check((scheduler.due || {}).due === false, 'scheduler does not need immediate sync', `reason=${(scheduler.due || {}).reason}`));
  checks.push(check(Number((scheduler.due || {}).cachedCount || 0) >= args.expectedCount, `scheduler sees at least ${args.expectedCount} cached rows`, `actual=${(scheduler.due || {}).cachedCount}`));

  const pokemon = await requestJson(args.baseUrl, '/api/pokemon?sort=id');
  const items = pokemon.items || [];
  const inspected = items.slice(0, args.expectedCount);
  const remoteImages = inspected.filter((item) => String(item.image || '').startsWith('https://'));
  checks.push(check(items.length >= args.expectedCount, `pokemon list has at least ${args.expectedCount} rows`, `actual=${items.length}`));
  if (args.requireLocalImages) {
    checks.push(check(remoteImages.length === 0, 'pokemon images use local/self-hosted URLs', `remote=${remoteImages.length}`));
  }

  const failed = checks.filter((item) => !item.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    baseUrl: args.baseUrl,
    expectedCount: args.expectedCount,
    summary: {
      syncedCount: statusItem.syncedCount,
      healthTone: statusItem.healthTone,
      syncAgeText: statusItem.syncAgeText,
      schedulerStarted: Boolean((scheduler.state || {}).started),
      schedulerDue: scheduler.due,
      pokemonRows: items.length,
      remoteImageCount: remoteImages.length
    },
    checks
  }, null, 2));

  if (failed.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
