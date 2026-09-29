import {
  ANALYSIS_SOURCES,
  CRSM_PIPELINE_VERSION,
  CRSM_REQUEST_VERSION,
  validateAnalysisRequest
} from './contracts.js';

export const DRAFT_SCHEMA_VERSION = 'crsm-draft.v1';
export const DRAFT_STORAGE_KEY = 'stock-mind.crsm-draft.v1';

export function createEmptyDraft(now = null) {
  return {
    schema_version: DRAFT_SCHEMA_VERSION,
    updated_at: now,
    items: []
  };
}

export function loadDraft(storage = defaultStorage()) {
  if (!storage) return createEmptyDraft();
  try {
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return createEmptyDraft();
    const parsed = JSON.parse(raw);
    if (!isValidDraft(parsed)) return createEmptyDraft();
    return normalizeDraft(parsed);
  } catch {
    return createEmptyDraft();
  }
}

export function saveDraft(draft, storage = defaultStorage(), now = new Date().toISOString()) {
  const next = normalizeDraft({
    ...draft,
    schema_version: DRAFT_SCHEMA_VERSION,
    updated_at: now
  });
  if (!storage) return next;
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function clearDraft(storage = defaultStorage(), now = new Date().toISOString()) {
  const next = createEmptyDraft(now);
  if (storage) storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function addManualTicker(draft, ticker, {
  itemId = createId('item'),
  now = new Date().toISOString()
} = {}) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return outcome(draft, false, 'TICKER_REQUIRED');

  const existing = findTicker(draft, normalized);
  if (existing) return outcome(draft, false, 'DUPLICATE', existing);

  const item = {
    item_id: itemId,
    ticker: normalized,
    analysis_source: ANALYSIS_SOURCES.WEB_ONLY,
    screening_context: null,
    documents: [],
    created_at: now
  };

  return outcome(withItems(draft, [...draft.items, item], now), true, null, item);
}

export function addScreenedTicker(draft, ticker, screeningContext, {
  itemId = createId('item'),
  now = new Date().toISOString()
} = {}) {
  const normalized = normalizeTicker(ticker);
  if (!normalized) return outcome(draft, false, 'TICKER_REQUIRED');
  if (!screeningContext || typeof screeningContext !== 'object') {
    return outcome(draft, false, 'SCREENING_CONTEXT_REQUIRED');
  }

  const existing = findTicker(draft, normalized);
  if (existing) {
    return outcome(
      draft,
      false,
      existing.analysis_source === ANALYSIS_SOURCES.SCREENED_WEB
        ? 'DUPLICATE'
        : 'SOURCE_CONFLICT',
      existing
    );
  }

  const item = {
    item_id: itemId,
    ticker: normalized,
    analysis_source: ANALYSIS_SOURCES.SCREENED_WEB,
    screening_context: structuredCloneSafe(screeningContext),
    documents: [],
    created_at: now
  };

  return outcome(withItems(draft, [...draft.items, item], now), true, null, item);
}

export function removeItem(draft, itemId, now = new Date().toISOString()) {
  return withItems(draft, draft.items.filter(item => item.item_id !== itemId), now);
}

export function attachDocuments(draft, itemId, documents, {
  now = new Date().toISOString(),
  idFactory = () => createId('doc')
} = {}) {
  const item = draft.items.find(candidate => candidate.item_id === itemId);
  if (!item) return outcome(draft, false, 'ITEM_NOT_FOUND');
  if (item.analysis_source === ANALYSIS_SOURCES.SCREENED_WEB) {
    return outcome(draft, false, 'SCREENED_EVIDENCE_FORBIDDEN', item);
  }

  const incoming = Array.from(documents || []);
  if (!incoming.length) return outcome(draft, false, 'DOCUMENT_REQUIRED', item);

  const normalizedDocs = incoming.map(document => ({
    document_id: document.document_id || idFactory(),
    filename: document.filename || document.name || 'document',
    type: document.type || 'application/octet-stream',
    size: Number(document.size ?? document.bytes ?? 0),
    checksum: String(document.checksum || ''),
    routing_metadata: {
      source: document.source || 'USER_UPLOAD',
      kind: document.kind || 'user_analysis',
      routing: Array.isArray(document.routing) ? [...document.routing] : []
    },
    extracted_content: document.extracted_content ?? document.content ?? '',
    structure: document.structure ?? null,
    provenance: document.provenance ?? null
  }));

  if (normalizedDocs.some(document => !document.checksum || !document.extracted_content)) {
    return outcome(draft, false, 'DOCUMENT_INVALID', item);
  }

  const existingIds = new Set((item.documents || []).map(document => document.document_id));
  const unique = normalizedDocs.filter(document => !existingIds.has(document.document_id));
  const nextItem = {
    ...item,
    analysis_source: ANALYSIS_SOURCES.EVIDENCE_WEB,
    screening_context: null,
    documents: [...(item.documents || []), ...unique]
  };

  const nextItems = draft.items.map(candidate => candidate.item_id === itemId ? nextItem : candidate);
  return outcome(withItems(draft, nextItems, now), true, null, nextItem);
}

export function removeDocument(draft, itemId, documentId, now = new Date().toISOString()) {
  const item = draft.items.find(candidate => candidate.item_id === itemId);
  if (!item) return outcome(draft, false, 'ITEM_NOT_FOUND');

  const documents = (item.documents || []).filter(document => document.document_id !== documentId);
  const nextItem = {
    ...item,
    documents,
    analysis_source: documents.length
      ? ANALYSIS_SOURCES.EVIDENCE_WEB
      : ANALYSIS_SOURCES.WEB_ONLY
  };

  const nextItems = draft.items.map(candidate => candidate.item_id === itemId ? nextItem : candidate);
  return outcome(withItems(draft, nextItems, now), true, null, nextItem);
}

export function buildSubmission(draft, {
  runId = createRunId(),
  now = new Date().toISOString()
} = {}) {
  if (!draft?.items?.length) throw new Error('Analysis List is empty.');

  const evidencePayloads = [];
  const items = draft.items.map(item => {
    if (item.analysis_source === ANALYSIS_SOURCES.SCREENED_WEB) {
      return {
        item_id: item.item_id,
        ticker: normalizeTicker(item.ticker),
        analysis_source: ANALYSIS_SOURCES.SCREENED_WEB,
        screening_context: structuredCloneSafe(item.screening_context),
        evidence_refs: []
      };
    }

    if (item.analysis_source === ANALYSIS_SOURCES.EVIDENCE_WEB) {
      const evidenceRefs = (item.documents || []).map(document => {
        const repositoryPath = memoEvidencePath(runId, item.ticker, document.document_id);
        const ref = {
          document_id: document.document_id,
          item_id: item.item_id,
          ticker: normalizeTicker(item.ticker),
          filename: document.filename,
          type: document.type,
          checksum: document.checksum,
          size: Number(document.size || 0),
          repository_path: repositoryPath
        };
        evidencePayloads.push({
          ...ref,
          routing_metadata: structuredCloneSafe(document.routing_metadata || {}),
          extracted_content: structuredCloneSafe(document.extracted_content),
          structure: structuredCloneSafe(document.structure),
          provenance: structuredCloneSafe(document.provenance)
        });
        return ref;
      });

      return {
        item_id: item.item_id,
        ticker: normalizeTicker(item.ticker),
        analysis_source: ANALYSIS_SOURCES.EVIDENCE_WEB,
        screening_context: null,
        evidence_refs: evidenceRefs
      };
    }

    return {
      item_id: item.item_id,
      ticker: normalizeTicker(item.ticker),
      analysis_source: ANALYSIS_SOURCES.WEB_ONLY,
      screening_context: null,
      evidence_refs: []
    };
  });

  const request = {
    request_version: CRSM_REQUEST_VERSION,
    pipeline_version: CRSM_PIPELINE_VERSION,
    run_id: runId,
    created_at: now,
    items
  };

  const check = validateAnalysisRequest(request);
  if (!check.valid) throw new Error(check.errors.join('; '));

  return {
    request,
    evidence_payloads: evidencePayloads
  };
}

export function draftSummary(draft) {
  const counts = {
    total: draft?.items?.length || 0,
    SCREENED_WEB: 0,
    EVIDENCE_WEB: 0,
    WEB_ONLY: 0
  };
  for (const item of draft?.items || []) {
    if (item.analysis_source in counts) counts[item.analysis_source] += 1;
  }
  return counts;
}

export function findTicker(draft, ticker) {
  const normalized = normalizeTicker(ticker);
  return (draft?.items || []).find(item => normalizeTicker(item.ticker) === normalized) || null;
}

export function createRunId(now = new Date(), suffix = null) {
  const stamp = now.toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
  return 'run-' + stamp + '-' + (suffix || randomToken(8));
}

function memoEvidencePath(runId, ticker, documentId) {
  return 'memo/runs/' + safeSegment(runId) + '/evidence/'
    + safeSegment(normalizeTicker(ticker)) + '/' + safeSegment(documentId) + '.json';
}

function withItems(draft, items, now) {
  return normalizeDraft({
    ...(draft || createEmptyDraft()),
    schema_version: DRAFT_SCHEMA_VERSION,
    updated_at: now,
    items
  });
}

function normalizeDraft(draft) {
  return {
    schema_version: DRAFT_SCHEMA_VERSION,
    updated_at: draft?.updated_at ?? null,
    items: Array.isArray(draft?.items)
      ? draft.items.map(item => ({
          ...item,
          ticker: normalizeTicker(item.ticker),
          documents: Array.isArray(item.documents) ? item.documents : []
        }))
      : []
  };
}

function isValidDraft(draft) {
  return Boolean(draft)
    && draft.schema_version === DRAFT_SCHEMA_VERSION
    && Array.isArray(draft.items)
    && draft.items.every(item =>
      item
      && typeof item.item_id === 'string'
      && normalizeTicker(item.ticker)
      && Object.values(ANALYSIS_SOURCES).includes(item.analysis_source)
    );
}

function normalizeTicker(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function outcome(draft, changed, reason = null, item = null) {
  return { draft, changed, reason, item };
}

function createId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  return prefix + '-' + (uuid || randomToken(20));
}

function randomToken(length) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) value += alphabet[byte % alphabet.length];
    return value;
  }
  const seed = String(Date.now()) + String(Math.random());
  for (let index = 0; index < length; index += 1) {
    value += alphabet[seed.charCodeAt(index % seed.length) % alphabet.length];
  }
  return value;
}

function safeSegment(value) {
  const text = String(value || '').trim();
  if (!/^[A-Za-z0-9._-]+$/.test(text) || text === '.' || text === '..') {
    throw new Error('Unsafe Memo path segment.');
  }
  return text;
}

function structuredCloneSafe(value) {
  if (value == null) return value;
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function defaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}
