import { field, setResult, MISSING_SHORT, decisionLabel } from './render-common.js';

export function renderNode6A(ctx) {
  const outputs = ctx.outputs || {};
  setResult({ ...outputs, screeningContext: ctx.screeningContext, mode: ctx.mode, ticker: ctx.ticker, sectorType: ctx.sectorType });

  const isScreened = ctx.mode === 'SCREENED';
  const f = (path, fallback = MISSING_SHORT) => escapeHtml(formatValue(field(path, fallback)));
  const raw = (path, fallback = null) => field(path, fallback);
  const n1 = outputs.node1 || {};
  const n2 = outputs.node2 || {};
  const n3 = outputs.node3 || {};
  const n4 = outputs.node4 || {};
  const n5 = outputs.node5 || {};

  const drivers = Array.isArray(n5.drivers) ? n5.drivers.slice(0, 3) : [];
  while (drivers.length < 3) drivers.push(MISSING_SHORT);

  const scenarios = n4.risk_scenarios || {};
  const bull = scenarios.bull || scenarios.BULL || {};
  const base = scenarios.base || scenarios.BASE || {};
  const bear = scenarios.bear || scenarios.BEAR || {};

  const screening = isScreened ? renderScreeningSnapshot(n1, n5) : '';
  const sources = sourceBar(n1.sources);
  const allocation = allocationSteps(n5.strategy?.allocation_plan);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Báo Cáo Phân Tích ${escapeHtml(ctx.ticker)} | Senior Equity Analyst</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
<script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','system-ui','sans-serif'],display:['Outfit','sans-serif']},colors:{brand:{deep:'#1e3a8a',accent:'#3b82f6',bg:'#f5f7fb'},status:{buy:'#16a34a',sell:'#dc2626',hold:'#f59e0b'}},boxShadow:{premium:'0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05)'}}}}</script>
<style>body{background-color:#f5f7fb;color:#1a1a1a;line-height:1.6}.card{background:#fff;border-radius:16px;padding:28px;margin-bottom:24px;box-shadow:0 4px 6px -1px rgb(0 0 0/0.05),0 2px 4px -2px rgb(0 0 0/0.05);transition:transform .2s ease,box-shadow .2s ease}.card:hover{box-shadow:0 20px 25px -5px rgb(0 0 0/0.05)}.hero-card{background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);color:#fff}.metric-card{background:#f8fafc;border:1px solid #e2e8f0;padding:16px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}.highlight{background-color:#eff6ff;border-left:4px solid #3b82f6;padding:16px;margin:16px 0;border-radius:0 8px 8px 0;font-style:italic}.sub-card{background:#fff;border:1px solid #f1f5f9;padding:16px;border-radius:10px;margin-bottom:12px}.badge{padding:4px 12px;border-radius:9999px;font-size:.75rem;font-weight:600;text-transform:uppercase}.grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}@media(max-width:768px){.grid-3{grid-template-columns:1fr}.card{padding:20px}}</style>
</head>
<body class="font-sans antialiased">
<div id="report" class="container mx-auto px-4 py-8 max-w-[1100px]">
<header class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4"><div><div class="flex items-center gap-3 mb-2"><span class="bg-brand-deep text-white px-3 py-1 rounded text-sm font-bold tracking-widest">HOSE: ${escapeHtml(ctx.ticker)}</span><span class="text-gray-500 font-medium text-sm">Cập nhật: ${f('date')}</span></div><h1 class="text-3xl md:text-4xl font-display font-extrabold text-brand-deep">BÁO CÁO PHÂN TÍCH CHUYÊN SÂU</h1><p class="text-gray-600 mt-1 font-medium">${f('node1.company_name')}</p></div><div class="text-right"><p class="text-xs uppercase tracking-wider text-gray-400 font-bold">Chuyên gia phân tích</p><p class="text-sm font-semibold text-gray-800">Senior Equity Analyst & Geopolitical Strategist</p></div></header>
<main>
<div class="card hero-card shadow-2xl relative overflow-hidden mb-6"><div class="relative z-10"><div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-white/20 pb-6"><div><h2 class="text-sm uppercase tracking-widest text-blue-200 font-bold mb-1">Quyết định đầu tư</h2><div class="text-5xl font-display font-black text-white tracking-tight">${escapeHtml(decisionLabel(raw('node5.decision')))}</div></div><div class="mt-4 md:mt-0 flex gap-8"><div class="text-center"><p class="text-blue-200 text-xs font-bold uppercase mb-1">AI Score</p><p class="text-3xl font-black">${f('node5.ai_score.value')}<span class="text-sm">/100</span></p></div><div class="text-center"><p class="text-blue-200 text-xs font-bold uppercase mb-1">Tin tưởng</p><p class="text-3xl font-black">${f('node5.confidence.value')}</p></div></div></div><div class="grid grid-cols-1 md:grid-cols-2 gap-8"><div><h3 class="text-blue-100 font-bold text-sm uppercase mb-3">Động lực tăng trưởng chính</h3><ul class="space-y-2">${drivers.map(x => `<li class="flex items-start gap-2 text-sm"><span class="text-green-400 mt-0.5">●</span><span>${escapeHtml(formatValue(x))}</span></li>`).join('')}</ul></div><div class="bg-white/10 p-4 rounded-lg border border-white/10"><h3 class="text-red-300 font-bold text-sm uppercase mb-2">Điều kiện vô hiệu (Invalidation)</h3><p class="text-sm leading-relaxed">${f('node5.thesis_invalidation')}</p></div></div></div></div>
${screening}
<div class="card border-2 border-brand-accent/20 mb-6"><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Tín hiệu Tổng hợp</h2><div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4"><div class="sub-card m-0 text-center"><span class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Cơ bản</span><span class="text-2xl">${signal('fundamental')}</span></div><div class="sub-card m-0 text-center"><span class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Kỹ thuật</span><span class="text-2xl">${signal('technical')}</span></div><div class="sub-card m-0 text-center"><span class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Vĩ mô</span><span class="text-2xl">${signal('macro')}</span></div><div class="sub-card m-0 text-center"><span class="text-[10px] font-bold text-gray-400 uppercase block mb-1">Thanh khoản</span><span class="text-2xl">${signal('liquidity')}</span></div></div><div class="text-center mb-4"><span class="badge bg-blue-100 text-blue-700">Đồng thuận tín hiệu: ${escapeHtml(n5.conflict_detector?.alignment ?? MISSING_SHORT)}</span></div><div class="grid grid-cols-1 md:grid-cols-3 gap-3"><div class="sub-card m-0"><span class="text-xs font-bold text-gray-400 uppercase block mb-1">Catalyst gần nhất</span><p class="text-sm font-medium">${f('node5.catalyst_horizon.nearest_catalyst')} (${f('node5.catalyst_horizon.bucket')})</p></div><div class="sub-card m-0"><span class="text-xs font-bold text-gray-400 uppercase block mb-1">Chất lượng lợi nhuận</span><p class="text-sm font-medium">${earningsQuality(n3.earnings_quality?.red_flags)}</p></div><div class="sub-card m-0"><span class="text-xs font-bold text-gray-400 uppercase block mb-1">Reverse DCF</span><p class="text-sm font-medium">CAGR ngầm định: ${f('node3.valuation.reverse_dcf_implied_fcf_cagr')} — ${f('node3.valuation.reverse_dcf_commentary')}</p></div></div></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><div class="card"><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Vĩ mô & Địa chính trị</h2><div class="space-y-4"><div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100"><span class="text-sm font-semibold text-gray-600 uppercase">Chế độ rủi ro</span><span class="badge bg-yellow-100 text-yellow-700">${f('node4.risk_regime')}</span></div><div class="grid grid-cols-2 gap-3"><div class="sub-card m-0"><h3 class="text-xs font-bold text-gray-400 uppercase mb-1">Lãi suất FED</h3><p class="text-lg font-bold">${f('node4.macro_indicators.fed_rate.value')}</p></div><div class="sub-card m-0"><h3 class="text-xs font-bold text-gray-400 uppercase mb-1">Tỷ giá USD/VND</h3><p class="text-lg font-bold">${f('node4.macro_indicators.usd_vnd.value')}</p></div><div class="sub-card m-0"><h3 class="text-xs font-bold text-gray-400 uppercase mb-1">Dầu Brent</h3><p class="text-lg font-bold">${f('node4.macro_indicators.oil_brent.value')}</p></div><div class="sub-card m-0"><h3 class="text-xs font-bold text-gray-400 uppercase mb-1">Lạm phát Mỹ</h3><p class="text-lg font-bold">${f('node4.macro_indicators.us_inflation.value')}</p></div></div><p class="text-sm text-gray-600">${f('node4.macro_view')}</p></div></div><div class="card"><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Phân tích Nhóm Ngành</h2><div class="space-y-4"><div class="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100"><span class="text-sm font-semibold text-gray-600 uppercase">Sức mạnh ngành</span><span class="badge bg-gray-200 text-gray-700">${f('node2.sector_vs_market.sector_strength_label')}</span></div><div class="bg-blue-50 border border-blue-100 p-4 rounded-xl"><div class="flex justify-between mb-2"><span class="text-sm font-medium">Ngành (cùng kỳ)</span><span class="text-sm font-bold">${sectorPerf(n2)}</span></div><div class="flex justify-between"><span class="text-sm font-medium">VN-Index</span><span class="text-sm font-bold">${f('node2.sector_vs_market.vnindex_perf_pct')}</span></div><div class="w-full bg-gray-200 h-2 rounded-full mt-3 overflow-hidden"><div class="bg-brand-accent h-full" style="width:${sectorBar(n2.sector_vs_market)}"></div></div></div><p class="text-sm text-gray-600 italic">${sectorInsight(n2)}</p></div></div></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><div class="card"><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Chu kỳ & Chính sách</h2><div class="sub-card"><p class="text-xs font-bold text-blue-500 uppercase mb-1">Giai đoạn</p><p class="font-bold text-gray-800">${industryStage(n4)}</p></div><div class="space-y-3"><div class="flex items-center gap-3"><div class="w-14 h-10 bg-red-50 text-red-600 rounded flex items-center justify-center font-bold text-sm">${industryMargin(n3.peer_list)}</div><p class="text-xs text-gray-500 uppercase font-semibold leading-tight">${industryMarginDesc(n3.peer_list)}</p></div><div class="flex items-center gap-3"><div class="w-14 h-10 bg-green-50 text-green-600 rounded flex items-center justify-center font-bold text-sm">${f('node4.domestic_drivers.0.value')}</div><p class="text-xs text-gray-500 uppercase font-semibold leading-tight">Ngân sách đầu tư công (Tỷ USD)</p></div></div></div><div class="card"><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Phân tích Doanh nghiệp</h2><div class="space-y-3"><div class="flex justify-between items-end border-b border-gray-100 pb-2"><div><p class="text-xs text-gray-400 font-bold uppercase">Doanh thu (${f('node1.financial_core_raw.revenue.period')})</p><p class="text-lg font-bold">${f('node1.financial_core_raw.revenue.value')}</p></div><span class="text-green-600 font-bold text-sm">${f('node1.financial_core_raw.revenue.yoy')}</span></div><div class="flex justify-between items-end border-b border-gray-100 pb-2"><div><p class="text-xs text-gray-400 font-bold uppercase">Lợi nhuận sau thuế</p><p class="text-lg font-bold">${f('node1.financial_core_raw.npat.value')}</p></div><span class="text-green-600 font-bold text-sm">${f('node1.financial_core_raw.npat.yoy')}</span></div><div class="highlight text-xs m-0 mt-2 py-2"><strong>Lợi thế (Moat):</strong> ${f('node3.moat')}</div></div></div></div>
<div class="card mb-6"><div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-start"><div><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Dòng tiền thông minh & Định giá</h2><div class="highlight"><strong>Key Insight:</strong> Đang trong giai đoạn <strong>${f('node2.smart_money_phase')}</strong> tại vùng ${smartMoneyZone(n2)}. ${f('node2.volume_analysis.vsa_signal_candidate')}</div><div class="grid grid-cols-2 gap-4 mt-4"><div class="metric-card"><span class="text-xs font-bold text-gray-400 uppercase">Volume Ratio</span><strong class="text-2xl text-brand-deep">${f('node2.volume_analysis.ratio')}</strong><span class="text-[10px] text-gray-400">vs avg 20 phiên</span></div><div class="metric-card"><span class="text-xs font-bold text-gray-400 uppercase">Tín hiệu</span><strong class="text-sm text-center text-brand-accent mt-1">${f('node2.volume_analysis.classification')}</strong></div></div></div><div><h3 class="text-sm font-bold uppercase text-gray-500 mb-4">Định giá (Valuation)</h3><div class="grid grid-cols-2 gap-4 mb-6"><div class="metric-card"><span class="text-xs font-bold text-gray-400 uppercase">P/E (TTM)</span><strong class="text-2xl ${peColor(n1, n3)}">${f('node1.valuation_multiples.pe_ttm')}</strong><span class="text-[10px] text-gray-400">TB Peer: ${f('node3.valuation.peer_avg_pe')}</span></div><div class="metric-card"><span class="text-xs font-bold text-gray-400 uppercase">P/B Ratio</span><strong class="text-2xl ${pbColor(n1)}">${f('node1.valuation_multiples.pb_current')}</strong><span class="text-[10px] text-gray-400">${pbDesc(n1)}</span></div></div><div class="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-300"><h3 class="text-sm font-bold uppercase text-gray-500 mb-4">Cấu trúc Kỹ thuật</h3><ul class="space-y-4"><li class="flex justify-between items-center"><span class="text-sm font-medium">Xu hướng</span><span class="badge bg-green-100 ${trendColor(n2)}">${f('node2.trend_status')}</span></li><li class="flex justify-between items-center"><span class="text-sm font-medium">So với SMA 200</span><span class="text-sm font-bold">${f('node2.sma_200_rel')}</span></li><li class="flex justify-between items-center"><span class="text-sm font-medium">Thanh khoản (Volume)</span><span class="text-sm font-bold">${f('node2.volume_analysis.classification')}</span></li></ul></div></div></div></div>
<div class="mb-6"><h2 class="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 ml-1">Hệ thống chấm điểm AI</h2><div class="grid grid-cols-2 md:grid-cols-6 gap-3">${scoreCard('Kỹ thuật','node5.scores.technical','green-500')}${scoreCard('Dòng tiền','node5.scores.flow','blue-500')}${scoreCard('Cơ bản','node5.scores.fundamental','yellow-500')}${scoreCard('Ngành/Vĩ mô','node5.scores.sector_macro','purple-500')}${scoreCard('Định giá','node5.scores.valuation','green-400')}${scoreCard('Rủi ro','node5.scores.risk','red-500')}</div></div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><div class="card"><h2 class="text-xl font-display font-bold text-red-700 mb-4">Quản trị Rủi ro</h2><div class="space-y-3"><div class="sub-card m-0 border-red-100"><span class="text-red-600 font-bold text-xs uppercase block mb-1">Doanh nghiệp</span><p class="text-sm font-medium">${riskCompany(n3)}</p></div><div class="sub-card m-0 border-red-100"><span class="text-red-600 font-bold text-xs uppercase block mb-1">Vĩ mô</span><p class="text-sm font-medium">${riskMacro(n4)}</p></div><div class="sub-card m-0 border-red-100"><span class="text-red-600 font-bold text-xs uppercase block mb-1">Thanh khoản</span><p class="text-sm font-medium">${liquidityNote(n5)}</p></div></div></div><div class="card"><h2 class="text-xl font-display font-bold text-brand-deep mb-4">Phân tích Nhân quả</h2><ul class="space-y-2"><li class="text-sm flex gap-2"><span class="font-bold text-brand-deep shrink-0">Gốc:</span><span>${causalFacts(n4)}</span></li><li class="text-sm flex gap-2"><span class="font-bold text-brand-deep shrink-0">Quả:</span><span>${f('node4.causal_chains.0.chain_summary')}</span></li><li class="text-sm flex gap-2"><span class="font-bold text-brand-deep shrink-0">Kỹ thuật:</span><span>${causalInference(n4)}</span></li></ul></div></div>
<div class="mb-6"><h2 class="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 ml-1">Kịch bản Phân tích</h2><div class="grid-3"><div class="card m-0 border-t-4 border-green-500"><div class="flex justify-between items-center mb-2"><h3 class="font-bold text-green-700">BULL CASE</h3><span class="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">${scenarioValue(bull,'probability','prob')}</span></div><p class="text-xs text-gray-600 mb-4">${scenarioValue(bull,'condition','description')}</p><p class="text-2xl font-black text-green-700">${scenarioValue(bull,'target')}</p><p class="text-[10px] font-bold text-gray-400 uppercase">Target Price</p></div><div class="card m-0 border-t-4 border-blue-500"><div class="flex justify-between items-center mb-2"><h3 class="font-bold text-brand-deep">BASE CASE</h3><span class="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">${scenarioValue(base,'probability','prob')}</span></div><p class="text-xs text-gray-600 mb-4">${scenarioValue(base,'condition','description')}</p><p class="text-2xl font-black text-brand-deep">${scenarioValue(base,'target')}</p><p class="text-[10px] font-bold text-gray-400 uppercase">Target Price</p></div><div class="card m-0 border-t-4 border-red-500"><div class="flex justify-between items-center mb-2"><h3 class="font-bold text-red-700">BEAR CASE</h3><span class="text-xs font-bold bg-red-100 text-red-700 px-2 py-1 rounded">${scenarioValue(bear,'probability','prob')}</span></div><p class="text-xs text-gray-600 mb-4">${scenarioValue(bear,'condition','description')}</p><p class="text-2xl font-black text-red-700">${scenarioValue(bear,'target','price')}</p><p class="text-[10px] font-bold text-gray-400 uppercase">Stop Loss</p></div></div></div>
<div class="card border-2 border-brand-accent/20 bg-blue-50/30"><h2 class="text-2xl font-display font-bold text-brand-deep mb-6 text-center">Chiến lược Giao dịch (Trade Setup)</h2><div class="grid grid-cols-1 md:grid-cols-4 gap-4"><div class="sub-card m-0 text-center"><p class="text-xs font-bold text-gray-400 uppercase mb-2">Vùng Mua</p><p class="text-xl font-bold text-brand-deep">${f('node5.strategy.entry_zone')}</p><p class="text-[10px] text-gray-500 mt-1">${allocation.note}</p></div><div class="sub-card m-0 text-center border-red-100"><p class="text-xs font-bold text-red-400 uppercase mb-2">Cắt Lỗ (SL)</p><p class="text-xl font-bold text-red-600">${f('node5.trading_stop.price')}</p><p class="text-[10px] text-gray-500 mt-1">${f('node5.trading_stop.basis')}</p></div><div class="sub-card m-0 text-center border-green-100"><p class="text-xs font-bold text-green-400 uppercase mb-2">Mục tiêu 1</p><p class="text-xl font-bold text-green-700">${strategyValue(n5.strategy?.tp1)}</p><p class="text-[10px] text-gray-500 mt-1">${strategyRationale(n5.strategy?.tp1)}</p></div><div class="sub-card m-0 text-center border-green-100"><p class="text-xs font-bold text-green-400 uppercase mb-2">Mục tiêu 2</p><p class="text-xl font-bold text-green-700">${strategyValue(n5.strategy?.tp2)}</p><p class="text-[10px] text-gray-500 mt-1">${strategyRationale(n5.strategy?.tp2)}</p></div></div><div class="mt-6 bg-white p-4 rounded-xl border border-brand-accent/10"><h3 class="text-sm font-bold uppercase text-brand-deep mb-3">Lộ trình giải ngân</h3><div class="flex flex-col md:flex-row justify-between gap-4 text-sm"><div class="flex-1"><span class="font-bold text-brand-accent">Bước 1:</span> ${escapeHtml(allocation.steps[0])}</div><div class="flex-1"><span class="font-bold text-brand-accent">Bước 2:</span> ${escapeHtml(allocation.steps[1])}</div><div class="flex-1"><span class="font-bold text-brand-accent">Bước 3:</span> ${escapeHtml(allocation.steps[2])}</div></div></div><div class="mt-4 bg-white p-4 rounded-xl border border-brand-accent/10"><h3 class="text-sm font-bold uppercase text-brand-deep mb-3">Quản trị vị thế (Position Sizing)</h3><div class="flex flex-col md:flex-row justify-between gap-4 text-sm"><div class="flex-1"><span class="font-bold text-brand-accent">Rủi ro/lệnh:</span> ${f('node5.strategy.risk_per_trade_pct_nav')}</div><div class="flex-1"><span class="font-bold text-brand-accent">Tỷ trọng tối đa:</span> ${f('node5.strategy.max_portfolio_weight_pct')}</div><div class="flex-1"><span class="font-bold text-brand-accent">Loại vị thế:</span> ${f('node5.strategy.position_type')}</div></div></div></div>
</main><footer class="mt-10 pt-6 border-t border-gray-200 text-center text-xs text-gray-400"><p class="mb-1">${sources}</p><p>Báo cáo được tạo tự động bởi AI Equity Research Engine · ${f('date')} · Chỉ dành cho mục đích tham khảo, không phải khuyến nghị đầu tư chính thức.</p></footer></div>
</body></html>`;

  function signal(key) {
    return escapeHtml(n5.conflict_detector?.[key] ?? MISSING_SHORT);
  }
}

function renderScreeningSnapshot(n1, n5) {
  const s = n1.screening_summary || {};
  const metric = (label, value) => `<div class="sub-card m-0 text-center"><span class="text-[10px] text-gray-400 uppercase block">${label}</span><strong class="text-lg">${escapeHtml(formatValue(value))}</strong></div>`;
  return `<div class="card border-2 border-purple-200 mb-6"><h2 class="text-xl font-display font-bold text-brand-deep mb-1">Screening Snapshot</h2><p class="text-xs text-gray-400 mb-4">Nguồn: StockScreener — đây là bối cảnh sàng lọc ban đầu, KHÔNG phải điểm số của CRSM</p><div class="grid grid-cols-3 md:grid-cols-4 gap-3 mb-4">${metric('Score',s.screen_score)}${metric('Rank',s.screen_rank)}${metric('Grade',s.screen_grade)}${metric('Quality',s.quality_score)}${metric('Growth',s.growth_score)}${metric('Valuation',s.valuation_score)}${metric('Momentum',s.momentum_score)}${metric('Mispricing',s.mispricing_score ?? s.opportunity_score)}</div><div class="flex flex-col md:flex-row justify-between items-center gap-3 bg-white p-4 rounded-xl border border-brand-accent/10"><div class="text-center md:text-left"><span class="text-xs text-gray-400 uppercase block">CRSM Score</span><strong class="text-2xl text-brand-deep">${escapeHtml(formatValue(n5.ai_score?.value))}/100</strong></div><div class="text-center"><span class="badge bg-purple-100 text-purple-700">SCREEN → CRSM: ${escapeHtml(statusLabel(n5.screen_vs_crsm?.status))}</span><p class="text-[10px] text-gray-500 mt-1">${escapeHtml(formatValue(n5.screen_vs_crsm?.interpretation))}</p></div></div></div>`;
}

function scoreCard(label, path, color) {
  const value = field(path, MISSING_SHORT);
  const n = Number(value);
  const width = Number.isFinite(n) ? `${Math.max(0, Math.min(100, n / 20 * 100))}%` : '0%';
  return `<div class="metric-card"><span class="text-[10px] font-bold text-gray-400 uppercase">${escapeHtml(label)}</span><strong class="text-xl">${escapeHtml(formatValue(value))}</strong><div class="w-full bg-gray-200 h-1 mt-2 rounded"><div class="bg-${color} h-full rounded" style="width:${width}"></div></div></div>`;
}

function sectorPerf(n2) {
  const value = n2.sector_vs_market?.sector_perf_pct;
  if (value == null || value === '') return MISSING_SHORT;
  const method = n2.sector_benchmark?.method;
  return method === 'peer_basket' ? `${formatValue(value)} (rổ peer, không có chỉ số ngành chính thức)` : formatValue(value);
}

function sectorBar(sector) {
  const a = Number(sector?.sector_perf_pct);
  const b = Number(sector?.vnindex_perf_pct);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return '0%';
  return `${Math.max(0, Math.min(100, (a / Math.max(Math.abs(a), Math.abs(b), 1)) * 100))}%`;
}

function sectorInsight(n2) {
  const a = Number(n2.sector_vs_market?.sector_perf_pct);
  const b = Number(n2.sector_vs_market?.vnindex_perf_pct);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return MISSING_SHORT;
  const diff = Math.round((a - b) * 100) / 100;
  return `Nhóm ngành ${diff >= 0 ? 'vượt' : 'kém'} VN-Index ${Math.abs(diff)} điểm % trong cùng kỳ.`;
}

function industryStage(n4) {
  const impact = n4.industry_impact;
  const sensitivity = n4.sensitivity_table;
  if (!impact && !sensitivity) return MISSING_SHORT;
  return formatValue(impact || MISSING_SHORT);
}

function industryMargin(peers) {
  if (!Array.isArray(peers) || !peers.length) return MISSING_SHORT;
  const values = peers.map(p => p.gross_margin ?? p.net_margin).map(Number).filter(Number.isFinite);
  if (!values.length) return MISSING_SHORT;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return `${Math.round(avg * 10) / 10}%`;
}

function industryMarginDesc(peers) {
  if (!Array.isArray(peers) || !peers.length) return `Biên lợi nhuận peer: ${MISSING_SHORT}`;
  const has = peers.some(p => Number.isFinite(Number(p.gross_margin ?? p.net_margin)));
  return has ? 'Biên lợi nhuận bình quân từ peer list' : `Biên lợi nhuận peer: ${MISSING_SHORT}`;
}

function smartMoneyZone(n2) {
  return formatValue(n2.zones?.demand ?? n2.zones?.supply);
}

function peColor(n1, n3) {
  const pe = Number(n1.valuation_multiples?.pe_ttm);
  const peer = Number(n3.valuation?.peer_avg_pe);
  if (!Number.isFinite(pe) || !Number.isFinite(peer)) return 'text-gray-500';
  return pe > peer ? 'text-red-500' : 'text-green-600';
}

function pbColor(n1) {
  const pb = Number(n1.valuation_multiples?.pb_current);
  if (!Number.isFinite(pb)) return 'text-gray-500';
  if (pb < 1) return 'text-green-600';
  if (pb > 2) return 'text-red-500';
  return 'text-gray-800';
}

function pbDesc(n1) {
  const pb = Number(n1.valuation_multiples?.pb_current);
  if (!Number.isFinite(pb)) return MISSING_SHORT;
  return pb < 1 ? 'Dưới giá trị sổ sách' : 'Trên giá trị sổ sách';
}

function trendColor(n2) {
  const trend = String(n2.trend_status || '').toLowerCase();
  if (/(up|bull|tăng|positive|strong)/.test(trend)) return 'text-green-700';
  if (/(down|bear|giảm|negative|weak)/.test(trend)) return 'text-red-700';
  return 'text-gray-700';
}

function riskCompany(n3) {
  const flags = n3.earnings_quality?.red_flags;
  const debt = n3.debt_to_equity ?? n3.earnings_quality?.debt_to_equity;
  const parts = [];
  if (Array.isArray(flags) && flags.length) parts.push(flagsToText(flags));
  if (debt != null) parts.push(`Debt/Equity: ${formatValue(debt)}`);
  return escapeHtml(parts.length ? parts.join(' · ') : 'Không phát hiện cảnh báo trọng yếu');
}

function flagsToText(flags) {
  return flags
    .map(x => (typeof x === 'string' ? x : (x?.flag ?? x?.name ?? x?.description ?? formatValue(x))))
    .join('; ');
}

function riskMacro(n4) {
  const regime = n4.risk_regime;
  const sensitivity = n4.sensitivity_table;
  if (regime == null && sensitivity == null) return MISSING_SHORT;
  return escapeHtml(formatValue(regime || sensitivity));
}

function liquidityNote(n5) {
  return escapeHtml(n5.liquidity_note || 'Thanh khoản bình thường');
}

function causalFacts(n4) {
  const facts = n4.causal_chains?.[0]?.facts;
  if (Array.isArray(facts)) return escapeHtml(flagsToText(facts));
  return escapeHtml(formatValue(facts));
}

function causalInference(n4) {
  const chain = n4.causal_chains?.[0] || {};
  const inference = chain.inferences;
  const confidence = chain.inference_confidence;
  if (inference == null) return MISSING_SHORT;
  const suffix = confidence != null ? ` (${formatValue(confidence)})` : '';
  return escapeHtml(`Suy luận: ${formatValue(inference)}${suffix}`);
}

function earningsQuality(flags) {
  if (!Array.isArray(flags) || !flags.length) return 'Không phát hiện bất thường';
  return escapeHtml(flagsToText(flags));
}

function scenarioValue(obj, key, altKey) {
  const value = obj?.[key] ?? (altKey ? obj?.[altKey] : null);
  return escapeHtml(formatValue(value));
}

function strategyValue(value) {
  if (value == null) return MISSING_SHORT;
  if (typeof value === 'object') return escapeHtml(formatValue(value.price ?? value.value ?? value.target));
  return escapeHtml(formatValue(value));
}

function strategyRationale(value) {
  if (value == null) return MISSING_SHORT;
  if (typeof value === 'object') return escapeHtml(formatValue(value.rationale ?? value.basis ?? value.description));
  return MISSING_SHORT;
}

function allocationSteps(value) {
  const fallback = [MISSING_SHORT, MISSING_SHORT, MISSING_SHORT];
  if (value == null) return { note: MISSING_SHORT, steps: fallback };
  if (typeof value === 'object') {
    const steps = [value.step1, value.step2, value.step3, ...(Array.isArray(value.steps) ? value.steps : [])].filter(v => v != null).slice(0, 3).map(formatValue);
    while (steps.length < 3) steps.push(MISSING_SHORT);
    return { note: formatValue(value.note ?? value.summary ?? value.description), steps };
  }
  return { note: formatValue(value), steps: fallback };
}

function sourceBar(sources) {
  if (!Array.isArray(sources)) return MISSING_SHORT;
  const names = sources.map(s => s?.name || s?.url_or_ref).filter(Boolean).slice(0, 8);
  return names.length ? names.map(escapeHtml).join(', ') : MISSING_SHORT;
}

function statusLabel(status) {
  if (status === 'CONFIRMED') return 'XÁC NHẬN';
  if (status === 'PARTIAL') return 'MỘT PHẦN';
  if (status === 'DIVERGENT') return 'KHÁC BIỆT';
  return MISSING_SHORT;
}

function formatValue(value) {
  if (value == null || value === '') return MISSING_SHORT;
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(formatValue).join('; ');
    }
    const name = value.name ?? value.label ?? value.title;
    const val = value.value ?? value.detail ?? value.description;
    if (name != null && val != null) return `${formatValue(name)}: ${formatValue(val)}`;
    if (name != null) return formatValue(name);
    if (val != null) return formatValue(val);
    try { return JSON.stringify(value); } catch { return MISSING_SHORT; }
  }
  return String(value);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
