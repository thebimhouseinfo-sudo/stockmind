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
const node6aTemplate = read('skills/stockmind-crsm-methodology/references/NODE6A-LOCKED-TEMPLATE.md');
const node6bReport = read('skills/stockmind-crsm-methodology/references/NODE6B-FULL-REPORT.md');
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
assert.match(methodologyRef, /legacy Node 7 side effect/);
assert.match(methodologyRef, /decision_record/);
assert.match(methodology, /node1\.\.node5|Node 1–5/);
assert.match(methodology, /deterministic web renderer/i);
assert.match(methodology, /NODE6B-FULL-REPORT\.md/);
assert.match(methodologyRef, /technical_coverage/);
assert.match(methodologyRef, /DEGRADED/);
assert.match(node6aTemplate, /HTML TEMPLATE \(LOCKED/);
assert.match(node6aTemplate, /id="report"/);
assert.match(node6bReport, /DOCUMENT STRUCTURE/);
assert.match(node6bReport, /BÁO CÁO PHÂN TÍCH/);
assert.doesNotMatch(node6aTemplate, /\[SCREEN_CRSM_STATUS\]/);
assert.doesNotMatch(node6aTemplate, /\[SCREEN_CRSM_INTERPRETATION\]/);
assert.doesNotMatch(node6bReport, /\[SCREEN_CRSM_STATUS\]/);
assert.doesNotMatch(node6bReport, /\[SCREEN_CRSM_INTERPRETATION\]/);

assert.match(admission, /stockmind-crsm-methodology/);
assert.match(worker, /stockmind-crsm-methodology/);
assert.match(worker, /existing-result recovery check/);
assert.match(worker, /do not rerun CRSM/);
assert.match(githubRuntime, /PROCESSING recovery before analysis/);
assert.match(githubRuntime, /RESULT_RECOVERY_CONFLICT/);
assert.match(githubRuntime, /hard recovery invariants/i);
assert.match(githubRuntime, /Presentation drift is \*\*not\*\* a recovery conflict/i);
assert.match(githubRuntime, /valid pre-existing canonical result/);
assert.match(githubRuntime, /thebimhouseinfo-sudo\/stockmind/);
assert.match(githubRuntime, /Branch:\s*\n`runtime`/);
assert.match(githubRuntime, /`memo\/`/);

assert.match(methodology, /runLLM\(\).*Do \*\*not\*\* reproduce that layer/s);
assert.match(methodology, /Do not use browser model-provider API keys/);
assert.doesNotMatch(admission, /custom MCP/i);
assert.match(resultContract, /repository result is the durable output|analysis destination is GitHub/i);
assert.match(resultContract, /Visual Report HTML is not model-owned/i);
assert.match(resultContract, /NODE6B-FULL-REPORT\.md/);
assert.match(resultContract, /Hard vs soft consistency/);
assert.match(resultContract, /Node 5 \+ decision_record are canonical/);
assert.match(methodology, /SOFT — repair\/normalize, do not fail the item/);
assert.match(methodology, /reason first, serialize second/i);
assert.match(methodologyRef, /Analytical operating principle/);
assert.match(node6bReport, /QUALITY BAR/);
assert.match(node6bReport, /Vietnamese throughout|Vietnamese/i);
assert.match(node6aTemplate, /OUTPUT BOUNDARY/);
assert.doesNotMatch(node6aTemplate, /FINAL EXECUTION RULE/);

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
