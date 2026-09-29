import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const pluginRoot = path.join(root, 'plugin', 'stockmind-web');

function read(relative) {
  return fs.readFileSync(path.join(pluginRoot, relative), 'utf8');
}

const registry = read('HARNESS-REGISTRY.md');
const admission = read('skills/stockmind-admission/SKILL.md');
const githubRuntime = read('skills/stockmind-github-runtime/SKILL.md');
const worker = read('skills/stockmind-worker-loop/SKILL.md');
const methodology = read('skills/stockmind-crsm-methodology/SKILL.md');
const methodologyRef = read('skills/stockmind-crsm-methodology/references/CRSM-METHODOLOGY.md');
const resultContract = read('skills/stockmind-result-contract/SKILL.md');

assert.equal(
  fs.existsSync(path.join(pluginRoot, 'mcp.json')),
  false,
  'stockmind-web must remain skill-only and must not contain mcp.json'
);

const order = [
  'stockmind-admission',
  'stockmind-github-runtime',
  'stockmind-worker-loop',
  'stockmind-crsm-methodology',
  'stockmind-result-contract'
].map(name => registry.indexOf(name));
assert.ok(order.every(index => index >= 0), 'all required harness layers must be registered');
for (let i = 1; i < order.length; i += 1) {
  assert.ok(order[i] > order[i - 1], 'harness layer order must remain canonical');
}

for (const mode of ['SCREENED_WEB', 'EVIDENCE_WEB', 'WEB_ONLY']) {
  assert.match(methodology + methodologyRef + worker, new RegExp(mode));
}

assert.match(methodologyRef, /Fundamental: 30%/);
assert.match(methodologyRef, /Valuation: 20%/);
assert.match(methodologyRef, /Technical: 15%/);
assert.match(methodologyRef, /Money Flow: 15%/);
assert.match(methodologyRef, /Sector\/Macro: 10%/);
assert.match(methodologyRef, /Risk: 10%/);

assert.match(methodologyRef, /do not output `screen_vs_crsm`/);
assert.match(methodologyRef, /Node7 browser-local side effect/);
assert.match(methodologyRef, /decision_record/);
assert.match(methodologyRef, /node1\.\.node6b/);

assert.match(admission, /stockmind-crsm-methodology/);
assert.match(worker, /stockmind-crsm-methodology/);
assert.match(githubRuntime, /thebimhouseinfo-sudo\/stockmind/);
assert.match(githubRuntime, /branch:\s*`runtime`/);
assert.match(githubRuntime, /`memo\/`/);

assert.doesNotMatch(methodology, /runLLM\(/);
assert.doesNotMatch(methodologyRef, /runLLM\(/);
assert.doesNotMatch(admission, /custom MCP/i);
assert.match(resultContract, /repository result is the durable output|analysis destination is GitHub/i);

const prohibited = [
  'choose the next ticker',
  'second user command'
];
for (const phrase of prohibited) {
  assert.ok(
    !worker.toLowerCase().includes('ask the user to ' + phrase),
    'worker must not introduce user interaction between items'
  );
}

console.log('Stockmind Web plugin harness tests passed.');
