const assert = require('assert');
const {
  applyCachedImage,
  buildSyncPlan,
  fetchEvolutionChain,
  flattenEvolutionChain,
  reuseExistingCachedImage,
  transformPokemonBundle
} = require('../wechat-miniapp/cloudfunctions/syncPokeapi/lib/pokeapi');

const plan = buildSyncPlan({
  startId: 4,
  endId: 6,
  concurrency: 20,
  retries: 9,
  timeoutMs: 1,
  dryRun: true,
  cacheImages: true,
  refreshImages: true,
  strictImageCache: true,
  imageCloudPathPrefix: 'pokemon artwork/test!'
});

assert.deepStrictEqual(plan.ids, [4, 5, 6]);
assert.strictEqual(plan.concurrency, 12);
assert.strictEqual(plan.retries, 5);
assert.strictEqual(plan.timeoutMs, 2000);
assert.strictEqual(plan.dryRun, true);
assert.strictEqual(plan.cacheImages, true);
assert.strictEqual(plan.refreshImages, true);
assert.strictEqual(plan.strictImageCache, true);
assert.strictEqual(plan.imageCloudPathPrefix, 'pokemon-artwork/test-');

const defaultPlan = buildSyncPlan({});
assert.strictEqual(defaultPlan.cacheImages, true);
assert.strictEqual(defaultPlan.refreshImages, false);

const noImageCachePlan = buildSyncPlan({
  cacheImages: false
});
assert.strictEqual(noImageCachePlan.cacheImages, false);

const transformed = transformPokemonBundle({
  pokemon: {
    id: 25,
    name: 'pikachu',
    height: 4,
    weight: 60,
    types: [
      { type: { name: 'electric' } }
    ],
    abilities: [
      { ability: { name: 'static' } },
      { ability: { name: 'lightning-rod' } }
    ],
    stats: [
      { base_stat: 35, stat: { name: 'hp' } },
      { base_stat: 55, stat: { name: 'attack' } },
      { base_stat: 40, stat: { name: 'defense' } },
      { base_stat: 50, stat: { name: 'special-attack' } },
      { base_stat: 50, stat: { name: 'special-defense' } },
      { base_stat: 90, stat: { name: 'speed' } }
    ],
    sprites: {
      front_default: 'https://example.test/pikachu.png',
      other: {
        'official-artwork': {
          front_default: 'https://example.test/pikachu-art.png'
        }
      }
    },
    moves: [
      {
        move: { name: 'thunder-shock' },
        version_group_details: [
          {
            level_learned_at: 1,
            move_learn_method: { name: 'level-up' },
            version_group: { name: 'scarlet-violet' }
          }
        ]
      },
      {
        move: { name: 'quick-attack' },
        version_group_details: [
          {
            level_learned_at: 5,
            move_learn_method: { name: 'level-up' },
            version_group: { name: 'scarlet-violet' }
          }
        ]
      }
    ]
  },
  species: {
    names: [
      { name: 'Pikachu', language: { name: 'en' } },
      { name: '皮卡丘', language: { name: 'zh-hans' } }
    ],
    genera: [
      { genus: '鼠宝可梦', language: { name: 'zh-hans' } }
    ],
    flavor_text_entries: [
      { flavor_text: '越是能制造出强大电力的皮卡丘，脸颊上的囊就越柔软。', language: { name: 'zh-hans' } }
    ],
    generation: {
      name: 'generation-i',
      url: 'https://pokeapi.co/api/v2/generation/1/'
    },
    evolution_chain: {
      url: 'https://pokeapi.co/api/v2/evolution-chain/10/'
    }
  },
  evolutionChain: {
    chain: {
      species: {
        name: 'pichu',
        url: 'https://pokeapi.co/api/v2/pokemon-species/172/'
      },
      evolves_to: [
        {
          species: {
            name: 'pikachu',
            url: 'https://pokeapi.co/api/v2/pokemon-species/25/'
          },
          evolution_details: [
            {
              trigger: { name: 'level-up' },
              min_happiness: 220
            }
          ],
          evolves_to: [
            {
              species: {
                name: 'raichu',
                url: 'https://pokeapi.co/api/v2/pokemon-species/26/'
              },
              evolution_details: [
                {
                  trigger: { name: 'use-item' },
                  item: { name: 'thunder-stone' }
                }
              ],
              evolves_to: []
            }
          ]
        }
      ]
    }
  },
  moveDetails: [
    {
      name: 'thunder-shock',
      names: [
        { name: 'Thunder Shock', language: { name: 'en' } },
        { name: '电击', language: { name: 'zh-hans' } }
      ],
      type: { name: 'electric' },
      power: 40,
      accuracy: 100,
      pp: 30
    },
    {
      name: 'quick-attack',
      names: [
        { name: 'Quick Attack', language: { name: 'en' } },
        { name: '电光一闪', language: { name: 'zh-hans' } }
      ],
      type: { name: 'normal' },
      power: 40,
      accuracy: 100,
      pp: 30
    }
  ]
});

assert.strictEqual(transformed.summary.id, 25);
assert.strictEqual(transformed.summary.name_zh, '皮卡丘');
assert.strictEqual(transformed.summary.name_zh_cn, '皮卡丘');
assert.strictEqual(transformed.summary.name_zh_tw, '皮卡丘');
assert.strictEqual(transformed.summary.name_en, 'Pikachu');
assert.strictEqual(transformed.summary.image, 'https://example.test/pikachu-art.png');
assert.strictEqual(transformed.summary.image_remote, 'https://example.test/pikachu-art.png');
assert.strictEqual(transformed.summary.image_cached, false);
assert.strictEqual(transformed.summary.types[0], 'electric');
assert.strictEqual(transformed.summary.stat_total, 320);
assert.strictEqual(transformed.detail.height, '0.4 m');
assert.strictEqual(transformed.detail.weight, '6 kg');
assert.strictEqual(transformed.detail.category, '鼠宝可梦');
assert.strictEqual(transformed.detail.evolution_chain_id, '10');
assert.deepStrictEqual(transformed.detail.evolution_chain, [172, 25, 26]);
assert.deepStrictEqual(transformed.detail.moves_summary, ['电击', '电光一闪']);
assert.strictEqual(transformed.detail.moves[0].name_en, 'Thunder Shock');
assert.deepStrictEqual(transformed.detail.evolution_conditions.map((item) => item.text), ['亲密度 220+', '使用雷之石']);

assert.deepStrictEqual(flattenEvolutionChain({
  chain: {
    species: { url: 'https://pokeapi.co/api/v2/pokemon-species/1/' },
    evolves_to: [
      {
        species: { url: 'https://pokeapi.co/api/v2/pokemon-species/2/' },
        evolves_to: []
      },
      {
        species: { url: 'https://pokeapi.co/api/v2/pokemon-species/3/' },
        evolves_to: []
      }
    ]
  }
}), [1, 2, 3]);

const cached = applyCachedImage(transformed, {
  fileID: 'cloud://pokechill.123/pokemon/artwork/0025-pikachu.png'
});

assert.strictEqual(cached.summary.image, 'cloud://pokechill.123/pokemon/artwork/0025-pikachu.png');
assert.strictEqual(cached.summary.image_remote, 'https://example.test/pikachu-art.png');
assert.strictEqual(cached.summary.image_file_id, 'cloud://pokechill.123/pokemon/artwork/0025-pikachu.png');
assert.strictEqual(cached.summary.image_cached, true);
assert.strictEqual(cached.detail.image, cached.summary.image);

const reused = reuseExistingCachedImage(transformed, {
  detail: {
    image: 'cloud://pokechill.123/pokemon/artwork/0025-pikachu.png',
    image_file_id: 'cloud://pokechill.123/pokemon/artwork/0025-pikachu.png',
    image_cached: true
  }
});

assert.strictEqual(reused.reused, true);
assert.strictEqual(reused.transformed.summary.image, 'cloud://pokechill.123/pokemon/artwork/0025-pikachu.png');
assert.strictEqual(reused.transformed.summary.image_remote, 'https://example.test/pikachu-art.png');
assert.strictEqual(reused.transformed.summary.image_cached, true);

const evolutionCache = new Map();
const cachedEvolution = Promise.resolve({ chain: null });
evolutionCache.set('https://pokeapi.co/api/v2/evolution-chain/1/', cachedEvolution);
const firstEvolutionPromise = fetchEvolutionChain('https://pokeapi.co/api/v2/evolution-chain/1/', {
  evolutionCache
});
const secondEvolutionPromise = fetchEvolutionChain('https://pokeapi.co/api/v2/evolution-chain/1/', {
  evolutionCache
});
assert.strictEqual(evolutionCache.size, 1);
assert.strictEqual(evolutionCache.get('https://pokeapi.co/api/v2/evolution-chain/1/'), cachedEvolution);
firstEvolutionPromise.catch(() => {});
secondEvolutionPromise.catch(() => {});

console.log('miniapp sync core tests passed');
