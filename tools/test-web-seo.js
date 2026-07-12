const assert = require('assert');
const { createApp } = require('../server');

async function main() {
  const app = createApp({ host: '127.0.0.1', port: 0 });
  await new Promise((resolve) => app.server.listen(0, app.host, resolve));
  const address = app.server.address();
  const baseUrl = `http://${address.address}:${address.port}`;
  try {
    const detailResponse = await fetch(`${baseUrl}/pages/pokemon-detail/index?id=6&lang=en`);
    const html = await detailResponse.text();
    assert.equal(detailResponse.status, 200);
    assert.equal(detailResponse.headers.get('content-language'), 'en');
    assert.match(html, /<title>Charizard #6 \| Pokédex<\/title>/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /hreflang="zh-CN"/);
    assert.match(html, /hreflang="zh-TW"/);
    assert.match(html, /hreflang="en"/);
    assert.match(html, /hreflang="x-default"/);
    assert.match(html, /type="application\/ld\+json"/);
    assert.match(html, /<noscript><main><h1>/);

    const headerLocale = await fetch(`${baseUrl}/pages/pokedex/index`, {
      headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' }
    });
    assert.equal(headerLocale.headers.get('content-language'), 'zh-TW');

    const sourcesHtml = await (await fetch(`${baseUrl}/pages/data-sources/index?lang=en`)).text();
    assert.match(sourcesHtml, /<title>Data Sources &amp; Notices \| PokeChill<\/title>/);

    const preflight = await fetch(`${baseUrl}/api/pokemon`, {
      method: 'OPTIONS',
      headers: { 'Access-Control-Request-Headers': 'accept-language' }
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-headers') || '', /Accept-Language/i);

    const sitemapIndex = await (await fetch(`${baseUrl}/sitemap.xml`)).text();
    assert.match(sitemapIndex, /sitemaps\/pokemon\.xml/);
    assert.match(sitemapIndex, /sitemaps\/ptcg\.xml/);
    assert.match(sitemapIndex, /sitemaps\/pocket\.xml/);

    const pokemonMap = await (await fetch(`${baseUrl}/sitemaps/pokemon.xml`)).text();
    const pocketMap = await (await fetch(`${baseUrl}/sitemaps/pocket.xml`)).text();
    assert.equal((pokemonMap.match(/<url>/g) || []).length, 1025);
    assert.equal((pocketMap.match(/<url>/g) || []).length, 3305);

    process.stdout.write(`${JSON.stringify({
      ok: true,
      contentLanguage: detailResponse.headers.get('content-language'),
      pokemonUrls: 1025,
      pocketUrls: 3305,
      corsAcceptLanguage: true
    }, null, 2)}\n`);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
