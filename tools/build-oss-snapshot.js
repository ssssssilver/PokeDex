const path = require('path');
const { buildOssSnapshot } = require('../server/oss-snapshot');

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function main() {
  const result = buildOssSnapshot({
    dataDir: path.resolve(option('data-dir', path.join(__dirname, '..', 'server', '.data'))),
    outputDir: path.resolve(option('output-dir', path.join(__dirname, '..', 'dist', 'oss'))),
    version: option('version', '') || undefined
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    version: result.manifest.version,
    generatedAt: result.manifest.generatedAt,
    counts: Object.fromEntries(Object.entries(result.manifest.datasets).map(([key, value]) => [key, value.count])),
    outputDir: result.outputDir
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
