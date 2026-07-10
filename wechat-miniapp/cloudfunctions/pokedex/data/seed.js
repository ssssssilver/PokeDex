const typeMeta = {
  normal: { name: '一般' },
  fire: { name: '火' },
  water: { name: '水' },
  electric: { name: '电' },
  grass: { name: '草' },
  ice: { name: '冰' },
  fighting: { name: '格斗' },
  poison: { name: '毒' },
  ground: { name: '地面' },
  flying: { name: '飞行' },
  psychic: { name: '超能力' },
  bug: { name: '虫' },
  rock: { name: '岩石' },
  ghost: { name: '幽灵' },
  dragon: { name: '龙' },
  dark: { name: '恶' },
  steel: { name: '钢' },
  fairy: { name: '妖精' }
};

const typeRelations = {
  normal: { weakTo: ['fighting'], resists: [], immuneTo: ['ghost'] },
  fire: { weakTo: ['water', 'ground', 'rock'], resists: ['fire', 'grass', 'ice', 'bug', 'steel', 'fairy'], immuneTo: [] },
  water: { weakTo: ['electric', 'grass'], resists: ['fire', 'water', 'ice', 'steel'], immuneTo: [] },
  electric: { weakTo: ['ground'], resists: ['electric', 'flying', 'steel'], immuneTo: [] },
  grass: { weakTo: ['fire', 'ice', 'poison', 'flying', 'bug'], resists: ['water', 'electric', 'grass', 'ground'], immuneTo: [] },
  ice: { weakTo: ['fire', 'fighting', 'rock', 'steel'], resists: ['ice'], immuneTo: [] },
  fighting: { weakTo: ['flying', 'psychic', 'fairy'], resists: ['bug', 'rock', 'dark'], immuneTo: [] },
  poison: { weakTo: ['ground', 'psychic'], resists: ['grass', 'fighting', 'poison', 'bug', 'fairy'], immuneTo: [] },
  ground: { weakTo: ['water', 'grass', 'ice'], resists: ['poison', 'rock'], immuneTo: ['electric'] },
  flying: { weakTo: ['electric', 'ice', 'rock'], resists: ['grass', 'fighting', 'bug'], immuneTo: ['ground'] },
  psychic: { weakTo: ['bug', 'ghost', 'dark'], resists: ['fighting', 'psychic'], immuneTo: [] },
  bug: { weakTo: ['fire', 'flying', 'rock'], resists: ['grass', 'fighting', 'ground'], immuneTo: [] },
  rock: { weakTo: ['water', 'grass', 'fighting', 'ground', 'steel'], resists: ['normal', 'fire', 'poison', 'flying'], immuneTo: [] },
  ghost: { weakTo: ['ghost', 'dark'], resists: ['poison', 'bug'], immuneTo: ['normal', 'fighting'] },
  dragon: { weakTo: ['ice', 'dragon', 'fairy'], resists: ['fire', 'water', 'electric', 'grass'], immuneTo: [] },
  dark: { weakTo: ['fighting', 'bug', 'fairy'], resists: ['ghost', 'dark'], immuneTo: ['psychic'] },
  steel: { weakTo: ['fire', 'fighting', 'ground'], resists: ['normal', 'grass', 'ice', 'flying', 'psychic', 'bug', 'rock', 'dragon', 'steel', 'fairy'], immuneTo: ['poison'] },
  fairy: { weakTo: ['poison', 'steel'], resists: ['fighting', 'bug', 'dark'], immuneTo: ['dragon'] }
};

const pokemon = [
  { id: 1, name_en: 'Bulbasaur', name_zh: '妙蛙种子', image: '/assets/pokemon/bulbasaur.png', types: ['grass', 'poison'], generation: 1, stat_total: 318, stats: { hp: 45, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 }, height: '0.7 m', weight: '6.9 kg', category: '种子宝可梦', abilities: ['茂盛', '叶绿素'], evolution_chain: [1, 2, 3], moves_summary: ['藤鞭', '飞叶快刀', '生长', '寄生种子'], flavor: '背上的种子会随着成长逐渐变大，是很适合新手认识属性关系的宝可梦。' },
  { id: 2, name_en: 'Ivysaur', name_zh: '妙蛙草', image: '/assets/pokemon/ivysaur.png', types: ['grass', 'poison'], generation: 1, stat_total: 405, stats: { hp: 60, attack: 62, defense: 63, specialAttack: 80, specialDefense: 80, speed: 60 }, height: '1.0 m', weight: '13.0 kg', category: '种子宝可梦', abilities: ['茂盛', '叶绿素'], evolution_chain: [1, 2, 3], moves_summary: ['藤鞭', '飞叶快刀', '甜甜香气', '睡眠粉'], flavor: '花苞开始绽放，草与毒的双属性让它有鲜明的抗性和弱点。' },
  { id: 3, name_en: 'Venusaur', name_zh: '妙蛙花', image: '/assets/pokemon/venusaur.png', types: ['grass', 'poison'], generation: 1, stat_total: 525, stats: { hp: 80, attack: 82, defense: 83, specialAttack: 100, specialDefense: 100, speed: 80 }, height: '2.0 m', weight: '100.0 kg', category: '种子宝可梦', abilities: ['茂盛', '叶绿素'], evolution_chain: [1, 2, 3], moves_summary: ['花瓣舞', '日光束', '污泥炸弹', '催眠粉'], flavor: '攻防均衡的最终进化，适合作为队伍分析器里的稳定草系样本。' },
  { id: 4, name_en: 'Charmander', name_zh: '小火龙', image: '/assets/pokemon/charmander.png', types: ['fire'], generation: 1, stat_total: 309, stats: { hp: 39, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 }, height: '0.6 m', weight: '8.5 kg', category: '蜥蜴宝可梦', abilities: ['猛火', '太阳之力'], evolution_chain: [4, 5, 6], moves_summary: ['火花', '烟幕', '火焰牙', '喷射火焰'], flavor: '尾巴上的火焰是它生命力的象征，也是火系弱点教学的好入口。' },
  { id: 5, name_en: 'Charmeleon', name_zh: '火恐龙', image: '/assets/pokemon/charmeleon.png', types: ['fire'], generation: 1, stat_total: 405, stats: { hp: 58, attack: 64, defense: 58, specialAttack: 80, specialDefense: 65, speed: 80 }, height: '1.1 m', weight: '19.0 kg', category: '火焰宝可梦', abilities: ['猛火', '太阳之力'], evolution_chain: [4, 5, 6], moves_summary: ['火焰牙', '劈开', '喷射火焰', '鬼面'], flavor: '速度与特攻开始突出，单火属性的优缺点很清晰。' },
  { id: 6, name_en: 'Charizard', name_zh: '喷火龙', image: '/assets/pokemon/charizard.png', types: ['fire', 'flying'], generation: 1, stat_total: 534, stats: { hp: 78, attack: 84, defense: 78, specialAttack: 109, specialDefense: 85, speed: 100 }, height: '1.7 m', weight: '90.5 kg', category: '火焰宝可梦', abilities: ['猛火', '太阳之力'], evolution_chain: [4, 5, 6], moves_summary: ['喷射火焰', '空气斩', '龙爪', '热风'], flavor: '火/飞行带来高输出和明显的岩石弱点，适合队伍短板演示。' },
  { id: 7, name_en: 'Squirtle', name_zh: '杰尼龟', image: '/assets/pokemon/squirtle.png', types: ['water'], generation: 1, stat_total: 314, stats: { hp: 44, attack: 48, defense: 65, specialAttack: 50, specialDefense: 64, speed: 43 }, height: '0.5 m', weight: '9.0 kg', category: '小龟宝可梦', abilities: ['激流', '雨盘'], evolution_chain: [7, 8, 9], moves_summary: ['水枪', '缩入壳中', '泡沫', '水之波动'], flavor: '防御扎实的水系初学者样本，适合和火系、草系互相对照。' },
  { id: 8, name_en: 'Wartortle', name_zh: '卡咪龟', image: '/assets/pokemon/wartortle.png', types: ['water'], generation: 1, stat_total: 405, stats: { hp: 59, attack: 63, defense: 80, specialAttack: 65, specialDefense: 80, speed: 58 }, height: '1.0 m', weight: '22.5 kg', category: '龟宝可梦', abilities: ['激流', '雨盘'], evolution_chain: [7, 8, 9], moves_summary: ['水之波动', '高速旋转', '咬住', '守住'], flavor: '水系中段进化，耐久更稳定，适合收藏页与进化链展示。' },
  { id: 9, name_en: 'Blastoise', name_zh: '水箭龟', image: '/assets/pokemon/blastoise.png', types: ['water'], generation: 1, stat_total: 530, stats: { hp: 79, attack: 83, defense: 100, specialAttack: 85, specialDefense: 105, speed: 78 }, height: '1.6 m', weight: '85.5 kg', category: '甲壳宝可梦', abilities: ['激流', '雨盘'], evolution_chain: [7, 8, 9], moves_summary: ['水炮', '加农光炮', '高速旋转', '守住'], flavor: '防守端很可靠的最终进化，单水属性让队伍分析结果更直观。' },
  { id: 25, name_en: 'Pikachu', name_zh: '皮卡丘', image: '/assets/pokemon/pikachu.png', types: ['electric'], generation: 1, stat_total: 320, stats: { hp: 35, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 }, height: '0.4 m', weight: '6.0 kg', category: '鼠宝可梦', abilities: ['静电', '避雷针'], evolution_chain: [25], moves_summary: ['电击', '电光一闪', '十万伏特', '电磁波'], flavor: '速度快、辨识度高，是每日猜谜和新手入口最友好的宝可梦之一。' },
  { id: 94, name_en: 'Gengar', name_zh: '耿鬼', image: '/assets/pokemon/gengar.png', types: ['ghost', 'poison'], generation: 1, stat_total: 500, stats: { hp: 60, attack: 65, defense: 60, specialAttack: 130, specialDefense: 75, speed: 110 }, height: '1.5 m', weight: '40.5 kg', category: '影子宝可梦', abilities: ['诅咒之躯'], evolution_chain: [94], moves_summary: ['暗影球', '催眠术', '祸不单行', '污泥炸弹'], flavor: '高速度高特攻，但弱点也不少，是属性速查里很有意思的案例。' },
  { id: 133, name_en: 'Eevee', name_zh: '伊布', image: '/assets/pokemon/eevee.png', types: ['normal'], generation: 1, stat_total: 325, stats: { hp: 55, attack: 55, defense: 50, specialAttack: 45, specialDefense: 65, speed: 55 }, height: '0.3 m', weight: '6.5 kg', category: '进化宝可梦', abilities: ['逃跑', '适应力', '危险预知'], evolution_chain: [133], moves_summary: ['电光一闪', '帮助', '咬住', '高速星星'], flavor: '拥有多种进化可能，适合后续扩展成进化链专题和每日发现。' }
];

module.exports = {
  typeMeta,
  typeRelations,
  pokemon
};

