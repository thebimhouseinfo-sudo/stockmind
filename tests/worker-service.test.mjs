import assert from 'node:assert/strict';
import fs from 'node:fs';

import { submitRun, retryFailedItem } from '../api/_memo-service.js';
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
    async deleteJson(path, expectedSha) {
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
      files.delete(path);
      return { path, commit_sha: 'commit-' + newSha() };
    },
    async list(path) {
      const prefix = path.replace(/\/$/, '') + '/';
      const entries = new Map();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const first = rest.split('/')[0];
        const isDir = rest.includes('/');
        if (!entries.has(first)) {
          entries.set(first, {
            name: first,
            path: prefix + first,
            type: isDir ? 'dir' : 'file',
            sha: isDir ? 'dir-' + first : files.get(key).sha
          });
        } else if (isDir) {
          entries.get(first).type = 'dir';
        }
      }
      if (!entries.size) {
        const error = new Error('Not found: ' + path);
        error.status = 404;
        throw error;
      }
      return [...entries.values()];
    }
  };
}

async function runToCompletion(runtime, fixtureValue, nowBase) {
  const submitted = await submitRun(runtime, {
    request: fixtureValue.request,
    evidence_payloads: fixtureValue.evidence_payload ? [fixtureValue.evidence_payload] : [],
    now: nowBase
  });
  const claimed = await claimItem(runtime, {
    run_id: fixtureValue.request.run_id,
    item_id: fixtureValue.request.items[0].item_id,
    expected_status_sha: submitted.status_sha,
    now: new Date(new Date(nowBase).getTime() + 60_000).toISOString()
  });
  return completeItem(runtime, {
    result: fixtureValue.result,
    expected_status_sha: claimed.status_sha,
    now: new Date(new Date(nowBase).getTime() + 120_000).toISOString()
  });
}

const screened = fixture('screened-web');
const runtime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});

const submitted = await submitRun(runtime, {
  request: screened.request,
  evidence_payloads: [],
  now: '2026-09-30T02:00:00.000Z'
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
  now: '2026-09-30T02:01:00.000Z'
});
assert.equal(claimed.item.state, 'PROCESSING');

const failed = await failItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: claimed.status_sha,
  error: { code: 'FIXTURE', message: 'non-analytical worker fixture' },
  now: '2026-09-30T02:02:00.000Z'
});
assert.equal(failed.item.state, 'FAILED');
assert.equal(failed.status.state, 'PARTIAL');
assert.equal(failed.render, null);
assert.ok(runtime.files.has(memoPaths(screened.request.run_id).request));

const retried = await retryFailedItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: failed.status_sha,
  now: '2026-09-30T02:03:00.000Z'
});
const reclaimed = await claimItem(runtime, {
  run_id: screened.request.run_id,
  item_id: screened.request.items[0].item_id,
  expected_status_sha: retried.status_sha,
  now: '2026-09-30T02:04:00.000Z'
});

const completed = await completeItem(runtime, {
  result: screened.result,
  expected_status_sha: reclaimed.status_sha,
  now: '2026-09-30T02:05:00.000Z'
});
assert.equal(completed.status.state, 'COMPLETED');
assert.equal(completed.current.state, 'EMPTY');
assert.equal(completed.render.index.date, '2026-09-30');
assert.equal(completed.render.index.runs.length, 1);
assert.equal(completed.render.snapshot.items[0].ticker, screened.result.ticker);
assert.ok(runtime.files.has('memo/render/runs/' + screened.request.run_id + '.json'));
assert.ok(!runtime.files.has(memoPaths(screened.request.run_id).request));
assert.ok(!runtime.files.has(memoPaths(screened.request.run_id).status));
assert.ok(!runtime.files.has(memoPaths(screened.request.run_id, screened.result.ticker).result));

const webOnly = fixture('web-only');
const sameDay = await runToCompletion(runtime, webOnly, '2026-09-30T06:00:00.000Z');
assert.equal(sameDay.render.index.date, '2026-09-30');
assert.equal(sameDay.render.index.runs.length, 2);
assert.ok(runtime.files.has('memo/render/runs/' + screened.request.run_id + '.json'));
assert.ok(runtime.files.has('memo/render/runs/' + webOnly.request.run_id + '.json'));

const evidenceFixture = fixture('evidence-web');
const nextDay = await runToCompletion(runtime, evidenceFixture, '2026-09-30T18:00:00.000Z');
assert.equal(nextDay.render.index.date, '2026-10-01');
assert.equal(nextDay.render.index.runs.length, 1);
assert.equal(nextDay.render.index.runs[0].run_id, evidenceFixture.request.run_id);
assert.ok(!runtime.files.has('memo/render/runs/' + screened.request.run_id + '.json'));
assert.ok(!runtime.files.has('memo/render/runs/' + webOnly.request.run_id + '.json'));
assert.ok(runtime.files.has('memo/render/runs/' + evidenceFixture.request.run_id + '.json'));

const evidenceRuntime = makeRuntime({
  'memo/current.json': createEmptyCurrent(),
  'memo/index.json': createEmptyIndex()
});
await submitRun(evidenceRuntime, {
  request: evidenceFixture.request,
  evidence_payloads: [evidenceFixture.evidence_payload],
  now: '2026-09-30T08:10:00.000Z'
});
const evidence = await readItemEvidence(evidenceRuntime, {
  run_id: evidenceFixture.request.run_id,
  item_id: evidenceFixture.request.items[0].item_id
});
assert.equal(evidence.evidence.length, 1);
assert.equal(evidence.evidence[0].value.ticker, evidenceFixture.request.items[0].ticker);

console.log('Stockmind worker service tests passed.');
