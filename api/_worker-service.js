import {
  ITEM_STATES,
  TERMINAL_RUN_STATES,
  assertEvidenceOwnedByItem,
  assertResult,
  assertStatus,
  buildRunSummary,
  memoPaths,
  transitionItem,
  upsertRunSummary,
  validateCurrent,
  validateIndex
} from '../src/memo/protocol.js';
import { getCurrentRun, getHistory, serviceError } from './_memo-service.js';

export async function inspectWorkerState(runtime) {
  const current = await getCurrentRun(runtime);
  if (!current.current.run_id) {
    return {
      actionable: false,
      reason: 'NO_CURRENT_RUN',
      current: current.current,
      current_sha: current.current_sha,
      request: null,
      status: null,
      status_sha: null,
      next_item: null
    };
  }

  const nextItem = (current.status.items || []).find(
    item => item.state === ITEM_STATES.PROCESSING || item.state === ITEM_STATES.READY
  ) || null;

  return {
    actionable: Boolean(nextItem),
    reason: nextItem ? null : 'NO_ACTIONABLE_ITEM',
    current: current.current,
    current_sha: current.current_sha,
    request: current.request,
    status: current.status,
    status_sha: current.status_sha,
    next_item: nextItem
  };
}

export async function statusRoundtrip(runtime) {
  const state = await inspectWorkerState(runtime);
  return {
    schema_version: state.current?.schema_version ?? null,
    run_id: state.current?.run_id ?? null,
    run_state: state.current?.state ?? null,
    current_sha: state.current_sha ?? null,
    status_sha: state.status_sha ?? null,
    actionable: state.actionable,
    next_item: state.next_item
      ? {
          item_id: state.next_item.item_id,
          ticker: state.next_item.ticker,
          analysis_source: state.next_item.analysis_source,
          state: state.next_item.state
        }
      : null
  };
}

export async function readCanonicalItem(runtime, {
  run_id,
  item_id
} = {}) {
  requireFields({ run_id, item_id }, ['run_id', 'item_id'], 'ITEM_INPUT_INVALID');
  const currentFile = await assertCurrentRun(runtime, run_id);
  const requestFile = await runtime.readJson(memoPaths(run_id).request);
  const statusFile = await runtime.readJson(memoPaths(run_id).status);

  const statusCheck = assertStatusSafe(statusFile.value);
  if (!statusCheck) throw serviceError('STATUS_INVALID', 'Canonical status is invalid', 500);

  const requestItem = (requestFile.value.items || []).find(item => item.item_id === item_id);
  const statusItem = (statusFile.value.items || []).find(item => item.item_id === item_id);
  if (!requestItem || !statusItem) {
    throw serviceError('ITEM_NOT_FOUND', 'Canonical item was not found', 404);
  }

  return {
    current: currentFile.value,
    current_sha: currentFile.sha,
    request_item: requestItem,
    status_item: statusItem,
    status_sha: statusFile.sha
  };
}

export async function readItemEvidence(runtime, {
  run_id,
  item_id
} = {}) {
  const canonical = await readCanonicalItem(runtime, { run_id, item_id });
  const refs = canonical.request_item.evidence_refs || [];
  const evidence = [];

  for (const ref of refs) {
    try {
      assertEvidenceOwnedByItem(ref, canonical.request_item);
    } catch (error) {
      throw serviceError(error.code || 'EVIDENCE_OWNER_MISMATCH', error.message, 500, error.details);
    }
    const file = await runtime.readJson(ref.repository_path);
    try {
      assertEvidenceOwnedByItem(file.value, canonical.request_item);
    } catch (error) {
      throw serviceError(error.code || 'EVIDENCE_OWNER_MISMATCH', error.message, 500, error.details);
    }
    evidence.push({ value: file.value, sha: file.sha });
  }

  return {
    run_id,
    item_id,
    ticker: canonical.request_item.ticker,
    analysis_source: canonical.request_item.analysis_source,
    evidence_refs: refs,
    evidence
  };
}

export async function claimItem(runtime, {
  run_id,
  item_id,
  expected_status_sha,
  now = new Date().toISOString()
} = {}) {
  requireFields(
    { run_id, item_id, expected_status_sha },
    ['run_id', 'item_id', 'expected_status_sha'],
    'CLAIM_INPUT_INVALID'
  );

  const currentFile = await assertCurrentRun(runtime, run_id);
  const statusPath = memoPaths(run_id).status;
  const statusFile = await runtime.readJson(statusPath);
  assertExpectedSha(statusFile.sha, expected_status_sha);

  const item = findStatusItem(statusFile.value, item_id);
  if (item.state === ITEM_STATES.PROCESSING) {
    return {
      already_processing: true,
      current: currentFile.value,
      current_sha: currentFile.sha,
      status: statusFile.value,
      status_sha: statusFile.sha,
      item
    };
  }
  if (item.state !== ITEM_STATES.READY) {
    throw serviceError('ITEM_NOT_READY', 'Only READY items can be claimed', 409);
  }

  const nextStatus = transitionItem(
    statusFile.value,
    item_id,
    ITEM_STATES.PROCESSING,
    { now }
  );
  const statusWrite = await runtime.updateJson(
    statusPath,
    nextStatus,
    expected_status_sha,
    'Stockmind worker claim ' + run_id + ' ' + item_id
  );
  const currentWrite = await syncCurrent(
    runtime,
    currentFile,
    nextStatus,
    now,
    'Stockmind worker claim ' + run_id
  );

  return {
    already_processing: false,
    current: currentWrite.value,
    current_sha: currentWrite.sha,
    status: nextStatus,
    status_sha: statusWrite.sha,
    item: findStatusItem(nextStatus, item_id)
  };
}

export async function failItem(runtime, {
  run_id,
  item_id,
  expected_status_sha,
  error,
  now = new Date().toISOString()
} = {}) {
  requireFields(
    { run_id, item_id, expected_status_sha },
    ['run_id', 'item_id', 'expected_status_sha'],
    'FAIL_INPUT_INVALID'
  );

  const currentFile = await assertCurrentRun(runtime, run_id);
  const requestFile = await runtime.readJson(memoPaths(run_id).request);
  const statusPath = memoPaths(run_id).status;
  const statusFile = await runtime.readJson(statusPath);
  assertExpectedSha(statusFile.sha, expected_status_sha);

  const item = findStatusItem(statusFile.value, item_id);
  if (item.state === ITEM_STATES.FAILED) {
    return {
      already_failed: true,
      current: currentFile.value,
      current_sha: currentFile.sha,
      status: statusFile.value,
      status_sha: statusFile.sha,
      item
    };
  }
  if (item.state !== ITEM_STATES.PROCESSING) {
    throw serviceError('ITEM_NOT_PROCESSING', 'Only PROCESSING items can fail', 409);
  }

  const nextStatus = transitionItem(
    statusFile.value,
    item_id,
    ITEM_STATES.FAILED,
    { now, error }
  );
  const statusWrite = await runtime.updateJson(
    statusPath,
    nextStatus,
    expected_status_sha,
    'Stockmind worker fail ' + run_id + ' ' + item_id
  );
  const currentWrite = await syncCurrent(
    runtime,
    currentFile,
    nextStatus,
    now,
    'Stockmind worker fail ' + run_id
  );

  let history = null;
  if (TERMINAL_RUN_STATES.includes(nextStatus.state)) {
    history = await persistTerminalSummary(runtime, requestFile.value, nextStatus, now);
  }

  return {
    already_failed: false,
    current: currentWrite.value,
    current_sha: currentWrite.sha,
    status: nextStatus,
    status_sha: statusWrite.sha,
    item: findStatusItem(nextStatus, item_id),
    history
  };
}

export async function completeItem(runtime, {
  result,
  expected_status_sha,
  now = new Date().toISOString()
} = {}) {
  if (!result || !expected_status_sha) {
    throw serviceError(
      'COMPLETE_INPUT_INVALID',
      'result and expected_status_sha are required',
      400
    );
  }

  try {
    assertResult(result);
  } catch (error) {
    throw serviceError(error.code || 'RESULT_INVALID', error.message, 400, error.details);
  }

  const runId = result.run_id;
  const itemId = result.item_id;
  const currentFile = await assertCurrentRun(runtime, runId);
  const requestFile = await runtime.readJson(memoPaths(runId).request);
  const requestItem = (requestFile.value.items || []).find(item => item.item_id === itemId);
  if (!requestItem) throw serviceError('ITEM_NOT_FOUND', 'Canonical request item was not found', 404);

  assertResultMatchesItem(result, requestItem);

  const statusPath = memoPaths(runId).status;
  const statusFile = await runtime.readJson(statusPath);
  assertExpectedSha(statusFile.sha, expected_status_sha);
  const statusItem = findStatusItem(statusFile.value, itemId);

  const resultPath = memoPaths(runId, requestItem.ticker).result;
  const existing = await runtime.readJsonOrNull(resultPath);

  if (statusItem.state === ITEM_STATES.COMPLETED) {
    if (!existing) {
      throw serviceError('RESULT_MISSING', 'COMPLETED item is missing its immutable result', 500);
    }
    assertSameResult(existing.value, result);
    return {
      already_completed: true,
      result_ref: resultPath,
      result_sha: existing.sha,
      current: currentFile.value,
      current_sha: currentFile.sha,
      status: statusFile.value,
      status_sha: statusFile.sha
    };
  }

  if (statusItem.state !== ITEM_STATES.PROCESSING) {
    throw serviceError('ITEM_NOT_PROCESSING', 'Only PROCESSING items can complete', 409);
  }

  let resultWrite = existing;
  if (existing) {
    assertSameResult(existing.value, result);
  } else {
    resultWrite = await runtime.createJson(
      resultPath,
      result,
      'Stockmind immutable result ' + runId + ' ' + requestItem.ticker
    );
  }

  const nextStatus = transitionItem(
    statusFile.value,
    itemId,
    ITEM_STATES.COMPLETED,
    { now, resultRef: resultPath }
  );
  const statusWrite = await runtime.updateJson(
    statusPath,
    nextStatus,
    expected_status_sha,
    'Stockmind worker complete ' + runId + ' ' + itemId
  );
  const currentWrite = await syncCurrent(
    runtime,
    currentFile,
    nextStatus,
    now,
    'Stockmind worker complete ' + runId
  );

  let history = null;
  if (TERMINAL_RUN_STATES.includes(nextStatus.state)) {
    history = await persistTerminalSummary(runtime, requestFile.value, nextStatus, now);
  }

  return {
    already_completed: false,
    result_ref: resultPath,
    result_sha: resultWrite.sha,
    current: currentWrite.value,
    current_sha: currentWrite.sha,
    status: nextStatus,
    status_sha: statusWrite.sha,
    history
  };
}

export async function getWorkerHistory(runtime) {
  return getHistory(runtime);
}

async function assertCurrentRun(runtime, runId) {
  const currentFile = await runtime.readJson('memo/current.json');
  const check = validateCurrent(currentFile.value);
  if (!check.valid) throw serviceError('CURRENT_INVALID', check.errors.join('; '), 500);
  if (currentFile.value.run_id !== runId) {
    throw serviceError('RUN_NOT_CURRENT', 'Worker writes are allowed only for the current run', 409);
  }
  return currentFile;
}

async function syncCurrent(runtime, currentFile, status, now, message) {
  const nextCurrent = {
    ...currentFile.value,
    state: status.state,
    updated_at: now
  };
  const write = await runtime.updateJson(
    'memo/current.json',
    nextCurrent,
    currentFile.sha,
    message
  );
  return { value: nextCurrent, sha: write.sha };
}

async function persistTerminalSummary(runtime, request, status, now) {
  const indexFile = await runtime.readJson('memo/index.json');
  const check = validateIndex(indexFile.value);
  if (!check.valid) throw serviceError('INDEX_INVALID', check.errors.join('; '), 500);

  const summary = buildRunSummary(request, status);
  const nextIndex = upsertRunSummary(indexFile.value, summary, now);
  const write = await runtime.updateJson(
    'memo/index.json',
    nextIndex,
    indexFile.sha,
    'Stockmind worker finalize ' + request.run_id
  );
  return { index: nextIndex, index_sha: write.sha, summary };
}

function assertResultMatchesItem(result, item) {
  if (
    result.item_id !== item.item_id
    || String(result.ticker).toUpperCase() !== String(item.ticker).toUpperCase()
    || result.analysis_source !== item.analysis_source
  ) {
    throw serviceError(
      'RESULT_OWNER_MISMATCH',
      'Result identity/source must match the canonical request item',
      400
    );
  }
}

function assertSameResult(existing, candidate) {
  if (stableJson(existing) !== stableJson(candidate)) {
    throw serviceError(
      'RESULT_IMMUTABLE',
      'An immutable result already exists with different content',
      409
    );
  }
}

function findStatusItem(status, itemId) {
  assertStatusSafe(status);
  const item = (status.items || []).find(candidate => candidate.item_id === itemId);
  if (!item) throw serviceError('ITEM_NOT_FOUND', 'Unknown item_id ' + itemId, 404);
  return item;
}

function assertStatusSafe(status) {
  try {
    assertStatus(status);
    return true;
  } catch (error) {
    throw serviceError(error.code || 'STATUS_INVALID', error.message, 500, error.details);
  }
}

function assertExpectedSha(actual, expected) {
  if (!expected || actual !== expected) {
    throw serviceError(
      'MEMO_SHA_CONFLICT',
      'Status changed; re-read before updating',
      409,
      { expected_sha: expected || null, actual_sha: actual || null }
    );
  }
}

function requireFields(value, fields, code) {
  const missing = fields.filter(field => !value[field]);
  if (missing.length) {
    throw serviceError(code, 'Missing required fields: ' + missing.join(', '), 400);
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(
      key => JSON.stringify(key) + ':' + stableJson(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}
