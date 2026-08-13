import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const normalizeSeedSource = html.match(/function normalizeSeed\([\s\S]*?\n}/)?.[0];
const createSeededRngSource = html.match(/function createSeededRng\([\s\S]*?\n}/)?.[0];

if (!normalizeSeedSource || !createSeededRngSource) {
  throw new Error('Cannot extract gameplay RNG implementation');
}

const {createSeededRng} = vm.runInNewContext(
  `${normalizeSeedSource}\n${createSeededRngSource}\n({createSeededRng})`,
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const sequence = (rng, count) => Array.from({length: count}, () => rng.next());
const seed = 0x12345678;
const first = createSeededRng(seed);
const second = createSeededRng(seed);
assert(JSON.stringify(sequence(first, 64)) === JSON.stringify(sequence(second, 64)), 'same seed must reproduce the same sequence');

const source = createSeededRng(seed);
sequence(source, 17);
const saved = {seed: source.seed, state: source.state, calls: source.calls};
const expectedTail = sequence(source, 32);
const restored = createSeededRng(saved.seed, saved.state, saved.calls);
assert(JSON.stringify(sequence(restored, 32)) === JSON.stringify(expectedTail), 'saved RNG state must resume the same sequence');
assert(restored.calls === saved.calls + 32, 'RNG call counter must survive restore');

const gameplay = createSeededRng(seed);
sequence(gameplay, 9);
const beforePresentation = {state: gameplay.state, calls: gameplay.calls};
for (let i = 0; i < 10000; i++) Math.random();
assert(gameplay.state === beforePresentation.state && gameplay.calls === beforePresentation.calls, 'presentation randomness must not mutate gameplay RNG');

const directRandomUses = [...html.matchAll(/Math\.random\(\)/g)];
assert(directRandomUses.length === 1, `expected one presentation-only Math.random call, found ${directRandomUses.length}`);
assert(html.includes('const visualRandom=()=>Math.random();'), 'Math.random must be isolated behind visualRandom');
assert(html.includes("visualShuffle([...this.drawPile])"), 'viewing the draw pile must use presentation randomness');
assert(!html.includes("shuffle([...this.drawPile])"), 'viewing the draw pile must not consume gameplay randomness');
assert(html.includes('runSeed:GAME_RNG.seed,rngState:GAME_RNG.state,rngCalls:GAME_RNG.calls'), 'save data must include gameplay RNG state');

console.log('Gameplay RNG verification passed: deterministic sequence, resumable state, presentation isolation, persisted state.');
