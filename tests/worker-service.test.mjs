import assert from 'node:assert/strict';
import fs from 'node:fs';

import { submitRun, retryFailedItem } from '../api/_memo-service.js';
import { stockmindMcpBoundary } from '../api/_mcp-server.js';
import {
  claimItem,
  completeItem,
  failItem,
  inspectWorkerState,
  readItemEvidence,
  statusRoundtrip
} from '../api/_worker-service.js';
import {
  createEmptyCurrent,
  createEmptyIndex,
  memoPaths
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
      return [...ids].map(name => ({
        name,
        path: 'memo/runs/' + name,
        type: 'dir',
        sha: 'dir-' + name
      }));
    }
  };
}

const boundary = stockmindMcpBoundary();
assert.equal(boundary.owner, 'thebimhouseinfo-sudo');
assert.equal(boundary.repo, 'stockmind');
assert.equal(boundary.branch, 'runtime');
assert.equal(boundary.path_prefix, 'memo/');
assert.equal(boundary.writes_enabled_by_default, true);
assert.equal(boundary.write_kill_switch, 'STOCKMIND_MCP_WRITES_ENABLED=false');

const screened = fixture('screened-web');
const runtime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});

const submitted = await submitRun(runtime, {
  request: screened.request,
  evidence_payloads: [],
  now: '2026-09-29T16:00:00.000Z'
});

let worker = await inspectWorkerState(runtime);
assert.equal(worker.actionable, true);
assert.equal(worker.next_item.item_id, screened.request.items[0].item_id);

const probe = await statusRoundtrip(runtime);
assert.equal(probe.run_id, screened.request.run_id);
assert.equal(probe.status_sha, submitted.status_sha);
assert.equal(probe.next_item.state, 'READY');

const claimed = await claimItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: submitted.status_sha,
  now: '2026-09-29T16:01:00.000Z'
});
assert.equal(claimed.item.state, 'PROCESSING');

await assert.rejects(
  () => claimItem(runtime, {
    run_id: screened.request.run_id,
    item_id: screened.request.items[0].item_id,
    expected_status_sha: submitted.status_sha
  }),
  error => error.code === 'MEMO_SHA_CONFLICT'
);

const failed = await failItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: claimed.status_sha,
  error: { code: 'FIXTURE', message: 'non-analytical worker fixture' },
  now: '2026-09-29T16:02:00.000Z'
});
assert.equal(failed.item.state, 'FAILED');
assert.equal(failed.status.state, 'PARTIAL');
assert.equal(failed.history.summary.failed_count, 1);

const retried = await retryFailedItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: failed.status_sha,
  now: '2026-09-29T16:03:00.000Z'
});
const reclaimed = await claimItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: retried.status_sha,
  now: '2026-09-29T16:04:00.000Z'
});

const completed = await completeItem(runtime, {
  result: screened.result,
  expected_status_sha: reclaimed.status_sha,
  now: '2026-09-29T16:05:00.000Z'
});
assert.equal(completed.status.state, 'COMPLETED');
assert.equal(completed.history.summary.completed_count, 1);
assert.ok(runtime.files.has(memoPaths(screened.request.run_id, 'VCB').result));

const idempotent = await completeItem(runtime, {
  result: screened.result,
  expected_status_sha: completed.status_sha,
  now: '2026-09-29T16:06:00.000Z'
});
assert.equal(idempotent.already_completed, true);

const changedResult = clone(screened.result);
changedResult.outputs.node6a = '<html>changed</html>';
await assert.rejects(
  () => completeItem(runtime, {
    result: changedResult,
    expected_status_sha: completed.status_sha
  }),
  error => error.code === 'RESULT_IMMUTABLE'
);

const evidenceFixture = fixture('evidence-web');
const evidenceRuntime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});
await submitRun(evidenceRuntime, {
  request: evidenceFixture.request,
  evidence_payloads: [evidenceFixture.evidence_payload],
  now: '2026-09-29T16:10:00.000Z'
});
const evidence = await readItemEvidence(evidenceRuntime, {
  run_id: evidenceFixture.request.run_id,
  item_id: evidenceFixture.request.items[0].item_id
});
assert.equal(evidence.evidence.length, 1);
assert.equal(evidence.evidence[0].value.ticker, evidenceFixture.request.items[0].ticker);

console.log('Stockmind worker service tests passed.');
