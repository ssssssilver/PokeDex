const SOURCES = Object.freeze({
  pokeapi: {
    id: 'pokeapi',
    product: 'pokedex',
    role: 'primary',
    url: 'https://pokeapi.co/api/v2',
    license: 'BSD-3-Clause',
    commercialUse: 'allowed',
    enabled: true
  },
  projectpokemon: {
    id: 'projectpokemon',
    product: 'pokedex',
    role: 'optional-media',
    url: 'https://projectpokemon.org/home/docs/spriteindex_148/',
    license: 'unverified-media-rights',
    commercialUse: 'review-required',
    enabled: false
  },
  pokemonTcgApi: {
    id: 'pokemon-tcg-api',
    product: 'ptcg',
    role: 'primary-en',
    url: 'https://api.pokemontcg.io/v2',
    license: 'service-terms',
    commercialUse: 'terms-apply',
    enabled: true
  },
  limitlessTcg: {
    id: 'limitless-tcg',
    product: 'ptcg',
    role: 'deck-statistics',
    url: 'https://limitlesstcg.com/decks',
    license: 'website-content',
    commercialUse: 'review-required',
    enabled: true
  },
  raenonx: {
    id: 'raenonx',
    product: 'pocket',
    role: 'primary-game-data',
    url: 'https://ptcgp.raenonx.cc',
    license: 'unpublished-api',
    commercialUse: 'review-required',
    enabled: true
  },
  chaseMew: {
    id: 'chase-mew',
    product: 'pocket',
    role: 'card-media-and-en',
    url: 'https://github.com/chase-mew/pokemon-tcg-pocket-cards',
    license: 'MIT',
    commercialUse: 'allowed-subject-to-upstream-media-rights',
    revision: 'e0d37b02bd29bbef77bcb3bed6d31cd991cb0196',
    enabled: true
  },
  flibustier: {
    id: 'flibustier',
    product: 'pocket',
    role: 'sets-rarities-pull-rates',
    url: 'https://github.com/flibustier/pokemon-tcg-pocket-database',
    license: 'MIT',
    commercialUse: 'allowed-subject-to-upstream-media-rights',
    revision: '484f88326e3aaa051fed46be2374fa85d5ab08ae',
    enabled: true
  },
  deckgym: {
    id: 'deckgym-core',
    product: 'pocket',
    role: 'optional-simulation-rules',
    url: 'https://github.com/bcollazo/deckgym-core',
    license: 'AGPL-3.0',
    commercialUse: 'isolated-review-required',
    enabled: false
  },
  limitlessPocket: {
    id: 'limitless-pocket',
    product: 'pocket',
    role: 'deck-statistics',
    url: 'https://play.limitlesstcg.com/decks?game=POCKET',
    license: 'website-content',
    commercialUse: 'review-required',
    enabled: true
  },
  ptcgChsReference: {
    id: 'ptcg-chs-datasets',
    product: 'ptcg',
    role: 'terminology-reference-only',
    url: 'https://github.com/duanxr/PTCG-CHS-Datasets',
    license: 'non-commercial-no-redistribution',
    commercialUse: 'prohibited',
    enabled: false,
    importForbidden: true
  }
});

function sourceManifest(product) {
  return Object.values(SOURCES)
    .filter((source) => !product || source.product === product)
    .map((source) => Object.assign({}, source));
}

module.exports = { SOURCES, sourceManifest };
