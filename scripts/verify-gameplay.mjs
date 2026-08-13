import {loadGameRuntime} from './runtime-harness.mjs';

const {context, G, html, resetRng, rngState} = loadGameRuntime();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function enumerateRoutes(nodes) {
  const starts = Object.keys(nodes).filter(key => nodes[key].r === 1);
  const routes = [];
  const visit = (key, path = [], seen = new Set()) => {
    assert(!seen.has(key), `map contains a cycle at ${key}`);
    const nextSeen = new Set(seen).add(key);
    const nextPath = [...path, key];
    if (key === 'boss') { routes.push(nextPath); return; }
    const edges = [...nodes[key].edges];
    assert(edges.length > 0, `non-boss node ${key} is a dead end`);
    edges.forEach(next => visit(next, nextPath, nextSeen));
  };
  starts.forEach(start => visit(start));
  return routes;
}

function verifyMap(seed) {
  resetRng(seed);
  G.genMap();
  const {nodes} = G;
  const rules = context.MAP_RULES;
  const routes = enumerateRoutes(nodes);
  assert(routes.length > 0, `seed ${seed}: no route reaches boss`);
  for (const route of routes) {
    const types = route.map(key => nodes[key].t);
    const count = type => types.filter(value => value === type).length;
    assert(count('elite') >= rules.minElitePerRoute, `seed ${seed}: route misses minimum elites`);
    assert(count('elite') <= rules.maxElitePerRoute, `seed ${seed}: route exceeds maximum elites`);
    assert(count('rest') >= 1, `seed ${seed}: route has no rest`);
    assert(count('chest') === 1, `seed ${seed}: route must have exactly one chest`);
    assert(count('unknown') <= rules.maxUnknownPerRoute, `seed ${seed}: route exceeds unknown limit`);
    for (let i = 0; i < route.length - 1; i++) {
      const node = nodes[route[i]], next = nodes[route[i + 1]];
      assert(!(node.t === 'elite' && next.t === 'elite'), `seed ${seed}: consecutive elites`);
      assert(!(node.t === 'rest' && next.t === 'rest'), `seed ${seed}: consecutive rests`);
      if (node.t === 'elite') assert(node.r > rules.noEliteBefore, `seed ${seed}: elite appears too early`);
    }
  }
}

for (let seed = 1; seed <= 10000; seed++) verifyMap(seed);

const characters = ['naruto', 'sasuke', 'sakura'];
for (const character of characters) {
  G.character = character;
  for (let seed = 1; seed <= 2000; seed++) {
    resetRng(seed);
    for (const kind of ['fight', 'elite']) {
      const cards = G.combatRewardCards(kind);
      assert(cards.length === 3, `${character}/${kind}/${seed}: reward must contain three cards`);
      assert(new Set(cards.map(card => card.key)).size === cards.length, `${character}/${kind}/${seed}: duplicate reward cards`);
      if (kind === 'elite') assert(cards.every(card => card.r >= 2), `${character}/${seed}: elite reward contains a common card`);
      else assert(cards.every(card => card.r >= 1 && card.r <= 3), `${character}/${seed}: normal reward rarity is invalid`);
    }
    const bossCards = G.randomCards(3, 2);
    assert(new Set(bossCards.map(card => card.key)).size === 3, `${character}/boss/${seed}: duplicate boss reward cards`);
    assert(bossCards.every(card => card.r >= 2), `${character}/${seed}: boss reward contains a common card`);
  }
}

G.character = 'naruto';
G.act = 0;
G.row = 1;
G.relics = ['fuuma', 'kyuubi_seal'];
G.energy = 3;
G.firstAtk = true;
G.firstSkl = true;
G.str = 0;
G.weak = 0;
G.vuln = 0;
G.might = 0;
G.healMight = 0;
G.blockMight = 0;
G.skillsPlayed = 0;
G.attacksPlayed = 0;
G.clones = 0;
G.block = 0;
G.overhealPower = 0;
G.vulnDrawPower = 0;
G.vulnDrawReady = false;
G.vulnDrawConsumed = false;
const enemy = {hp: 100, maxHp: 100, block: 0, str: 0, weak: 0, vuln: 0, burn: 0, stealth: 0, thorns: 0, phase2done: false, intent: {}};
G.enemies = [enemy];
G.flashRelic = () => {};
G.fxText = () => {};
G.playerEl = () => null;
const realDealDamage = G.dealDamage;
const hitDamage = [];
G.dealDamage = (target, amount) => { hitDamage.push(amount); target.hp -= amount; };
G.execCard(context.mkCard('uzumaki_barrage'), enemy);
assert(JSON.stringify(hitDamage) === JSON.stringify([12, 2, 2]), `first-attack relic bonus must affect one hit, got ${hitDamage.join('/')}`);
G.dealDamage = realDealDamage;

G.maxHp = 100;
G.hp = 50;
G.deck = [];
G.potions = [];
G.combatHealingUsed = 0;
const firstHeal = G.healFromCard(10);
const secondHeal = G.healFromCard(10);
const thirdHeal = G.healFromCard(10);
assert(firstHeal.offered === 10 && secondHeal.offered === 8 && thirdHeal.offered === 0, 'card healing must share an 18-point combat budget');
assert(G.hp === 68 && G.combatHealingUsed === 18, 'card healing must stop after the combat budget is exhausted');
G.heal(10);
assert(G.hp === 78 && G.combatHealingUsed === 18, 'non-card healing must not consume the combat card-healing budget');
G.hp = G.maxHp;
G.combatHealingUsed = 0;
const overheal = G.healFromCard(10);
assert(overheal.offered === 10 && overheal.healed === 0 && overheal.overflow === 10 && G.combatHealingUsed === 10, 'overheal value must consume the shared combat budget');

G.stats = {dmg: 0, kills: 0, cards: 0, turns: 0, elites: 0};
G.hp = 50;
G.block = 0;
G.enemies = [];
const statusTarget = {hp: 50, maxHp: 50, block: 20, stealth: 2, thorns: 5, boss: 0, phase2: null};
G.enemies = [statusTarget];
G.dealDamage(statusTarget, 10, 'status');
assert(statusTarget.hp === 40 && statusTarget.block === 20 && statusTarget.stealth === 2, 'status damage must ignore block and stealth without consuming them');
assert(G.hp === 50, 'status damage must not trigger reflection');

const lethalTarget = {hp: 5, maxHp: 5, block: 0, stealth: 0, thorns: 4, boss: 0, phase2: null};
G.enemies = [lethalTarget];
G.hp = 50;
G.dealDamage(lethalTarget, 10, 'attack');
assert(lethalTarget.hp <= 0 && G.hp === 46, 'a lethal attack must still trigger reflection');

const phaseTarget = {
  hp: 5, maxHp: 100, block: 9, stealth: 1, thorns: 0, burn: 6, weak: 3, vuln: 2,
  boss: 1, phase2done: false, mi: 0, tc: 0, str: 0, regen: 0, grow: null,
  phase2: {n: 'phase two', sp: 'P2', hpRatio: 0.5, str: 1, moves: [{a: 1, txt: 'phase move'}], special: null, regen: 0, stealth: 0, thorns: 0},
};
G.enemies = [phaseTarget];
G.combatKind = 'boss';
G.dealDamage(phaseTarget, 10, 'status');
assert(phaseTarget.phase2done && phaseTarget.hp === 50, 'lethal damage must transition a boss to phase two');
assert(phaseTarget.block === 0 && phaseTarget.burn === 0 && phaseTarget.weak === 0 && phaseTarget.vuln === 0, 'boss phase transition must clear block and negative statuses');

assert(html.includes("!this.availableNodeKeys().has(k)"), 'enterNode must validate route reachability');
assert(html.includes("version:4"), 'save schema must persist active nodes');
assert(html.includes("this.activeNode.payload.cardPicked=true"), 'selected reward state must be persisted');
assert(html.includes("option.cond&&!option.cond(this)"), 'event choices must revalidate conditions');
assert(html.includes("dealDamage(t,layers*c.burnBurst,'status')"), 'burn detonation must use status damage');
assert(rngState().calls > 0, 'gameplay verification should exercise the real RNG');

console.log('Gameplay verification passed: 10,000 maps, rewards, first-hit relics, healing cap, damage kinds, boss phase rules.');
