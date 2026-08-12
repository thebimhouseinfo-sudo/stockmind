import { field, setResult, MISSING_SHORT } from './render-common.js';

export function renderNode6B(ctx) {
  const outputs = ctx.outputs;
  setResult({ ...outputs, screeningContext: ctx.screeningContext, mode: ctx.mode, ticker: ctx.ticker });

  const isScreened = ctx.mode === 'SCREENED';
  const md = [];
  const ticker = ctx.ticker;

  md.push(`# BÁO CÁO PHÂN TÍCH ${ticker}`);
  md.push(`Cập nhật: ${field('date')} · Kỳ dữ liệu: ${field('node1.data_period')} · Chế độ: ${ctx.mode}`);
  md.push('');

  md.push('## 1. Quyết định đầu tư');
  md.push(`- **Khuyến nghị:** ${field('node5.decision')}`);
  md.push(`- **AI Score:** ${field('node5.ai_score.value')}/100 — công thức: ${field('node5.ai_score.formula_shown')}`.replace(/\s+/g, ' '));
  md.push(`- **Độ tin cậy:** ${field('node5.confidence.value')}% (thành phần: data completeness ${field('node5.confidence.components.data_completeness')}%, source quality ${field('node5.confidence.components.source_quality')}%, cross-source ${field('node5.confidence.components.cross_source_agreement')}%, fundamental consistency ${field('node5.confidence.components.fundamental_consistency')}%, technical confirmation ${field('node5.confidence.components.technical_confirmation')}%, macro clarity ${field('node5.confidence.components.macro_clarity')}%)`);
  md.push(`- **Động lực chính:** ${(outputs.node5?.drivers || []).join('; ') || MISSING_SHORT}`);
  md.push(`- **Điều kiện vô hiệu hóa luận điểm (fundamental):** ${field('node5.thesis_invalidation')}`);
  md.push(`- **Ngưỡng cắt lỗ kỹ thuật (trading stop, KHÁC trên):** ${field('node5.trading_stop.price')} — ${field('node5.trading_stop.basis')}`);
  md.push('');

  if (isScreened) {
    const s = outputs.node1?.screening_summary || {};
    md.push('## 2. Screening Snapshot');
    md.push(`> Nguồn: StockScreener (dữ liệu TradingView do người dùng nhập) — bối cảnh ban đầu, KHÔNG phải điểm số CRSM.`);
    md.push('');
    md.push('| Score | Rank | Grade | Quality | Growth | Valuation | Momentum | Mispricing |');
    md.push('|---|---|---|---|---|---|---|---|');
    md.push(`| ${cell(s.screen_score)} | ${cell(s.screen_rank)} | ${cell(s.screen_grade)} | ${cell(s.quality_score)} | ${cell(s.growth_score)} | ${cell(s.valuation_score)} | ${cell(s.momentum_score)} | ${cell(s.mispricing_score)} |`);
    md.push('');
    md.push(`- **CRSM Score:** ${field('node5.ai_score.value')}/100 — **So với Screening:** ${field('node5.screen_vs_crsm.status')} (${field('node5.screen_vs_crsm.interpretation')})`);
    md.push('');
  }

  md.push(`## ${isScreened ? 3 : 2}. Tín hiệu tổng hợp (Conflict Detector)`);
  const cd = outputs.node5?.conflict_detector;
  md.push('| Cơ bản | Kỹ thuật | Vĩ mô | Thanh khoản | Đồng thuận |');
  md.push('|---|---|---|---|---|');
  md.push(`| ${cell(cd?.fundamental)} | ${cell(cd?.technical)} | ${cell(cd?.macro)} | ${cell(cd?.liquidity)} | ${cell(cd?.signal_alignment)} |`);
  md.push('');
  md.push(`- **Catalyst gần nhất:** ${field('node5.catalyst_horizon.nearest_catalyst')} (khung: ${field('node5.catalyst_horizon.bucket')})`);
  md.push('');

  md.push(`## ${isScreened ? 4 : 3}. Vĩ mô & Ngành`);
  md.push(`- Chế độ rủi ro: ${field('node4.risk_regime')}`);
  md.push(`- FED: ${field('node4.macro_indicators.fed_rate.value')} | USD/VND: ${field('node4.macro_indicators.usd_vnd.value')} | Dầu Brent: ${field('node4.macro_indicators.oil_brent.value')} | Lạm phát Mỹ: ${field('node4.macro_indicators.us_inflation.value')}`);
  md.push(`- Ngành so với benchmark: ${field('node2.sector_vs_market.sector_perf_pct')} vs VN-Index ${field('node2.sector_vs_market.vnindex_perf_pct')} — ${field('node2.sector_vs_market.sector_strength_label')}`);
  md.push(`- Nhận định: ${field('node4.macro_view')}`);
  md.push('');

  md.push(`## ${isScreened ? 5 : 4}. Doanh nghiệp & Chất lượng lợi nhuận`);
  md.push(`- Doanh thu: ${field('node1.financial_core_raw.revenue.value')} (${field('node1.financial_core_raw.revenue.period')}, ${field('node1.financial_core_raw.revenue.yoy')})`);
  md.push(`- Lợi nhuận sau thuế: ${field('node1.financial_core_raw.npat.value')} (${field('node1.financial_core_raw.npat.yoy')})`);
  md.push(`- **Chất lượng lợi nhuận:** CFO/NPAT = ${field('node3.earnings_quality.cfo_over_npat')} | FCF/NPAT = ${field('node3.earnings_quality.fcf_over_npat')} | Accrual Ratio = ${field('node3.earnings_quality.accrual_ratio')}`);
  md.push(`- Cờ đỏ: ${(outputs.node3?.earnings_quality?.red_flags || []).join(', ') || 'Không phát hiện bất thường'}`);
  if (isScreened && Array.isArray(outputs.node3?.screening_flags) && outputs.node3.screening_flags.length) {
    md.push('  - Screening triggers đã điều tra: ' + outputs.node3.screening_flags.map(f => `**${f.flag}** (${f.severity}): ${f.observation} — ${f.answer || 'Chưa có dữ liệu'}`).join('; '));
  }
  md.push(`- Phân loại tăng trưởng: ${field('node3.earnings_sustainability.classification')} — ${field('node3.earnings_sustainability.reasoning')}`);
  md.push(`- Lợi thế cạnh tranh: ${field('node3.moat')}`);
  md.push(`- F-Score: ${field('node3.f_score')} | M-Score: ${field('node3.m_score')} (${field('node3.m_score_note')})`);
  md.push(`- WACC: ${field('node3.capital_efficiency.wacc.value')} (${field('node3.capital_efficiency.wacc.formula_note')}) | ROIC: ${field('node3.capital_efficiency.roic.value')} | Kinh tế biên: ${field('node3.capital_efficiency.economic_spread')}`);
  md.push('');

  md.push(`## ${isScreened ? 6 : 5}. Định giá & So sánh ngành`);
  md.push(`- P/E (TTM): ${field('node1.valuation_multiples.pe_ttm')} | P/B: ${field('node1.valuation_multiples.pb_current')}`);
  md.push(`- DCF Fair Value: ${field('node3.valuation.dcf_fair_value')}`);
  md.push(`- **Reverse DCF:** giá hiện tại ngầm định FCF CAGR ${field('node3.valuation.reverse_dcf_implied_fcf_cagr')} — ${field('node3.valuation.reverse_dcf_commentary')}`);
  const peers = outputs.node3?.valuation?.peer_list || [];
  if (peers.length) {
    md.push('- Danh sách peer:');
    md.push('  | Mã | P/E | P/B | ROE | Lý do chọn |');
    md.push('  |---|---|---|---|---|');
    peers.forEach(p => md.push(`  | ${cell(p.ticker)} | ${cell(p.pe)} | ${cell(p.pb)} | ${cell(p.roe)} | ${cell(p.peer_selection_reason)} |`));
  }
  md.push('');

  md.push(`## ${isScreened ? 7 : 6}. Kỹ thuật & Dòng tiền`);
  md.push(`- Nguồn: ${field('node2.ohlcv_source.source')} (${field('node2.ohlcv_source.sessions_used')} phiên)`);
  md.push(`- Xu hướng: ${field('node2.trend_status')} | ${field('node2.sma_200_rel')}`);
  md.push(`- Khối lượng: ${field('node2.volume_analysis.ratio')} — ${field('node2.volume_analysis.classification')} — ${field('node2.volume_analysis.vsa_signal_candidate')} (chỉ là candidate)`);
  md.push(`- Giai đoạn: ${field('node2.smart_money_phase')} (vùng ${field('node2.zones.demand')})`);
  if (isScreened) {
    md.push(`- Đối chiếu momentum screening: ${field('node2.screening_signal_analysis.momentum_signal.status')} — ${field('node2.screening_signal_analysis.momentum_signal.evidence')}`);
  }
  md.push('');

  md.push(`## ${isScreened ? 8 : 7}. Rủi ro`);
  md.push(`- Doanh nghiệp: ${field('node1.market_data.liquidity_flag')}`);
  md.push(`- Vĩ mô: ${field('node4.risk_regime')}`);
  md.push(`- Thanh khoản: ${field('node5.liquidity_note') === MISSING_SHORT ? 'Thanh khoản bình thường' : field('node5.liquidity_note')}`);
  md.push('');

  md.push(`## ${isScreened ? 9 : 8}. Phân tích nhân quả`);
  md.push(`- **Fact:** ${field('node4.causal_chains.0.facts')}`);
  md.push(`- **Suy luận (Inference):** ${field('node4.causal_chains.0.inferences')} — độ tin cậy: ${field('node4.causal_chains.0.inference_confidence')}`);
  md.push(`- **Giả định (Assumption):** ${field('node4.causal_chains.0.assumptions')}`);
  md.push(`- Tóm tắt chuỗi: ${field('node4.causal_chains.0.chain_summary')}`);
  md.push('');

  md.push(`## ${isScreened ? 10 : 9}. Kịch bản`);
  const scenarios = outputs.node4?.risk_scenarios || [];
  if (scenarios.length) {
    md.push('| Kịch bản | Xác suất | Điều kiện |');
    md.push('|---|---|---|');
    scenarios.forEach(s => md.push(`| ${cell(s.case)} | ${cell(s.probability_pct)}% | ${cell(s.condition)} |`));
    md.push('');
  }

  md.push(`## ${isScreened ? 11 : 10}. Chiến lược giao dịch & Quản trị vị thế`);
  md.push(`- Vùng mua: ${field('node5.strategy.entry_zone')} — ${field('node5.strategy.allocation_plan')}`);
  md.push(`- Cắt lỗ kỹ thuật: ${field('node5.trading_stop.price')} (${field('node5.trading_stop.basis')})`);
  md.push(`- Mục tiêu 1: ${field('node5.strategy.tp1')} | Mục tiêu 2: ${field('node5.strategy.tp2')}`);
  md.push(`- **Quản trị vị thế:** Rủi ro/lệnh = ${field('node5.strategy.risk_per_trade_pct_nav')} NAV | Tỷ trọng tối đa = ${field('node5.strategy.max_portfolio_weight_pct')} | Loại vị thế: ${field('node5.strategy.position_type')}`);
  md.push('');

  const sources = outputs.node1?.sources || [];
  md.push(`## ${isScreened ? 12 : 11}. Nguồn dữ liệu`);
  if (isScreened) md.push('- StockScreener (dữ liệu TradingView do người dùng nhập)');
  sources.forEach(s => md.push(`- ${cell(s.name)} — ${cell(s.date)} — ${cell(s.url_or_ref)}`));
  md.push('');
  md.push('---');
  md.push(`*Báo cáo tự động, chỉ dùng tham khảo cá nhân — ${field('date')}.*`);
  md.push('');

  return md.join('\n');
}

function cell(value) {
  if (value == null || value === '') return 'Chưa có dữ liệu';
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}