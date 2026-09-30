import { validateAnalysisResult } from './contracts.js';
import { decisionLabel } from './nodes/render-common.js';

export const RESULT_SOURCE_LABELS = Object.freeze({
  SCREENED_WEB: 'Screener + Web',
  EVIDENCE_WEB: 'Documents + Web',
  WEB_ONLY: 'Web only'
});

export function adaptMemoResult(input) {
  const result = input?.value ?? input;
  const check = validateAnalysisResult(result);
  if (!check.valid) {
    const error = new Error(check.errors.join('; '));
    error.code = 'RESULT_INVALID';
    throw error;
  }

  const decision = result.decision_record;
  return {
    runId: result.run_id,
    itemId: result.item_id,
    ticker: normalizeTicker(result.ticker),
    analysisSource: result.analysis_source,
    analysisSourceLabel: sourceLabel(result.analysis_source),
    analysisDate: decision.date,
    decision: decision.decision,
    decisionLabel: decisionLabel(decision.decision),
    aiScore: decision.ai_score,
    confidence: decision.confidence,
    priceAtAnalysis: decision.price_at_analysis,
    entryZone: decision.entry_zone,
    tradingStop: decision.trading_stop,
    tp1: decision.tp1,
    tp2: decision.tp2,
    thesisInvalidation: decision.thesis_invalidation,
    visualReport: result.outputs.node6a,
    detailReport: result.outputs.node6b,
    decisionRecord: { ...decision },
    outputs: result.outputs,
    raw: result
  };
}

export function normalizeMemoRun(run) {
  if (!run?.request || !run?.status) return null;
  const requestItems = new Map(
    (run.request.items || []).map(item => [item.item_id, item])
  );

  const items = (run.status.items || []).map(statusItem => {
    const requestItem = requestItems.get(statusItem.item_id) || null;
    const wrappedResult = run.results?.[normalizeTicker(statusItem.ticker)] || null;
    let result = null;
    let resultError = null;

    if (wrappedResult) {
      try {
        result = adaptMemoResult(wrappedResult);
      } catch (error) {
        resultError = error?.message || String(error);
      }
    }

    const analysisSource = requestItem?.analysis_source
      || statusItem.analysis_source
      || result?.analysisSource
      || null;

    return {
      ...statusItem,
      ticker: normalizeTicker(statusItem.ticker),
      analysis_source: analysisSource,
      analysis_source_label: sourceLabel(analysisSource),
      request_item: requestItem,
      result,
      result_error: resultError
    };
  });

  return {
    run_id: run.request.run_id,
    state: run.status.state,
    created_at: run.status.created_at ?? run.request.created_at ?? null,
    updated_at: run.status.updated_at ?? null,
    status_sha: run.status_sha ?? null,
    request_sha: run.request_sha ?? null,
    items,
    raw: run
  };
}


export function normalizeRenderSnapshot(input) {
  const snapshot = input?.snapshot ?? input;
  if (!snapshot || snapshot.schema_version !== 'stockmind-render.v1' || !Array.isArray(snapshot.items)) {
    return null;
  }

  const items = snapshot.items.map(item => {
    let result = null;
    let resultError = null;
    try {
      result = adaptMemoResult(item.result);
    } catch (error) {
      resultError = error?.message || String(error);
    }
    return {
      item_id: item.item_id,
      ticker: normalizeTicker(item.ticker),
      analysis_source: item.analysis_source,
      analysis_source_label: sourceLabel(item.analysis_source),
      state: 'COMPLETED',
      error: null,
      result_ref: null,
      started_at: null,
      completed_at: item.completed_at ?? snapshot.completed_at ?? null,
      updated_at: item.completed_at ?? snapshot.completed_at ?? null,
      result,
      result_error: resultError
    };
  });

  return {
    run_id: snapshot.run_id,
    state: 'COMPLETED',
    created_at: snapshot.created_at ?? null,
    updated_at: snapshot.completed_at ?? null,
    status_sha: null,
    request_sha: null,
    items,
    raw: snapshot
  };
}

export function summarizeMemoRun(run) {
  const items = run?.items || [];
  const completed = items.filter(item => item.state === 'COMPLETED').length;
  const failed = items.filter(item => item.state === 'FAILED').length;
  const processing = items.filter(item => item.state === 'PROCESSING').length;
  const ready = items.filter(item => item.state === 'READY').length;
  return {
    total: items.length,
    completed,
    failed,
    processing,
    ready
  };
}

export function selectDefaultTicker(run, preferredTicker = null) {
  const items = run?.items || [];
  if (!items.length) return null;

  const preferred = normalizeTicker(preferredTicker);
  if (preferred && items.some(item => item.ticker === preferred)) return preferred;

  const completed = items.find(item => item.state === 'COMPLETED' && item.result);
  if (completed) return completed.ticker;

  return items[0].ticker;
}

export function selectedRunItem(run, ticker) {
  const normalized = normalizeTicker(ticker);
  return (run?.items || []).find(item => item.ticker === normalized) || null;
}

export function decisionLogRows(item) {
  if (!item?.result?.decisionRecord) return [];
  return [{
    ...item.result.decisionRecord,
    analysis_source: item.analysis_source,
    run_id: item.result.runId,
    item_id: item.result.itemId
  }];
}

export function sourceLabel(value) {
  return RESULT_SOURCE_LABELS[value] || value || 'Unknown';
}

function normalizeTicker(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
