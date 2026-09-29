import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createGitHubRuntimeClient,
  GitHubRuntimeError,
  STOCKMIND_RUNTIME,
  assertMemoPath
} from '../api/_github-runtime.js';
import {
  getCurrentRun,
  getHistory,
  getRun,
  inspectMaintenance,
  rebuildHistoryIndex,
  retryFailedItem,
  submitRun,
  writeEvidence
} from '../api/_memo-service.js';
import {
  ITEM_STATES,
  RUN_STATES,
  createEmptyCurrent,
  createEmptyIndex,
  createStatusFromRequest,
  memoPaths,
  transitionItem
} from '../src/memo/protocol.js';

function fixture(name) {
  return JSON.parse(
    fs.readFileSync(new URL('./fixtures/crsm/' + name + '.json', import.meta.url), 'utf8')
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeRuntime(initial = {}) {
  const files = new Map();
  let counter = 0;

  for (const [path, value] of Object.entries(initial)) {
    counter += 1;
    files.set(path, { value: clone(value), sha: 'sha-' + counter });
  }

  function newSha() {
    counter += 1;
    return 'sha-' + counter;
  }

  return {
    files,

    async readJson(path) {
      const file = files.get(path);
      if (!file) {
        const error = new Error('Not found: ' + path);
        error.status = 404;
        throw error;
      }
      return { path, sha: file.sha, value: clone(file.value) };
    },

    async readJsonOrNull(path) {
      const file = files.get(path);
      return file ? { path, sha: file.sha, value: clone(file.value) } : null;
    },

    async createJson(path, value) {
      if (files.has(path)) {
        const error = new Error('Already exists: ' + path);
        error.status = 409;
        throw error;
      }
      const sha = newSha();
      files.set(path, { value: clone(value), sha });
      return { path, sha, commit_sha: 'commit-' + counter };
    },

    async updateJson(path, value, expectedSha) {
      const file = files.get(path);
      if (!file) {
        const error = new Error('Missing: ' + path);
        error.status = 404;
        throw error;
      }
      if (file.sha !== expectedSha) {
        const error = new Error('SHA conflict');
        error.code = 'MEMO_SHA_CONFLICT';
        error.status = 409;
        throw error;
      }
      const sha = newSha();
      files.set(path, { value: clone(value), sha });
      return { path, sha, commit_sha: 'commit-' + counter };
    },

    async list(path) {
      if (path !== 'memo/runs') return [];
      const ids = new Set();
      for (const key of files.keys()) {
        const match = key.match(/^memo\/runs\/([^/]+)\//);
        if (match) ids.add(match[1]);
      }
      return [...ids].sort().map(name => ({
        name,
        path: 'memo/runs/' + name,
        type: 'dir',
        sha: 'dir-' + name
      }));
    }
  };
}

const evidenceFixture = fixture('evidence-web');
const runtime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});

const request = clone(evidenceFixture.request);
request.created_at = '2026-09-29T14:10:00.000Z';

const submitted = await submitRun(runtime, {
  request,
  evidence_payloads: [evidenceFixture.evidence_payload],
  now: '2026-09-29T14:10:00.000Z'
});

assert.equal(submitted.run_id, request.run_id);
assert.equal(submitted.current.state, RUN_STATES.READY);
assert.ok(runtime.files.has(memoPaths(request.run_id).request));
assert.ok(runtime.files.has(memoPaths(request.run_id).status));
assert.ok(runtime.files.has(evidenceFixture.evidence_payload.repository_path));

await assert.rejects(
  () => submitRun(runtime, {
    request,
    evidence_payloads: [evidenceFixture.evidence_payload]
  }),
  error => error.code === 'MEMO_ACTIVE_RUN_EXISTS'
);

const current = await getCurrentRun(runtime);
assert.equal(current.request.run_id, request.run_id);
assert.equal(current.status.items[0].state, ITEM_STATES.READY);
assert.ok(current.current_sha);
assert.ok(current.status_sha);

const wrongEvidence = clone(evidenceFixture.evidence_payload);
wrongEvidence.ticker = 'VCB';
const wrongRuntime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});

await assert.rejects(
  () => submitRun(wrongRuntime, {
    request,
    evidence_payloads: [wrongEvidence]
  }),
  error => error.code === 'MEMO_EVIDENCE_OWNER_MISMATCH'
);

const orphanEvidence = clone(evidenceFixture.evidence_payload);
orphanEvidence.document_id = 'extra-doc';
const orphanRuntime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});

await assert.rejects(
  () => submitRun(orphanRuntime, {
    request,
    evidence_payloads: [evidenceFixture.evidence_payload, orphanEvidence]
  }),
  error => error.code === 'EVIDENCE_ORPHAN_PAYLOAD'
);

let statusFile = await runtime.readJson(memoPaths(request.run_id).status);
let failed = transitionItem(
  statusFile.value,
  request.items[0].item_id,
  ITEM_STATES.PROCESSING,
  { now: '2026-09-29T14:11:00.000Z' }
);
failed = transitionItem(
  failed,
  request.items[0].item_id,
  ITEM_STATES.FAILED,
  {
    now: '2026-09-29T14:12:00.000Z',
    error: { code: 'FIXTURE', message: 'fixture fail' }
  }
);
assert.equal(failed.state, RUN_STATES.PARTIAL);
await runtime.updateJson(memoPaths(request.run_id).status, failed, statusFile.sha);
statusFile = await runtime.readJson(memoPaths(request.run_id).status);

// Simulate plugin terminal summary so retry must reopen both status and current.
const currentBeforeRetry = await runtime.readJson('memo/current.json');
await runtime.updateJson('memo/current.json', {
  ...currentBeforeRetry.value,
  state: RUN_STATES.PARTIAL,
  updated_at: '2026-09-29T14:12:00.000Z'
}, currentBeforeRetry.sha);

await assert.rejects(
  () => retryFailedItem(runtime, {
    run_id: request.run_id,
    item_id: request.items[0].item_id,
    expected_status_sha: 'stale-sha'
  }),
  error => error.code === 'MEMO_SHA_CONFLICT'
);

const retried = await retryFailedItem(runtime, {
  run_id: request.run_id,
  item_id: request.items[0].item_id,
  expected_status_sha: statusFile.sha,
  now: '2026-09-29T14:13:00.000Z'
});
assert.equal(retried.status.items[0].state, ITEM_STATES.READY);
assert.equal(retried.current.state, RUN_STATES.READY);
const reopenedCurrent = await runtime.readJson('memo/current.json');
assert.equal(reopenedCurrent.value.state, RUN_STATES.READY);

const directEvidenceRuntime = makeRuntime({
  [memoPaths(request.run_id).request]: request
});
const evidenceWrite = await writeEvidence(directEvidenceRuntime, {
  run_id: request.run_id,
  item_id: request.items[0].item_id,
  ticker: request.items[0].ticker,
  evidence: evidenceFixture.evidence_payload
});
assert.equal(evidenceWrite.path, evidenceFixture.evidence_payload.repository_path);

const fabricatedEvidenceRuntime = makeRuntime({
  [memoPaths(request.run_id).request]: request
});
await assert.rejects(
  () => writeEvidence(fabricatedEvidenceRuntime, {
    run_id: request.run_id,
    item_id: 'fake-item',
    ticker: request.items[0].ticker,
    evidence: evidenceFixture.evidence_payload
  }),
  error => error.code === 'ITEM_NOT_FOUND'
);

const metadataMismatchRuntime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});
const metadataMismatch = clone(evidenceFixture.evidence_payload);
metadataMismatch.checksum = 'tampered-checksum';
await assert.rejects(
  () => submitRun(metadataMismatchRuntime, {
    request,
    evidence_payloads: [metadataMismatch]
  }),
  error => error.code === 'EVIDENCE_METADATA_MISMATCH'
);

const webFixture = fixture('web-only');
const webRequest = clone(webFixture.request);
const terminalRuntime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});

const initialStatus = createStatusFromRequest(
  webRequest,
  '2026-09-29T14:20:00.000Z'
);
let terminalStatus = transitionItem(
  initialStatus,
  webRequest.items[0].item_id,
  ITEM_STATES.PROCESSING,
  { now: '2026-09-29T14:21:00.000Z' }
);

const resultRef = memoPaths(webRequest.run_id, webRequest.items[0].ticker).result;
terminalStatus = transitionItem(
  terminalStatus,
  webRequest.items[0].item_id,
  ITEM_STATES.COMPLETED,
  {
    now: '2026-09-29T14:22:00.000Z',
    resultRef
  }
);

await terminalRuntime.createJson(memoPaths(webRequest.run_id).request, webRequest);
await terminalRuntime.createJson(memoPaths(webRequest.run_id).status, terminalStatus);
await terminalRuntime.createJson(resultRef, webFixture.result);

const rebuilt = await rebuildHistoryIndex(terminalRuntime, {
  now: '2026-09-29T14:23:00.000Z'
});
assert.equal(rebuilt.index.runs.length, 1);
assert.equal(rebuilt.index.runs[0].run_id, webRequest.run_id);
assert.deepEqual(rebuilt.skipped, []);

await terminalRuntime.createJson(
  'memo/runs/run-malformed-001/request.json',
  { invalid: true }
);
const rebuiltWithMalformed = await rebuildHistoryIndex(terminalRuntime, {
  now: '2026-09-29T14:24:00.000Z'
});
assert.equal(rebuiltWithMalformed.index.runs.length, 1);
assert.equal(rebuiltWithMalformed.skipped.length, 1);
assert.equal(rebuiltWithMalformed.skipped[0].run_id, 'run-malformed-001');

const history = await getHistory(terminalRuntime);
assert.equal(history.index.runs.length, 1);

const loadedRun = await getRun(terminalRuntime, webRequest.run_id);
assert.equal(loadedRun.results.FPT.value.ticker, 'FPT');

const maintenance = await inspectMaintenance(terminalRuntime);
assert.deepEqual(maintenance.missing_from_index, []);
assert.deepEqual(maintenance.missing_run_dirs, []);

assert.equal(STOCKMIND_RUNTIME.owner, 'thebimhouseinfo-sudo');
assert.equal(STOCKMIND_RUNTIME.repo, 'stockmind');
assert.equal(STOCKMIND_RUNTIME.branch, 'runtime');

const fakeFetch = async () => ({
  ok: true,
  status: 200,
  async json() { return []; }
});

const client = createGitHubRuntimeClient({
  fetchImpl: fakeFetch,
  token: 'fixture-token'
});

await assert.rejects(
  () => client.readJson('README.md'),
  error => error instanceof GitHubRuntimeError
    && error.code === 'GITHUB_RUNTIME_PATH_DENIED'
);
assert.throws(
  () => assertMemoPath('memo/arbitrary.json'),
  error => error instanceof GitHubRuntimeError
    && error.code === 'GITHUB_RUNTIME_PATH_DENIED'
);
assert.equal(assertMemoPath('memo/current.json'), 'memo/current.json');
assert.equal(assertMemoPath('memo/runs', { allowDirectory: true }), 'memo/runs');

assert.throws(
  () => createGitHubRuntimeClient({
    fetchImpl: fakeFetch,
    token: 'fixture-token',
    branch: 'master'
  }),
  error => error instanceof GitHubRuntimeError
    && error.code === 'GITHUB_RUNTIME_BOUNDARY'
);

console.log('Vercel GitHub bridge tests passed.');


for (const route of [
  'crsm-submit',
  'crsm-current',
  'crsm-history',
  'crsm-run',
  'crsm-retry',
  'crsm-evidence',
  'crsm-maintenance'
]) {
  const mod = await import('../api/' + route + '.js');
  assert.equal(typeof mod.default, 'function', route + ' must export a Vercel handler');
}
