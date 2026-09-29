import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ITEM_STATES,
  MEMO_SCHEMA_VERSION,
  MemoProtocolError,
  RUN_STATES,
  assertCanSubmit,
  assertEvidenceOwnedByItem,
  assertExactSha,
  assertResultCreateOnly,
  buildRunSummary,
  canSubmitNewRun,
  createCurrentForRun,
  createEmptyCurrent,
  createEmptyIndex,
  createStatusFromRequest,
  detectIndexOrphans,
  deriveRunState,
  failedItems,
  memoPaths,
  nextResumableItem,
  rebuildIndex,
  transitionItem,
  upsertRunSummary,
  validateCurrent,
  validateIndex,
  validateStatus
} from '../src/memo/protocol.js';

function fixture(name) {
  return JSON.parse(fs.readFileSync(new URL(`./fixtures/crsm/${name}.json`, import.meta.url), 'utf8'));
}

const mixed = fixture('mixed-run');
const evidence = fixture('evidence-web');

assert.equal(MEMO_SCHEMA_VERSION, 'stockmind-memo.v1');

const paths = memoPaths('run-mixed-001', 'hpg', 'doc-001');
assert.deepEqual(paths, {
  current: 'memo/current.json',
  index: 'memo/index.json',
  run_dir: 'memo/runs/run-mixed-001',
  request: 'memo/runs/run-mixed-001/request.json',
  status: 'memo/runs/run-mixed-001/status.json',
  result: 'memo/runs/run-mixed-001/results/HPG.json',
  evidence_dir: 'memo/runs/run-mixed-001/evidence/HPG',
  evidence: 'memo/runs/run-mixed-001/evidence/HPG/doc-001.json'
});
assert.throws(() => memoPaths('../escape'), error => error instanceof MemoProtocolError && error.code === 'MEMO_PATH_SEGMENT_INVALID');

const emptyCurrent = createEmptyCurrent();
assert.equal(validateCurrent(emptyCurrent).valid, true);
assert.equal(canSubmitNewRun(emptyCurrent), true);
assert.equal(assertCanSubmit(emptyCurrent), true);

const status0 = createStatusFromRequest(mixed, '2026-09-29T14:00:00.000Z');
assert.equal(validateStatus(status0).valid, true);
assert.equal(status0.state, RUN_STATES.READY);
assert.equal(status0.items.length, 3);
assert.ok(status0.items.every(item => item.state === ITEM_STATES.READY));

const current = createCurrentForRun(mixed, status0, '2026-09-29T14:00:00.000Z');
assert.equal(validateCurrent(current).valid, true);
assert.equal(current.run_id, mixed.run_id);
assert.equal(canSubmitNewRun(current), false);
assert.throws(() => assertCanSubmit(current), error => error.code === 'MEMO_ACTIVE_RUN_EXISTS');

assert.throws(
  () => transitionItem(status0, status0.items[0].item_id, ITEM_STATES.COMPLETED, { resultRef: 'x' }),
  error => error.code === 'MEMO_ITEM_TRANSITION_INVALID'
);

const firstId = status0.items[0].item_id;
const firstResultRef = memoPaths(mixed.run_id, status0.items[0].ticker).result;
const status1 = transitionItem(status0, firstId, ITEM_STATES.PROCESSING, { now: '2026-09-29T14:01:00.000Z' });
assert.equal(status1.state, RUN_STATES.PROCESSING);
assert.equal(status1.items[0].started_at, '2026-09-29T14:01:00.000Z');

const status2 = transitionItem(status1, firstId, ITEM_STATES.COMPLETED, {
  now: '2026-09-29T14:02:00.000Z',
  resultRef: firstResultRef
});
assert.equal(status2.items[0].result_ref, firstResultRef);
assert.equal(status2.state, RUN_STATES.PROCESSING);
assert.equal(nextResumableItem(status2).item_id, status2.items[1].item_id);

const secondId = status2.items[1].item_id;
let status3 = transitionItem(status2, secondId, ITEM_STATES.PROCESSING, { now: '2026-09-29T14:03:00.000Z' });
status3 = transitionItem(status3, secondId, ITEM_STATES.FAILED, {
  now: '2026-09-29T14:04:00.000Z',
  error: { code: 'FIXTURE_FAIL', message: 'fixture failure' }
});
assert.equal(failedItems(status3).length, 1);
assert.equal(status3.items[1].error.code, 'FIXTURE_FAIL');

const thirdId = status3.items[2].item_id;
let status4 = transitionItem(status3, thirdId, ITEM_STATES.PROCESSING, { now: '2026-09-29T14:05:00.000Z' });
status4 = transitionItem(status4, thirdId, ITEM_STATES.COMPLETED, {
  now: '2026-09-29T14:06:00.000Z',
  resultRef: memoPaths(mixed.run_id, status3.items[2].ticker).result
});
assert.equal(status4.state, RUN_STATES.PARTIAL);
assert.equal(canSubmitNewRun({ ...current, state: status4.state }), true);

const retry = transitionItem(status4, secondId, ITEM_STATES.READY, { now: '2026-09-29T14:07:00.000Z' });
assert.equal(retry.state, RUN_STATES.PROCESSING);
assert.equal(retry.items[1].error, null);
assert.equal(nextResumableItem(retry).item_id, secondId);

let completed = transitionItem(retry, secondId, ITEM_STATES.PROCESSING, { now: '2026-09-29T14:08:00.000Z' });
completed = transitionItem(completed, secondId, ITEM_STATES.COMPLETED, {
  now: '2026-09-29T14:09:00.000Z',
  resultRef: memoPaths(mixed.run_id, retry.items[1].ticker).result
});
assert.equal(completed.state, RUN_STATES.COMPLETED);
assert.equal(deriveRunState(completed.items), RUN_STATES.COMPLETED);
assert.equal(nextResumableItem(completed), null);

assert.equal(assertExactSha('abc', 'abc'), true);
assert.throws(() => assertExactSha('abc', 'def'), error => error.code === 'MEMO_SHA_CONFLICT');
assert.equal(assertResultCreateOnly(null), true);
assert.throws(() => assertResultCreateOnly('existing-sha'), error => error.code === 'MEMO_RESULT_IMMUTABLE');

const evidenceItem = evidence.request.items[0];
assert.equal(assertEvidenceOwnedByItem(evidenceItem.evidence_refs[0], evidenceItem), true);
const wrongEvidence = JSON.parse(JSON.stringify(evidenceItem.evidence_refs[0]));
wrongEvidence.ticker = 'VCB';
assert.throws(
  () => assertEvidenceOwnedByItem(wrongEvidence, evidenceItem),
  error => error.code === 'MEMO_EVIDENCE_OWNER_MISMATCH'
);

const summary = buildRunSummary(mixed, completed);
assert.equal(summary.state, RUN_STATES.COMPLETED);
assert.equal(summary.item_count, 3);
assert.equal(summary.completed_count, 3);

const index0 = createEmptyIndex();
assert.equal(validateIndex(index0).valid, true);
const index1 = upsertRunSummary(index0, summary, '2026-09-29T14:10:00.000Z');
assert.equal(index1.runs.length, 1);
const index2 = upsertRunSummary(index1, { ...summary, completed_at: '2026-09-29T14:11:00.000Z' }, '2026-09-29T14:11:00.000Z');
assert.equal(index2.runs.length, 1);
assert.equal(index2.runs[0].completed_at, '2026-09-29T14:11:00.000Z');

const rebuilt = rebuildIndex([summary], '2026-09-29T14:12:00.000Z');
assert.equal(rebuilt.runs.length, 1);
assert.equal(validateIndex(rebuilt).valid, true);

assert.deepEqual(detectIndexOrphans(rebuilt, [mixed.run_id, 'run-orphan-dir']), {
  missing_from_index: ['run-orphan-dir'],
  missing_run_dirs: []
});
assert.deepEqual(detectIndexOrphans(rebuilt, []), {
  missing_from_index: [],
  missing_run_dirs: [mixed.run_id]
});

const badStatus = JSON.parse(JSON.stringify(status0));
badStatus.state = RUN_STATES.COMPLETED;
assert.equal(validateStatus(badStatus).valid, false);

console.log('GitHub Memo protocol tests passed.');
