import { validateAnalysisResult } from './contracts.js';
import { decisionLabel } from './nodes/render-common.js';
import { renderNode6A } from './nodes/node6a-renderer.js';

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
    visualReport: renderNode6A({
      ticker: result.ticker,
      mode: result.analysis_source === 'SCREENED_WEB' ? 'SCREENED' : 'DIRECT',
      screeningContext: result.outputs?.node1?.trusted_screener_snapshot
        ?? result.outputs?.node1?.screening_context
        ?? null,
      sectorType: result.outputs?.node1?.sector_type ?? null,
      outputs: result.outputs
    }),
    detailReport: result.outputs.node6b,
    decisionRecord: { ...decision },
    outputs: result.outputs,
    raw: result
  };
}


export function normalizeVisualReportHtml(input, result = null) {
  let html = String(input ?? '');
  if (!html.trim()) return html;

  const doctypeStart = html.search(/<!doctype\s+html/i);
  const htmlStart = html.search(/<html(?:\s|>)/i);
  const start = doctypeStart >= 0 ? doctypeStart : htmlStart;
  const end = html.toLowerCase().lastIndexOf('</html>');
  if (start >= 0 && end >= start) {
    html = html.slice(start, end + '</html>'.length);
  }

  html = html.replace(/class=(["'])([\s\S]*?)\1/g, (match, quote, value) => {
    const cleaned = value
      .replace(/\bData\s+not\s+available\b/gi, '')
      .replace(/\bChưa\s+có\s+dữ\s+liệu\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return `class=${quote}${cleaned}${quote}`;
  });

  html = html.replace(/style=(["'])([\s\S]*?)\1/g, (match, quote, value) => {
    const cleaned = value
      .replace(/width\s*:\s*(?:Data\s+not\s+available|Chưa\s+có\s+dữ\s+liệu)/gi, 'width:0%');
    return `style=${quote}${cleaned}${quote}`;
  });

  const decisionRecord = result?.decision_record ?? result?.decisionRecord ?? null;
  const node5 = result?.outputs?.node5 ?? result?.node5 ?? null;
  const aiScore = firstFinite(decisionRecord?.ai_score, node5?.ai_score?.value);
  const confidence = firstFinite(decisionRecord?.confidence, node5?.confidence?.value);
  const decision = decisionRecord?.decision ?? node5?.decision ?? null;

  if (Number.isFinite(aiScore)) {
    html = html.replace(
      /(<p[^>]*>\s*AI Score\s*<\/p>\s*<p[^>]*>)[^<]*(<span[^>]*>\s*\/100\s*<\/span>)/i,
      (_, before, after) => `${before}${formatCanonicalNumber(aiScore)}${after}`
    );
    html = html.replace(
      /(<span[^>]*>\s*CRSM Score\s*<\/span>\s*<strong[^>]*>)[^<]*(<\/strong>)/i,
      (_, before, after) => `${before}${formatCanonicalNumber(aiScore)}/100${after}`
    );
  }

  if (Number.isFinite(confidence)) {
    html = html.replace(
      /(<p[^>]*>\s*(?:Tin tưởng|Confidence)\s*<\/p>\s*<p[^>]*>)[^<]*(<\/p>)/i,
      (_, before, after) => `${before}${formatCanonicalNumber(confidence)}%${after}`
    );
  }

  if (decision) {
    html = html.replace(
      /(<h2[^>]*>\s*Quyết định đầu tư\s*<\/h2>\s*<div[^>]*>)[^<]*(<\/div>)/i,
      (_, before, after) => `${before}${decisionLabel(decision)}${after}`
    );
  }

  return html;
}

function firstFinite(...values) {
  for (const value of values) {
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function formatCanonicalNumber(value) {
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2, useGrouping: false });
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
