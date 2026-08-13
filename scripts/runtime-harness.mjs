import fs from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';
import {webcrypto} from 'node:crypto';

function makeClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    toggle: (name, force) => {
      const enabled = force === undefined ? !values.has(name) : !!force;
      if (enabled) values.add(name); else values.delete(name);
      return enabled;
    },
    contains: name => values.has(name),
  };
}

function makeElement() {
  return {
    classList: makeClassList(),
    dataset: {},
    style: {},
    innerHTML: '',
    textContent: '',
    clientWidth: 800,
    clientHeight: 600,
    scrollHeight: 1000,
    scrollTop: 0,
    appendChild() {},
    remove() {},
    setAttribute() {},
    getAttribute() { return null; },
    getBoundingClientRect() { return {left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100}; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
}

export function loadGameRuntime() {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };
  const storage = new Map();
  const document = {
    documentElement: makeElement(),
    getElementById: element,
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement: makeElement,
  };
  const context = vm.createContext({
    console,
    document,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: key => storage.delete(key),
      clear: () => storage.clear(),
    },
    performance,
    crypto: webcrypto,
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame: callback => { callback(); return 0; },
    cancelAnimationFrame() {},
    getComputedStyle: () => ({getPropertyValue: () => '126'}),
    MouseEvent: class MouseEvent {},
    Uint32Array,
    Math,
    Date,
  });
  context.window = context;
  context.globalThis = context;
  context.addEventListener = () => {};
  context.innerWidth = 1440;
  context.innerHeight = 900;
  vm.runInContext(scripts.join('\n'), context, {filename: 'index.html'});

  return {
    context,
    html,
    G: context.G,
    resetRng(seed, state = seed, calls = 0) {
      vm.runInContext(`resetGameplayRng(${seed >>> 0},${state >>> 0},${calls})`, context);
    },
    rngState() {
      return vm.runInContext('({seed:GAME_RNG.seed,state:GAME_RNG.state,calls:GAME_RNG.calls})', context);
    },
  };
}
