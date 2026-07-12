const fs = require('fs');
const http = require('http');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');
const { CacheStore } = require('./cache-store');
const { PokedexService } = require('./pokedex-service');
const { syncPokeapi } = require('./pokeapi-sync');
const { PtcgCacheStore } = require('./ptcg-cache-store');
const { PtcgService } = require('./ptcg-service');
const { syncPtcg } = require('./ptcg-sync');
const { PocketCacheStore } = require('./pocket-cache-store');
const { PocketService } = require('./pocket-service');
const { syncPocket } = require('./pocket-sync');
const { PocketScheduler } = require('./pocket-scheduler');
const { PocketDeckService } = require('./pocket-deck-service');
const { createSyncScheduler } = require('./sync-scheduler');
const { HotDeckService } = require('./deck-service');
const { PokemonModel3dService } = require('./projectpokemon-3d-service');
const { sourceManifest } = require('./data-source-registry');

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(body);
}

function sendText(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept-Language',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  });
  res.end(payload);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error(`Invalid JSON body: ${error.message}`));
      }
    });
    req.on('error', reject);
  });
}

function queryObject(searchParams) {
  const data = {};
  searchParams.forEach((value, key) => {
    data[key] = value;
  });
  return data;
}

function idsFromQuery(value) {
  return String(value || '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter(Boolean);
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json' || ext === '.map') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.ico') return 'image/x-icon';
  if (ext === '.woff') return 'font/woff';
  if (ext === '.woff2') return 'font/woff2';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/png';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function localizedName(item, locale) {
  if (!item) return '';
  if (locale === 'en') return item.name_en || item.name || item.display_name || item.name_zh;
  if (locale === 'zh-TW') return item.name_zh_tw || item.name_zh || item.display_name || item.name || item.name_en;
  return item.name_zh_cn || item.name_zh || item.display_name || item.name || item.name_en;
}

function buildSeoMetadata(pathname, searchParams, services, publicBaseUrl, acceptLanguage) {
  const localeValue = String(searchParams.get('lang') || acceptLanguage || 'zh-CN').toLowerCase();
  const locale = localeValue.startsWith('en') ? 'en' : localeValue.includes('tw') || localeValue.includes('hk') || localeValue.includes('hant') ? 'zh-TW' : 'zh-CN';
  const copy = {
    'zh-CN': { site: '宝批小站', home: '宝可梦、实体卡牌与 Pocket 图鉴', pokedex: '宝可梦图鉴', cards: '宝可梦实体卡牌图鉴', pocket: 'Pokémon TCG Pocket 图鉴', sources: '数据来源与声明' },
    'zh-TW': { site: '寶批小站', home: '寶可夢、實體卡牌與 Pocket 圖鑑', pokedex: '寶可夢圖鑑', cards: '寶可夢實體卡牌圖鑑', pocket: 'Pokémon TCG Pocket 圖鑑', sources: '資料來源與聲明' },
    en: { site: 'PokeChill', home: 'Pokémon, Physical TCG and Pocket Database', pokedex: 'Pokédex', cards: 'Pokémon TCG Card Database', pocket: 'Pokémon TCG Pocket Card Database', sources: 'Data Sources & Notices' }
  }[locale];
  let title = `${copy.home} | ${copy.site}`;
  let description = locale === 'en'
    ? 'Explore Pokémon, physical Pokémon TCG cards, Pocket cards, deck rankings and lightweight tools.'
    : locale === 'zh-TW'
      ? '查詢寶可夢、實體寶可夢卡牌、Pocket 卡牌、熱門牌組與實用工具。'
      : '查询宝可梦、实体宝可梦卡牌、Pocket 卡牌、热门卡组与实用工具。';
  let image = '';
  let entityName = copy.site;
  const id = searchParams.get('id');
  try {
    if (pathname.includes('/pokemon-detail/') && id) {
      const item = services.pokedex.getPokemon(Number(id)).item;
      if (item) {
        entityName = localizedName(item, locale);
        title = `${entityName} #${item.id} | ${copy.pokedex}`;
        const entries = item.flavor_entries || [];
        const language = locale === 'en' ? 'en' : locale === 'zh-TW' ? 'zh-hant' : 'zh-hans';
        description = (entries.find((entry) => entry.language === language) || entries.find((entry) => entry.language === 'en') || {}).text || description;
        image = item.image || item.image_remote || '';
      }
    } else if (pathname.includes('/card-detail/') && id) {
      const item = services.ptcg.getCard(id).item;
      if (item) {
        entityName = localizedName(item, locale);
        title = `${entityName} ${item.set_id || ''} #${item.number || ''} | ${copy.cards}`.replace(/\s+/g, ' ');
        description = locale === 'en' ? item.flavor_text_en || item.flavor_text || description : item.description_zh || item.flavor_text || description;
        image = item.image || item.image_large || '';
      }
    } else if (pathname.includes('/pocket-card-detail/') && id) {
      const item = services.pocket.getCard(id).item;
      if (item) {
        entityName = localizedName(item, locale);
        title = `${entityName} | ${copy.pocket}`;
        description = locale === 'en'
          ? ((item.rules || {}).attacks || []).map((attack) => attack.effect).filter(Boolean).join(' ') || description
          : (item.attacks || []).map((attack) => attack.description_zh_template).filter(Boolean).join(' ') || description;
        image = item.image || '';
      }
    } else if (pathname.includes('/data-sources/')) title = `${copy.sources} | ${copy.site}`;
    else if (pathname.includes('/pokedex/')) title = `${copy.pokedex} | ${copy.site}`;
    else if (pathname.includes('/carddex/')) title = `${copy.cards} | ${copy.site}`;
    else if (pathname.includes('/pocket/')) title = `${copy.pocket} | ${copy.site}`;
  } catch (error) {
    // A missing cache record should not prevent the SPA shell from loading.
  }
  const origin = publicBaseUrl.replace(/\/$/, '');
  const canonicalUrl = new URL(pathname, `${origin}/`);
  if (id) canonicalUrl.searchParams.set('id', id);
  const canonical = canonicalUrl.toString();
  const imageUrl = image ? new URL(image, `${origin}/`).toString() : '';
  const languageLinks = ['zh-CN', 'zh-TW', 'en'].map((language) => {
    const url = new URL(canonical);
    url.searchParams.set('lang', language);
    return `<link rel="alternate" hreflang="${language}" href="${escapeHtml(url.toString())}">`;
  }).join('') + `<link rel="alternate" hreflang="x-default" href="${escapeHtml(canonical)}">`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': pathname.includes('-detail/') ? 'ItemPage' : 'WebPage',
    name: entityName,
    description,
    url: canonical,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: copy.site, url: `${origin}/` }
  };
  return { locale, title, description: String(description).replace(/\s+/g, ' ').slice(0, 240), imageUrl, canonical, languageLinks, structuredData };
}

function injectSeo(html, seo) {
  if (!seo) return html;
  let output = html
    .replace(/<html(?:\s+lang="[^"]*")?/, `<html lang="${seo.locale}"`)
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(seo.description)}">`)
    .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(seo.title)}">`)
    .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(seo.description)}">`);
  const extras = `<link rel="canonical" href="${escapeHtml(seo.canonical)}">${seo.languageLinks}` +
    `<meta property="og:url" content="${escapeHtml(seo.canonical)}">` +
    `<meta property="og:locale" content="${seo.locale.replace('-', '_')}">` +
    '<meta name="twitter:card" content="summary_large_image">' +
    (seo.imageUrl ? `<meta property="og:image" content="${escapeHtml(seo.imageUrl)}">` : '') +
    `<script type="application/ld+json">${JSON.stringify(seo.structuredData).replace(/</g, '\\u003c')}</script>`;
  output = output.replace('</head>', `${extras}</head>`);
  const fallback = `<noscript><main><h1>${escapeHtml(seo.title)}</h1><p>${escapeHtml(seo.description)}</p>` +
    (seo.imageUrl ? `<img src="${escapeHtml(seo.imageUrl)}" alt="${escapeHtml(seo.structuredData.name)}">` : '') +
    '</main></noscript>';
  return output.replace('<body>', `<body>${fallback}`);
}

function serveWebApp(req, res, pathname, webRoot, seo) {
  if ((req.method !== 'GET' && req.method !== 'HEAD') || !webRoot || !fs.existsSync(webRoot)) {
    return false;
  }
  if (pathname === '/health' || pathname.startsWith('/api/')) return false;

  let relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  let filePath = path.resolve(webRoot, relativePath);
  const rootPrefix = `${path.resolve(webRoot)}${path.sep}`;
  if (filePath !== path.resolve(webRoot) && !filePath.startsWith(rootPrefix)) return false;

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(webRoot, 'index.html');
  }
  if (!fs.existsSync(filePath)) return false;

  const contentType = contentTypeFor(filePath);
  const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  const compressible = /^(text\/|application\/(javascript|json))/.test(contentType);
  const immutableAsset = /[.-][0-9a-f]{8,}\./i.test(path.basename(filePath));
  const headers = {
    'Content-Type': contentType,
    'Cache-Control': path.basename(filePath) === 'index.html'
      ? 'no-cache'
      : immutableAsset
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=86400'
  };
  if (acceptsGzip && compressible) {
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  const isHtml = path.basename(filePath) === 'index.html';
  if (isHtml) headers['Content-Language'] = seo ? seo.locale : 'zh-CN';
  res.writeHead(200, headers);
  if (req.method === 'HEAD') {
    res.end();
  } else {
    if (isHtml) {
      const body = Buffer.from(injectSeo(fs.readFileSync(filePath, 'utf8'), seo));
      if (acceptsGzip) zlib.gzip(body, { level: zlib.constants.Z_BEST_SPEED }, (error, compressed) => res.end(error ? body : compressed));
      else res.end(body);
      return true;
    }
    const stream = fs.createReadStream(filePath);
    if (acceptsGzip && compressible) {
      stream.pipe(zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED })).pipe(res);
    } else {
      stream.pipe(res);
    }
  }
  return true;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function serveArtwork(req, res, pathname, dataDir) {
  const prefix = '/assets/pokemon/artwork/';
  const fileName = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  const filePath = path.join(dataDir, 'artwork', fileName);
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveRepoPokemonAsset(req, res, pathname) {
  const prefix = '/assets/local-pokemon/';
  const fileName = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  if (!fileName || fileName.includes('/') || fileName.includes('\\')) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  const spriteRoot = path.resolve(__dirname, 'assets', 'local-pokemon');
  const filePath = path.resolve(spriteRoot, fileName);
  if (!filePath.startsWith(spriteRoot) || !fs.existsSync(filePath)) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
}

async function servePtcgCardImage(req, res, pathname, service) {
  const prefix = '/assets/ptcg/cards/';
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  const parts = rest.split('/').filter(Boolean);
  const id = decodeURIComponent(parts[0] || '');
  const size = parts[1] === 'large' ? 'large' : 'small';

  if (!id || id.includes('/') || id.includes('\\')) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  const info = service.getImageInfo(id, size);
  if (!info) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  if (fs.existsSync(info.filePath)) {
    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return;
  }

  const response = await fetch(info.remote, {
    headers: {
      'User-Agent': 'PokeChill/1.0'
    }
  });
  if (!response.ok) {
    sendJson(res, 502, { error: `Unable to fetch card image: ${response.status}` });
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(info.filePath));
  fs.writeFileSync(info.filePath, buffer);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || contentTypeFor(info.filePath),
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(buffer);
}

async function servePtcgSetImage(req, res, pathname, service) {
  const prefix = '/assets/ptcg/sets/';
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  const parts = rest.split('/').filter(Boolean);
  const id = decodeURIComponent(parts[0] || '');
  const kind = parts[1] === 'logo' ? 'logo' : 'symbol';

  if (!id || id.includes('/') || id.includes('\\')) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  const info = service.getSetImageInfo(id, kind);
  if (!info) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  if (fs.existsSync(info.filePath)) {
    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return;
  }

  const response = await fetch(info.remote, {
    headers: {
      'User-Agent': 'PokeChill/1.0'
    }
  });
  if (!response.ok) {
    sendJson(res, 502, { error: `Unable to fetch set image: ${response.status}` });
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(info.filePath));
  fs.writeFileSync(info.filePath, buffer);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || contentTypeFor(info.filePath),
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(buffer);
}

async function servePocketCardImage(req, res, pathname, service) {
  const prefix = '/assets/pocket/cards/';
  const id = decodeURIComponent(pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '');
  if (!id || id.includes('/') || id.includes('\\')) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }
  const info = service.getImageInfo(id);
  if (!info) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }
  if (fs.existsSync(info.filePath)) {
    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return;
  }
  const response = await fetch(info.remote, { headers: { 'User-Agent': 'PokeChill/1.0' } });
  if (!response.ok) {
    sendJson(res, 502, { error: `Unable to fetch Pocket card image: ${response.status}` });
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(info.filePath));
  fs.writeFileSync(info.filePath, buffer);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || 'image/png',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(buffer);
}

async function servePocketPackImage(req, res, pathname, service) {
  const prefix = '/assets/pocket/packs/';
  const id = decodeURIComponent(pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '');
  if (!id || id.includes('/') || id.includes('\\')) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }
  const info = service.getPackImageInfo(id);
  if (!info) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }
  if (fs.existsSync(info.filePath)) {
    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return;
  }
  const response = await fetch(info.remote, { headers: { 'User-Agent': 'PokeChill/1.0' } });
  if (!response.ok) {
    sendJson(res, 502, { error: `Unable to fetch Pocket pack image: ${response.status}` });
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(info.filePath));
  fs.writeFileSync(info.filePath, buffer);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || 'image/png',
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(buffer);
}

async function serveLimitlessPokemonImage(req, res, pathname, service) {
  const prefix = '/assets/limitless/pokemon/';
  const assetPath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  const info = service.getPokemonImageInfo(decodeURIComponent(assetPath || ''));
  if (!info) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  if (fs.existsSync(info.filePath)) {
    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return;
  }

  const response = await fetch(info.remote, {
    headers: {
      'User-Agent': 'PokeChill/1.0'
    }
  });
  if (!response.ok) {
    sendJson(res, 502, { error: `Unable to fetch Limitless image: ${response.status}` });
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(info.filePath));
  fs.writeFileSync(info.filePath, buffer);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || contentTypeFor(info.filePath),
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(buffer);
}

async function serveLimitlessCardImage(req, res, pathname, service) {
  const prefix = '/assets/limitless/cards/';
  const assetPath = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
  const info = service.getCardImageInfo(decodeURIComponent(assetPath || ''));
  if (!info) {
    sendJson(res, 404, { error: 'Asset not found' });
    return;
  }

  if (fs.existsSync(info.filePath)) {
    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return;
  }

  const response = await fetch(info.remote, {
    headers: {
      'User-Agent': 'PokeChill/1.0'
    }
  });
  if (!response.ok) {
    sendJson(res, 502, { error: `Unable to fetch deck card image: ${response.status}` });
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  ensureDir(path.dirname(info.filePath));
  fs.writeFileSync(info.filePath, buffer);
  res.writeHead(200, {
    'Content-Type': response.headers.get('content-type') || contentTypeFor(info.filePath),
    'Cache-Control': 'public, max-age=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(buffer);
}

function createApp(options = {}) {
  const host = options.host || process.env.POKECHILL_HOST || DEFAULT_HOST;
  const port = Number(options.port || process.env.POKECHILL_PORT || DEFAULT_PORT);
  const publicBaseUrl = options.publicBaseUrl || process.env.POKECHILL_PUBLIC_BASE_URL || `http://${host}:${port}`;
  const webRoot = options.webRoot || process.env.POKECHILL_WEB_ROOT || path.resolve(__dirname, '../web/dist');
  const dataDir = options.dataDir || process.env.POKECHILL_DATA_DIR || path.join(__dirname, '.data');
  const store = options.store || new CacheStore({
    filePath: path.join(dataDir, 'pokedex-cache.json')
  });
  const ptcgStore = options.ptcgStore || new PtcgCacheStore({
    filePath: path.join(dataDir, 'ptcg-cache.json')
  });
  const pocketStore = options.pocketStore || new PocketCacheStore({
    filePath: path.join(dataDir, 'pocket-cache.json')
  });
  const service = new PokedexService(store, { publicBaseUrl });
  const ptcgService = new PtcgService(ptcgStore, {
    publicBaseUrl,
    pokemonStore: store,
    dataDir
  });
  const pocketService = new PocketService(pocketStore, { publicBaseUrl, dataDir });
  const pocketDeckService = new PocketDeckService(pocketStore, { publicBaseUrl, dataDir });
  const hotDeckService = new HotDeckService({
    publicBaseUrl,
    dataDir
  });
  const pokemonModel3dService = new PokemonModel3dService({
    publicBaseUrl,
    dataDir,
    pokemonStore: store
  });
  const scheduler = createSyncScheduler({
    store,
    dataDir,
    syncFn: syncPokeapi,
    scheduler: options.scheduler || {}
  });
  const pocketScheduler = new PocketScheduler({
    store: pocketStore,
    dataDir,
    scheduler: options.pocketScheduler || {}
  });

  async function handler(req, res) {
    if (req.method === 'OPTIONS') {
      sendText(res, 204, '');
      return;
    }

    const currentUrl = new URL(req.url, publicBaseUrl);
    const pathname = currentUrl.pathname.replace(/\/+$/, '') || '/';

    try {
      if (pathname.startsWith('/assets/pokemon/artwork/')) {
        serveArtwork(req, res, pathname, dataDir);
        return;
      }

      if (pathname.startsWith('/assets/local-pokemon/')) {
        serveRepoPokemonAsset(req, res, pathname);
        return;
      }

      const pokemon3dAssetMatch = pathname.match(/^\/assets\/pokemon\/3d\/(normal|shiny)\/([^/]+\.gif)$/);
      if (pokemon3dAssetMatch) {
        const served = await pokemonModel3dService.serveImage(
          res,
          pokemon3dAssetMatch[1],
          decodeURIComponent(pokemon3dAssetMatch[2])
        );
        if (!served) {
          sendJson(res, 404, { error: 'Asset not found' });
        }
        return;
      }

      if (pathname.startsWith('/assets/ptcg/cards/')) {
        await servePtcgCardImage(req, res, pathname, ptcgService);
        return;
      }

      if (pathname.startsWith('/assets/ptcg/sets/')) {
        await servePtcgSetImage(req, res, pathname, ptcgService);
        return;
      }

      if (pathname.startsWith('/assets/pocket/cards/')) {
        await servePocketCardImage(req, res, pathname, pocketService);
        return;
      }

      if (pathname.startsWith('/assets/pocket/packs/')) {
        await servePocketPackImage(req, res, pathname, pocketService);
        return;
      }

      if (pathname.startsWith('/assets/limitless/pokemon/')) {
        await serveLimitlessPokemonImage(req, res, pathname, hotDeckService);
        return;
      }

      if (pathname.startsWith('/assets/limitless/cards/')) {
        await serveLimitlessCardImage(req, res, pathname, hotDeckService);
        return;
      }

      if (req.method === 'GET' && pathname === '/health') {
        sendJson(res, 200, {
          ok: true,
          service: 'pokechill-self-hosted-api',
          publicBaseUrl,
          webRoot,
          webReady: fs.existsSync(path.join(webRoot, 'index.html')),
          cacheFile: store.filePath,
          scheduler: {
            enabled: scheduler.status().enabled,
            started: scheduler.status().state.started,
            running: scheduler.status().state.running,
            due: scheduler.status().due
          },
          pocketScheduler: {
            enabled: pocketScheduler.status().enabled,
            started: pocketScheduler.status().state.started,
            running: pocketScheduler.status().state.running,
            due: pocketScheduler.status().due
          }
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pokemon') {
        sendJson(res, 200, service.listPokemon(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/data-sources') {
        sendJson(res, 200, {
          items: sourceManifest(currentUrl.searchParams.get('product') || ''),
          policy: {
            commercialModel: 'free-with-advertising-or-sponsorship',
            officialChineseOnly: true,
            traditionalChineseStandard: 'zh-TW-official-terminology'
          }
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/data-health') {
        sendJson(res, 200, {
          generatedAt: new Date().toISOString(),
          products: {
            pokedex: service.getSyncStatus(),
            ptcg: ptcgService.getSyncStatus(),
            pocket: pocketService.getMeta()
          }
        });
        return;
      }

      const pokemonMatch = pathname.match(/^\/api\/pokemon\/(\d+)$/);
      if (req.method === 'GET' && pokemonMatch) {
        const payload = service.getPokemon(Number(pokemonMatch[1]));
        if (payload.item) {
          payload.item.model3d = pokemonModel3dService.getModelForPokemon(payload.item);
        }
        sendJson(res, 200, payload);
        return;
      }

      const pokemon3dMatch = pathname.match(/^\/api\/pokemon\/(\d+)\/3d-model$/);
      if (req.method === 'GET' && pokemon3dMatch) {
        const payload = service.getPokemon(Number(pokemon3dMatch[1]));
        sendJson(res, 200, {
          item: payload.item ? pokemonModel3dService.getModelForPokemon(payload.item) : null,
          source: 'projectpokemon'
        });
        return;
      }

      const pokemonCardsMatch = pathname.match(/^\/api\/pokemon\/(\d+)\/cards$/);
      if (req.method === 'GET' && pokemonCardsMatch) {
        sendJson(res, 200, ptcgService.getPokemonCards(Number(pokemonCardsMatch[1]), queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/cards') {
        sendJson(res, 200, ptcgService.listCards(queryObject(currentUrl.searchParams)));
        return;
      }

      const cardMatch = pathname.match(/^\/api\/cards\/([^/]+)$/);
      if (req.method === 'GET' && cardMatch) {
        sendJson(res, 200, ptcgService.getCard(decodeURIComponent(cardMatch[1])));
        return;
      }

      const cardPokemonMatch = pathname.match(/^\/api\/cards\/([^/]+)\/related-pokemon$/);
      if (req.method === 'GET' && cardPokemonMatch) {
        sendJson(res, 200, ptcgService.getRelatedPokemon(decodeURIComponent(cardPokemonMatch[1])));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/card-sets') {
        sendJson(res, 200, ptcgService.listSets(queryObject(currentUrl.searchParams)));
        return;
      }

      const cardSetMatch = pathname.match(/^\/api\/card-sets\/([^/]+)$/);
      if (req.method === 'GET' && cardSetMatch) {
        sendJson(res, 200, ptcgService.getSet(decodeURIComponent(cardSetMatch[1])));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/ptcg/meta') {
        sendJson(res, 200, ptcgService.getMeta());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/ptcg/sync-status') {
        sendJson(res, 200, ptcgService.getSyncStatus());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/ptcg/sync-runs') {
        sendJson(res, 200, ptcgService.getSyncRuns(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/cards') {
        sendJson(res, 200, pocketService.listCards(queryObject(currentUrl.searchParams)));
        return;
      }

      const pocketCardMatch = pathname.match(/^\/api\/pocket\/cards\/([^/]+)$/);
      if (req.method === 'GET' && pocketCardMatch) {
        sendJson(res, 200, pocketService.getCard(decodeURIComponent(pocketCardMatch[1])));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/expansions') {
        sendJson(res, 200, pocketService.listExpansions(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/packs') {
        sendJson(res, 200, pocketService.listPacks(queryObject(currentUrl.searchParams)));
        return;
      }

      const pocketPackMatch = pathname.match(/^\/api\/pocket\/packs\/([^/]+)$/);
      if (req.method === 'GET' && pocketPackMatch) {
        sendJson(res, 200, pocketService.getPack(decodeURIComponent(pocketPackMatch[1])));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/rarities') {
        sendJson(res, 200, pocketService.getRarities());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/pull-rates') {
        sendJson(res, 200, pocketService.getPullRates(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/pocket/open-pack') {
        sendJson(res, 200, pocketService.openPack(await parseJsonBody(req)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/events') {
        sendJson(res, 200, pocketService.listEvents(queryObject(currentUrl.searchParams)));
        return;
      }

      const pocketCollections = {
        '/api/pocket/missions': 'missions',
        '/api/pocket/battles': 'battles',
        '/api/pocket/shops': 'shops',
        '/api/pocket/wonder-picks': 'wonder_picks',
        '/api/pocket/profile-decorations': 'profile_decorations',
        '/api/pocket/peripheral-goods': 'peripheral_goods',
        '/api/pocket/rental-decks': 'rental_decks',
        '/api/pocket/preset-decks': 'preset_decks',
        '/api/pocket/pvp-ranks': 'pvp_ranks',
        '/api/pocket/hot-decks': 'hot_decks'
      };
      if (req.method === 'GET' && pocketCollections[pathname]) {
        sendJson(res, 200, pocketService.listCollection(
          pocketCollections[pathname],
          queryObject(currentUrl.searchParams)
        ));
        return;
      }

      if (req.method === 'GET' && (pathname === '/api/pocket/meta' || pathname === '/api/pocket/sync-status')) {
        sendJson(res, 200, pocketService.getMeta());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/sync-runs') {
        sendJson(res, 200, pocketService.getRuns(queryObject(currentUrl.searchParams)));
        return;
      }

      const pocketHotDeckMatch = pathname.match(/^\/api\/pocket\/hot-decks\/([^/]+)$/);
      if (req.method === 'GET' && pocketHotDeckMatch) {
        sendJson(res, 200, await pocketDeckService.getDetail(
          decodeURIComponent(pocketHotDeckMatch[1]),
          queryObject(currentUrl.searchParams)
        ));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pocket/scheduler') {
        sendJson(res, 200, pocketScheduler.status());
        return;
      }

      if (req.method === 'POST' && pathname === '/api/pocket/scheduler/run') {
        const body = await parseJsonBody(req);
        sendJson(res, 200, await pocketScheduler.runIfDue(body.reason || 'manual-api', body));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/pokemon-3d/sync-status') {
        sendJson(res, 200, {
          item: pokemonModel3dService.getMeta(),
          source: 'projectpokemon'
        });
        return;
      }

      if (req.method === 'GET' && pathname === '/api/decks/hot') {
        sendJson(res, 200, await hotDeckService.listHotDecks(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/decks/detail') {
        sendJson(res, 200, await hotDeckService.getDeckDetail(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/card-quiz/daily') {
        sendJson(res, 200, ptcgService.getDailyCardQuiz());
        return;
      }

      if (req.method === 'POST' && pathname === '/api/card-quiz/daily/answer') {
        sendJson(res, 200, ptcgService.submitDailyCardQuiz(await parseJsonBody(req)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/card-pack/open') {
        sendJson(res, 200, ptcgService.openCardPack(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/card-pack/open') {
        sendJson(res, 200, ptcgService.openCardPack(await parseJsonBody(req)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/evolution') {
        sendJson(res, 200, service.getEvolutionChain(idsFromQuery(currentUrl.searchParams.get('ids'))));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/types') {
        sendJson(res, 200, service.getTypes());
        return;
      }

      if (req.method === 'GET' && pathname === '/api/type-chart') {
        sendJson(res, 200, service.getTypeChart());
        return;
      }

      const typeMatch = pathname.match(/^\/api\/types\/([^/]+)\/relations$/);
      if (req.method === 'GET' && typeMatch) {
        sendJson(res, 200, service.getTypeRelations(decodeURIComponent(typeMatch[1])));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/quiz/daily') {
        sendJson(res, 200, service.getDailyQuiz(currentUrl.searchParams.get('seed')));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/quiz/daily/answer') {
        sendJson(res, 200, service.submitDailyQuiz(await parseJsonBody(req)));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/team/analyze') {
        sendJson(res, 200, service.analyzeTeam(await parseJsonBody(req)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/sync/status') {
        sendJson(res, 200, service.getSyncStatus(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/sync/runs') {
        sendJson(res, 200, service.getSyncRuns(queryObject(currentUrl.searchParams)));
        return;
      }

      if (req.method === 'GET' && pathname === '/api/sync/scheduler') {
        sendJson(res, 200, scheduler.status());
        return;
      }

      if (req.method === 'POST' && pathname === '/api/sync/scheduler/run') {
        const body = await parseJsonBody(req);
        const result = await scheduler.runIfDue(body.reason || 'manual-api', Object.assign({}, body, {
          forceSchedulerRun: body.forceSchedulerRun === true
        }));
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/cache/validate') {
        sendJson(res, 200, service.validateCache(await parseJsonBody(req)));
        return;
      }

      if (req.method === 'POST' && pathname === '/api/sync/pokeapi') {
        const result = await syncPokeapi(store, await parseJsonBody(req), { dataDir });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/sync/ptcg') {
        const result = await syncPtcg(ptcgStore, await parseJsonBody(req));
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/sync/pocket') {
        const result = await syncPocket(pocketStore, await parseJsonBody(req), { dataDir });
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/sync/projectpokemon-3d') {
        const result = await pokemonModel3dService.sync(await parseJsonBody(req));
        sendJson(res, 200, result);
        return;
      }

      if (req.method === 'GET' && pathname === '/robots.txt') {
        const origin = publicBaseUrl.replace(/\/$/, '');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\n`);
        return;
      }

      if (req.method === 'GET' && pathname === '/sitemap.xml') {
        const origin = publicBaseUrl.replace(/\/$/, '');
        const maps = ['core', 'pokemon', 'ptcg', 'pocket'].map((name) => `<sitemap><loc>${origin}/sitemaps/${name}.xml</loc></sitemap>`).join('');
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps}</sitemapindex>`);
        return;
      }

      const sitemapMatch = pathname.match(/^\/sitemaps\/(core|pokemon|ptcg|pocket)\.xml$/);
      if (req.method === 'GET' && sitemapMatch) {
        const origin = publicBaseUrl.replace(/\/$/, '');
        let paths = ['/', '/pages/pokedex/index', '/pages/carddex/index', '/pages/pocket/index'];
        if (sitemapMatch[1] === 'pokemon') paths = store.getSummaries().map((item) => `/pages/pokemon-detail/index?id=${encodeURIComponent(item.id)}`);
        if (sitemapMatch[1] === 'ptcg') paths = ptcgStore.getCardSummaries().map((item) => `/pages/card-detail/index?id=${encodeURIComponent(item.id)}`);
        if (sitemapMatch[1] === 'pocket') paths = pocketStore.getCards().map((item) => `/pages/pocket-card-detail/index?id=${encodeURIComponent(item.id)}`);
        const urls = paths.map((itemPath) => `<url><loc>${escapeHtml(`${origin}${itemPath}`)}</loc></url>`).join('');
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
        return;
      }

      const seo = buildSeoMetadata(pathname, currentUrl.searchParams, {
        pokedex: service,
        ptcg: ptcgService,
        pocket: pocketService
      }, publicBaseUrl, req.headers['accept-language']);
      if (serveWebApp(req, res, pathname, webRoot, seo)) return;

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, {
        error: error.message || 'Internal server error'
      });
    }
  }

  return {
    host,
    port,
    publicBaseUrl,
    webRoot,
    dataDir,
    store,
    ptcgStore,
    pocketStore,
    service,
    ptcgService,
    pocketService,
    pocketDeckService,
    hotDeckService,
    pokemonModel3dService,
    scheduler,
    pocketScheduler,
    handler,
    server: http.createServer(handler)
  };
}

if (require.main === module) {
  const app = createApp();
  app.scheduler.start();
  app.pocketScheduler.start();
  app.server.listen(app.port, app.host, () => {
    console.log(`PokeChill self-hosted API listening on ${app.publicBaseUrl}`);
    console.log(`Cache file: ${app.store.filePath}`);
    console.log(`Sync scheduler enabled: ${app.scheduler.status().enabled}`);
  });
}

module.exports = {
  createApp
};
