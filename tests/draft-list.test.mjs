import assert from 'node:assert/strict';
import {
  addManualTicker,
  addScreenedTicker,
  attachDocuments,
  buildSubmission,
  clearDraft,
  createEmptyDraft,
  draftSummary,
  findTicker,
  loadDraft,
  removeDocument,
  removeItem,
  saveDraft
} from '../src/crsm/draft-list.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, value); },
    removeItem(key) { map.delete(key); }
  };
}

let draft = createEmptyDraft('2026-09-29T15:00:00.000Z');
let result = addManualTicker(draft, ' fpt ', {
  itemId: 'item-fpt',
  now: '2026-09-29T15:01:00.000Z'
});
assert.equal(result.changed, true);
draft = result.draft;
assert.equal(draft.items[0].ticker, 'FPT');
assert.equal(draft.items[0].analysis_source, 'WEB_ONLY');

const duplicate = addManualTicker(draft, 'FPT', { itemId: 'other' });
assert.equal(duplicate.changed, false);
assert.equal(duplicate.reason, 'DUPLICATE');
assert.equal(duplicate.draft.items.length, 1);

const screenedConflict = addScreenedTicker(
  draft,
  'FPT',
  { source: 'StockScreenerV2', ticker: 'FPT' },
  { itemId: 'screened-fpt' }
);
assert.equal(screenedConflict.changed, false);
assert.equal(screenedConflict.reason, 'SOURCE_CONFLICT');
assert.equal(findTicker(draft, 'FPT').analysis_source, 'WEB_ONLY');

const attached = attachDocuments(draft, 'item-fpt', [{
  document_id: 'doc-fpt-1',
  name: 'FPT-report.txt',
  type: 'text/plain',
  bytes: 200,
  checksum: 'sha256-fixture-fpt',
  source: 'USER_UPLOAD',
  kind: 'financial_report',
  routing: ['node3'],
  content: 'FPT fixture evidence'
}], { now: '2026-09-29T15:02:00.000Z' });
assert.equal(attached.changed, true);
draft = attached.draft;
assert.equal(draft.items[0].analysis_source, 'EVIDENCE_WEB');
assert.equal(draft.items[0].documents.length, 1);

const screenedAfterEvidence = addScreenedTicker(
  draft,
  'FPT',
  { source: 'StockScreenerV2', ticker: 'FPT' },
  { itemId: 'screened-fpt' }
);
assert.equal(screenedAfterEvidence.reason, 'SOURCE_CONFLICT');
assert.equal(findTicker(draft, 'FPT').analysis_source, 'EVIDENCE_WEB');

result = addScreenedTicker(
  draft,
  'VCB',
  {
    source: 'StockScreenerV2',
    ticker: 'VCB',
    screening_as_of: '2026-09-29',
    screening_summary: { screen_score: 80, screen_rank: 1, screen_grade: 'A' }
  },
  { itemId: 'item-vcb', now: '2026-09-29T15:03:00.000Z' }
);
assert.equal(result.changed, true);
draft = result.draft;
assert.equal(findTicker(draft, 'VCB').analysis_source, 'SCREENED_WEB');

const forbidden = attachDocuments(draft, 'item-vcb', [{
  document_id: 'doc-vcb-1',
  name: 'VCB.txt',
  checksum: 'hash',
  content: 'forbidden'
}]);
assert.equal(forbidden.changed, false);
assert.equal(forbidden.reason, 'SCREENED_EVIDENCE_FORBIDDEN');

const submission = buildSubmission(draft, {
  runId: 'run-pack4-fixture',
  now: '2026-09-29T15:04:00.000Z'
});
assert.equal(submission.request.items.length, 2);
assert.equal(submission.evidence_payloads.length, 1);
assert.equal(submission.request.items[0].analysis_source, 'EVIDENCE_WEB');
assert.equal(
  submission.request.items[0].evidence_refs[0].repository_path,
  'memo/runs/run-pack4-fixture/evidence/FPT/doc-fpt-1.json'
);
assert.equal(submission.evidence_payloads[0].item_id, 'item-fpt');
assert.equal(submission.evidence_payloads[0].ticker, 'FPT');
assert.equal(submission.request.items[1].analysis_source, 'SCREENED_WEB');
assert.deepEqual(submission.request.items[1].evidence_refs, []);

assert.deepEqual(draftSummary(draft), {
  total: 2,
  SCREENED_WEB: 1,
  EVIDENCE_WEB: 1,
  WEB_ONLY: 0
});

const storage = memoryStorage();
saveDraft(draft, storage, '2026-09-29T15:05:00.000Z');
const restored = loadDraft(storage);
assert.equal(restored.items.length, 2);
assert.equal(restored.items[0].documents[0].document_id, 'doc-fpt-1');

let withoutDoc = removeDocument(restored, 'item-fpt', 'doc-fpt-1').draft;
assert.equal(findTicker(withoutDoc, 'FPT').analysis_source, 'WEB_ONLY');
withoutDoc = removeItem(withoutDoc, 'item-vcb');
assert.equal(withoutDoc.items.length, 1);
const cleared = clearDraft(storage);
assert.equal(cleared.items.length, 0);
assert.equal(loadDraft(storage).items.length, 0);

console.log('CRSM Analysis List draft tests passed.');
