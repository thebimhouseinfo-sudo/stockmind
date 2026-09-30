import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ANALYSIS_SOURCES,
  CRSM_PIPELINE_VERSION,
  CRSM_REQUEST_VERSION,
  CRSM_RESULT_VERSION,
  DECISION_RECORD_FIELDS,
  REQUIRED_RENDER_OUTPUT_KEYS,
  validateAnalysisItem,
  validateAnalysisRequest,
  validateAnalysisResult,
  validateEvidencePayload
} from '../src/crsm/contracts.js';

function fixture(name) {
  return JSON.parse(fs.readFileSync(new URL(`./fixtures/crsm/${name}.json`, import.meta.url), 'utf8'));
}

const screened = fixture('screened-web');
const evidence = fixture('evidence-web');
const webOnly = fixture('web-only');
const mixed = fixture('mixed-run');

assert.equal(CRSM_REQUEST_VERSION, 'crsm-request.v1');
assert.equal(CRSM_RESULT_VERSION, 'crsm-result.v1');
assert.equal(CRSM_PIPELINE_VERSION, 'crsm-pipeline.v1');
assert.deepEqual(Object.values(ANALYSIS_SOURCES), ['SCREENED_WEB', 'EVIDENCE_WEB', 'WEB_ONLY']);

for (const sample of [screened, evidence, webOnly]) {
  const requestCheck = validateAnalysisRequest(sample.request);
  assert.equal(requestCheck.valid, true, requestCheck.errors.join('\n'));

  const resultCheck = validateAnalysisResult(sample.result);
  assert.equal(resultCheck.valid, true, resultCheck.errors.join('\n'));

  for (const key of REQUIRED_RENDER_OUTPUT_KEYS) {
    assert.ok(key in sample.result.outputs, `fixture must include renderer output ${key}`);
  }

  for (const field of DECISION_RECORD_FIELDS) {
    assert.ok(field in sample.result.decision_record, `fixture decision_record missing ${field}`);
  }
}

const evidencePayloadCheck = validateEvidencePayload(evidence.evidence_payload);
assert.equal(evidencePayloadCheck.valid, true, evidencePayloadCheck.errors.join('\n'));

const mixedCheck = validateAnalysisRequest(mixed);
assert.equal(mixedCheck.valid, true, mixedCheck.errors.join('\n'));
assert.deepEqual(mixed.items.map(item => item.analysis_source), [
  'SCREENED_WEB',
  'EVIDENCE_WEB',
  'WEB_ONLY'
]);

const invalidScreened = structuredClone(screened.request.items[0]);
invalidScreened.evidence_refs = [evidence.request.items[0].evidence_refs[0]];
assert.equal(validateAnalysisItem(invalidScreened).valid, false);

const invalidEvidence = structuredClone(evidence.request.items[0]);
invalidEvidence.screening_context = { source: 'should-not-exist' };
assert.equal(validateAnalysisItem(invalidEvidence).valid, false);

const invalidWebOnly = structuredClone(webOnly.request.items[0]);
invalidWebOnly.screening_context = { source: 'should-not-exist' };
assert.equal(validateAnalysisItem(invalidWebOnly).valid, false);

const wrongTickerEvidence = structuredClone(evidence.request.items[0]);
wrongTickerEvidence.evidence_refs[0].ticker = 'VCB';
const wrongTickerCheck = validateAnalysisItem(wrongTickerEvidence);
assert.equal(wrongTickerCheck.valid, false);
assert.ok(wrongTickerCheck.errors.some(error => error.includes('must match owner ticker')));

const wrongItemEvidence = structuredClone(evidence.request.items[0]);
wrongItemEvidence.evidence_refs[0].item_id = 'different-item';
const wrongItemCheck = validateAnalysisItem(wrongItemEvidence);
assert.equal(wrongItemCheck.valid, false);
assert.ok(wrongItemCheck.errors.some(error => error.includes('must match owner item_id')));

const duplicateTicker = structuredClone(mixed);
duplicateTicker.items[2].ticker = 'VCB';
assert.equal(validateAnalysisRequest(duplicateTicker).valid, false);

const missingRendererOutput = structuredClone(webOnly.result);
delete missingRendererOutput.outputs.node6b;
assert.equal(validateAnalysisResult(missingRendererOutput).valid, false);

const mismatchedDecisionTicker = structuredClone(webOnly.result);
mismatchedDecisionTicker.decision_record.ticker = 'VCB';
assert.equal(validateAnalysisResult(mismatchedDecisionTicker).valid, false);

const driftedNode5 = structuredClone(screened.result);
driftedNode5.outputs.node5.scores.money_flow = driftedNode5.outputs.node5.scores.flow;
delete driftedNode5.outputs.node5.scores.flow;
driftedNode5.outputs.node5.decision = 'WAIT_FOR_ENTRY';
driftedNode5.outputs.node5.catalyst_horizon = '30-90d';
driftedNode5.outputs.node5.thesis_invalidation = ['array is not canonical'];
const driftedNode5Check = validateAnalysisResult(driftedNode5);
assert.equal(driftedNode5Check.valid, false);
assert.ok(driftedNode5Check.errors.some(error => error.includes('scores.flow')));
assert.ok(driftedNode5Check.errors.some(error => error.includes('decision must be')));
assert.ok(driftedNode5Check.errors.some(error => error.includes('catalyst_horizon must be an object')));
assert.ok(driftedNode5Check.errors.some(error => error.includes('thesis_invalidation must be')));

const degradedWithoutDisclosure = structuredClone(screened.result);
degradedWithoutDisclosure.outputs.node2.technical_coverage = {
  status: 'DEGRADED',
  required_sessions: 300,
  sessions_used: 42,
  missing_capabilities: [],
  note: 'missing OHLCV'
};
const degradedCheck = validateAnalysisResult(degradedWithoutDisclosure);
assert.equal(degradedCheck.valid, false);
assert.ok(degradedCheck.errors.some(error => error.includes('must name missing capabilities')));

const freeformVisual = structuredClone(screened.result);
freeformVisual.outputs.node6a = '<article><h1>Short report</h1></article>';
assert.equal(validateAnalysisResult(freeformVisual).valid, false);

const shortDetail = structuredClone(screened.result);
shortDetail.outputs.node6b = '# NT2\nShort summary';
assert.equal(validateAnalysisResult(shortDetail).valid, false);

console.log('CRSM migration contract tests passed.');
