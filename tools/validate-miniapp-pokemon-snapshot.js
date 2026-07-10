const path = require('path');

const snapshotPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '../wechat-miniapp/miniprogram/data/generated-pokemon.js');

const snapshot = require(snapshotPath);

const KNOWN_TYPES = new Set([
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy'
]);

function fail(message) {
  throw new Error(message);
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    fail(`${label} must be a non-empty string`);
  }
}

function statTotal(stats) {
  return Number(stats.hp || 0) +
    Number(stats.attack || 0) +
    Number(stats.defense || 0) +
    Number(stats.specialAttack || 0) +
    Number(stats.specialDefense || 0) +
    Number(stats.speed || 0);
}

function validatePokemon(pokemon, index, ids) {
  const label = `pokemon[${index}]`;
  if (!Number.isInteger(pokemon.id) || pokemon.id <= 0) {
    fail(`${label}.id must be a positive integer`);
  }
  assertNonEmptyString(pokemon.name_zh, `${label}.name_zh`);
  assertNonEmptyString(pokemon.name_en, `${label}.name_en`);
  assertNonEmptyString(pokemon.image, `${label}.image`);
  assertNonEmptyString(pokemon.height, `${label}.height`);
  assertNonEmptyString(pokemon.weight, `${label}.weight`);

  if (!Array.isArray(pokemon.types) || !pokemon.types.length) {
    fail(`${label}.types must be a non-empty array`);
  }
  pokemon.types.forEach((type) => {
    if (!KNOWN_TYPES.has(type)) {
      fail(`${label}.types contains unknown type: ${type}`);
    }
  });

  if (!pokemon.stats || typeof pokemon.stats !== 'object') {
    fail(`${label}.stats is required`);
  }
  ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'].forEach((stat) => {
    if (!Number.isInteger(pokemon.stats[stat]) || pokemon.stats[stat] <= 0) {
      fail(`${label}.stats.${stat} must be a positive integer`);
    }
  });

  const computedTotal = statTotal(pokemon.stats);
  if (pokemon.stat_total !== computedTotal) {
    fail(`${label}.stat_total ${pokemon.stat_total} does not match computed total ${computedTotal}`);
  }

  if (!Array.isArray(pokemon.evolution_chain) || !pokemon.evolution_chain.length) {
    fail(`${label}.evolution_chain must be a non-empty array`);
  }
  if (!pokemon.evolution_chain.includes(pokemon.id)) {
    fail(`${label}.evolution_chain must include current id ${pokemon.id}`);
  }
  pokemon.evolution_chain.forEach((id) => {
    if (!Number.isInteger(id) || id <= 0) {
      fail(`${label}.evolution_chain contains invalid id: ${id}`);
    }
  });

  if (!Array.isArray(pokemon.moves_summary)) {
    fail(`${label}.moves_summary must be an array`);
  }
  if (ids.has(pokemon.id)) {
    fail(`duplicate pokemon id ${pokemon.id}`);
  }
  ids.add(pokemon.id);
}

function main() {
  if (!snapshot || typeof snapshot !== 'object') {
    fail('snapshot must export an object');
  }
  assertNonEmptyString(snapshot.generatedAt, 'generatedAt');
  if (snapshot.source !== 'pokeapi') {
    fail(`source must be pokeapi, got ${snapshot.source}`);
  }
  if (!Array.isArray(snapshot.pokemon)) {
    fail('pokemon must be an array');
  }
  if (snapshot.count !== snapshot.pokemon.length) {
    fail(`count ${snapshot.count} does not match pokemon length ${snapshot.pokemon.length}`);
  }
  if (Array.isArray(snapshot.failed) && snapshot.failed.length) {
    fail(`snapshot has failed entries: ${JSON.stringify(snapshot.failed.slice(0, 5))}`);
  }

  const ids = new Set();
  snapshot.pokemon.forEach((pokemon, index) => validatePokemon(pokemon, index, ids));

  console.log(JSON.stringify({
    ok: true,
    path: snapshotPath,
    count: snapshot.count,
    first: snapshot.pokemon[0] && snapshot.pokemon[0].name_zh,
    last: snapshot.pokemon[snapshot.pokemon.length - 1] && snapshot.pokemon[snapshot.pokemon.length - 1].name_zh
  }, null, 2));
}

main();

