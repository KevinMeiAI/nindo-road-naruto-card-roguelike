import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

function uniqueMatches(pattern) {
  return [...new Set([...html.matchAll(pattern)].map(match => match[0]))];
}

function runtimePath(source) {
  const parsed = path.parse(source);
  return path.join('assets', 'runtime', path.basename(parsed.dir), `${parsed.name}.webp`);
}

const groups = [
  {name: 'card artwork', sources: uniqueMatches(/assets\/card-art\/[^" ]+\.jpg/g), maxBytes: 90_000},
  {name: 'sprite', sources: uniqueMatches(/assets\/sprites\/[^" ]+\.png/g), maxBytes: 300_000},
  {name: 'background', sources: fs.readdirSync(path.join(root, 'assets/backgrounds')).filter(name => name.endsWith('.jpg')).map(name => `assets/backgrounds/${name}`), maxBytes: 350_000},
];

let sourceBytes = 0;
let runtimeBytes = 0;
const expectedRuntimeFiles = new Set();
for (const group of groups) {
  assert(group.sources.length > 0, `${group.name}: no source files found`);
  for (const source of group.sources) {
    const sourceFile = path.join(root, source);
    const generated = runtimePath(source);
    const generatedFile = path.join(root, generated);
    expectedRuntimeFiles.add(generated);
    assert(fs.existsSync(sourceFile), `${group.name}: missing source ${source}`);
    assert(fs.existsSync(generatedFile), `${group.name}: missing runtime asset ${generated}`);
    if (!fs.existsSync(sourceFile) || !fs.existsSync(generatedFile)) continue;
    const sourceSize = fs.statSync(sourceFile).size;
    const generatedSize = fs.statSync(generatedFile).size;
    sourceBytes += sourceSize;
    runtimeBytes += generatedSize;
    assert(generatedSize > 0, `${group.name}: empty runtime asset ${generated}`);
    assert(generatedSize <= group.maxBytes, `${group.name}: ${generated} is ${(generatedSize / 1024).toFixed(1)} KiB (limit ${(group.maxBytes / 1024).toFixed(1)} KiB)`);
  }
}

function walkFiles(directory) {
  return fs.readdirSync(directory, {withFileTypes: true}).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(file) : [file];
  });
}
for (const file of walkFiles(path.join(root, 'assets/runtime'))) {
  const relative = path.relative(root, file);
  assert(expectedRuntimeFiles.has(relative), `orphan runtime asset: ${relative}`);
}

assert(html.includes('function runtimeAssetPath('), 'runtime asset path resolver is missing');
assert(html.includes('loading="${eager?\'eager\':\'lazy\'}" decoding="async"'), 'card artwork must load lazily by default and decode asynchronously');
assert(runtimeBytes < sourceBytes * 0.25, `runtime assets should be below 25% of source bytes, got ${(runtimeBytes / sourceBytes * 100).toFixed(1)}%`);

if (errors.length) {
  console.error(errors.map(error => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log(`Asset verification passed: ${(sourceBytes / 1048576).toFixed(1)} MiB source -> ${(runtimeBytes / 1048576).toFixed(1)} MiB runtime (${(runtimeBytes / sourceBytes * 100).toFixed(1)}%).`);
