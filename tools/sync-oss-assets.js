const fs = require('fs');
const path = require('path');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeSegment(value) {
  return encodeURIComponent(String(value));
}

function jobsFromCaches(dataDir, datasets) {
  const jobs = [];
  if (datasets.has('pokemon')) {
    const cache = readJson(path.join(dataDir, 'pokedex-cache.json'));
    Object.values(cache.pokemon_detail || {}).forEach((item) => {
      if (item.image_remote) jobs.push({ url: item.image_remote, relative: `pokemon/artwork/${item.id}.png` });
    });
  }
  if (datasets.has('ptcg')) {
    const cache = readJson(path.join(dataDir, 'ptcg-cache.json'));
    Object.values(cache.card_detail || {}).forEach((item) => {
      if (item.image_small_remote) jobs.push({ url: item.image_small_remote, relative: `ptcg/cards/${safeSegment(item.id)}/small.png` });
      if (item.image_large_remote) jobs.push({ url: item.image_large_remote, relative: `ptcg/cards/${safeSegment(item.id)}/large.png` });
    });
    Object.values(cache.card_sets || {}).forEach((item) => {
      if (item.image_symbol_remote) jobs.push({ url: item.image_symbol_remote, relative: `ptcg/sets/${safeSegment(item.id)}/symbol.png` });
      if (item.image_logo_remote) jobs.push({ url: item.image_logo_remote, relative: `ptcg/sets/${safeSegment(item.id)}/logo.png` });
    });
  }
  if (datasets.has('pocket')) {
    const cache = readJson(path.join(dataDir, 'pocket-cache.json'));
    Object.values(cache.cards || {}).forEach((item) => {
      if (item.image) jobs.push({ url: item.image, relative: `pocket/cards/${safeSegment(item.id)}.png` });
    });
    Object.values(cache.packs || {}).forEach((item) => {
      if (item.image) jobs.push({ url: item.image, relative: `pocket/packs/${safeSegment(item.id)}.png` });
    });
  }
  return jobs;
}

async function download(job, rootDir, options) {
  const filePath = path.join(rootDir, ...job.relative.split('/'));
  if (!options.refresh && fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return 'reused';
  if (options.dryRun) return 'planned';
  let lastError = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      const response = await fetch(job.url, { signal: controller.signal, headers: { 'User-Agent': 'PokeChill/1.0' } });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 100) throw new Error('Downloaded asset is empty');
      ensureDir(path.dirname(filePath));
      const temporary = `${filePath}.tmp`;
      fs.writeFileSync(temporary, buffer);
      fs.renameSync(temporary, filePath);
      return 'downloaded';
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`${job.url}: ${lastError && lastError.message}`);
}

async function runPool(jobs, workerCount, handler) {
  let cursor = 0;
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      await handler(jobs[index], index);
    }
  }));
}

async function main() {
  const dataDir = path.resolve(option('data-dir', path.join(__dirname, '..', 'server', '.data')));
  const outputDir = path.resolve(option('output-dir', path.join(dataDir, 'oss-assets')));
  const datasets = new Set(String(option('datasets', 'pokemon,ptcg,pocket')).split(',').map((item) => item.trim()).filter(Boolean));
  const limit = Math.max(0, Number(option('limit', 0)));
  const options = {
    attempts: Math.max(1, Number(option('attempts', 3))),
    timeoutMs: Math.max(1000, Number(option('timeout-ms', 30000))),
    refresh: process.argv.includes('--refresh'),
    dryRun: process.argv.includes('--dry-run')
  };
  const allJobs = jobsFromCaches(dataDir, datasets);
  const jobs = limit ? allJobs.slice(0, limit) : allJobs;
  const stats = { total: jobs.length, planned: options.dryRun ? jobs.length : 0, downloaded: 0, reused: 0, failed: 0, failures: [] };
  await runPool(jobs, Math.max(1, Number(option('concurrency', 8))), async (job) => {
    try {
      const status = await download(job, outputDir, options);
      if (status !== 'planned') stats[status] = (stats[status] || 0) + 1;
    } catch (error) {
      stats.failed += 1;
      if (stats.failures.length < 20) stats.failures.push(error.message);
    }
  });
  process.stdout.write(`${JSON.stringify(Object.assign({ ok: stats.failed === 0, outputDir, totalAvailable: allJobs.length }, stats), null, 2)}\n`);
  if (stats.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
