const fs = require('fs');
const path = require('path');

const SOURCE_NAME = 'ProjectPokemon Sprite Index';
const DEFAULT_CREDIT = '3D GIF sprites from ProjectPokemon Sprite Index.';
const PKPARAISO_CREDIT = 'Animated GIFs credited by ProjectPokemon to pkparaiso.';

const MODEL_PAGES = [
  {
    generation: 1,
    title: '3D Models: Generation 1 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-1-pok%C3%A9mon-r90/'
  },
  {
    generation: 2,
    title: '3D Models: Generation 2 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-2-pok%C3%A9mon-r91/'
  },
  {
    generation: 3,
    title: '3D Models: Generation 3 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-3-pok%C3%A9mon-r92/'
  },
  {
    generation: 4,
    title: '3D Models: Generation 4 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-4-pok%C3%A9mon-r93/'
  },
  {
    generation: 5,
    title: '3D Models: Generation 5 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-5-pok%C3%A9mon-r94/'
  },
  {
    generation: 6,
    title: '3D Models: Generation 6 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-6-pok%C3%A9mon-r95/'
  },
  {
    generation: 7,
    title: '3D Models: Generation 7 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-7-pok%C3%A9mon-r96/'
  },
  {
    generation: 8,
    title: '3D Models: Generation 8 Pokemon',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/3d-models-generation-8-pok%C3%A9mon-r123/',
    credit: PKPARAISO_CREDIT
  }
];

const DEFAULT_FORM_SUFFIXES = [
  'altered',
  'average',
  'incarnate',
  'land',
  'male',
  'normal',
  'ordinary',
  'plant',
  'red-striped',
  'standard',
  'aria',
  'shield',
  'solo',
  'disguised',
  'full-belly',
  'amped'
];

const FORM_PART_LABELS = {
  '10': '10%形态',
  alola: '阿罗拉',
  blade: '刀剑形态',
  busted: '破损形态',
  complete: '完全体',
  cosplay: '换装',
  crowned: '王冠',
  defense: '防御形态',
  f: '雌性',
  galar: '伽勒尔',
  gigantamax: '超极巨化',
  hangry: '空腹花纹',
  hisui: '洗翠',
  mega: 'Mega',
  megax: 'Mega X',
  megay: 'Mega Y',
  noice: '解冻形态',
  origin: '起源形态',
  originalcap: '初始帽子',
  partnercap: '伙伴帽子',
  belle: '贵妇',
  libre: '摔角手',
  phd: '博士',
  popstar: '偶像',
  primal: '原始回归',
  rapid: '连击流',
  resolute: '觉悟形态',
  rockstar: '摇滚明星',
  school: '鱼群形态',
  shield: '盾牌形态',
  sky: '天空形态',
  speed: '速度形态',
  strike: '',
  therian: '灵兽形态',
  totem: '霸主',
  zen: '达摩模式'
};

const CAP_LABELS = {
  kantocap: '关都帽子',
  hoenncap: '丰缘帽子',
  sinnohcap: '神奥帽子',
  unovacap: '合众帽子',
  kaloscap: '卡洛斯帽子',
  alolacap: '阿罗拉帽子'
};

const DEFAULT_STATE = {
  meta: {},
  models_by_slug: {},
  models_by_pokemon_id: {}
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePokemonName(value) {
  return normalizeSlug(value)
    .replace(/^nidoran-female$/, 'nidoran-f')
    .replace(/^nidoran-male$/, 'nidoran-m')
    .replace(/^farfetchd$/, 'farfetchd')
    .replace(/^sirfetchd$/, 'sirfetchd')
    .replace(/^mr-mime$/, 'mr-mime')
    .replace(/^mime-jr$/, 'mime-jr')
    .replace(/^mr-rime$/, 'mr-rime');
}

function localFileName(slug) {
  return `${normalizeSlug(slug) || 'unknown'}.gif`;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'image/png';
}

function parseModelUrls(html, page) {
  const results = [];
  const seen = new Set();
  const regex = /https:\/\/projectpokemon\.org\/images\/(?:sprites-models\/)?(?:normal-sprite|shiny-sprite|swsh-normal-sprites|swsh-shiny-sprites)\/[^"'<> ]+?\.gif/gi;
  let match = regex.exec(html);

  while (match) {
    const remote = match[0].replace(/&amp;/g, '&');
    if (!seen.has(remote)) {
      seen.add(remote);
      const parts = new URL(remote).pathname.split('/').filter(Boolean);
      const fileName = parts[parts.length - 1] || '';
      const folder = parts[parts.length - 2] || '';
      const slug = normalizeSlug(fileName.replace(/\.gif$/i, ''));
      const variant = folder.includes('shiny') ? 'shiny' : 'normal';
      results.push({
        slug,
        variant,
        remote,
        fileName,
        sourceUrl: page.url,
        sourceTitle: page.title,
        generation: page.generation,
        credit: page.credit || DEFAULT_CREDIT
      });
    }
    match = regex.exec(html);
  }

  return results;
}

function candidateSlugsForPokemon(pokemon) {
  const candidates = [
    pokemon && pokemon.slug,
    pokemon && pokemon.name_en,
    pokemon && pokemon.name
  ].map(normalizePokemonName).filter(Boolean);

  const expanded = [];
  candidates.forEach((slug) => {
    expanded.push(slug);
    if (slug === 'mr-mime') expanded.push('mrmime');
    if (slug === 'mime-jr') expanded.push('mimejr');
    if (slug === 'mr-rime') expanded.push('mrrime');
    if (slug.startsWith('tapu-')) {
      expanded.push(slug.replace(/-/g, ''));
    }
    if (slug === 'melmetal') {
      expanded.push('melmetal-gigantamax');
    }
    DEFAULT_FORM_SUFFIXES.forEach((suffix) => {
      const marker = `-${suffix}`;
      if (slug.endsWith(marker)) {
        expanded.push(slug.slice(0, -marker.length));
      }
    });
    expanded.push(slug.replace(/-incarnate$/, ''));
    expanded.push(slug.replace(/-altered$/, ''));
    expanded.push(slug.replace(/-red-striped$/, ''));
  });

  return Array.from(new Set(expanded.filter(Boolean)));
}

function modelSlugMatchesBase(modelSlug, baseSlug) {
  if (!modelSlug || !baseSlug) return false;
  if (modelSlug === baseSlug || modelSlug.startsWith(`${baseSlug}-`)) return true;
  const compact = baseSlug.replace(/-/g, '');
  return compact !== baseSlug && (modelSlug === compact || modelSlug.startsWith(`${compact}-`));
}

function modelSuffix(modelSlug, baseSlugs) {
  const matches = (baseSlugs || [])
    .filter((baseSlug) => modelSlugMatchesBase(modelSlug, baseSlug))
    .sort((a, b) => b.length - a.length);
  const base = matches[0] || '';
  if (!base) return '';
  if (modelSlug === base) return '';
  const compact = base.replace(/-/g, '');
  if (modelSlug === compact) return '';
  if (modelSlug.startsWith(`${base}-`)) return modelSlug.slice(base.length + 1);
  if (modelSlug.startsWith(`${compact}-`)) return modelSlug.slice(compact.length + 1);
  return '';
}

function formLabelFromSlug(modelSlug, baseSlugs) {
  const suffix = modelSuffix(modelSlug, baseSlugs);
  if (!suffix) return '默认形态';
  if (CAP_LABELS[suffix]) return CAP_LABELS[suffix];
  if (suffix === 'megax') return 'Mega X';
  if (suffix === 'megay') return 'Mega Y';
  if (suffix === 'rapid-strike') return '连击流';
  if (suffix === 'single-strike') return '一击流';
  if (suffix === 'rapid-strike-gigantamax') return '连击流超极巨化';
  if (suffix === 'crowned-sword') return '王剑形态';
  if (suffix === 'crowned-shield') return '王盾形态';
  return suffix
    .split('-')
    .filter(Boolean)
    .map((part) => FORM_PART_LABELS[part] || part)
    .filter(Boolean)
    .join('');
}

function formSortWeight(slug, baseSlugs) {
  const suffix = modelSuffix(slug, baseSlugs);
  if (!suffix) return 0;
  if (suffix === 'f' || suffix === 'm') return 10;
  if (suffix.includes('mega')) return 20;
  if (suffix.includes('gigantamax')) return 30;
  if (suffix.includes('alola') || suffix.includes('galar') || suffix.includes('hisui')) return 40;
  if (suffix.includes('cap') || suffix.includes('cosplay')) return 50;
  return 60;
}

async function fetchBuffer(remote) {
  const response = await fetch(remote, {
    headers: {
      'User-Agent': 'PokeChill/1.0 (+self-hosted local cache)'
    }
  });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${remote}: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function runPool(items, concurrency, worker) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await worker(item);
    }
  });
  await Promise.all(workers);
}

class PokemonModel3dService {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, '.data');
    this.publicBaseUrl = options.publicBaseUrl || 'http://127.0.0.1:8787';
    this.pokemonStore = options.pokemonStore || null;
    this.rootDir = path.join(this.dataDir, 'projectpokemon-3d');
    this.imageRoot = path.join(this.rootDir, 'images');
    this.indexPath = path.join(this.rootDir, 'index.json');
    this.state = null;
  }

  load() {
    if (this.state) return this.state;
    try {
      const parsed = JSON.parse(fs.readFileSync(this.indexPath, 'utf8'));
      this.state = Object.assign({}, clone(DEFAULT_STATE), parsed || {});
    } catch (error) {
      this.state = clone(DEFAULT_STATE);
    }
    return this.state;
  }

  save() {
    ensureDir(path.dirname(this.indexPath));
    const tempPath = `${this.indexPath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(this.load(), null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, this.indexPath);
  }

  assetPath(variant, slug) {
    return `/assets/pokemon/3d/${variant}/${localFileName(slug)}`;
  }

  filePath(variant, slug) {
    return path.join(this.imageRoot, variant, localFileName(slug));
  }

  absoluteAsset(assetPath) {
    if (!assetPath) return '';
    return `${this.publicBaseUrl}${assetPath}`;
  }

  getMeta() {
    return clone(this.load().meta || {});
  }

  getModelBySlug(slug) {
    const item = this.load().models_by_slug[normalizeSlug(slug)];
    return item ? clone(item) : null;
  }

  getModelByPokemonId(id) {
    const slug = this.load().models_by_pokemon_id[String(id)];
    return slug ? this.getModelBySlug(slug) : null;
  }

  decorateModel(model, pokemon, baseSlugs = []) {
    if (!model) return null;
    const normalPath = model.normal_asset_path || '';
    const shinyPath = model.shiny_asset_path || '';
    return {
      pokemonId: Number(pokemon.id || model.pokemon_id || 0),
      slug: model.slug,
      formName: model.form_name || model.slug,
      label: formLabelFromSlug(model.slug, baseSlugs),
      generation: model.generation,
      image: this.absoluteAsset(normalPath || shinyPath),
      normalImage: this.absoluteAsset(normalPath),
      shinyImage: this.absoluteAsset(shinyPath),
      normalAssetPath: normalPath,
      shinyAssetPath: shinyPath,
      hasNormal: Boolean(normalPath),
      hasShiny: Boolean(shinyPath),
      sourceName: SOURCE_NAME,
      sourceUrl: model.source_url,
      credit: model.credit || DEFAULT_CREDIT
    };
  }

  getModelFormsForPokemon(pokemon) {
    if (!pokemon) return [];
    const baseSlugs = candidateSlugsForPokemon(pokemon);
    const direct = this.getModelByPokemonId(pokemon.id);
    const state = this.load();
    const bySlug = state.models_by_slug || {};
    const matched = Object.values(bySlug)
      .filter((model) => baseSlugs.some((baseSlug) => modelSlugMatchesBase(model.slug, baseSlug)));

    if (direct && !matched.find((model) => model.slug === direct.slug)) {
      matched.push(direct);
    }

    return matched
      .map((model) => this.decorateModel(model, pokemon, baseSlugs))
      .filter((model) => model && model.image)
      .sort((a, b) => {
        const weight = formSortWeight(a.slug, baseSlugs) - formSortWeight(b.slug, baseSlugs);
        if (weight) return weight;
        return a.label.localeCompare(b.label);
      });
  }

  getModelForPokemon(pokemon) {
    const forms = this.getModelFormsForPokemon(pokemon);
    if (!forms.length) return null;
    return Object.assign({}, forms[0], { forms });
  }

  getImageInfo(variant, fileName) {
    const cleanVariant = variant === 'shiny' ? 'shiny' : 'normal';
    const slug = normalizeSlug(String(fileName || '').replace(/\.gif$/i, ''));
    const model = this.getModelBySlug(slug);
    if (!model) return null;
    const remote = cleanVariant === 'shiny' ? model.shiny_remote : model.normal_remote;
    const filePath = this.filePath(cleanVariant, slug);
    if (!remote && !fs.existsSync(filePath)) return null;
    return {
      slug,
      variant: cleanVariant,
      remote,
      filePath,
      contentType: contentTypeFor(filePath)
    };
  }

  async serveImage(res, variant, fileName) {
    const info = this.getImageInfo(variant, fileName);
    if (!info) return false;

    if (!fs.existsSync(info.filePath) && info.remote) {
      const buffer = await fetchBuffer(info.remote);
      ensureDir(path.dirname(info.filePath));
      fs.writeFileSync(info.filePath, buffer);
    }

    if (!fs.existsSync(info.filePath)) return false;

    res.writeHead(200, {
      'Content-Type': contentTypeFor(info.filePath),
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(info.filePath).pipe(res);
    return true;
  }

  buildPokemonIdMap(modelsBySlug) {
    const map = {};
    const summaries = this.pokemonStore && this.pokemonStore.getSummaries
      ? this.pokemonStore.getSummaries()
      : [];

    summaries.forEach((pokemon) => {
      const match = candidateSlugsForPokemon(pokemon).find((slug) => modelsBySlug[slug]);
      if (!match) return;
      modelsBySlug[match].pokemon_id = Number(pokemon.id);
      map[String(pokemon.id)] = match;
    });

    return map;
  }

  async sync(options = {}) {
    const startedAt = new Date().toISOString();
    const pages = MODEL_PAGES.filter((page) => {
      const generations = options.generations || options.generation || [];
      const selected = Array.isArray(generations) ? generations.map(Number) : [Number(generations)];
      return !selected.filter(Boolean).length || selected.includes(page.generation);
    });
    const refresh = Boolean(options.refresh);
    const downloadImages = options.downloadImages !== false;
    const concurrency = Math.max(1, Math.min(Number(options.concurrency || 6), 12));
    const modelsBySlug = Object.assign({}, this.load().models_by_slug || {});
    const discovered = [];
    const failed = [];

    for (const page of pages) {
      const response = await fetch(page.url, {
        headers: {
          'User-Agent': 'PokeChill/1.0 (+self-hosted local cache)'
        }
      });
      if (!response.ok) {
        failed.push({ page: page.url, error: `HTTP ${response.status}` });
        continue;
      }
      const html = await response.text();
      const records = parseModelUrls(html, page);
      discovered.push({ generation: page.generation, count: records.length, page: page.url });

      records.forEach((record) => {
        if (!record.slug) return;
        const existing = modelsBySlug[record.slug] || {
          slug: record.slug,
          generation: record.generation,
          source_url: record.sourceUrl,
          source_title: record.sourceTitle,
          source_name: SOURCE_NAME,
          credit: record.credit,
          normal_remote: '',
          shiny_remote: '',
          normal_asset_path: '',
          shiny_asset_path: ''
        };
        const previousGeneration = Number(existing.generation || record.generation);
        const shouldUseRecord = !existing[`${record.variant}_remote`] || record.generation <= previousGeneration;
        existing.generation = Math.min(previousGeneration, record.generation);
        if (shouldUseRecord) {
          existing.source_url = record.sourceUrl;
          existing.source_title = record.sourceTitle;
          existing.credit = record.credit || existing.credit || DEFAULT_CREDIT;
          existing[`${record.variant}_remote`] = record.remote;
          existing[`${record.variant}_asset_path`] = this.assetPath(record.variant, record.slug);
        }
        modelsBySlug[record.slug] = existing;
      });
    }

    const modelsByPokemonId = this.buildPokemonIdMap(modelsBySlug);
    const downloadJobs = [];
    Object.values(modelsBySlug).forEach((model) => {
      ['normal', 'shiny'].forEach((variant) => {
        const remote = model[`${variant}_remote`];
        if (!remote) return;
        const filePath = this.filePath(variant, model.slug);
        if (!refresh && fs.existsSync(filePath)) return;
        downloadJobs.push({ slug: model.slug, variant, remote, filePath });
      });
    });

    let downloadedCount = 0;
    if (downloadImages) {
      await runPool(downloadJobs, concurrency, async (job) => {
        try {
          const buffer = await fetchBuffer(job.remote);
          ensureDir(path.dirname(job.filePath));
          fs.writeFileSync(job.filePath, buffer);
          downloadedCount += 1;
        } catch (error) {
          failed.push({
            slug: job.slug,
            variant: job.variant,
            remote: job.remote,
            error: error.message
          });
        }
      });
    }

    const state = this.load();
    state.models_by_slug = modelsBySlug;
    state.models_by_pokemon_id = modelsByPokemonId;
    state.meta = {
      sourceName: SOURCE_NAME,
      sourcePages: MODEL_PAGES.map((page) => ({
        generation: page.generation,
        title: page.title,
        url: page.url
      })),
      startedAt,
      syncedAt: new Date().toISOString(),
      modelCount: Object.keys(modelsBySlug).length,
      pokemonMatchedCount: Object.keys(modelsByPokemonId).length,
      discovered,
      downloadedCount,
      downloadJobCount: downloadJobs.length,
      failedCount: failed.length,
      failed: failed.slice(0, 50),
      downloadImages
    };
    this.save();

    return {
      ok: failed.length === 0,
      item: clone(state.meta),
      source: 'projectpokemon'
    };
  }
}

module.exports = {
  PokemonModel3dService,
  MODEL_PAGES,
  SOURCE_NAME,
  parseModelUrls,
  normalizeSlug,
  candidateSlugsForPokemon
};
