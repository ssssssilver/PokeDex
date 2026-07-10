const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { createApp } = require('../server');

function requestJson(baseUrl, method, pathname, payload) {
  const url = new URL(pathname, baseUrl);
  const body = payload ? JSON.stringify(payload) : '';

  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method,
      headers: Object.assign({
        Accept: 'application/json'
      }, body ? {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      } : {})
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
            return;
          }
          resolve(parsed);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${error.message}; raw=${raw}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pokechill-api-'));
  const app = createApp({
    host: '127.0.0.1',
    port: 8791,
    publicBaseUrl: 'http://127.0.0.1:8791',
    dataDir,
    scheduler: {
      expectedCount: 3,
      endId: 3,
      syncOnStart: false
    }
  });

  await listen(app.server, app.port, app.host);

  try {
    const health = await requestJson(app.publicBaseUrl, 'GET', '/health');
    assert.strictEqual(health.ok, true);
    assert.strictEqual(health.scheduler.enabled, true);

    const seedList = await requestJson(app.publicBaseUrl, 'GET', '/api/pokemon?sort=id');
    assert.ok(seedList.items.length > 0);
    assert.strictEqual(seedList.source, 'local-seed');

    const sync = await requestJson(app.publicBaseUrl, 'POST', '/api/sync/pokeapi', {
      startId: 1,
      endId: 3,
      concurrency: 2,
      retries: 1,
      timeoutMs: 15000,
      cacheImages: false,
      strictImageCache: false,
      force: true
    });
    assert.strictEqual(sync.ok, true);
    assert.strictEqual(sync.syncedCount, 3);
    assert.strictEqual(sync.failedCount, 0);

    const cachedList = await requestJson(app.publicBaseUrl, 'GET', '/api/pokemon?sort=id');
    assert.strictEqual(cachedList.source, 'remote-cache');
    assert.strictEqual(cachedList.items.length, 3);
    assert.strictEqual(cachedList.items[0].id, 1);

    const detail = await requestJson(app.publicBaseUrl, 'GET', '/api/pokemon/1');
    assert.strictEqual(detail.source, 'remote-cache');
    assert.strictEqual(detail.item.id, 1);
    assert.deepStrictEqual(detail.item.evolution.map((item) => item.id), [1, 2, 3]);

    const team = await requestJson(app.publicBaseUrl, 'POST', '/api/team/analyze', {
      ids: [1, 2, 3]
    });
    assert.ok(team.item.members.length >= 3);
    assert.ok(team.item.score > 0);

    const status = await requestJson(app.publicBaseUrl, 'GET', '/api/sync/status');
    assert.strictEqual(status.item.cacheReady, true);
    assert.strictEqual(status.item.syncedCount, 3);
    assert.strictEqual(status.item.syncFresh, true);

    const validate = await requestJson(app.publicBaseUrl, 'POST', '/api/cache/validate', {
      expectedCount: 3,
      sampleIds: [1, 2, 3],
      maxSyncAgeHours: 30
    });
    assert.strictEqual(validate.ok, true);
    assert.deepStrictEqual(validate.checks.missingSummaryIds, []);
    assert.deepStrictEqual(validate.checks.missingDetailIds, []);

    const runs = await requestJson(app.publicBaseUrl, 'GET', '/api/sync/runs?limit=3');
    assert.ok(runs.items.length >= 1);
    assert.strictEqual(runs.items[0].status, 'success');

    const scheduler = await requestJson(app.publicBaseUrl, 'GET', '/api/sync/scheduler');
    assert.strictEqual(scheduler.enabled, true);
    assert.strictEqual(scheduler.due.due, false);

    console.log(JSON.stringify({
      ok: true,
      baseUrl: app.publicBaseUrl,
      cacheFile: app.store.filePath,
      syncedCount: sync.syncedCount,
      imageCachedCount: sync.imageCachedCount,
      listCount: cachedList.items.length,
      first: cachedList.items[0].name_en,
      healthTone: status.item.healthTone,
      validationOk: validate.ok,
      latestRun: runs.items[0].status
    }, null, 2));
  } finally {
    await close(app.server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
