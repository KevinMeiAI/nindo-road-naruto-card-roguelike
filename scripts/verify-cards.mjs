import fs from 'node:fs';
import {loadGameRuntime} from './runtime-harness.mjs';

const {context, html} = loadGameRuntime();
const {CHARACTERS: characters, CARDS: cards, mkCard} = context;
const MIN_REWARD_POOL = 30;
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
  assert(pool.length >= MIN_REWARD_POOL, `${key}: expected at least ${MIN_REWARD_POOL} available reward cards, got ${pool.length}`);
  assert(rarity[0] > rarity[1] && rarity[1] > rarity[2], `${key}: rarity counts must descend, got ${rarity.join('/')}`);
}

for (const [key, card] of Object.entries(cards)) {
  if (card.t === 'curse' || card.r === 0) continue;
  assert(card.up && typeof card.up.d === 'string', `${key}: reward card must define an upgraded description`);
}

for (const [key, definition] of Object.entries(cards)) {
  assert(typeof definition.art === 'string' && definition.art.length > 0, `${key}: missing card artwork path`);
  if (definition.art) {
    const artworkUrl = new URL(`../${definition.art}`, import.meta.url);
    assert(fs.existsSync(artworkUrl), `${key}: artwork file does not exist: ${definition.art}`);
    const runtimeArtwork = definition.art.replace('assets/card-art/', 'assets/runtime/card-art/').replace(/\.jpg$/, '.webp');
    assert(fs.existsSync(new URL(`../${runtimeArtwork}`, import.meta.url)), `${key}: runtime artwork file does not exist: ${runtimeArtwork}`);
  }
  const base = mkCard(key, false);
  for (const [field, value] of Object.entries(definition)) {
    if (field === 'up' || field === 'chars') continue;
    assert(Object.is(base[field], value), `${key}: mkCard base mismatch for ${field}`);
  }
  if (!definition.up) continue;
  const upgraded = mkCard(key, true);
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

const poolSummary = Object.keys(characters).map(key => {
  const pool = Object.values(cards).filter(card => card.r > 0 && card.r < 4 && (!card.chars || card.chars.includes(key)));
  return `${key} ${pool.length}`;
}).join(', ');
console.log(`Card data verification passed: ${Object.keys(cards).length} cards; reward pools ${poolSummary}; no unsafe zero-cost draw cards.`);
