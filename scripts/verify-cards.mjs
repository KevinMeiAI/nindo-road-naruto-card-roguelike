import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
new Function(scripts.join('\n'));

function readConst(name, nextName) {
  const pattern = new RegExp(`const ${name} = (\\{[\\s\\S]*?\\n\\});\\nconst ${nextName}`);
  const match = html.match(pattern);
  if (!match) throw new Error(`Cannot extract ${name}`);
  return vm.runInNewContext(`(${match[1]})`);
}

const characters = readConst('CHARACTERS', 'CHARACTER_EVENT_CARDS');
const cards = readConst('CARDS', 'TYPE_LABEL');
const mkCardSource = html.match(/function mkCard\([\s\S]*?\n}/)?.[0] || '';
const upgradeCardSource = html.match(/function upgradeCard\([\s\S]*?\n}/)?.[0] || '';
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

for (const [key, character] of Object.entries(characters)) {
  const starter = character.deck.map(cardKey => cards[cardKey]);
  assert(starter.length === 10, `${key}: starter deck must contain 10 cards`);
  assert(character.deck.filter(cardKey => cardKey === 'taijutsu').length === 4, `${key}: starter deck must contain 4 basic attacks`);
  assert(character.deck.filter(cardKey => cardKey === 'kawarimi').length === 4, `${key}: starter deck must contain 4 basic defenses`);
  assert(starter.filter(card => card?.chars?.includes(key)).length === 2, `${key}: starter deck must contain 2 exclusive cards`);

  const pool = Object.values(cards).filter(card => card.r > 0 && card.r < 4 && (!card.chars || card.chars.includes(key)));
  const rarity = [1, 2, 3].map(value => pool.filter(card => card.r === value).length);
  assert(pool.length === 39, `${key}: expected 39 available reward cards, got ${pool.length}`);
  assert(rarity[0] > rarity[1] && rarity[1] > rarity[2], `${key}: rarity counts must descend, got ${rarity.join('/')}`);
}

for (const [key, card] of Object.entries(cards)) {
  if (card.t === 'curse' || card.r === 0) continue;
  assert(card.up && typeof card.up.d === 'string', `${key}: reward card must define an upgraded description`);
}

const cardFactory = vm.runInNewContext(
  `${mkCardSource}\n${upgradeCardSource}\n({mkCard, upgradeCard})`,
  { CARDS: cards },
);
for (const [key, definition] of Object.entries(cards)) {
  assert(typeof definition.art === 'string' && definition.art.length > 0, `${key}: missing card artwork path`);
  if (definition.art) {
    const artworkUrl = new URL(`../${definition.art}`, import.meta.url);
    assert(fs.existsSync(artworkUrl), `${key}: artwork file does not exist: ${definition.art}`);
  }
  const base = cardFactory.mkCard(key, false);
  for (const [field, value] of Object.entries(definition)) {
    if (field === 'up' || field === 'chars') continue;
    assert(Object.is(base[field], value), `${key}: mkCard base mismatch for ${field}`);
  }
  if (!definition.up) continue;
  const upgraded = cardFactory.mkCard(key, true);
  assert(upgraded.upgraded === true, `${key}: upgraded instance is not marked upgraded`);
  assert(upgraded.n === `${definition.up.n || definition.n}⁺`, `${key}: upgraded name mismatch`);
  for (const [field, value] of Object.entries(definition.up)) {
    if (field === 'n') continue;
    assert(Object.is(upgraded[field], value), `${key}: mkCard upgrade mismatch for ${field}`);
  }

  for (const [label, card] of [['base', definition], ['upgrade', {...definition, ...definition.up}]]) {
    const drawAmount = Object.entries(card)
      .filter(([field]) => field === 'draw' || field.startsWith('drawIf') || field.endsWith('Draw'))
      .reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
    assert(!(card.c === 0 && !card.ex && drawAmount > 0), `${key} ${label}: non-exhausting zero-cost draw requires balance review`);
  }
}

const requiredKeywords = ['怪力', '影分身', '灼烧', '引爆', '保留', '盈疗', '洞察', '固守'];
for (const keyword of requiredKeywords) {
  assert(html.includes(`"${keyword}":`), `missing keyword explanation: ${keyword}`);
}

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Card data verification passed: ${Object.keys(cards).length} cards, 39 reward cards per character, no unsafe zero-cost draw cards.`);
