import {
  assertCanSubmit,
  assertEvidenceOwnedByItem,
  buildRunSummary,
  createCurrentForRun,
  createStatusFromRequest,
  memoPaths,
  rebuildIndex,
  transitionItem,
  assertRequest,
  assertResult,
  assertStatus,
  validateCurrent,
  validateIndex,
  ITEM_STATES,
  TERMINAL_RUN_STATES
} from '../src/memo/protocol.js';
import {
  validateAnalysisRequest,
  validateEvidencePayload
} from '../src/crsm/contracts.js';

export async function submitRun(runtime, { request, evidence_payloads = [], now = new Date().toISOString() } = {}) {
  const requestCheck = validateAnalysisRequest(request);
  if (!requestCheck.valid) throw serviceError('REQUEST_INVALID', requestCheck.errors.join('; '), 400);

  const currentFile = await runtime.readJson('memo/current.json');
  try {
    assertCanSubmit(currentFile.value);
  } catch (error) {
    throw serviceError(error.code || 'ACTIVE_RUN_EXISTS', error.message, 409, error.details);
  }

  const evidenceById = new Map();
  for (const payload of evidence_payloads) {
    const check = validateEvidencePayload(payload);
    if (!check.valid) throw serviceError('EVIDENCE_INVALID', check.errors.join('; '), 400);
    if (evidenceById.has(payload.document_id)) {
      throw serviceError('EVIDENCE_DUPLICATE', 'Duplicate document_id ' + payload.document_id, 400);
    }
    evidenceById.set(payload.document_id, payload);
  }

  const expectedEvidenceIds = new Set();
  for (const item of request.items) {
    for (const ref of item.evidence_refs || []) {
      expectedEvidenceIds.add(ref.document_id);
      try {
        assertEvidenceOwnedByItem(ref, item);
      } catch (error) {
        throw serviceError(error.code || 'EVIDENCE_OWNER_MISMATCH', error.message, 400);
      }

      const payload = evidenceById.get(ref.document_id);
      if (!payload) throw serviceError('EVIDENCE_PAYLOAD_MISSING', 'Missing payload for ' + ref.document_id, 400);

      try {
        assertEvidenceOwnedByItem(payload, item);
      } catch (error) {
        throw serviceError(error.code || 'EVIDENCE_OWNER_MISMATCH', error.message, 400);
      }

      assertEvidenceMatchesRef(payload, ref);
      const expectedPath = memoPaths(request.run_id, item.ticker, ref.document_id).evidence;
      if (ref.repository_path !== expectedPath || payload.repository_path !== expectedPath) {
        throw serviceError('EVIDENCE_PATH_MISMATCH', 'Evidence path must equal ' + expectedPath, 400);
      }
    }
  }

  for (const documentId of evidenceById.keys()) {
    if (!expectedEvidenceIds.has(documentId)) {
      throw serviceError('EVIDENCE_ORPHAN_PAYLOAD', 'Payload ' + documentId + ' is not referenced by request', 400);
    }
  }

  const status = createStatusFromRequest(request, now);
  const current = createCurrentForRun(request, status, now);
  const paths = memoPaths(request.run_id);

  for (const item of request.items) {
    for (const ref of item.evidence_refs || []) {
      await runtime.createJson(
        ref.repository_path,
        evidenceById.get(ref.document_id),
        'Memo evidence ' + request.run_id + ' ' + item.ticker
      );
    }
  }

  await runtime.createJson(
    paths.request,
    { ...request, created_at: request.created_at || now },
    'Memo request ' + request.run_id
  );
  const statusWrite = await runtime.createJson(paths.status, status, 'Memo status ' + request.run_id);
  const currentWrite = await runtime.updateJson(
    'memo/current.json',
    current,
    currentFile.sha,
    'Activate Memo run ' + request.run_id
  );

  return {
    run_id: request.run_id,
    current,
    current_sha: currentWrite.sha,
    status,
    status_sha: statusWrite.sha
  };
}

export async function getCurrentRun(runtime) {
  const currentFile = await runtime.readJson('memo/current.json');
  const currentCheck = validateCurrent(currentFile.value);
  if (!currentCheck.valid) throw serviceError('CURRENT_INVALID', currentCheck.errors.join('; '), 500);
  if (!currentFile.value.run_id) {
    return {
      current: currentFile.value,
      current_sha: currentFile.sha,
      request: null,
      status: null,
      status_sha: null
    };
  }

  const paths = memoPaths(currentFile.value.run_id);
  const [requestFile, statusFile] = await Promise.all([
    runtime.readJson(paths.request),
    runtime.readJson(paths.status)
  ]);
  try {
    assertRequest(requestFile.value);
    assertStatus(statusFile.value);
  } catch (error) {
    throw serviceError(error.code || 'RUN_INVALID', error.message, 500, error.details);
  }

  return {
    current: currentFile.value,
    current_sha: currentFile.sha,
    request: requestFile.value,
    status: statusFile.value,
    status_sha: statusFile.sha
  };
}

export async function getHistory(runtime) {
  const indexFile = await runtime.readJson('memo/index.json');
  const check = validateIndex(indexFile.value);
  if (!check.valid) throw serviceError('INDEX_INVALID', check.errors.join('; '), 500);
  return { index: indexFile.value, index_sha: indexFile.sha };
}

export async function getRun(runtime, runId, { includeResults = true } = {}) {
  const paths = memoPaths(runId);
  const [requestFile, statusFile] = await Promise.all([
    runtime.readJson(paths.request),
    runtime.readJson(paths.status)
  ]);

  try {
    assertRequest(requestFile.value);
    assertStatus(statusFile.value);
  } catch (error) {
    throw serviceError(error.code || 'RUN_INVALID', error.message, 500, error.details);
  }

  const results = {};
  if (includeResults) {
    for (const item of statusFile.value.items || []) {
      if (item.state !== ITEM_STATES.COMPLETED || !item.result_ref) continue;
      const resultFile = await runtime.readJson(item.result_ref);
      try {
        assertResult(resultFile.value);
      } catch (error) {
        throw serviceError(error.code || 'RESULT_INVALID', error.message, 500, error.details);
      }
      results[item.ticker] = { value: resultFile.value, sha: resultFile.sha };
    }
  }

  return {
    request: requestFile.value,
    request_sha: requestFile.sha,
    status: statusFile.value,
    status_sha: statusFile.sha,
    results
  };
}

export async function retryFailedItem(runtime, {
  run_id,
  item_id,
  expected_status_sha,
  now = new Date().toISOString()
} = {}) {
  if (!run_id || !item_id || !expected_status_sha) {
    throw serviceError('RETRY_INPUT_INVALID', 'run_id, item_id and expected_status_sha are required', 400);
  }

  const currentFile = await runtime.readJson('memo/current.json');
  const currentCheck = validateCurrent(currentFile.value);
  if (!currentCheck.valid) throw serviceError('CURRENT_INVALID', currentCheck.errors.join('; '), 500);
  if (currentFile.value.run_id !== run_id) {
    throw serviceError('RUN_NOT_CURRENT', 'Retry is allowed only for the current run', 409);
  }

  const statusPath = memoPaths(run_id).status;
  const statusFile = await runtime.readJson(statusPath);
  if (statusFile.sha !== expected_status_sha) {
    throw serviceError('MEMO_SHA_CONFLICT', 'Status changed; refresh before retry', 409);
  }

  const target = statusFile.value.items && statusFile.value.items.find(item => item.item_id === item_id);
  if (!target) throw serviceError('ITEM_NOT_FOUND', 'Unknown item_id ' + item_id, 404);
  if (target.state !== ITEM_STATES.FAILED) {
    throw serviceError('ITEM_NOT_FAILED', 'Only FAILED items can be retried', 409);
  }

  const next = transitionItem(statusFile.value, item_id, ITEM_STATES.READY, { now });
  const write = await runtime.updateJson(statusPath, next, expected_status_sha, 'Retry Memo item ' + item_id);

  const nextCurrent = {
    ...currentFile.value,
    state: next.state,
    updated_at: now
  };
  const currentWrite = await runtime.updateJson(
    'memo/current.json',
    nextCurrent,
    currentFile.sha,
    'Reopen Memo run ' + run_id
  );

  return {
    current: nextCurrent,
    current_sha: currentWrite.sha,
    status: next,
    status_sha: write.sha
  };
}

export async function writeEvidence(runtime, { run_id, item_id, ticker, evidence } = {}) {
  if (!run_id || !item_id || !ticker || !evidence) {
    throw serviceError('EVIDENCE_INPUT_INVALID', 'run_id, item_id, ticker and evidence are required', 400);
  }

  const requestFile = await runtime.readJson(memoPaths(run_id).request);
  try {
    assertRequest(requestFile.value);
  } catch (error) {
    throw serviceError(error.code || 'REQUEST_INVALID', error.message, 500, error.details);
  }

  const item = requestFile.value.items.find(candidate =>
    candidate.item_id === item_id
    && String(candidate.ticker).toUpperCase() === String(ticker).toUpperCase()
  );
  if (!item) throw serviceError('ITEM_NOT_FOUND', 'Canonical request item was not found', 404);

  const check = validateEvidencePayload(evidence);
  if (!check.valid) throw serviceError('EVIDENCE_INVALID', check.errors.join('; '), 400);

  try {
    assertEvidenceOwnedByItem(evidence, item);
  } catch (error) {
    throw serviceError(error.code || 'EVIDENCE_OWNER_MISMATCH', error.message, 400);
  }

  const ref = (item.evidence_refs || []).find(candidate => candidate.document_id === evidence.document_id);
  if (!ref) throw serviceError('EVIDENCE_NOT_REFERENCED', 'Evidence document_id is not referenced by canonical request', 400);
  assertEvidenceMatchesRef(evidence, ref);

  const expectedPath = memoPaths(run_id, item.ticker, evidence.document_id).evidence;
  if (ref.repository_path !== expectedPath || evidence.repository_path !== expectedPath) {
    throw serviceError('EVIDENCE_PATH_MISMATCH', 'Evidence path must equal ' + expectedPath, 400);
  }

  const write = await runtime.createJson(expectedPath, evidence, 'Memo evidence ' + run_id + ' ' + item.ticker);
  return { path: expectedPath, sha: write.sha };
}

export async function rebuildHistoryIndex(runtime, { now = new Date().toISOString() } = {}) {
  const indexFile = await runtime.readJson('memo/index.json');
  let entries = [];

  try {
    entries = await runtime.list('memo/runs');
  } catch (error) {
    if (error.status === 404) entries = [];
    else throw error;
  }

  const summaries = [];
  const skipped = [];
  for (const entry of entries.filter(item => item.type === 'dir')) {
    const runId = entry.name;
    try {
      const run = await getRun(runtime, runId, { includeResults: false });
      if (!TERMINAL_RUN_STATES.includes(run.status.state)) continue;
      summaries.push(buildRunSummary(run.request, run.status));
    } catch (error) {
      skipped.push({
        run_id: runId,
        error: String(error?.message || error)
      });
    }
  }

  const next = rebuildIndex(summaries, now);
  const write = await runtime.updateJson('memo/index.json', next, indexFile.sha, 'Rebuild Memo history index');
  return { index: next, index_sha: write.sha, skipped };
}

export async function inspectMaintenance(runtime) {
  const indexFile = await runtime.readJson('memo/index.json');
  let entries = [];

  try {
    entries = await runtime.list('memo/runs');
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const runIds = entries.filter(item => item.type === 'dir').map(item => item.name);
  const indexed = new Set((indexFile.value.runs || []).map(run => run.run_id));
  const dirs = new Set(runIds);

  return {
    run_ids: runIds,
    missing_from_index: runIds.filter(id => !indexed.has(id)).sort(),
    missing_run_dirs: [...indexed].filter(id => !dirs.has(id)).sort()
  };
}

function assertEvidenceMatchesRef(payload, ref) {
  for (const key of ['document_id', 'item_id', 'ticker', 'filename', 'type', 'checksum', 'size', 'repository_path']) {
    if (payload[key] !== ref[key]) {
      throw serviceError('EVIDENCE_METADATA_MISMATCH', 'Evidence ' + key + ' does not match request reference', 400);
    }
  }
}

export function serviceError(code, message, status = 500, details = null) {
  const error = new Error(message);
  error.name = 'MemoServiceError';
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}
