const {
  buildImageCloudPath,
  buildSyncPlan,
  fetchPokemonBundle,
  requestBuffer,
  transformPokemonBundle
} = require('../wechat-miniapp/cloudfunctions/syncPokeapi/lib/pokeapi');

async function main() {
  const plan = buildSyncPlan({
    limit: Number(process.argv[2] || 3),
    dryRun: true,
    retries: 1,
    timeoutMs: 15000,
    concurrency: 3
  });

  const rows = [];
  let firstImage = null;
  for (const id of plan.ids) {
    const bundle = await fetchPokemonBundle(id, {
      timeoutMs: plan.timeoutMs,
      userAgent: plan.userAgent
    });
    const transformed = transformPokemonBundle(bundle);
    if (!firstImage && transformed.summary.image) {
      const downloaded = await requestBuffer(transformed.summary.image, {
        timeoutMs: plan.timeoutMs,
        userAgent: plan.userAgent
      });
      firstImage = {
        id: transformed.summary.id,
        bytes: downloaded.buffer.length,
        cloudPath: buildImageCloudPath(bundle.pokemon, transformed.summary.image, {
          prefix: 'pokemon/artwork',
          contentType: downloaded.contentType
        })
      };
    }
    rows.push({
      id: transformed.summary.id,
      name_zh: transformed.summary.name_zh,
      name_en: transformed.summary.name_en,
      types: transformed.summary.types.join('/'),
      stat_total: transformed.summary.stat_total,
      evolution_chain: transformed.detail.evolution_chain.join('>'),
      image: Boolean(transformed.summary.image),
      image_cached: transformed.summary.image_cached
    });
  }

  console.table(rows);
  if (firstImage) {
    console.log(`First image dry-run: ${firstImage.bytes} bytes -> ${firstImage.cloudPath}`);
  }
  console.log(`PokeAPI dry-run OK: ${rows.length} Pokemon transformed, no cloud writes.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
