import { field, setResult, MISSING_SHORT } from './render-common.js';

export function renderNode6A(ctx) {
  const outputs = ctx.outputs;
  const { node1, node2, node3, node4, node5 } = outputs;
  setResult({ ...outputs, screeningContext: ctx.screeningContext, mode: ctx.mode, ticker: ctx.ticker });

  const isScreened = ctx.mode === 'SCREENED';
  const decision = field('node5.decision', 'Chưa có dữ liệu');
  const aiScore = pct(field('node5.ai_score.value', MISSING_SHORT));
  const confidence = pct(field('node5.confidence.value', MISSING_SHORT));

  const drivers = (node5?.drivers || []).map(d => `<li>${esc(d)}</li>`).join('') ||
    `<li class="muted">${MISSING_SHORT}</li>`;

  const factors = [
    ['Kỹ thuật', field('node5.scores.technical'), 'green'],
    ['Dòng tiền', field('node5.scores.flow'), 'blue'],
    ['Cơ bản', field('node5.scores.fundamental'), 'yellow'],
    ['Ngành/Vĩ mô', field('node5.scores.sector_macro'), 'purple'],
    ['Định giá', field('node5.scores.valuation'), 'green'],
    ['Rủi ro', field('node5.scores.risk'), 'red']
  ].map(([label, value, color]) => `<div class="metric-card"><span class="muted">${label}</span><strong>${value}</strong></div>`).join('');

  const snapshotBlock = isScreened ? `
    <div class="card border-brand">
      <h3>Screening Snapshot</h3>
      <p class="muted">Nguồn: StockScreener (dữ liệu TradingView do người dùng nhập) — bối cảnh sàng lọc ban đầu, KHÔNG phải điểm số CRSM.</p>
      <div class="score-grid">
        ${snapshotCard('Score', field('node1.screening_summary.screen_score'))}
        ${snapshotCard('Rank', field('node1.screening_summary.screen_rank'))}
        ${snapshotCard('Grade', field('node1.screening_summary.screen_grade'))}
        ${snapshotCard('Quality', field('node1.screening_summary.quality_score'))}
        ${snapshotCard('Growth', field('node1.screening_summary.growth_score'))}
        ${snapshotCard('Valuation', field('node1.screening_summary.valuation_score'))}
        ${snapshotCard('Momentum', field('node1.screening_summary.momentum_score'))}
        ${snapshotCard('Mispricing', field('node1.screening_summary.mispricing_score'))}
      </div>
      <div class="vs-block">
        <span class="muted">CRSM Score</span>
        <strong>${aiScore}/100</strong>
        <span class="badge ${statusClass(field('node5.screen_vs_crsm.status'))}">SCREEN → CRSM: ${field('node5.screen_vs_crsm.status')}</span>
        <p class="muted">${field('node5.screen_vs_crsm.interpretation', '')}</p>
      </div>
    </div>` : '';

  const sourcesHtml = (node1?.sources || []).map(s => esc(s.name || s.url_or_ref || '')).filter(Boolean).join(', ') || 'Chưa có dữ liệu';

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Báo cáo phân tích ${esc(ctx.ticker)}</title>
<style>
  body { font-family: Inter, system-ui, sans-serif; background: #f5f7fb; color: #1a1a1a; margin: 0; padding: 24px; }
  .report { max-width: 1100px; margin: 0 auto; }
  .card { background: #fff; border-radius: 16px; padding: 24px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,.06); }
  .hero { background: linear-gradient(135deg, #1e3a8a, #1e40af); color: #fff; }
  .hero h1 { margin: 0 0 4px; font-size: 28px; }
  .hero .lede { color: #bfdbfe; margin-bottom: 12px; }
  .hero-row { display: flex; gap: 32px; flex-wrap: wrap; }
  .hero-row strong { font-size: 34px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  @media (max-width: 760px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }
  .metric-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; text-align: center;}
  .metric-card strong { display: block; font-size: 20px; margin-top: 4px; }
  .muted { color: #64748b; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-weight: 600; font-size: 12px; }
  .badge-ok { background: #dcfce7; color: #166534; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .badge-err { background: #fee2e2; color: #991b1b; }
  .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  @media (max-width: 760px) { .score-grid { grid-template-columns: repeat(2, 1fr);} }
  .score-grid > div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center;}
  .score-grid strong { display: block; margin-top: 2px; }
  .vs-block { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; background: #fff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #edf1f7; font-size: 14px; }
  th { color: #64748b; font-size: 12px; text-transform: uppercase; }
  ul { margin: 0; padding-left: 18px; }
</style>
</head>
<body>
<div class="report">
  <div class="card hero">
    <p class="lede">HOSE: ${esc(ctx.ticker)} · Cập nhật: ${field('date')} · Kỳ dữ liệu: ${field('node1.data_period')}</p>
    <h1>BÁO CÁO PHÂN TÍCH CHUYÊN SÂU</h1>
    <div class="hero-row">
      <div><p class="muted">Quyết định</p><strong>${decision}</strong></div>
      <div><p class="muted">AI Score</p><strong>${aiScore}<span style="font-size:16px">/100</span></strong></div>
      <div><p class="muted">Tin tưởng</p><strong>${confidence}</strong></div>
      <div><p class="muted">Điều kiện vô hiệu</p><p>${field('node5.thesis_invalidation')}</p></div>
    </div>
    <ul>${drivers}</ul>
  </div>

  ${snapshotBlock}

  <div class="card">
    <div class="grid-2">
      <div>
        <h3>Hệ thống chấm điểm AI</h3>
        <div class="score-grid">${factors}</div>
        <p class="muted">Buổi đánh giá: ${field('node5.ai_score.formula_shown', '')}</p>
      </div>
      <div>
        <h3>Tín hiệu tổng hợp</h3>
        ${conflictSignals(node5)}
        <p class="muted">Catalyst gần nhất: ${field('node5.catalyst_horizon.nearest_catalyst')} (${field('node5.catalyst_horizon.bucket')})</p>
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3>Vĩ mô</h3>
      <p class="muted">Chế độ rủi ro: <strong>${field('node4.risk_regime')}</strong></p>
      <p>FED: ${field('node4.macro_indicators.fed_rate.value')} · USD/VND: ${field('node4.macro_indicators.usd_vnd.value')} · Dầu Brent: ${field('node4.macro_indicators.oil_brent.value')} · Lạm phát: ${field('node4.macro_indicators.us_inflation.value')}</p>
      <p>${field('node4.macro_view')}</p>
    </div>
    <div class="card">
      <h3>Nhóm ngành</h3>
      <p class="muted">Sức mạnh ngành: <strong>${field('node2.sector_vs_market.sector_strength_label')}</strong></p>
      <p>Ngành (${field('node2.sector_vs_market.period')}): ${field('node2.sector_vs_market.sector_perf_pct')} · VN-Index: ${field('node2.sector_vs_market.vnindex_perf_pct')}</p>
      <p>${field('node2.conclusion')}</p>
    </div>
  </div>

  <div class="card">
    <h3>Doanh nghiệp & Chất lượng lợi nhuận</h3>
    <table>
      <tr><th>Doanh thu (${field('node1.financial_core_raw.revenue.period')})</th><td>${field('node1.financial_core_raw.revenue.value')} (${field('node1.financial_core_raw.revenue.yoy')})</td></tr>
      <tr><th>Lợi nhuận sau thuế</th><td>${field('node1.financial_core_raw.npat.value')} (${field('node1.financial_core_raw.npat.yoy')})</td></tr>
      <tr><th>CFO/NPAT</th><td>${field('node3.earnings_quality.cfo_over_npat')}</td></tr>
      <tr><th>FCF/NPAT</th><td>${field('node3.earnings_quality.fcf_over_npat')}</td></tr>
      <tr><th>Accrual Ratio</th><td>${field('node3.earnings_quality.accrual_ratio')}</td></tr>
      <tr><th>Phân loại tăng trưởng</th><td>${field('node3.earnings_sustainability.classification')} — ${field('node3.earnings_sustainability.reasoning')}</td></tr>
      <tr><th>F-Score / M-Score</th><td>${field('node3.f_score')} / ${field('node3.m_score')} (${field('node3.m_score_note')})</td></tr>
      <tr><th>WACC / ROIC / Kinh tế biên</th><td>${field('node3.capital_efficiency.wacc.value')} / ${field('node3.capital_efficiency.roic.value')} / ${field('node3.capital_efficiency.economic_spread')}</td></tr>
      <tr><th>Moat</th><td>${field('node3.moat')}</td></tr>
    </table>
  </div>

  <div class="card">
    <h3>Định giá & So sánh</h3>
    <p class="muted">P/E (TTM): <strong>${field('node1.valuation_multiples.pe_ttm')}</strong> · P/B: <strong>${field('node1.valuation_multiples.pb_current')}</strong> · DCF Fair Value: <strong>${field('node3.valuation.dcf_fair_value')}</strong></p>
    <p>Reverse DCF: ${field('node3.valuation.reverse_dcf_commentary')}</p>
    ${peersTable(node3)}
  </div>

  <div class="card">
    <h3>Kỹ thuật</h3>
    <p>Xu hướng: ${field('node2.trend_status')} · ${field('node2.sma_200_rel')}</p>
    <p>Volume Ratio: ${field('node2.volume_analysis.ratio')} — ${field('node2.volume_analysis.classification')} — ${field('node2.volume_analysis.vsa_signal_candidate')}</p>
    <p>Giai đoạn: ${field('node2.smart_money_phase')} (${field('node2.zones.demand')})</p>
  </div>

  <div class="grid-2">
    <div class="card">
      <h3>Quản trị Rủi ro</h3>
      <p>Doanh nghiệp: ${field('node5.liquidity_note')}</p>
      <p>Vĩ mô: ${field('node4.risk_regime')}</p>
      <p>Thanh khoản: ${field('node1.market_data.liquidity_flag')}</p>
    </div>
    <div class="card">
      <h3>Phân tích Nhân quả</h3>
      <p>Gốc: ${field('node4.causal_chains.0.facts')}</p>
      <p>Quả: ${field('node4.causal_chains.0.chain_summary')}</p>
      <p>Kỹ thuật: ${field('node4.causal_chains.0.inferences')}</p>
    </div>
  </div>

  <div class="card">
    <h3>Kịch bản</h3>
    ${scenariosTable(node4)}
  </div>

  <div class="card">
    <h3>Chiến lược giao dịch</h3>
    <table>
      <tr><th>Vùng mua</th><td>${field('node5.strategy.entry_zone')} — ${field('node5.strategy.allocation_plan')}</td></tr>
      <tr><th>Cắt lỗ kỹ thuật</th><td>${field('node5.trading_stop.price')} (${field('node5.trading_stop.basis')})</td></tr>
      <tr><th>Mục tiêu 1 / 2</th><td>${field('node5.strategy.tp1')} / ${field('node5.strategy.tp2')}</td></tr>
      <tr><th>Quản trị vị thế</th><td>Rủi ro/lệnh ${field('node5.strategy.risk_per_trade_pct_nav')} NAV · Tỷ trọng tối đa ${field('node5.strategy.max_portfolio_weight_pct')} · Loại ${field('node5.strategy.position_type')}</td></tr>
    </table>
  </div>

  <p class="muted" style="font-size:12px;">Nguồn: ${sourcesHtml}</p>
  <p class="muted" style="font-size:12px;">Báo cáo tự động bởi CRSM · ${field('date')} · Không phải khuyến nghị đầu tư chính thức.</p>
</div>
</body>
</html>`;
}

function snapshotCard(label, value) {
  return `<div><span class="muted">${label}</span><strong>${value}</strong></div>`;
}

function conflictSignals(node5) {
  if (!node5?.conflict_detector) return `<p class="muted">${MISSING_SHORT}</p>`;
  const d = node5.conflict_detector;
  return `
    <table>
      <tr><th>Cơ bản</th><td>${d.fundamental ?? MISSING_SHORT}</td></tr>
      <tr><th>Kỹ thuật</th><td>${d.technical ?? MISSING_SHORT}</td></tr>
      <tr><th>Vĩ mô</th><td>${d.macro ?? MISSING_SHORT}</td></tr>
      <tr><th>Thanh khoản</th><td>${d.liquidity ?? MISSING_SHORT}</td></tr>
      <tr><th>Đồng thuận tín hiệu</th><td>${d.signal_alignment ?? MISSING_SHORT}</td></tr>
    </table>`;
}

function peersTable(node3) {
  const peers = node3?.valuation?.peer_list || [];
  if (!peers.length) return `<p>${MISSING_SHORT}</p>`;
  return `<table>
    <tr><th>Mã</th><th>P/E</th><th>P/B</th><th>ROE</th><th>Lý do chọn</th></tr>
    ${peers.map(p => `<tr><td>${esc(p.ticker)}</td><td>${p.pe ?? ''}</td><td>${p.pb ?? ''}</td><td>${p.roe ?? ''}</td><td>${esc(p.peer_selection_reason || '')}</td></tr>`).join('')}
  </table>`;
}

function scenariosTable(node4) {
  const scenarios = node4?.risk_scenarios || [];
  if (!scenarios.length) return `<p>${MISSING_SHORT}</p>`;
  return `<table>
    <tr><th>Kịch bản</th><th>Xác suất</th><th>Điều kiện</th></tr>
    ${scenarios.map(s => `<tr><td>${esc(s.case)}</td><td>${s.probability_pct ?? ''}%</td><td>${esc(s.condition || '')}</td></tr>`).join('')}
  </table>`;
}

function statusClass(status) {
  if (status === 'CONFIRMED') return 'badge-ok';
  if (status === 'PARTIAL') return 'badge-warn';
  if (status === 'DIVERGENT') return 'badge-err';
  return '';
}

function pct(value) {
  if (value == null || value === MISSING_SHORT) return value ?? MISSING_SHORT;
  if (String(value).includes('%')) return value;
  if (!Number.isFinite(Number(value))) return value;
  return `${Math.round(Number(value) * 100) / 100}%`;
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}