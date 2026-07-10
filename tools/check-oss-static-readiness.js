const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { hashBucket } = require('../server/oss-snapshot');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'oss'));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pad(value, length) {
  return String(value).padStart(length, '0');
}

function filesRecursively(directory, output = []) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) filesRecursively(fullPath, output);
    else output.push(fullPath);
  });
  return output;
}

function validateDataset(releaseDir, name, dataset) {
  const rows = [];
  for (let index = 0; index < dataset.listChunks; index += 1) {
    const relative = dataset.listPath.replace('{chunk}', pad(index, 4));
    rows.push(...readJson(path.join(releaseDir, relative)).items);
  }
  assert.strictEqual(rows.length, dataset.count, `${name} list count mismatch`);
  const bucketCache = {};
  rows.forEach((item) => {
    const bucket = hashBucket(item.id, dataset.detailBuckets);
    if (!bucketCache[bucket]) {
      const relative = dataset.detailPath.replace('{bucket}', pad(bucket, 3));
      bucketCache[bucket] = readJson(path.join(releaseDir, relative));
    }
    assert(bucketCache[bucket][String(item.id)], `${name} detail missing: ${item.id}`);
  });
  return rows;
}

function main() {
  const manifest = readJson(path.join(root, 'manifest.json'));
  assert.strictEqual(manifest.schemaVersion, 1);
  const releaseDir = path.join(root, manifest.releaseBase);
  assert(fs.existsSync(path.join(releaseDir, 'manifest.json')), 'release manifest missing');
  const rows = {};
  Object.entries(manifest.datasets).forEach(([name, dataset]) => {
    rows[name] = validateDataset(releaseDir, name, dataset);
  });

  const allFiles = filesRecursively(releaseDir);
  let maxFile = null;
  allFiles.forEach((filePath) => {
    const stat = fs.statSync(filePath);
    if (!maxFile || stat.size > maxFile.size) maxFile = { filePath, size: stat.size };
    assert(stat.size < 4 * 1024 * 1024, `static object exceeds 4 MB: ${filePath}`);
    if (filePath.endsWith('.json')) {
      const content = fs.readFileSync(filePath, 'utf8');
      assert(!/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(content), `localhost URL found: ${filePath}`);
    }
  });

  const decks = readJson(path.join(releaseDir, manifest.files.ptcgDecks));
  const deckDetails = readJson(path.join(releaseDir, manifest.files.ptcgDeckDetails));
  const pocketCollections = readJson(path.join(releaseDir, manifest.files.pocketCollections));
  const pocketDetails = readJson(path.join(releaseDir, manifest.files.pocketDeckDetails));
  const missingDeckDetails = (decks.items || []).filter((item) => !(deckDetails.items || {})[item.url]).map((item) => item.url);
  const missingPocketDeckDetails = (pocketCollections.hot_decks || []).filter((item) => !(pocketDetails.items || {})[item.id]).map((item) => item.id);

  const report = {
    ok: missingDeckDetails.length === 0 && missingPocketDeckDetails.length === 0,
    version: manifest.version,
    objects: allFiles.length,
    maxObjectBytes: maxFile ? maxFile.size : 0,
    counts: Object.fromEntries(Object.entries(rows).map(([name, items]) => [name, items.length])),
    decks: {
      ptcg: (decks.items || []).length,
      ptcgDetails: Object.keys(deckDetails.items || {}).length,
      pocket: (pocketCollections.hot_decks || []).length,
      pocketDetails: Object.keys(pocketDetails.items || {}).length,
      missingPtcg: missingDeckDetails.length,
      missingPocket: missingPocketDeckDetails.length
    }
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
