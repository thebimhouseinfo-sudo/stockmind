import { field, setResult, MISSING_SHORT, decisionLabel } from './render-common.js';

// Node 6B is the locked, text-first Word report template.
// legacy/CRSM/NODE_6B.md is reference-only and must never be modified.
export function renderNode6B(ctx) {
  const outputs = ctx.outputs || {};
  setResult({ ...outputs, screeningContext: ctx.screeningContext, mode: ctx.mode, ticker: ctx.ticker, sectorType: ctx.sectorType });

  const isScreened = ctx.mode === 'SCREENED';
  const n1 = outputs.node1 || {};
  const n2 = outputs.node2 || {};
  const n3 = outputs.node3 || {};
  const n4 = outputs.node4 || {};
  const n5 = outputs.node5 || {};
  const md = [];
  const ticker = ctx.ticker || n1.ticker || MISSING_SHORT;
  const modeLabel = isScreened ? 'SÀNG LỌC (SCREENED)' : 'TRỰC TIẾP (DIRECT)';

  md.push(`# BÁO CÁO PHÂN TÍCH ${ticker} — ${field('node1.company_name')}`);
  md.push(`Cập nhật: ${field('date')} · Kỳ dữ liệu: ${field('node1.data_period')} · Chế độ: ${modeLabel}`);
  md.push('');

  md.push('## 1. Quyết định đầu tư');
  md.push(`- **Khuyến nghị:** ${decisionLabel(field('node5.decision'))}`);
  md.push(`- **Điểm AI:** ${field('node5.ai_score.value')}/100 — công thức: ${field('node5.ai_score.formula_shown')}`.replace(/\s+/g, ' '));
  md.push(`- **Độ tin cậy:** ${field('node5.confidence.value')}% (thành phần: độ đầy đủ dữ liệu ${field('node5.confidence.components.data_completeness')}%, chất lượng nguồn ${field('node5.confidence.components.source_quality')}%, mức đồng thuận giữa nguồn ${field('node5.confidence.components.cross_source_agreement')}%, tính nhất quán cơ bản ${field('node5.confidence.components.fundamental_consistency')}%, xác nhận kỹ thuật ${field('node5.confidence.components.technical_confirmation')}%, độ rõ vĩ mô ${field('node5.confidence.components.macro_clarity')}%)`);
  md.push(`- **Động lực chính:** ${drivers(n5.drivers)}`);
  md.push(`- **Điều kiện vô hiệu hóa luận điểm (cơ bản):** ${field('node5.thesis_invalidation')}`);
  md.push(`- **Ngưỡng cắt lỗ kỹ thuật (KHÁC với trên):** ${field('node5.trading_stop.price')} — ${field('node5.trading_stop.basis')}`);
  md.push('');

  if (isScreened) {
    const s = n1.screening_summary || {};
    md.push('## 2. Tóm tắt sàng lọc');
    md.push('> Nguồn: StockScreener (dữ liệu người dùng nhập từ TradingView) — đây là bối cảnh sàng lọc ban đầu, KHÔNG phải điểm số của CRSM.');
    md.push('');
    md.push('| Điểm | Hạng | Phân loại | Chất lượng | Tăng trưởng | Định giá | Động lượng | Định giá sai |');
    md.push('|---|---|---|---|---|---|---|---|');
    md.push(`| ${cell(s.screen_score)} | ${cell(s.screen_rank)} | ${cell(s.screen_grade)} | ${cell(s.quality_score)} | ${cell(s.growth_score)} | ${cell(s.valuation_score)} | ${cell(s.momentum_score)} | ${cell(s.mispricing_score)} |`);
    md.push('');
    md.push(`- **Điểm CRSM:** ${field('node5.ai_score.value')}/100 — **So với sàng lọc:** ${screenStatusLabel(field('node5.screen_vs_crsm.status'))} (${field('node5.screen_vs_crsm.interpretation')})`);
    md.push('');
  }

  const base = isScreened ? 3 : 2;
  md.push(`## ${base}. Tín hiệu tổng hợp (Bộ phát hiện xung đột)`);
  const cd = n5.conflict_detector || {};
  md.push('| Cơ bản | Kỹ thuật | Vĩ mô | Thanh khoản | Đồng thuận |');
  md.push('|---|---|---|---|---|');
  md.push(`| ${signalLabel(cd.fundamental)} | ${signalLabel(cd.technical)} | ${signalLabel(cd.macro)} | ${signalLabel(cd.liquidity)} | ${signalLabel(cd.signal_alignment ?? cd.alignment)} |`);
  md.push('');
  md.push(`- **Chất xúc tác gần nhất:** ${field('node5.catalyst_horizon.nearest_catalyst')} (khung: ${catalystLabel(field('node5.catalyst_horizon.bucket'))})`);
  md.push('');

  md.push(`## ${base + 1}. Vĩ mô & Ngành`);
  md.push(`- Chế độ rủi ro: ${riskLabel(field('node4.risk_regime'))}`);
  md.push(`- FED: ${field('node4.macro_indicators.fed_rate.value')} | USD/VND: ${field('node4.macro_indicators.usd_vnd.value')} | Dầu Brent: ${field('node4.macro_indicators.oil_brent.value')} | Lạm phát Mỹ: ${field('node4.macro_indicators.us_inflation.value')}`);
  md.push('- Biến số nhạy cảm riêng của doanh nghiệp:');
  renderSensitivity(md, n4.sensitivity_table);
  md.push(`- Ngành so với chỉ số tham chiếu (${field('node2.sector_vs_market.benchmark_method')}): ${field('node2.sector_vs_market.sector_perf_pct')} so với ${field('node2.sector_vs_market.benchmark_name', 'VN-Index')} ${field('node2.sector_vs_market.vnindex_perf_pct')} — ${field('node2.sector_vs_market.sector_strength_label')}`);
  md.push(`- Nhận định: ${field('node4.macro_view')}`);
  md.push('');

  md.push(`## ${base + 2}. Doanh nghiệp & Chất lượng lợi nhuận`);
  md.push(`- Doanh thu: ${field('node1.financial_core_raw.revenue.value')} (${field('node1.financial_core_raw.revenue.period')}, ${field('node1.financial_core_raw.revenue.yoy')})`);
  md.push(`- Lợi nhuận sau thuế: ${field('node1.financial_core_raw.npat.value')} (${field('node1.financial_core_raw.npat.yoy')})`);
  md.push(`- **Chất lượng lợi nhuận:** CFO/NPAT = ${field('node3.earnings_quality.cfo_over_npat')} | FCF/NPAT = ${field('node3.earnings_quality.fcf_over_npat')} | Tỷ lệ dồn tích = ${field('node3.earnings_quality.accrual_ratio')}`);
  md.push(`- Cờ đỏ (nếu có): ${listOrMissing(n3.earnings_quality?.red_flags, 'Không phát hiện bất thường')}`);
  if (isScreened) {
    md.push('- Các cờ sàng lọc đã điều tra:');
    renderScreeningFlags(md, n3.screening_flags);
  }
  md.push(`- **Phân loại tăng trưởng:** ${classificationLabel(field('node3.earnings_sustainability.classification'))} — ${field('node3.earnings_sustainability.reasoning')}`);
  md.push(`- Lợi thế cạnh tranh: ${field('node3.moat')}`);
  md.push(`- F-Score: ${field('node3.f_score')} | M-Score: ${field('node3.m_score')} (${field('node3.m_score_note')})`);
  md.push(`- WACC: ${field('node3.capital_efficiency.wacc.value')} (công thức: ${field('node3.capital_efficiency.wacc.formula_note')}) | ROIC: ${field('node3.capital_efficiency.roic.value')} | Chênh lệch kinh tế: ${field('node3.capital_efficiency.economic_spread')}`);
  md.push('');

  md.push(`## ${base + 3}. Định giá & So sánh ngành`);
  md.push(`- P/E (TTM): ${field('node1.valuation_multiples.pe_ttm')} | P/E trung bình nhóm so sánh: ${peerAverage(n3)}`);
  md.push(`- P/B: ${field('node1.valuation_multiples.pb_current')} — ${field('node1.valuation_multiples.pb_description')}`);
  md.push(`- Giá trị hợp lý DCF: ${field('node3.valuation.dcf_fair_value')}`);
  md.push(`- **Reverse DCF:** giá hiện tại ngầm định FCF CAGR ~${field('node3.valuation.reverse_dcf_implied_fcf_cagr')} — ${field('node3.valuation.reverse_dcf_commentary')}`);
  md.push('- Danh sách mã so sánh (lý do chọn từng mã):');
  renderPeers(md, n3.valuation?.peer_list || n3.peer_list);
  md.push('');

  md.push(`## ${base + 4}. Kỹ thuật & Dòng tiền`);
  md.push(`- Nguồn dữ liệu giá: ${field('node2.ohlcv_source.source')} (${field('node2.ohlcv_source.sessions_used')} phiên, ${field('node2.ohlcv_source.date_range')})`);
  md.push(`- Xu hướng: ${trendLabel(field('node2.trend_status'))} | So với SMA200: ${field('node2.sma_200_rel')}`);
  md.push(`- Khối lượng: ${field('node2.volume_analysis.ratio')} — phân loại: ${volumeLabel(field('node2.volume_analysis.classification'))} (chỉ là tín hiệu ứng viên, không khẳng định dòng tiền lớn nếu chưa có bằng chứng)`);
  md.push(`- Giai đoạn: ${field('node2.smart_money_phase')} tại vùng ${field('node2.zones.demand')} — ${field('node2.smart_money_insight')}`);
  if (isScreened) md.push(`- Đối chiếu động lượng sàng lọc — trạng thái ${signalLabel(field('node2.screening_signal_analysis.momentum_signal.status'))}, bằng chứng: ${field('node2.screening_signal_analysis.momentum_signal.evidence')}`);
  md.push('');

  md.push(`## ${base + 5}. Rủi ro`);
  md.push(`- Doanh nghiệp: ${field('node1.market_data.liquidity_flag')}`);
  md.push(`- Vĩ mô: ${riskLabel(field('node4.risk_regime'))}`);
  const liquidity = field('node5.liquidity_note');
  md.push(`- Thanh khoản: ${liquidity === MISSING_SHORT ? 'Thanh khoản bình thường' : liquidity}`);
  md.push('');

  md.push(`## ${base + 6}. Phân tích nhân quả (tách SỰ KIỆN / SUY LUẬN / GIẢ ĐỊNH)`);
  md.push(`- **Sự kiện (Fact):** ${field('node4.causal_chains.0.facts')}`);
  md.push(`- **Suy luận (Inference):** ${field('node4.causal_chains.0.inferences')} — độ tin cậy: ${field('node4.causal_chains.0.inference_confidence')}`);
  md.push(`- **Giả định (Assumption):** ${field('node4.causal_chains.0.assumptions')}`);
  md.push(`- Tóm tắt chuỗi: ${field('node4.causal_chains.0.chain_summary')}`);
  md.push('');

  md.push(`## ${base + 7}. Kịch bản`);
  renderScenarios(md, n4.risk_scenarios);
  md.push('');

  md.push(`## ${base + 8}. Chiến lược giao dịch & Quản trị vị thế`);
  md.push(`- Vùng mua: ${field('node5.strategy.entry_zone')} — ${field('node5.strategy.allocation_plan')}`);
  md.push(`- Cắt lỗ kỹ thuật (Trading Stop): ${field('node5.trading_stop.price')} (${field('node5.trading_stop.basis')})`);
  md.push(`- Mục tiêu 1: ${field('node5.strategy.tp1')} (${field('node5.strategy.tp1_desc')}) | Mục tiêu 2: ${field('node5.strategy.tp2')} (${field('node5.strategy.tp2_desc')})`);
  md.push(`- Lộ trình giải ngân: ${allocationSteps(n5.strategy?.allocation_plan)}`);
  md.push(`- **Quản trị vị thế:** Rủi ro/lệnh = ${field('node5.strategy.risk_per_trade_pct_nav')} NAV | Tỷ trọng tối đa = ${field('node5.strategy.max_portfolio_weight_pct')} | Loại vị thế: ${positionLabel(field('node5.strategy.position_type'))}`);
  md.push('');

  md.push(`## ${base + 9}. Nguồn dữ liệu`);
  if (isScreened) md.push('- StockScreener (dữ liệu TradingView do người dùng nhập)');
  renderSources(md, n1.sources);
  md.push('');
  md.push('---');
  md.push(`*Báo cáo tự động, chỉ dùng tham khảo cá nhân — ${field('date')}.*`);
  md.push('');

  return md.join('\n');
}

function cell(value) {
  if (value == null || value === '') return MISSING_SHORT;
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function drivers(value) {
  if (!Array.isArray(value) || value.length === 0) return MISSING_SHORT;
  return value.slice(0, 3).map(cell).join('; ');
}

function listOrMissing(value, fallback = MISSING_SHORT) {
  if (!Array.isArray(value) || value.length === 0) return fallback;
  return value.map(cell).join('; ');
}

function renderSensitivity(md, table) {
  md.push('| Biến số | Độ nhạy | Chiều tác động | Độ tin cậy |');
  md.push('|---|---|---|---|');
  if (!Array.isArray(table) || table.length === 0) {
    md.push(`| ${MISSING_SHORT} | ${MISSING_SHORT} | ${MISSING_SHORT} | ${MISSING_SHORT} |`);
    return;
  }
  table.forEach(x => md.push(`| ${cell(x.variable ?? x.name ?? x.factor)} | ${cell(x.sensitivity)} | ${cell(x.direction ?? x.impact ?? x.direction_of_impact)} | ${cell(x.confidence)} |`));
}

function renderScreeningFlags(md, flags) {
  if (!Array.isArray(flags) || flags.length === 0) {
    md.push(`  - ${MISSING_SHORT}`);
    return;
  }
  md.push('  | Cờ | Mức độ | Quan sát | Câu hỏi điều tra | Câu trả lời |');
  md.push('  |---|---|---|---|---|');
  flags.forEach(f => md.push(`  | ${cell(f.flag)} | ${cell(f.severity)} | ${cell(f.observation)} | ${cell(f.question ?? f.investigation_question)} | ${cell(f.answer)} |`));
}

function peerAverage(n3) {
  const v = n3.valuation?.pe_peer_avg ?? n3.valuation?.peer_pe_avg ?? n3.pe_peer_avg;
  if (v != null && v !== '') return cell(v);
  const peers = n3.valuation?.peer_list || n3.peer_list || [];
  if (!Array.isArray(peers) || peers.length === 0) return MISSING_SHORT;
  const nums = peers.map(p => Number(p.pe)).filter(Number.isFinite);
  return nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : MISSING_SHORT;
}

function renderPeers(md, peers) {
  md.push('| Mã | P/E | P/B | ROE | Ngày | Lý do chọn mã so sánh |');
  md.push('|---|---|---|---|---|---|');
  if (!Array.isArray(peers) || peers.length === 0) {
    md.push(`| ${MISSING_SHORT} | ${MISSING_SHORT} | ${MISSING_SHORT} | ${MISSING_SHORT} | ${MISSING_SHORT} | ${MISSING_SHORT} |`);
    return;
  }
  peers.forEach(p => md.push(`| ${cell(p.ticker ?? p.symbol)} | ${cell(p.pe)} | ${cell(p.pb)} | ${cell(p.roe)} | ${cell(p.date ?? p.data_date)} | ${cell(p.reason ?? p.selection_reason)} |`));
}

function renderScenarios(md, scenarios) {
  md.push('| Kịch bản | Xác suất | Điều kiện | Giá mục tiêu |');
  md.push('|---|---|---|---|');
  const s = Array.isArray(scenarios) ? scenarios : [];
  const find = key => s.find(x => String(x.scenario ?? x.label ?? x.name ?? '').toLowerCase().includes(key));
  [['Tăng (Bull)', find('bull')], ['Cơ sở (Base)', find('base')], ['Giảm (Bear)', find('bear')]].forEach(([label, x]) => {
    md.push(`| ${label} | ${cell(x?.probability ?? x?.prob)} | ${cell(x?.condition ?? x?.conditions)} | ${cell(x?.target_price ?? x?.price_target ?? x?.target ?? x?.bear_price)} |`);
  });
}

function allocationSteps(value) {
  if (Array.isArray(value)) return value.map((x, i) => `(${i + 1}) ${cell(x)}`).join('  ');
  if (value && typeof value === 'object') {
    const values = Object.values(value).filter(v => v != null && v !== '');
    if (values.length) return values.map((x, i) => `(${i + 1}) ${cell(x)}`).join('  ');
  }
  return value != null && value !== '' ? cell(value) : MISSING_SHORT;
}

function renderSources(md, sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    md.push(`- ${MISSING_SHORT}`);
    return;
  }
  sources.forEach(s => md.push(`- ${cell(s.name ?? s.source ?? s.title)} — ${cell(s.date ?? s.data_date ?? s.published_date)} — ${cell(s.note ?? s.notes ?? s.description)}`));
}

function screenStatusLabel(value) {
  const map = { CONFIRMED: 'XÁC NHẬN', PARTIAL: 'MỘT PHẦN', DIVERGENT: 'KHÁC BIỆT' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function signalLabel(value) {
  const map = { BULLISH: 'TÍCH CỰC', BEARISH: 'TIÊU CỰC', NEUTRAL: 'TRUNG TÍNH', STRONG: 'MẠNH', WEAK: 'YẾU', ALIGNED: 'ĐỒNG THUẬN', CONFLICT: 'XUNG ĐỘT' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function riskLabel(value) {
  const map = { RISK_ON: 'ƯA RỦI RO', RISK_OFF: 'NÉ RỦI RO', NEUTRAL: 'TRUNG TÍNH', ELEVATED: 'RỦI RO CAO', LOW: 'RỦI RO THẤP' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function catalystLabel(value) {
  const map = { NEAR_TERM: 'GẦN', SHORT_TERM: 'NGẮN HẠN', MEDIUM_TERM: 'TRUNG HẠN', LONG_TERM: 'DÀI HẠN' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function classificationLabel(value) {
  const map = { SUSTAINABLE: 'BỀN VỮNG', CYCLICAL: 'CHU KỲ', ONE_OFF: 'MỘT LẦN', UNSUSTAINABLE: 'KHÔNG BỀN VỮNG', UNCERTAIN: 'CHƯA XÁC ĐỊNH' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function trendLabel(value) {
  const map = { UPTREND: 'TĂNG', DOWNTREND: 'GIẢM', SIDEWAYS: 'ĐI NGANG', BULLISH: 'TÍCH CỰC', BEARISH: 'TIÊU CỰC', NEUTRAL: 'TRUNG TÍNH' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function volumeLabel(value) {
  const map = { HIGH: 'CAO', LOW: 'THẤP', NORMAL: 'BÌNH THƯỜNG', SPIKE: 'ĐỘT BIẾN' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}

function positionLabel(value) {
  const map = { LONG: 'MUA', SHORT: 'BÁN', SWING: 'GIAO DỊCH SWING', CORE: 'VỊ THẾ CỐT LÕI', SPECULATIVE: 'ĐẦU CƠ' };
  const v = String(value ?? '');
  return map[v.toUpperCase()] || v || MISSING_SHORT;
}
