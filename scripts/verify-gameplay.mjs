import {loadGameRuntime} from './runtime-harness.mjs';

const {context, G, html, resetRng, rngState} = loadGameRuntime();
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

function allPathRanges(nodes, types) {
  const ranges = new Map();
  const ordered = Object.keys(nodes).sort((a, b) => nodes[b].r - nodes[a].r);
  for (const key of ordered) {
    const node = nodes[key];
    const edges = [...node.edges];
    if (key !== 'boss') assert(edges.length > 0, `non-boss node ${key} is a dead end`);
    const result = {};
    for (const type of types) {
      const own = node.t === type ? 1 : 0;
      if (!edges.length) result[type] = {min: own, max: own};
      else {
        const next = edges.map(edge => {
          assert(nodes[edge], `map edge points to missing node ${edge}`);
          assert(ranges.has(edge), `map contains a non-forward edge from ${key} to ${edge}`);
          return ranges.get(edge)[type];
        });
        result[type] = {
          min: own + Math.min(...next.map(value => value.min)),
          max: own + Math.max(...next.map(value => value.max)),
        };
      }
    }
    ranges.set(key, result);
  }
  return ranges;
}

function verifyMap(seed) {
  resetRng(seed);
  G.genMap();
  const {nodes} = G;
  const rules = context.MAP_RULES;
  const starts = Object.keys(nodes).filter(key => nodes[key].r === 1);
  assert(starts.length > 0, `seed ${seed}: no route starts`);
  const pathRanges = allPathRanges(nodes, ['elite', 'rest', 'chest', 'unknown']);
  let decisionRows = 0;
  for (let row = 1; row <= rules.rows; row++) {
    const rowNodes = Object.values(nodes).filter(node => node.r === row);
    const types = new Set(rowNodes.map(node => node.t));
    if (types.size > 1) decisionRows++;
    if (rowNodes.length > 1) {
      assert(!rowNodes.every(node => node.t === 'chest'), `seed ${seed}: whole row ${row} is chest`);
      assert(!rowNodes.every(node => node.t === 'rest'), `seed ${seed}: whole row ${row} is rest`);
    }
    if (row < rules.rows) {
      const edges = rowNodes.flatMap(node => [...node.edges]
        .map(next => ({from: node, to: nodes[next]}))
        .filter(edge => edge.to?.r === row + 1));
      for (let a = 0; a < edges.length; a++) for (let b = a + 1; b < edges.length; b++) {
        const first = edges[a], second = edges[b];
        if (first.from === second.from || first.to === second.to) continue;
        assert((first.from.c - second.from.c) * (first.to.c - second.to.c) >= 0, `seed ${seed}: crossing edges at row ${row}`);
      }
    }
  }
  assert(decisionRows >= 6, `seed ${seed}: only ${decisionRows} rows offer distinct node types`);
  for (const start of starts) {
    const {elite: elites, rest: rests, chest: chests, unknown: unknowns} = pathRanges.get(start);
    assert(elites.min >= rules.minElitePerRoute, `seed ${seed}: route misses minimum elites`);
    assert(elites.max <= rules.maxElitePerRoute, `seed ${seed}: route exceeds maximum elites`);
    assert(rests.min >= 1, `seed ${seed}: route has no rest`);
    assert(chests.min === 1 && chests.max === 1, `seed ${seed}: route must have exactly one chest`);
    assert(unknowns.max <= rules.maxUnknownPerRoute, `seed ${seed}: route exceeds unknown limit`);
  }
  for (const node of Object.values(nodes)) {
    if (node.t === 'elite') assert(node.r > rules.noEliteBefore, `seed ${seed}: elite appears too early`);
    for (const nextKey of node.edges) {
      const next = nodes[nextKey];
      assert(!(node.t === 'elite' && next.t === 'elite'), `seed ${seed}: consecutive elites`);
      assert(!(node.t === 'rest' && next.t === 'rest'), `seed ${seed}: consecutive rests`);
    }
  }
}

for (let seed = 1; seed <= 10000; seed++) verifyMap(seed);

for (const act of [0, 1, 2]) {
  for (const floor of [1, 6, 12]) {
    G.act = act;
    G.row = floor;
    G.seenEvents = [];
    G.eventHistory = [];
    const recentEvents = [];
    for (let seed = 1; seed <= 200; seed++) {
      resetRng(seed);
      const index = G.rollEventIndex();
      const event = context.EVENTS[index];
      assert(event && event.acts.includes(act), `act ${act}: ineligible event ${event?.id}`);
      assert(!recentEvents.slice(-context.MAP_RULES.eventRecentWindow).includes(event.id), `act ${act}: event repeated inside recent window`);
      recentEvents.push(event.id);
      G.eventHistory.push(event.id);
    }

    G.encounterHistory = [];
    const recentEncounters = [];
    for (let seed = 1; seed <= 200; seed++) {
      resetRng(seed);
      const encounter = G.rollEncounter();
      assert(encounter.min <= G.row && encounter.max >= G.row, `act ${act}: encounter ${encounter.id} outside floor range`);
      assert(!recentEncounters.slice(-context.MAP_RULES.encounterRecentWindow).includes(encounter.id), `act ${act}: encounter repeated inside recent window`);
      recentEncounters.push(encounter.id);
    }
  }

  const onceEvent = context.EVENTS.find(event => event.oncePerRun && event.acts.includes(act));
  if (onceEvent) {
    G.seenEvents = [onceEvent.id];
    G.eventHistory = [];
    assert(!G.eligibleEvents().some(({event}) => event.id === onceEvent.id), `act ${act}: once-per-run event remained eligible`);
  }
}

const eventIds = context.EVENTS.map(event => event.id);
assert(new Set(eventIds).size === eventIds.length, 'event ids must be unique');
assert(context.EVENTS.every(event => event.id && event.acts?.length && event.weight > 0), 'events must define stable ids, acts and positive weights');

resetRng(424242);
G.character = 'sasuke';
G.maxHp = 74;
G.hp = 51;
G.gold = 123;
G.act = 1;
G.row = 4;
G.curCol = 2;
G.deck = [context.mkCard('taijutsu'), context.mkCard('chidori', true)];
G.relics = ['fuuma'];
G.potions = ['heisyo'];
G.stats = {dmg: 12, kills: 2, cards: 5, turns: 3, elites: 1};
G.permStr = 1;
G.removeCount = 2;
G.seenEvents = ['wounded_ally'];
G.eventHistory = ['ichiraku', 'wounded_ally'];
G.encounterHistory = ['curse_guard', 'spider_archer'];
G.genMap();
G.activeNode = {key: Object.keys(G.nodes).find(key => G.nodes[key].r === 4), nodeType: 'event', phase: 'event', payload: {eventId: 'wounded_ally', stage: 'choice', result: null}};
G.saveRun();
const saved = G.readSave();
assert(saved?.version === 5, 'save round trip must use schema v5');
assert(JSON.stringify(saved.seenEvents) === JSON.stringify(G.seenEvents), 'save round trip must preserve seen events');
assert(JSON.stringify(saved.eventHistory) === JSON.stringify(G.eventHistory), 'save round trip must preserve event history');
assert(JSON.stringify(saved.encounterHistory) === JSON.stringify(G.encounterHistory), 'save round trip must preserve encounter history');
assert(saved.activeNode?.payload?.eventId === 'wounded_ally', 'save round trip must preserve a stable active event id');

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
G.maxHp = 80;
G.hp = 80;
G.gold = 500;
G.deck = [context.mkCard('taijutsu'), context.mkCard('kawarimi')];
G.relics = [];
G.potions = [];
G.permStr = 0;
assert(G.addRelic('headband') === true && G.addRelic('headband') === false, 'relic acquisition must reject duplicates');
assert(G.relics.filter(key => key === 'headband').length === 1 && G.permStr === 1, 'duplicate relic effects must not stack');

const rewardCard = {key: 'rasengan', upgraded: false};
G.activeNode = {key: '1-0', nodeType: 'fight', phase: 'reward', payload: {
  rewardType: 'combat', choices: [rewardCard], cardPicked: false, selectedCard: null,
  potion: 'heisyo', potionTaken: false,
}};
const rewardDeckSize = G.deck.length;
assert(G.takeCard(0) === true, 'first card reward claim must succeed');
assert(G.takeCard(0) !== true && G.deck.length === rewardDeckSize + 1, 'card reward must be claimable only once');
assert(G.takePotion() === true, 'first potion reward claim must succeed');
assert(G.takePotion() === false && G.potions.length === 1, 'potion reward must be claimable only once');

G.gold = 500;
G.deck = [context.mkCard('taijutsu'), context.mkCard('kawarimi')];
G.relics = [];
G.potions = [];
G.shopCards = [context.mkCard('rasengan')];
G.shopPrices = [65];
G.shopRelics = ['headband'];
G.shopPotion = 'heisyo';
G.removeUsed = false;
G.activeNode = {key: '1-0', nodeType: 'shop', phase: 'shop', payload: {
  cards: [{key: 'rasengan', upgraded: false}], prices: [65], relics: ['headband'], potion: 'heisyo', removeUsed: false,
}};
assert(G.buyCard(0) === true && G.buyCard(0) === false && G.gold === 435, 'shop card must charge and award exactly once');
assert(G.buyRelic(0) === true && G.buyRelic(0) === false && G.gold === 260, 'shop relic must charge and award exactly once');
assert(G.buyPotion() === true && G.buyPotion() === false && G.gold === 210, 'shop potion must charge and award exactly once');

G.relics = [];
G.gold = 0;
G.activeNode = {key: '4-0', nodeType: 'chest', phase: 'chest', payload: null};
assert(G.openChest() === true, 'opening a fresh chest must succeed');
const chestState = JSON.stringify({payload: G.activeNode.payload, relics: G.relics, gold: G.gold, rng: rngState()});
assert(G.openChest() === true, 'reopening a resolved chest must restore its view');
assert(JSON.stringify({payload: G.activeNode.payload, relics: G.relics, gold: G.gold, rng: rngState()}) === chestState, 'reopening a chest must not reroll or duplicate its reward');

const event = context.EVENTS.find(item => item.id === 'ichiraku');
G.maxHp = 80;
G.hp = 80;
G.activeNode = {key: '5-0', nodeType: 'event', phase: 'event', payload: {eventIndex: context.EVENTS.indexOf(event), stage: 'choice', result: null}};
assert(G.openEvent(G.activeNode.payload) === true, 'legacy indexed event saves must still restore');
assert(G.activeNode.payload.eventId === event.id && !('eventIndex' in G.activeNode.payload), 'legacy event saves must migrate to a stable event id');
G.activeNode = {key: '5-0', nodeType: 'event', phase: 'event', payload: {eventId: event.id, stage: 'choice', result: null}};
G._event = event;
G._eventId = event.id;
assert(G.eventChoice(1) === true && G.maxHp === 86, 'first event choice must resolve its effect');
assert(G.eventChoice(1) === false && G.maxHp === 86, 'resolved event choices must not execute twice');

G.hp = 10;
G.maxHp = 100;
G.relics = [];
G.activeNode = {key: '6-0', nodeType: 'rest', phase: 'rest', payload: {resolved: false}};
assert(G.restHeal(9999) === true && G.hp === 40, 'rest healing must compute its own bounded amount');
assert(G.restHeal(9999) === false && G.hp === 40, 'a rest choice must resolve only once');

G.deck = [context.mkCard('taijutsu'), context.mkCard('kawarimi')];
let pickedCards = 0;
G.pickFromDeck('test', card => !card.upgraded, () => { pickedCards++; });
context.upgradeCard(G.deck[0]);
G._dp(0);
assert(pickedCards === 0, 'deck picker must revalidate its filter at execution time');
G.closeOverlay();

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
assert(html.includes("version:5"), 'save schema must persist active nodes and histories');
assert(html.includes('seenEvents:this.seenEvents||[]'), 'save schema must persist event history');
assert(html.includes("dealDamage(t,layers*c.burnBurst,'status')"), 'burn detonation must use status damage');
assert(rngState().calls > 0, 'gameplay verification should exercise the real RNG');

console.log('Gameplay verification passed: 10,000 maps, event/encounter pools, rewards, healing, damage and boss rules.');
