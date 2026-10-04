import { validateAnalysisResult } from './contracts.js';
import { decisionLabel } from './nodes/render-common.js';
import { renderNode6A } from './nodes/node6a-renderer.js';
import { prepareNode6AOutputs, localizeReportText } from './report-data-normalizer.js';

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
    thesisConviction: result.outputs?.node5?.thesis_conviction ?? null,
    decisionOverlay: result.outputs?.node5?.decision_overlay ?? null,
    marketRegime: result.outputs?.node5?.decision_overlay?.market_regime ?? null,
    riskAttribution: result.outputs?.node5?.risk_attribution ?? [],
    investmentHorizon: result.outputs?.node5?.investment_horizon ?? null,
    monitoringKpis: result.outputs?.node5?.monitoring_kpis ?? [],
    visualReport: localizeReportText(renderNode6A({
      ticker: result.ticker,
      mode: result.analysis_source === 'SCREENED_WEB' ? 'SCREENED' : 'DIRECT',
      screeningContext: result.outputs?.node1?.trusted_screener_snapshot
        ?? result.outputs?.node1?.screening_context
        ?? null,
      sectorType: result.outputs?.node1?.sector_type ?? null,
      outputs: prepareNode6AOutputs(result.outputs)
    })),
    detailReport: normalizeDetailReport(result.outputs.node6b, result),
    validationWarnings: [...(check.warnings || [])],
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


function normalizeDetailReport(markdown, result) {
  if (typeof markdown === 'string' && markdown.trim()) return markdown;

  const n1 = result?.outputs?.node1 || {};
  const n5 = result?.outputs?.node5 || {};
  const d = result?.decision_record || {};
  const lines = [
    `# BÁO CÁO PHÂN TÍCH ${result?.ticker || ''}`,
    '',
    '## 1. Quyết định đầu tư',
    `- **Khuyến nghị:** ${d.decision ?? 'Chưa có dữ liệu'}`,
    `- **Điểm AI:** ${d.ai_score ?? 'Chưa có dữ liệu'}/100`,
    `- **Độ tin cậy:** ${d.confidence ?? 'Chưa có dữ liệu'}%`,
    `- **Độ thuyết phục luận điểm:** ${n5.thesis_conviction?.level ?? d.thesis_conviction ?? 'Chưa có dữ liệu'}`,
    `- **Chế độ thị trường:** ${n5.decision_overlay?.market_regime?.regime_state ?? d.market_regime ?? 'Chưa có dữ liệu'}`,
    `- **Khung đầu tư:** ${n5.investment_horizon?.bucket ?? d.investment_horizon ?? 'Chưa có dữ liệu'}`,
    `- **Luận điểm chính:** ${n5.full_reasoning || 'Chưa có dữ liệu'}`,
    `- **Phản luận mạnh nhất:** ${n5.anti_thesis || 'Chưa có dữ liệu'}`,
    `- **Điều kiện vô hiệu luận điểm:** ${d.thesis_invalidation ?? 'Chưa có dữ liệu'}`,
    '',
    '## 2. Chiến lược giao dịch',
    `- **Vùng mua:** ${d.entry_zone ?? 'Chưa có dữ liệu'}`,
    `- **Cắt lỗ kỹ thuật:** ${d.trading_stop ?? 'Chưa có dữ liệu'}`,
    `- **Mục tiêu 1:** ${d.tp1 ?? 'Chưa có dữ liệu'}`,
    `- **Mục tiêu 2:** ${d.tp2 ?? 'Chưa có dữ liệu'}`,
    '',
    '## 3. Dữ liệu nền',
    `- **Kỳ dữ liệu:** ${n1.data_period ?? 'Chưa có dữ liệu'}`,
    `- **Giá tại thời điểm phân tích:** ${d.price_at_analysis ?? 'Chưa có dữ liệu'}`,
    '',
    '> Báo cáo chi tiết do mô hình tạo chưa khả dụng; đây là bản phục hồi deterministic từ dữ liệu CRSM đã được lưu.'
  ];
  return lines.join('\\n');
}
