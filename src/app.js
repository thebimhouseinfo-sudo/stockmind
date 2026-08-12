import { parseTradingViewPaste } from './parser.js';
import { buildPrompt, buildStats, scoreStocks } from './scoring.js';
import { crsmState, subscribeCRSM } from './crsm/state.js';
import { buildScreeningContext } from './crsm/context.js';
import { runCRSM } from './crsm/engine.js';
import { renderCRSMTab, bindCRSMUIBindings, updateDynamicRegion } from './crsm/ui/index.js';
import { downloadReportBundle } from './crsm/report-export.js';

const STORAGE_KEY = 'stock-mind.dataset.v1';

let state = { tab: 'import', pasteText: '', rows: loadRows(), errors: [], selectedTicker: null, selectedTickers: [], search: '', batchRunning: false, batchProgress: null, importStatus: null };
const app = document.getElementById('app');
subscribeCRSM(() => { if (state.tab === 'crsm') updateDynamicRegion(); });
render();

function render() {
  app.innerHTML = `<div class="shell">${renderTopbar()}<main class="main">
    ${state.tab === 'import' ? renderImport() : ''}
    ${state.tab === 'dashboard' ? renderDashboard() : ''}
    ${state.tab === 'list' ? renderList() : ''}
    ${state.tab === 'detail' ? renderDetail() : ''}
    ${state.tab === 'crsm' ? renderCRSMTab() : ''}
  </main></div>`;
  bindEvents();
}

function renderTopbar() {
  const tabs = [['import', 'Screen'], ['dashboard', 'Dashboard'], ['list', 'Ranking'], ['crsm', 'CRSM']];
  return `<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">↗</div><span>Stock Mind</span></div><nav class="tabs">${tabs.map(([id, label]) => `<button class="tab ${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}</nav></div></header>`;
}

function renderImport() {
  const status = state.importStatus || (state.rows.length ? { count: state.rows.length, columns: null, time: null } : null);
  return `<section class="screen-page">
    <div class="screen-hero">
      <div class="screen-copy">
        <p class="eyebrow">Stock Screening</p>
        <h1>From TradingView<br>to Stock Mind</h1>
        <p class="screen-lead">Lọc cổ phiếu trên TradingView, copy toàn bộ bảng kết quả, rồi đưa thẳng vào Stock Mind.</p>
        <div class="screen-actions">
          <button class="btn primary screen-action" id="openTradingView">Open TradingView <span>↗</span></button>
          <button class="btn screen-action" id="importClipboard">Import &amp; Screen</button>
        </div>
        <p class="screen-hint">TradingView → Ctrl+A → Ctrl+C → Import &amp; Screen</p>
        ${status ? `<div class="screen-status"><strong>${status.count.toLocaleString('vi-VN')} mã</strong><span>${status.columns ? `${status.columns} cột` : 'Screening data'}${status.time ? ` · ${escapeHtml(status.time)}` : ''}</span></div>` : ''}
        ${state.errors.length ? `<div class="errors" style="margin-top:14px">${state.errors.map(escapeHtml).join('<br>')}</div>` : ''}
      </div>
      <div class="screen-visual" aria-hidden="true">
        <div class="screen-orbit orbit-one"></div>
        <div class="screen-orbit orbit-two"></div>
        <div class="screen-flow-card flow-tv">
          <div class="flow-card-top"><span class="flow-dot"></span><span>TRADINGVIEW</span></div>
          <div class="mini-table"><i></i><i></i><i></i><i></i><i></i></div>
          <div class="mini-bars"><b></b><b></b><b></b><b></b></div>
        </div>
        <div class="screen-flow-arrow">→</div>
        <div class="screen-flow-card flow-rank">
          <div class="flow-card-top"><span class="flow-dot"></span><span>STOCK MIND</span></div>
          <div class="rank-row"><strong>#01</strong><span>VCB</span><em>A+</em></div>
          <div class="rank-row"><strong>#02</strong><span>HPG</span><em>A</em></div>
          <div class="rank-row"><strong>#03</strong><span>HAH</span><em>A</em></div>
        </div>
        <div class="screen-flow-card flow-crsm">
          <div class="flow-card-top"><span class="flow-dot"></span><span>CRSM</span></div>
          <div class="crsm-pulse"></div>
          <small>Deep analysis</small>
        </div>
        <div class="screen-caption"><span>01</span> Copy your screen <span>02</span> Rank candidates <span>03</span> Analyze deeply</div>
      </div>
    </div>
  </section>`;
}

function renderDashboard() {
  if (!state.rows.length) return emptyState();
  const stats = buildStats(state.rows);
  const industries = Object.entries(stats.industryCount).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return `<section class="grid"><div class="grid metrics">${metric('Tổng mã', stats.total)}${metric('Điểm TB', fmt(stats.avgScore))}${metric('Ngành', Object.keys(stats.industryCount).length)}${metric('Top Grade', stats.top10[0]?.GRADE || '-')}</div>
    <div class="grid two"><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Top 10</p><h2>Sức mạnh tổng hợp</h2></div></div>${stats.top10.map(row => stockLine(row)).join('')}</div>
    <div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Industries</p><h2>Phân bổ ngành</h2></div></div>${industries.map(([name, count]) => `<div class="stock-line"><span>${escapeHtml(name)}</span><strong>${count} mã</strong></div>`).join('')}</div></div></section>`;
}

function renderList() {
  if (!state.rows.length) return emptyState();
  const rows = state.rows.filter(row => { const q = state.search.toLowerCase(); return row.TICKER.toLowerCase().includes(q) || row.INDUSTRY.toLowerCase().includes(q); });
  const visibleTickers = rows.map(row => row.TICKER);
  const selectedVisible = visibleTickers.filter(ticker => state.selectedTickers.includes(ticker));
  const allVisibleSelected = visibleTickers.length > 0 && selectedVisible.length === visibleTickers.length;
  return `<section class="panel panel-pad"><div class="toolbar"><div><p class="eyebrow">Ranking</p><h2>${rows.length} mã</h2><p class="muted">Bấm trực tiếp vào <strong>ticker</strong> để chạy một mã. Hoặc chọn nhiều mã rồi bấm <strong>Run CRSM</strong>. Không có mã nào tự động chạy.</p></div><input class="search" id="searchInput" value="${escapeHtml(state.search)}" placeholder="Tìm ticker hoặc ngành"></div>
    <div class="actions" style="margin-bottom:14px"><button class="btn" id="selectVisibleCRSM">${allVisibleSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}</button><button class="btn primary" id="runSelectedCRSM" ${state.selectedTickers.length || state.batchRunning ? '' : 'disabled'}>Run CRSM${state.selectedTickers.length ? ` (${state.selectedTickers.length})` : ''}</button>${state.selectedTickers.length ? `<button class="btn" id="clearSelectedCRSM">Bỏ chọn</button>` : ''}${state.batchRunning && state.batchProgress ? `<span class="muted">Đang chạy ${state.batchProgress.index}/${state.batchProgress.total}: ${escapeHtml(state.batchProgress.ticker)}</span>` : ''}</div>
    <div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="selectAllCRSM" ${allVisibleSelected ? 'checked' : ''}></th><th>Rank</th><th>Ticker</th><th>Industry</th><th>Price</th><th>P/E</th><th>Quality</th><th>Growth</th><th>Value</th><th>Micro</th><th>Momentum</th><th>Mispricing</th><th>Final</th><th>Grade</th></tr></thead>
    <tbody>${rows.map(row => `<tr><td><input type="checkbox" class="crsm-select" data-select-ticker="${row.TICKER}" ${state.selectedTickers.includes(row.TICKER) ? 'checked' : ''}></td><td>#${row.RANK}</td><td class="ticker"><button class="crsm-link ticker-run" data-crsm="${row.TICKER}" title="Chạy CRSM cho ${row.TICKER}" style="margin:0;padding:0;background:transparent;border:0;color:var(--blue);font-weight:900;letter-spacing:.04em">${row.TICKER}</button><button class="crsm-link" data-detail="${row.TICKER}" title="Xem chi tiết scoring">Chi tiết</button></td><td>${escapeHtml(row.INDUSTRY)}</td><td>${fmt(row.PRICE)}</td><td>${fmt(row.PE)}</td><td>${fmt(row.QUALITY_SCORE)}</td><td>${fmt(row.GROWTH_SCORE)}</td><td>${fmt(row.VALUATION_SCORE)}</td><td>${fmt(row.MICRO)}</td><td>${fmt(row.MOMENTUM)}</td><td>${fmt(row.MISPRICING)}</td><td><strong>${fmt(row.FINALSCORE)}</strong></td><td>${gradeBadge(row.GRADE)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function renderDetail() {
  const stock = state.rows.find(row => row.TICKER === state.selectedTicker) || state.rows[0];
  if (!stock) return emptyState();
  const prompt = buildPrompt(stock);
  return `<section class="grid"><button class="btn" data-tab="list">← Quay lại ranking</button><div class="detail-head"><div class="panel panel-pad"><p class="eyebrow">${escapeHtml(stock.INDUSTRY)}</p><h1>${stock.TICKER}</h1><div class="score-big">${fmt(stock.FINALSCORE)}</div><p>Rank #${stock.RANK} · ${gradeBadge(stock.GRADE)}</p><button class="btn primary" data-crsm="${stock.TICKER}">Phân tích bằng CRSM →</button></div>
    <div class="panel panel-pad"><p class="eyebrow">Score Breakdown</p><div class="score-grid">${scoreCard('Quality', stock.QUALITY_SCORE)}${scoreCard('Growth', stock.GROWTH_SCORE)}${scoreCard('Valuation', stock.VALUATION_SCORE)}${scoreCard('Micro', stock.MICRO)}${scoreCard('Momentum', stock.MOMENTUM)}${scoreCard('Mispricing', stock.MISPRICING)}</div></div></div>
    <div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">AI Prompt</p><h2>Prompt phân tích tối ưu</h2></div><button class="btn primary" id="copyPrompt">Copy prompt</button></div><textarea class="prompt" id="promptText" readonly>${escapeHtml(prompt)}</textarea></div></section>`;
}

function bindEvents() {
  document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => { state.tab = button.dataset.tab; render(); }));
  document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); state.selectedTicker = button.dataset.detail; state.tab = 'detail'; render(); }));
  document.querySelectorAll('[data-crsm]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); launchScreenedCRSM(button.dataset.crsm); }));
  document.querySelectorAll('[data-select-ticker]').forEach(input => input.addEventListener('change', event => toggleSelectedTicker(event.target.dataset.selectTicker, event.target.checked)));

  bind('openTradingView', 'click', () => window.open('https://www.tradingview.com/screener/', '_blank', 'noopener,noreferrer'));
  bind('importClipboard', 'click', importFromClipboard);
  bind('copyPrompt', 'click', copyPrompt);
  bind('crsmRunDirect', 'click', runDirectCRSM);
  bind('crsmBack', 'click', () => { state.tab = 'list'; render(); });
  bind('selectAllCRSM', 'change', event => selectVisible(event.target.checked));
  bind('selectVisibleCRSM', 'click', selectAllVisibleToggle);
  bind('clearSelectedCRSM', 'click', () => { state.selectedTickers = []; render(); });
  bind('runSelectedCRSM', 'click', runSelectedCRSM);
  bindCRSMUIBindings();
  window.addEventListener('crsm:retry-from-failed', () => retryFailedCRSM());
  window.addEventListener('crsm:retry-all', () => retryAllCRSM());
  const crsmTickerInput = document.getElementById('crsmTickerInput');
  if (crsmTickerInput) crsmTickerInput.addEventListener('keydown', event => { if (event.key === 'Enter') runDirectCRSM(); });
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', event => { state.search = event.target.value; render(); });
}

function bind(id, event, handler) { const node = document.getElementById(id); if (node) node.addEventListener(event, handler); }

async function importFromClipboard() {
  state.errors = [];
  try {
    if (!navigator.clipboard?.readText) throw new Error('Trình duyệt không hỗ trợ đọc Clipboard. Hãy dùng Chrome/Edge/Safari mới hoặc mở quyền Clipboard.');
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error('Clipboard đang trống. Hãy mở TradingView Screener, Ctrl+A → Ctrl+C rồi thử lại.');
    state.pasteText = text;
    const result = parseTradingViewPaste(text);
    state.errors = result.errors;
    if (result.errors.length || !result.rows.length) {
      state.importStatus = null;
      render();
      return;
    }
    state.rows = scoreStocks(result.rows);
    state.selectedTicker = state.rows[0]?.TICKER || null;
    state.selectedTickers = [];
    state.importStatus = { count: state.rows.length, columns: result.rows[0] ? Object.keys(result.rows[0]).length : null, time: new Date().toLocaleString('vi-VN') };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows));
    state.tab = 'dashboard';
    render();
  } catch (error) {
    state.errors = [error?.message || 'Không thể đọc dữ liệu từ Clipboard.'];
    render();
  }
}

function toggleSelectedTicker(ticker, checked) {
  const next = new Set(state.selectedTickers);
  if (checked) next.add(ticker); else next.delete(ticker);
  state.selectedTickers = [...next];
  render();
}

function selectVisible(checked) {
  const q = state.search.toLowerCase();
  const visible = state.rows.filter(row => row.TICKER.toLowerCase().includes(q) || row.INDUSTRY.toLowerCase().includes(q)).map(row => row.TICKER);
  const next = new Set(state.selectedTickers);
  visible.forEach(ticker => checked ? next.add(ticker) : next.delete(ticker));
  state.selectedTickers = [...next];
  render();
}

function selectAllVisibleToggle() {
  const q = state.search.toLowerCase();
  const visible = state.rows.filter(row => row.TICKER.toLowerCase().includes(q) || row.INDUSTRY.toLowerCase().includes(q)).map(row => row.TICKER);
  const allSelected = visible.length > 0 && visible.every(ticker => state.selectedTickers.includes(ticker));
  selectVisible(!allSelected);
}

function launchScreenedCRSM(ticker) {
  const stock = state.rows.find(row => row.TICKER === ticker);
  if (!stock) return;
  state.selectedTicker = ticker;
  state.tab = 'crsm';
  render();
  const context = buildScreeningContext(stock);
  runCRSM({ mode: 'SCREENED', ticker, screeningContext: context });
}

async function runSelectedCRSM() {
  if (state.batchRunning || !state.selectedTickers.length) return;
  const queue = [...state.selectedTickers];
  state.batchRunning = true;
  state.batchProgress = { index: 0, total: queue.length, ticker: queue[0] };
  state.tab = 'crsm';
  render();

  for (let index = 0; index < queue.length; index += 1) {
    const ticker = queue[index];
    const stock = state.rows.find(row => row.TICKER === ticker);
    if (!stock) continue;
    state.batchProgress = { index: index + 1, total: queue.length, ticker };
    updateBatchProgress();
    const context = buildScreeningContext(stock);
    const result = await runCRSM({
      mode: 'SCREENED',
      ticker,
      screeningContext: context,
      onComplete: async ({ outputs }) => {
        const report = outputs?.node6a;
        if (report) await downloadReportBundle(report, ticker);
      }
    });
    if (result?.error && !result?.outputs?.node6a) console.warn(`CRSM batch failed for ${ticker}`, result.error);
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  state.batchRunning = false;
  state.batchProgress = null;
  state.selectedTickers = [];
  updateBatchProgress();
}

function updateBatchProgress() {
  if (state.tab === 'list') render();
  else updateDynamicRegion();
}

async function runDirectCRSM() {
  const input = document.getElementById('crsmTickerInput');
  const ticker = (input?.value || '').trim().toUpperCase();
  if (!ticker) return;
  setCrsmRunning();
  await runCRSM({ mode: 'DIRECT', ticker, screeningContext: null });
}

function setCrsmRunning() { if (state.tab !== 'crsm') render(); else updateDynamicRegion(); }

function retryFailedCRSM() {
  const mode = crsmState.mode; const ticker = crsmState.ticker; const startFrom = crsmState.failedNode;
  if (!mode || !ticker) return;
  runCRSM({ mode, ticker, screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null, startFrom, existingOutputs: crsmState.nodeOutputs });
}

function retryAllCRSM() {
  const mode = crsmState.mode; const ticker = crsmState.ticker;
  if (!mode || !ticker) return;
  runCRSM({ mode, ticker, screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null, startFrom: 'node1', existingOutputs: null, bypassCache: true });
}

function loadRows() { try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function emptyState() { return `<section class="panel panel-pad"><p class="eyebrow">No Data</p><h1>Chưa có dữ liệu cổ phiếu</h1><p class="muted">Hãy import bảng TradingView ở tab Screen để bắt đầu.</p><button class="btn primary" data-tab="import">Đi tới Screen</button></section>`; }
function metric(label, value) { return `<div class="panel metric"><p class="metric-label">${label}</p><p class="metric-value">${value}</p></div>`; }
function stockLine(row) { return `<div class="stock-line clickable" data-crsm="${row.TICKER}" title="Chạy CRSM cho ${row.TICKER}"><span><strong>${row.TICKER}</strong> <span class="muted">${escapeHtml(row.INDUSTRY)}</span></span><span>${fmt(row.FINALSCORE)} ${gradeBadge(row.GRADE)}</span></div>`; }
function scoreCard(label, value) { return `<div class="score-card"><span class="muted">${label}</span><strong>${fmt(value)}</strong></div>`; }
function gradeBadge(grade) { const cls = grade?.startsWith('A') ? 'grade-a' : grade === 'B' ? 'grade-b' : grade === 'C' ? 'grade-c' : 'grade-d'; return `<span class="badge ${cls}">${grade || '-'}</span>`; }
function fmt(value) { if (value == null || Number.isNaN(value)) return '-'; if (typeof value === 'number') return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }); return value; }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
