import {
  ANALYSIS_SOURCES,
  CRSM_PIPELINE_VERSION,
  CRSM_REQUEST_VERSION,
  CRSM_RESULT_VERSION,
  validateAnalysisRequest,
  validateAnalysisResult,
  validateEvidenceRef
} from '../crsm/contracts.js';

export const MEMO_SCHEMA_VERSION = 'stockmind-memo.v1';

export const ITEM_STATES = Object.freeze({
  READY: 'READY',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
});

export const RUN_STATES = Object.freeze({
  EMPTY: 'EMPTY',
  READY: 'READY',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL'
});

export const TERMINAL_RUN_STATES = Object.freeze([
  RUN_STATES.COMPLETED,
  RUN_STATES.PARTIAL
]);

const ITEM_TRANSITIONS = Object.freeze({
  [ITEM_STATES.READY]: new Set([ITEM_STATES.PROCESSING]),
  [ITEM_STATES.PROCESSING]: new Set([ITEM_STATES.COMPLETED, ITEM_STATES.FAILED]),
  [ITEM_STATES.FAILED]: new Set([ITEM_STATES.READY]),
  [ITEM_STATES.COMPLETED]: new Set()
});

export class MemoProtocolError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'MemoProtocolError';
    this.code = code;
    this.details = details;
  }
}

export function createEmptyCurrent() {
  return {
    schema_version: MEMO_SCHEMA_VERSION,
    run_id: null,
    state: RUN_STATES.EMPTY,
    created_at: null,
    updated_at: null,
    request_ref: null,
    status_ref: null
  };
}

export function createEmptyIndex() {
  return {
    schema_version: MEMO_SCHEMA_VERSION,
    updated_at: null,
    runs: []
  };
}

export function memoPaths(runId, ticker = null, documentId = null) {
  const safeRun = safeSegment(runId, 'run_id');
  const base = `memo/runs/${safeRun}`;
  const paths = {
    current: 'memo/current.json',
    index: 'memo/index.json',
    run_dir: base,
    request: `${base}/request.json`,
    status: `${base}/status.json`
  };

  if (ticker != null) {
    const safeTicker = safeSegment(String(ticker).toUpperCase(), 'ticker');
    paths.result = `${base}/results/${safeTicker}.json`;
    paths.evidence_dir = `${base}/evidence/${safeTicker}`;
    if (documentId != null) {
      const safeDocument = safeSegment(documentId, 'document_id');
      paths.evidence = `${paths.evidence_dir}/${safeDocument}.json`;
    }
  }

  return paths;
}

export function createStatusFromRequest(request, now = null) {
  assertRequest(request);
  const timestamp = now ?? null;
  const items = request.items.map(item => ({
    item_id: item.item_id,
    ticker: normalizeTicker(item.ticker),
    analysis_source: item.analysis_source,
    state: ITEM_STATES.READY,
    error: null,
    result_ref: null,
    started_at: null,
    completed_at: null,
    updated_at: timestamp
  }));

  return {
    schema_version: MEMO_SCHEMA_VERSION,
    run_id: request.run_id,
    state: RUN_STATES.READY,
    created_at: timestamp,
    updated_at: timestamp,
    items
  };
}

export function createCurrentForRun(request, status, now = null) {
  assertRequest(request);
  assertStatus(status);
  if (request.run_id !== status.run_id) {
    throw new MemoProtocolError('MEMO_RUN_ID_MISMATCH', 'request.run_id must match status.run_id');
  }
  const paths = memoPaths(request.run_id);
  return {
    schema_version: MEMO_SCHEMA_VERSION,
    run_id: request.run_id,
    state: status.state,
    created_at: status.created_at ?? now ?? null,
    updated_at: now ?? status.updated_at ?? null,
    request_ref: paths.request,
    status_ref: paths.status
  };
}

export function validateCurrent(current) {
  const errors = [];
  if (!isObject(current)) return invalid('current must be an object');
  if (current.schema_version !== MEMO_SCHEMA_VERSION) errors.push(`schema_version must equal ${MEMO_SCHEMA_VERSION}`);
  if (!Object.values(RUN_STATES).includes(current.state)) errors.push('current.state is invalid');

  if (current.state === RUN_STATES.EMPTY) {
    if (current.run_id != null) errors.push('EMPTY current must have run_id=null');
    if (current.request_ref != null) errors.push('EMPTY current must have request_ref=null');
    if (current.status_ref != null) errors.push('EMPTY current must have status_ref=null');
  } else {
    requireString(current.run_id, 'current.run_id', errors);
    requireString(current.request_ref, 'current.request_ref', errors);
    requireString(current.status_ref, 'current.status_ref', errors);
  }

  return result(errors);
}

export function validateIndex(index) {
  const errors = [];
  if (!isObject(index)) return invalid('index must be an object');
  if (index.schema_version !== MEMO_SCHEMA_VERSION) errors.push(`schema_version must equal ${MEMO_SCHEMA_VERSION}`);
  if (!Array.isArray(index.runs)) {
    errors.push('index.runs must be an array');
    return result(errors);
  }

  const ids = new Set();
  index.runs.forEach((run, i) => {
    if (!isObject(run)) {
      errors.push(`runs[${i}] must be an object`);
      return;
    }
    requireString(run.run_id, `runs[${i}].run_id`, errors);
    if (!TERMINAL_RUN_STATES.includes(run.state)) errors.push(`runs[${i}].state must be terminal`);
    if (run.run_id && ids.has(run.run_id)) errors.push(`runs[${i}].run_id duplicated`);
    ids.add(run.run_id);
  });
  return result(errors);
}

export function validateStatus(status) {
  const errors = [];
  if (!isObject(status)) return invalid('status must be an object');
  if (status.schema_version !== MEMO_SCHEMA_VERSION) errors.push(`schema_version must equal ${MEMO_SCHEMA_VERSION}`);
  requireString(status.run_id, 'status.run_id', errors);
  if (!Object.values(RUN_STATES).includes(status.state) || status.state === RUN_STATES.EMPTY) {
    errors.push('status.state is invalid');
  }
  if (!Array.isArray(status.items) || status.items.length === 0) {
    errors.push('status.items must be a non-empty array');
    return result(errors);
  }

  const ids = new Set();
  const tickers = new Set();
  status.items.forEach((item, i) => {
    if (!isObject(item)) {
      errors.push(`items[${i}] must be an object`);
      return;
    }
    requireString(item.item_id, `items[${i}].item_id`, errors);
    requireString(item.ticker, `items[${i}].ticker`, errors);
    if (!Object.values(ANALYSIS_SOURCES).includes(item.analysis_source)) {
      errors.push(`items[${i}].analysis_source is invalid`);
    }
    if (!Object.values(ITEM_STATES).includes(item.state)) {
      errors.push(`items[${i}].state is invalid`);
    }
    if (item.state === ITEM_STATES.COMPLETED && !item.result_ref) {
      errors.push(`items[${i}] COMPLETED requires result_ref`);
    }
    if (item.item_id && ids.has(item.item_id)) errors.push(`items[${i}].item_id duplicated`);
    ids.add(item.item_id);
    const ticker = normalizeTicker(item.ticker);
    if (ticker && tickers.has(ticker)) errors.push(`items[${i}].ticker duplicated`);
    tickers.add(ticker);
  });

  const derived = deriveRunState(status.items);
  if (status.state !== derived) errors.push(`status.state must equal derived state ${derived}`);
  return result(errors);
}

export function assertCanSubmit(current) {
  const check = validateCurrent(current);
  if (!check.valid) {
    throw new MemoProtocolError('MEMO_CURRENT_INVALID', check.errors.join('; '));
  }
  if (!canSubmitNewRun(current)) {
    throw new MemoProtocolError('MEMO_ACTIVE_RUN_EXISTS', `Run ${current.run_id} is still ${current.state}`);
  }
  return true;
}

export function canSubmitNewRun(current) {
  if (!current || current.state === RUN_STATES.EMPTY || current.run_id == null) return true;
  return TERMINAL_RUN_STATES.includes(current.state);
}

export function transitionItem(status, itemId, nextState, options = {}) {
  assertStatus(status);
  if (!Object.values(ITEM_STATES).includes(nextState)) {
    throw new MemoProtocolError('MEMO_ITEM_STATE_INVALID', `Unsupported state ${nextState}`);
  }

  const index = status.items.findIndex(item => item.item_id === itemId);
  if (index < 0) throw new MemoProtocolError('MEMO_ITEM_NOT_FOUND', `Unknown item_id ${itemId}`);

  const currentItem = status.items[index];
  const allowed = ITEM_TRANSITIONS[currentItem.state];
  if (!allowed?.has(nextState)) {
    throw new MemoProtocolError(
      'MEMO_ITEM_TRANSITION_INVALID',
      `Invalid transition ${currentItem.state} -> ${nextState} for ${itemId}`
    );
  }

  const now = options.now ?? null;
  const nextItem = { ...currentItem, state: nextState, updated_at: now };

  if (nextState === ITEM_STATES.PROCESSING) {
    nextItem.started_at = currentItem.started_at ?? now;
    nextItem.error = null;
  }

  if (nextState === ITEM_STATES.COMPLETED) {
    if (!options.resultRef) {
      throw new MemoProtocolError('MEMO_RESULT_REF_REQUIRED', 'COMPLETED transition requires resultRef');
    }
    nextItem.result_ref = options.resultRef;
    nextItem.error = null;
    nextItem.completed_at = now;
  }

  if (nextState === ITEM_STATES.FAILED) {
    nextItem.error = normalizeError(options.error);
    nextItem.completed_at = null;
  }

  if (currentItem.state === ITEM_STATES.FAILED && nextState === ITEM_STATES.READY) {
    nextItem.error = null;
    nextItem.result_ref = null;
    nextItem.started_at = null;
    nextItem.completed_at = null;
  }

  const items = status.items.map((item, i) => (i === index ? nextItem : { ...item }));
  return {
    ...status,
    items,
    state: deriveRunState(items),
    updated_at: now
  };
}

export function deriveRunState(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new MemoProtocolError('MEMO_STATUS_ITEMS_REQUIRED', 'Cannot derive run state from empty items');
  }
  const states = items.map(item => item.state);
  if (states.every(state => state === ITEM_STATES.READY)) return RUN_STATES.READY;
  if (states.every(state => state === ITEM_STATES.COMPLETED)) return RUN_STATES.COMPLETED;
  if (states.every(state => state === ITEM_STATES.COMPLETED || state === ITEM_STATES.FAILED)) {
    return RUN_STATES.PARTIAL;
  }
  return RUN_STATES.PROCESSING;
}

export function nextResumableItem(status) {
  assertStatus(status);
  return status.items.find(item => item.state === ITEM_STATES.READY || item.state === ITEM_STATES.PROCESSING) ?? null;
}

export function failedItems(status) {
  assertStatus(status);
  return status.items.filter(item => item.state === ITEM_STATES.FAILED);
}

export function buildRunSummary(request, status) {
  assertRequest(request);
  assertStatus(status);
  if (request.run_id !== status.run_id) {
    throw new MemoProtocolError('MEMO_RUN_ID_MISMATCH', 'request.run_id must match status.run_id');
  }

  const completed = status.items.filter(item => item.state === ITEM_STATES.COMPLETED).length;
  const failed = status.items.filter(item => item.state === ITEM_STATES.FAILED).length;
  const terminal = TERMINAL_RUN_STATES.includes(status.state);

  return {
    run_id: request.run_id,
    state: status.state,
    created_at: status.created_at ?? request.created_at ?? null,
    completed_at: terminal ? status.updated_at ?? null : null,
    request_ref: memoPaths(request.run_id).request,
    status_ref: memoPaths(request.run_id).status,
    tickers: request.items.map(item => normalizeTicker(item.ticker)),
    item_count: request.items.length,
    completed_count: completed,
    failed_count: failed
  };
}

export function upsertRunSummary(index, summary, now = null) {
  const check = validateIndex(index);
  if (!check.valid) throw new MemoProtocolError('MEMO_INDEX_INVALID', check.errors.join('; '));
  if (!isObject(summary)) throw new MemoProtocolError('MEMO_SUMMARY_INVALID', 'summary must be an object');
  requireTerminalSummary(summary);

  const runs = index.runs.filter(run => run.run_id !== summary.run_id);
  runs.push({ ...summary });
  runs.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
  return {
    ...index,
    updated_at: now,
    runs
  };
}

export function rebuildIndex(runSummaries, now = null) {
  if (!Array.isArray(runSummaries)) {
    throw new MemoProtocolError('MEMO_REBUILD_INPUT_INVALID', 'runSummaries must be an array');
  }
  let index = createEmptyIndex();
  for (const summary of runSummaries) {
    index = upsertRunSummary(index, summary, now);
  }
  return { ...index, updated_at: now };
}

export function detectIndexOrphans(index, runIds) {
  const check = validateIndex(index);
  if (!check.valid) throw new MemoProtocolError('MEMO_INDEX_INVALID', check.errors.join('; '));
  if (!Array.isArray(runIds)) {
    throw new MemoProtocolError('MEMO_RUN_IDS_INVALID', 'runIds must be an array');
  }
  const dirs = new Set(runIds);
  const indexed = new Set(index.runs.map(run => run.run_id));
  return {
    missing_from_index: [...dirs].filter(id => !indexed.has(id)).sort(),
    missing_run_dirs: [...indexed].filter(id => !dirs.has(id)).sort()
  };
}

export function assertExactSha(expectedSha, actualSha) {
  if (!expectedSha || !actualSha || expectedSha !== actualSha) {
    throw new MemoProtocolError('MEMO_SHA_CONFLICT', 'GitHub blob SHA changed; re-read before update', {
      expected_sha: expectedSha ?? null,
      actual_sha: actualSha ?? null
    });
  }
  return true;
}

export function assertResultCreateOnly(existingSha) {
  if (existingSha) {
    throw new MemoProtocolError('MEMO_RESULT_IMMUTABLE', 'Completed result already exists and must not be overwritten', {
      existing_sha: existingSha
    });
  }
  return true;
}

export function assertEvidenceOwnedByItem(ref, item) {
  const check = validateEvidenceRef(ref, item);
  if (!check.valid) {
    throw new MemoProtocolError('MEMO_EVIDENCE_OWNER_MISMATCH', check.errors.join('; '));
  }
  return true;
}

export function assertRequest(request) {
  const check = validateAnalysisRequest(request);
  if (!check.valid) throw new MemoProtocolError('MEMO_REQUEST_INVALID', check.errors.join('; '));
  return request;
}

export function assertResult(result) {
  const check = validateAnalysisResult(result);
  if (!check.valid) throw new MemoProtocolError('MEMO_RESULT_INVALID', check.errors.join('; '));
  return result;
}

export function assertStatus(status) {
  const check = validateStatus(status);
  if (!check.valid) throw new MemoProtocolError('MEMO_STATUS_INVALID', check.errors.join('; '));
  return status;
}

function requireTerminalSummary(summary) {
  requireStringOrThrow(summary.run_id, 'summary.run_id');
  if (!TERMINAL_RUN_STATES.includes(summary.state)) {
    throw new MemoProtocolError('MEMO_SUMMARY_STATE_INVALID', 'summary.state must be terminal');
  }
}

function safeSegment(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MemoProtocolError('MEMO_PATH_SEGMENT_INVALID', `${label} must be a non-empty string`);
  }
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed) || trimmed === '.' || trimmed === '..') {
    throw new MemoProtocolError('MEMO_PATH_SEGMENT_INVALID', `${label} contains unsafe path characters`);
  }
  return trimmed;
}

function normalizeTicker(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function normalizeError(value) {
  if (value == null) return { message: 'Unknown error' };
  if (typeof value === 'string') return { message: value };
  return {
    message: String(value.message ?? value.error ?? 'Unknown error'),
    code: value.code ?? null
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} must be a non-empty string`);
}

function requireStringOrThrow(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MemoProtocolError('MEMO_FIELD_INVALID', `${label} must be a non-empty string`);
  }
}

function result(errors) {
  return { valid: errors.length === 0, errors };
}

function invalid(message) {
  return { valid: false, errors: [message] };
}

export const CONTRACT_VERSIONS = Object.freeze({
  memo: MEMO_SCHEMA_VERSION,
  request: CRSM_REQUEST_VERSION,
  result: CRSM_RESULT_VERSION,
  pipeline: CRSM_PIPELINE_VERSION
});
