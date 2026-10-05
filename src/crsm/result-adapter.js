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
  const generated = typeof markdown === 'string' && markdown.trim()
    ? markdown
    : buildDeterministicDetailReport(result);
  return ensureDetailDepth(generated, result);
}

function ensureDetailDepth(markdown, result) {
  const raw = String(markdown || '');
  const text = raw.trim();
  if (!text) return buildDeterministicDetailReport(result);

  const needsExpectation = Array.isArray(result?.outputs?.node3?.expectation_basis)
    && result.outputs.node3.expectation_basis.length
    && !/(expectation|kỳ vọng|variant view|quan điểm khác biệt)/i.test(text);
  const needsRisk = Array.isArray(result?.outputs?.node5?.risk_attribution)
    && result.outputs.node5.risk_attribution.length
    && !/(risk attribution|phân bổ rủi ro|residual risk|rủi ro còn lại)/i.test(text);
  const needsMonitoring = Array.isArray(result?.outputs?.node5?.monitoring_kpis)
    && result.outputs.node5.monitoring_kpis.length
    && !/(monitoring|theo dõi|what would change|thay đổi quan điểm)/i.test(text);
  const needsMarket = result?.outputs?.node2?.market_context
    && !/(vn-index|vnindex|bối cảnh thị trường việt nam|độ rộng thị trường|relative strength|sức mạnh tương đối)/i.test(text);

  if (!needsExpectation && !needsRisk && !needsMonitoring && !needsMarket) return raw;

  const appendix = buildDetailAppendix(result, { needsExpectation, needsRisk, needsMonitoring, needsMarket });
  const base = raw.replace(/\s*$/, '');
  return appendix ? `${base}\n\n---\n\n${appendix}` : raw;
}

function buildDeterministicDetailReport(result) {
  const n1 = result?.outputs?.node1 || {};
  const n2 = result?.outputs?.node2 || {};
  const n3 = result?.outputs?.node3 || {};
  const n4 = result?.outputs?.node4 || {};
  const n5 = result?.outputs?.node5 || {};
  const d = result?.decision_record || {};

  const lines = [
    `# BÁO CÁO PHÂN TÍCH ${md(result?.ticker)} — ${md(n1.company_name)}`,
    `Cập nhật: ${md(d.date)} · Kỳ dữ liệu: ${md(n1.data_period)} · Nguồn phân tích: ${md(result?.analysis_source)}`,
    '',
    '## 1. Tóm tắt CIO & quyết định đầu tư',
    `- **Khuyến nghị:** ${md(d.decision)}`,
    `- **Điểm AI:** ${md(d.ai_score)}/100 — giữ nguyên công thức sáu yếu tố CRSM.`,
    `- **Độ tin cậy bằng chứng:** ${percentMd(d.confidence)}`,
    `- **Độ thuyết phục luận điểm:** ${md(n5.thesis_conviction?.level ?? d.thesis_conviction)} — ${md(n5.thesis_conviction?.rationale)}`,
    `- **Chế độ thị trường / overlay:** ${md(n5.decision_overlay?.market_regime?.regime_state ?? d.market_regime)}; timing = ${md(n5.decision_overlay?.timing_effect)}; sizing = ${md(n5.decision_overlay?.sizing_effect)}.`,
    `- **Khung đầu tư:** ${md(n5.investment_horizon?.bucket ?? d.investment_horizon)} — ${md(n5.investment_horizon?.rationale)}`,
    '',
    mdParagraph('Luận điểm chính', n5.full_reasoning),
    mdParagraph('Phản luận mạnh nhất', n5.anti_thesis),
    mdParagraph('Điều kiện vô hiệu luận điểm', d.thesis_invalidation),
    mdParagraph('Catalyst gần nhất', joinParts([n5.catalyst_horizon?.nearest_catalyst, n5.catalyst_horizon?.bucket])),
    '',
    '## 2. Luận điểm, kỳ vọng & quan điểm khác biệt',
    mdParagraph('Quan điểm khác biệt', n5.variant_view?.summary),
    mdParagraph('Vì sao khác kỳ vọng tham chiếu', n5.variant_view?.why_different),
    mdParagraph('Payoff nếu đúng', n5.variant_view?.payoff_if_right),
    mdParagraph('Điều gì chứng minh luận điểm sai', n5.variant_view?.what_proves_wrong),
    expectationTable(n3.expectation_basis),
    '',
    '## 3. Chất lượng doanh nghiệp & động lực lợi nhuận',
    mdParagraph('Kết luận cơ bản', n3.conclusion),
    mdParagraph('Chất lượng lợi nhuận', humanizeMd(n3.earnings_quality)),
    mdParagraph('Tính bền vững lợi nhuận', humanizeMd(n3.earnings_sustainability)),
    mdParagraph('Lợi thế cạnh tranh', n3.moat),
    sectorEconomicsBlock(n3.sector_economics, n1.material_questions),
    '',
    '## 4. Định giá & bất đối xứng',
    mdParagraph('Kết luận định giá', humanizeMd(n3.valuation)),
    valuationMethodsTable(n3.sector_economics?.valuation_method_selection),
    scenarioTable(n4.risk_scenarios),
    '',
    '## 5. Bối cảnh thị trường Việt Nam & timing',
    marketContextBlock(n2.market_context, n2),
    mdParagraph('Hàm ý timing', joinParts([
      n5.decision_overlay?.override_rationale,
      n2.conclusion
    ])),
    '',
    '## 6. External drivers & cơ chế truyền dẫn',
    whatChangedTable(n4.what_changed),
    mdParagraph('Kết luận vĩ mô/ngành', n4.conclusion ?? n4.company_impact),
    '',
    '## 7. Rủi ro, phản luận & residual-risk ownership',
    riskAttributionTable(n5.risk_attribution),
    mdParagraph('Thanh khoản', n5.liquidity_note),
    '',
    '## 8. Chiến lược vị thế & quản trị giao dịch',
    `- **Vùng mua:** ${md(d.entry_zone)}`,
    `- **Cắt lỗ kỹ thuật:** ${md(d.trading_stop)} — ${md(n5.trading_stop?.basis)}`,
    `- **Mục tiêu 1:** ${md(d.tp1)}`,
    `- **Mục tiêu 2:** ${md(d.tp2)}`,
    `- **Rủi ro/lệnh:** ${md(n5.strategy?.risk_per_trade_pct_nav)} NAV`,
    `- **Tỷ trọng tối đa:** ${md(n5.strategy?.max_portfolio_weight_pct)}`,
    mdParagraph('Kế hoạch giải ngân', humanizeMd(n5.strategy?.allocation_plan)),
    '',
    '## 9. Monitoring dashboard — điều gì làm thay đổi quyết định',
    monitoringTable(n5.monitoring_kpis),
    changeMindList(n5.what_would_change_my_mind),
    '',
    '## 10. Nguồn & giới hạn dữ liệu',
    sourceList(n1.sources),
    mdParagraph('Giới hạn kỹ thuật', n2.technical_coverage?.note),
    mdParagraph('Giới hạn market context', n2.market_context?.coverage?.note),
    '',
    '> Đây là bản phục hồi deterministic chi tiết từ dữ liệu CRSM canonical; không tạo thêm điểm số, quyết định hay số liệu ngoài Node 1–5.',
    '',
    '*Báo cáo tự động, chỉ dùng tham khảo cá nhân.*'
  ];

  return lines.filter(line => line !== null).join('\n');
}

function buildDetailAppendix(result, flags) {
  const n2 = result?.outputs?.node2 || {};
  const n3 = result?.outputs?.node3 || {};
  const n5 = result?.outputs?.node5 || {};
  const sections = ['## Phụ lục CIO & giám sát'];

  if (flags.needsExpectation) {
    sections.push('### Kỳ vọng tham chiếu & variant view', expectationTable(n3.expectation_basis));
  }
  if (flags.needsMarket) {
    sections.push('### Bối cảnh thị trường Việt Nam', marketContextBlock(n2.market_context, n2));
  }
  if (flags.needsRisk) {
    sections.push('### Phân bổ rủi ro còn lại', riskAttributionTable(n5.risk_attribution));
  }
  if (flags.needsMonitoring) {
    sections.push('### Monitoring dashboard', monitoringTable(n5.monitoring_kpis), changeMindList(n5.what_would_change_my_mind));
  }
  return sections.filter(Boolean).join('\n\n');
}

function expectationTable(items) {
  if (!Array.isArray(items) || !items.length) return '_Chưa có expectation basis đáng tin cậy; không suy diễn consensus._';
  const rows = items.map(item => [
    item.topic,
    item.expectation_basis,
    item.statement,
    item.analyst_view,
    item.gap_direction,
    item.investment_implication,
    refsText(item.source_refs)
  ]);
  return markdownTable(['Chủ đề','Cơ sở kỳ vọng','Kỳ vọng tham chiếu','Quan điểm phân tích','Khoảng cách','Hàm ý đầu tư','Nguồn'], rows);
}

function valuationMethodsTable(items) {
  if (!Array.isArray(items) || !items.length) return '_Không có phương pháp định giá thích hợp được xác minh._';
  return markdownTable(
    ['Phương pháp','Trạng thái','Lý do chọn','Nguồn'],
    items.map(item => [item.method,item.status,item.reason,refsText(item.evidence_refs)])
  );
}

function whatChangedTable(items) {
  if (!Array.isArray(items) || !items.length) return '_Không có external-driver delta đủ bằng chứng để trình bày._';
  return markdownTable(
    ['Driver','Exposure','Prior → Current','Chiều','Mức độ','Lag','Cơ chế/hàm ý','Nguồn'],
    items.map(item => [
      item.driver,
      item.exposure,
      `${md(item.prior_state)} → ${md(item.current_state)}`,
      item.direction,
      item.materiality,
      item.transmission_lag,
      joinParts([item.fact, item.inference, item.assumption ? 'Giả định: ' + item.assumption : null]),
      refsText(item.source_refs)
    ])
  );
}

function riskAttributionTable(items) {
  if (!Array.isArray(items) || !items.length) return '_Chưa có bảng residual-risk attribution._';
  return markdownTable(
    ['Driver','Primary owner','Residual effect','Risk treatment','Rationale','Nguồn'],
    items.map(item => [item.driver,item.primary_owner,item.residual_risk_effect,item.risk_score_treatment,item.rationale,refsText(item.evidence_refs)])
  );
}

function monitoringTable(items) {
  if (!Array.isArray(items) || !items.length) return '_Chưa có monitoring KPI canonical._';
  return markdownTable(
    ['KPI','Hiện tại','Điều kiện theo dõi','Liên kết với thesis','Nguồn'],
    items.map(item => [item.kpi,item.current_state,item.watch_condition,item.thesis_link,refsText(item.source_refs)])
  );
}

function marketContextBlock(context, node2) {
  if (!context || typeof context !== 'object') {
    return mdParagraph('Market context', joinParts([node2?.sector_vs_market, node2?.conclusion]));
  }
  const vn = context.benchmarks?.vnindex || {};
  const secondary = Array.isArray(context.benchmarks?.secondary) ? context.benchmarks.secondary[0] : null;
  const relative = context.stock_relative_strength || {};
  const coverage = context.coverage || {};
  return [
    `- **VN-Index:** ${md(vn.performance_pct)} trong ${md(vn.period)}; xu hướng ${md(vn.trend)}.`,
    `- **Benchmark phụ:** ${secondary ? md(secondary.name) + ' ' + md(secondary.performance_pct) + ' (' + md(secondary.period) + ')' : 'Chưa có dữ liệu'}.`,
    `- **Độ rộng:** ${humanizeMd(context.breadth)}`,
    `- **Thanh khoản thị trường:** ${humanizeMd(context.turnover_liquidity)}`,
    `- **Luân chuyển dẫn dắt:** ${humanizeMd(context.leadership_rotation)}`,
    `- **Khối ngoại toàn thị trường:** ${humanizeMd(context.market_foreign_flow)}`,
    `- **Sức mạnh tương đối cổ phiếu:** ${humanizeMd(relative)}`,
    `- **Coverage:** ${md(coverage.status)}; thiếu: ${refsText(coverage.missing_capabilities)}.`
  ].join('\n');
}

function sectorEconomicsBlock(economics, materialQuestions) {
  const parts = [];
  if (economics && typeof economics === 'object') {
    parts.push(mdParagraph('Sector profile', economics.sector_profile));
    parts.push(mdParagraph('Earnings bridge', humanizeMd(economics.earnings_bridge)));
    parts.push(mdParagraph('Normalized earnings', humanizeMd(economics.normalized_earnings)));
    parts.push(mdParagraph('Capital allocation', humanizeMd(economics.capital_allocation)));
    parts.push(mdParagraph('Balance-sheet capacity', humanizeMd(economics.balance_sheet_capacity)));
  }
  if (Array.isArray(materialQuestions) && materialQuestions.length) {
    parts.push(markdownTable(
      ['Câu hỏi trọng yếu','Trạng thái','Trả lời','Vì sao quan trọng','Nguồn'],
      materialQuestions.map(item => [item.question,item.status,item.answer,item.why_material,refsText(item.source_refs)])
    ));
  }
  return parts.filter(Boolean).join('\n\n') || '_Chưa có sector-economics detail._';
}

function scenarioTable(value) {
  if (!value) return '_Không có kịch bản định lượng đủ bằng chứng._';
  const list = Array.isArray(value)
    ? value
    : Object.entries(value).map(([name, item]) => ({ name, ...(item || {}) }));
  if (!list.length) return '_Không có kịch bản định lượng đủ bằng chứng._';
  return markdownTable(
    ['Kịch bản','Xác suất','Điều kiện','Mục tiêu'],
    list.map(item => [
      item.name ?? item.scenario ?? item.label,
      item.probability ?? item.prob ?? item.weight,
      item.condition ?? item.conditions ?? item.description,
      item.target ?? item.target_price ?? item.price_target ?? item.bear_price
    ])
  );
}

function sourceList(sources) {
  if (!Array.isArray(sources) || !sources.length) return '- Chưa có dữ liệu nguồn.';
  return sources.map(source => {
    const name = source?.name ?? source?.url_or_ref ?? source?.source ?? 'Nguồn';
    return `- ${md(name)} — ${md(source?.date ?? source?.as_of)} — ${md(source?.note ?? source?.description)}`;
  }).join('\n');
}

function changeMindList(items) {
  if (!Array.isArray(items) || !items.length) return '**Điều gì làm thay đổi quan điểm:** Chưa có dữ liệu.';
  return ['**Điều gì làm thay đổi quan điểm:**', ...items.map(item => `- ${md(item)}`)].join('\n');
}

function markdownTable(headers, rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  const header = `| ${headers.map(mdCell).join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map(row => `| ${row.map(mdCell).join(' | ')} |`).join('\n');
  return [header, sep, body].join('\n');
}

function mdParagraph(label, value) {
  return `**${label}:** ${md(value)}`;
}

function md(value) {
  if (value == null || value === '') return 'Chưa có dữ liệu';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Chưa có dữ liệu';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) return value.length ? value.map(md).join('; ') : 'Chưa có dữ liệu';
  if (typeof value === 'object') return humanizeMd(value);
  return String(value).replace(/\s+/g, ' ').trim() || 'Chưa có dữ liệu';
}

function mdCell(value) {
  return md(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
}

function humanizeMd(value) {
  if (value == null || value === '') return 'Chưa có dữ liệu';
  if (Array.isArray(value)) return value.length ? value.map(humanizeMd).join('; ') : 'Chưa có dữ liệu';
  if (typeof value !== 'object') return md(value);
  const pairs = Object.entries(value)
    .filter(([, item]) => item != null && item !== '')
    .map(([key, item]) => `${key.replace(/_/g, ' ')}: ${humanizeMd(item)}`);
  return pairs.length ? pairs.join(' · ') : 'Chưa có dữ liệu';
}

function refsText(value) {
  if (!Array.isArray(value)) return md(value);
  return value.length ? value.map(md).join('; ') : 'Chưa có dữ liệu';
}

function joinParts(values) {
  return (values || []).filter(value => value != null && value !== '').map(md).join(' · ') || 'Chưa có dữ liệu';
}

function percentMd(value) {
  const text = md(value);
  if (text === 'Chưa có dữ liệu' || /%$/.test(text)) return text;
  return text + '%';
}

