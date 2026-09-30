export const CRSM_REQUEST_VERSION = 'crsm-request.v1';
export const CRSM_RESULT_VERSION = 'crsm-result.v1';
export const CRSM_PIPELINE_VERSION = 'crsm-pipeline.v1';

export const ANALYSIS_SOURCES = Object.freeze({
  SCREENED_WEB: 'SCREENED_WEB',
  EVIDENCE_WEB: 'EVIDENCE_WEB',
  WEB_ONLY: 'WEB_ONLY'
});

export const REQUIRED_RENDER_OUTPUT_KEYS = Object.freeze([
  'node1',
  'node2',
  'node3',
  'node4',
  'node5',
  'node6a',
  'node6b'
]);

export const DECISION_RECORD_FIELDS = Object.freeze([
  'date',
  'ticker',
  'price_at_analysis',
  'decision',
  'ai_score',
  'confidence',
  'entry_zone',
  'trading_stop',
  'tp1',
  'tp2',
  'thesis_invalidation'
]);

export function validateAnalysisItem(item) {
  const errors = [];
  if (!isPlainObject(item)) return fail('item must be an object');

  requireString(item.item_id, 'item_id', errors);
  requireTicker(item.ticker, 'ticker', errors);

  if (!Object.values(ANALYSIS_SOURCES).includes(item.analysis_source)) {
    errors.push('analysis_source must be SCREENED_WEB, EVIDENCE_WEB, or WEB_ONLY');
    return { valid: false, errors };
  }

  const evidenceRefs = Array.isArray(item.evidence_refs) ? item.evidence_refs : [];
  if (!Array.isArray(item.evidence_refs)) errors.push('evidence_refs must be an array');

  if (item.analysis_source === ANALYSIS_SOURCES.SCREENED_WEB) {
    if (!isPlainObject(item.screening_context)) {
      errors.push('SCREENED_WEB requires screening_context');
    }
    if (evidenceRefs.length) {
      errors.push('SCREENED_WEB forbids evidence_refs');
    }
  }

  if (item.analysis_source === ANALYSIS_SOURCES.EVIDENCE_WEB) {
    if (item.screening_context != null) {
      errors.push('EVIDENCE_WEB forbids screening_context');
    }
    if (!evidenceRefs.length) {
      errors.push('EVIDENCE_WEB requires at least one evidence_ref');
    }
    for (const ref of evidenceRefs) {
      errors.push(...validateEvidenceRef(ref, item).errors);
    }
  }

  if (item.analysis_source === ANALYSIS_SOURCES.WEB_ONLY) {
    if (item.screening_context != null) {
      errors.push('WEB_ONLY forbids screening_context');
    }
    if (evidenceRefs.length) {
      errors.push('WEB_ONLY forbids evidence_refs');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidenceRef(ref, ownerItem) {
  const errors = [];
  if (!isPlainObject(ref)) return fail('evidence_ref must be an object');

  requireString(ref.document_id, 'evidence_ref.document_id', errors);
  requireString(ref.item_id, 'evidence_ref.item_id', errors);
  requireTicker(ref.ticker, 'evidence_ref.ticker', errors);
  requireString(ref.filename, 'evidence_ref.filename', errors);
  requireString(ref.type, 'evidence_ref.type', errors);
  requireString(ref.checksum, 'evidence_ref.checksum', errors);
  requireString(ref.repository_path, 'evidence_ref.repository_path', errors);

  if (!Number.isFinite(ref.size) || ref.size < 0) {
    errors.push('evidence_ref.size must be a non-negative finite number');
  }

  if (ownerItem) {
    if (ref.item_id !== ownerItem.item_id) {
      errors.push('evidence_ref.item_id must match owner item_id');
    }
    if (normalizeTicker(ref.ticker) !== normalizeTicker(ownerItem.ticker)) {
      errors.push('evidence_ref.ticker must match owner ticker');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidencePayload(payload) {
  const errors = [];
  if (!isPlainObject(payload)) return fail('evidence payload must be an object');

  const refResult = validateEvidenceRef(payload);
  errors.push(...refResult.errors);

  if (!('extracted_content' in payload)) {
    errors.push('evidence payload requires extracted_content');
  } else if (
    typeof payload.extracted_content !== 'string'
    && !Array.isArray(payload.extracted_content)
    && !isPlainObject(payload.extracted_content)
  ) {
    errors.push('evidence payload extracted_content must be string, array, or object');
  }

  if (payload.routing_metadata != null && !isPlainObject(payload.routing_metadata)) {
    errors.push('evidence payload routing_metadata must be an object when present');
  }

  return { valid: errors.length === 0, errors };
}

export function validateAnalysisRequest(request) {
  const errors = [];
  if (!isPlainObject(request)) return fail('request must be an object');

  if (request.request_version !== CRSM_REQUEST_VERSION) {
    errors.push(`request_version must equal ${CRSM_REQUEST_VERSION}`);
  }
  if (request.pipeline_version !== CRSM_PIPELINE_VERSION) {
    errors.push(`pipeline_version must equal ${CRSM_PIPELINE_VERSION}`);
  }
  requireString(request.run_id, 'run_id', errors);

  if (!Array.isArray(request.items) || request.items.length === 0) {
    errors.push('items must be a non-empty array');
    return { valid: false, errors };
  }

  const itemIds = new Set();
  const tickers = new Set();
  request.items.forEach((item, index) => {
    const result = validateAnalysisItem(item);
    errors.push(...result.errors.map(error => `items[${index}]: ${error}`));

    if (item?.item_id) {
      if (itemIds.has(item.item_id)) errors.push(`items[${index}]: duplicate item_id`);
      itemIds.add(item.item_id);
    }

    const ticker = normalizeTicker(item?.ticker);
    if (ticker) {
      if (tickers.has(ticker)) errors.push(`items[${index}]: duplicate ticker`);
      tickers.add(ticker);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateDecisionRecord(record, ticker = null) {
  const errors = [];
  if (!isPlainObject(record)) return fail('decision_record must be an object');

  for (const field of DECISION_RECORD_FIELDS) {
    if (!(field in record)) errors.push(`decision_record missing field: ${field}`);
  }

  requireString(record.date, 'decision_record.date', errors);
  requireTicker(record.ticker, 'decision_record.ticker', errors);

  if (ticker && normalizeTicker(record.ticker) !== normalizeTicker(ticker)) {
    errors.push('decision_record.ticker must match result ticker');
  }

  return { valid: errors.length === 0, errors };
}

export function validateAnalysisResult(result) {
  const errors = [];
  if (!isPlainObject(result)) return fail('result must be an object');

  if (result.result_version !== CRSM_RESULT_VERSION) {
    errors.push(`result_version must equal ${CRSM_RESULT_VERSION}`);
  }
  if (result.pipeline_version !== CRSM_PIPELINE_VERSION) {
    errors.push(`pipeline_version must equal ${CRSM_PIPELINE_VERSION}`);
  }

  requireString(result.run_id, 'run_id', errors);
  requireString(result.item_id, 'item_id', errors);
  requireTicker(result.ticker, 'ticker', errors);

  if (!Object.values(ANALYSIS_SOURCES).includes(result.analysis_source)) {
    errors.push('analysis_source must be SCREENED_WEB, EVIDENCE_WEB, or WEB_ONLY');
  }

  if (!isPlainObject(result.outputs)) {
    errors.push('outputs must be an object');
  } else {
    for (const key of REQUIRED_RENDER_OUTPUT_KEYS) {
      if (!(key in result.outputs) || result.outputs[key] == null) {
        errors.push(`outputs missing required renderer key: ${key}`);
      }
    }
    if ('node6a' in result.outputs && typeof result.outputs.node6a !== 'string') {
      errors.push('outputs.node6a must be a string');
    }
    if ('node6b' in result.outputs && typeof result.outputs.node6b !== 'string') {
      errors.push('outputs.node6b must be a string');
    }
  }

  const decision = validateDecisionRecord(result.decision_record, result.ticker);
  errors.push(...decision.errors);

  return { valid: errors.length === 0, errors };
}

export function assertValidAnalysisRequest(request) {
  const result = validateAnalysisRequest(request);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return request;
}

export function assertValidAnalysisResult(result) {
  const check = validateAnalysisResult(result);
  if (!check.valid) throw new Error(check.errors.join('; '));
  return result;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} must be a non-empty string`);
}

function requireTicker(value, label, errors) {
  requireString(value, label, errors);
  if (typeof value === 'string' && value.trim() && !/^[A-Z0-9._-]+$/i.test(value.trim())) {
    errors.push(`${label} contains unsupported characters`);
  }
}

function normalizeTicker(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function fail(message) {
  return { valid: false, errors: [message] };
}
