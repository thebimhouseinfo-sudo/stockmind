import { parseTradingViewPaste } from './parser.js';
import { buildPrompt, buildStats, scoreStocks } from './scoring.js';
import { samplePaste } from './sample.js';
import { crsmState, subscribeCRSM } from './crsm/state.js';
import { buildScreeningContext } from './crsm/context.js';
import { runCRSM } from './crsm/engine.js';
import { renderCRSMTab, bindCRSMUIBindings, updateDynamicRegion } from './crsm/ui/index.js';

const STORAGE_KEY = 'stock-mind.dataset.v1';

let state = {
  tab: 'import',
  pasteText: '',
  rows: loadRows(),
  errors: [],
  selectedTicker: null,
  search: ''
};

const app = document.getElementById('app');
subscribeCRSM(() => {
  if (state.tab === 'crsm') {
    updateDynamicRegion();
  }
});
render();

function render() {
  app.innerHTML = `
    <div class="shell">
      ${renderTopbar()}
      <main class="main">
        ${state.tab === 'import' ? renderImport() : ''}
        ${state.tab === 'dashboard' ? renderDashboard() : ''}
        ${state.tab === 'list' ? renderList() : ''}
        ${state.tab === 'detail' ? renderDetail() : ''}
        ${state.tab === 'crsm' ? renderCRSMTab() : ''}
      </main>
    </div>
  `;
  bindEvents();
}

function renderTopbar() {
  const tabs = [
    ['import', 'Paste'],
    ['dashboard', 'Dashboard'],
    ['list', 'Ranking'],
    ['crsm', 'CRSM']
  ];

  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand"><div class="brand-mark">↗</div><span>Stock Mind</span></div>
        <nav class="tabs">
          ${tabs.map(([id, label]) => `<button class="tab ${state.tab === id ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
        </nav>
      </div>
    </header>
  `;
}

function renderImport() {
  return `
    <section class="grid two">
      <div class="panel panel-pad">
        <p class="eyebrow">TradingView Input</p>
        <h1>Dán bảng screener vào đây</h1>
        <p class="muted">Copy cả dòng header từ TradingView để app tự nhận diện cột và tính điểm.</p>
        <textarea class="paste-box" id="pasteInput" placeholder="Paste dữ liệu TradingView...">${escapeHtml(state.pasteText)}</textarea>
        <div class="actions">
          <button class="btn primary" id="processPaste">Xử lý dữ liệu</button>
          <button class="btn" id="loadSample">Dùng dữ liệu mẫu</button>
          <button class="btn" id="exportJson">Export JSON</button>
          <label class="btn" for="importJson">Import JSON</label>
          <input id="importJson" type="file" accept="application/json" hidden>
          <button class="btn danger" id="clearData">Xóa dữ liệu</button>
        </div>
      </div>
      <div class="panel panel-pad">
        <p class="eyebrow">Status</p>
        <h2>${state.rows.length ? `${state.rows.length} mã đã sẵn sàng` : 'Chưa có dữ liệu'}</h2>
        <p class="muted">Dữ liệu được lưu trong trình duyệt của bạn. Không còn phụ thuộc Google Sheet hay Apps Script.</p>
        ${state.errors.length ? `<div class="errors">${state.errors.map(escapeHtml).join('<br>')}</div>` : '<div class="notice">Công thức đang dùng scoring model V1 trong SPEC.md.</div>'}
      </div>
    </section>
  `;
}

function renderDashboard() {
  if (!state.rows.length) return emptyState();

  const stats = buildStats(state.rows);
  const industries = Object.entries(stats.industryCount).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return `
    <section class="grid">
      <div class="grid metrics">
        ${metric('Tổng mã', stats.total)}
        ${metric('Điểm TB', fmt(stats.avgScore))}
        ${metric('Ngành', Object.keys(stats.industryCount).length)}
        ${metric('Top Grade', stats.top10[0]?.GRADE || '-')}
      </div>
      <div class="grid two">
        <div class="panel panel-pad">
          <div class="title-row"><div><p class="eyebrow">Top 10</p><h2>Sức mạnh tổng hợp</h2></div></div>
          ${stats.top10.map(row => stockLine(row)).join('')}
        </div>
        <div class="panel panel-pad">
          <div class="title-row"><div><p class="eyebrow">Industries</p><h2>Phân bổ ngành</h2></div></div>
          ${industries.map(([name, count]) => `
            <div class="stock-line">
              <span>${escapeHtml(name)}</span>
              <strong>${count} mã</strong>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

function renderList() {
  if (!state.rows.length) return emptyState();

  const rows = state.rows.filter(row => {
    const q = state.search.toLowerCase();
    return row.TICKER.toLowerCase().includes(q) || row.INDUSTRY.toLowerCase().includes(q);
  });

  return `
    <section class="panel panel-pad">
      <div class="toolbar">
        <div><p class="eyebrow">Ranking</p><h2>${rows.length} mã</h2></div>
        <input class="search" id="searchInput" value="${escapeHtml(state.search)}" placeholder="Tìm ticker hoặc ngành">
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th><th>Ticker</th><th>Industry</th><th>Price</th><th>P/E</th>
              <th>Quality</th><th>Growth</th><th>Value</th><th>Micro</th><th>Momentum</th>
              <th>Mispricing</th><th>Final</th><th>Grade</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr class="clickable" data-detail="${row.TICKER}">
                <td>#${row.RANK}</td>
                <td class="ticker">
                  ${row.TICKER}
                  <button class="crsm-link" data-crsm="${row.TICKER}" title="Phân tích bằng CRSM">CRSM →</button>
                </td>
                <td>${escapeHtml(row.INDUSTRY)}</td>
                <td>${fmt(row.PRICE)}</td>
                <td>${fmt(row.PE)}</td>
                <td>${fmt(row.QUALITY_SCORE)}</td>
                <td>${fmt(row.GROWTH_SCORE)}</td>
                <td>${fmt(row.VALUATION_SCORE)}</td>
                <td>${fmt(row.MICRO)}</td>
                <td>${fmt(row.MOMENTUM)}</td>
                <td>${fmt(row.MISPRICING)}</td>
                <td><strong>${fmt(row.FINALSCORE)}</strong></td>
                <td>${gradeBadge(row.GRADE)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDetail() {
  const stock = state.rows.find(row => row.TICKER === state.selectedTicker) || state.rows[0];
  if (!stock) return emptyState();
  const prompt = buildPrompt(stock);

  return `
    <section class="grid">
      <button class="btn" data-tab="list">← Quay lại ranking</button>
      <div class="detail-head">
        <div class="panel panel-pad">
          <p class="eyebrow">${escapeHtml(stock.INDUSTRY)}</p>
          <h1>${stock.TICKER}</h1>
          <div class="score-big">${fmt(stock.FINALSCORE)}</div>
          <p>Rank #${stock.RANK} · ${gradeBadge(stock.GRADE)}</p>
        </div>
        <div class="panel panel-pad">
          <p class="eyebrow">Score Breakdown</p>
          <div class="score-grid">
            ${scoreCard('Quality', stock.QUALITY_SCORE)}
            ${scoreCard('Growth', stock.GROWTH_SCORE)}
            ${scoreCard('Valuation', stock.VALUATION_SCORE)}
            ${scoreCard('Micro', stock.MICRO)}
            ${scoreCard('Momentum', stock.MOMENTUM)}
            ${scoreCard('Mispricing', stock.MISPRICING)}
          </div>
        </div>
      </div>
      <div class="panel panel-pad">
        <div class="title-row">
          <div><p class="eyebrow">AI Prompt</p><h2>Prompt phân tích tối ưu</h2></div>
          <button class="btn primary" id="copyPrompt">Copy prompt</button>
        </div>
        <textarea class="prompt" id="promptText" readonly>${escapeHtml(prompt)}</textarea>
      </div>
    </section>
  `;
}

function bindEvents() {
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => {
      state.tab = button.dataset.tab;
      render();
    });
  });

  document.querySelectorAll('[data-detail]').forEach(row => {
    row.addEventListener('click', () => {
      state.selectedTicker = row.dataset.detail;
      state.tab = 'detail';
      render();
    });
  });

  document.querySelectorAll('[data-crsm]').forEach(row => {
    row.addEventListener('click', event => {
      event.stopPropagation();
      launchScreenedCRSM(row.dataset.crsm);
    });
  });

  const pasteInput = document.getElementById('pasteInput');
  if (pasteInput) {
    pasteInput.addEventListener('input', event => {
      state.pasteText = event.target.value;
    });
  }

  bind('processPaste', 'click', processPaste);
  bind('loadSample', 'click', () => {
    state.pasteText = samplePaste;
    processPaste();
  });
  bind('clearData', 'click', () => {
    state.rows = [];
    state.errors = [];
    state.selectedTicker = null;
    localStorage.removeItem(STORAGE_KEY);
    render();
  });
  bind('exportJson', 'click', exportJson);
  bind('importJson', 'change', importJson);
  bind('copyPrompt', 'click', copyPrompt);
  bind('crsmRunDirect', 'click', runDirectCRSM);
  bind('crsmBack', 'click', () => {
    state.tab = 'list';
    render();
  });
  bindCRSMUIBindings();

  window.addEventListener('crsm:retry-from-failed', () => retryFailedCRSM());
  window.addEventListener('crsm:retry-all', () => retryAllCRSM());

  const crsmTickerInput = document.getElementById('crsmTickerInput');
  if (crsmTickerInput) {
    crsmTickerInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') runDirectCRSM();
    });
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', event => {
      state.search = event.target.value;
      render();
    });
  }
}

function bind(id, event, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener(event, handler);
}

function processPaste() {
  const input = document.getElementById('pasteInput');
  if (input && input.value.trim()) state.pasteText = input.value;

  const result = parseTradingViewPaste(state.pasteText);
  state.errors = result.errors;
  state.rows = result.errors.length ? [] : scoreStocks(result.rows);
  state.selectedTicker = state.rows[0]?.TICKER || null;
  if (state.rows.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows));
    state.tab = 'dashboard';
  }
  render();
}

function launchScreenedCRSM(ticker) {
  const stock = state.rows.find(row => row.TICKER === ticker);
  if (!stock) return;
  state.tab = 'crsm';
  render();
  const context = buildScreeningContext(stock);
  runCRSM({ mode: 'SCREENED', ticker, screeningContext: context });
}

async function runDirectCRSM() {
  const input = document.getElementById('crsmTickerInput');
  const ticker = (input?.value || '').trim().toUpperCase();
  if (!ticker) return;
  setCrsmRunning();
  await runCRSM({ mode: 'DIRECT', ticker, screeningContext: null });
}

function setCrsmRunning() {
  if (state.tab !== 'crsm') render();
  else updateDynamicRegion();
}

function retryFailedCRSM() {
  const mode = crsmState.mode;
  const ticker = crsmState.ticker;
  const startFrom = crsmState.failedNode;
  if (!mode || !ticker) return;
  runCRSM({
    mode,
    ticker,
    screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null,
    startFrom,
    existingOutputs: crsmState.nodeOutputs
  });
}

function retryAllCRSM() {
  const mode = crsmState.mode;
  const ticker = crsmState.ticker;
  if (!mode || !ticker) return;
  runCRSM({
    mode,
    ticker,
    screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null,
    startFrom: 'node1',
    existingOutputs: null,
    bypassCache: true
  });
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.rows, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stock-mind-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const rows = JSON.parse(await file.text());
  state.rows = scoreStocks(rows);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.rows));
  state.tab = 'dashboard';
  render();
}

async function copyPrompt() {
  const text = document.getElementById('promptText')?.value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
}

function loadRows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function emptyState() {
  return `
    <section class="panel panel-pad">
      <p class="eyebrow">No Data</p>
      <h1>Chưa có dữ liệu cổ phiếu</h1>
      <p class="muted">Hãy dán dữ liệu TradingView ở tab Paste để bắt đầu.</p>
      <button class="btn primary" data-tab="import">Đi tới Paste</button>
    </section>
  `;
}

function metric(label, value) {
  return `<div class="panel metric"><p class="metric-label">${label}</p><p class="metric-value">${value}</p></div>`;
}

function stockLine(row) {
  return `
    <div class="stock-line clickable" data-detail="${row.TICKER}">
      <span><strong>${row.TICKER}</strong> <span class="muted">${escapeHtml(row.INDUSTRY)}</span></span>
      <span>${fmt(row.FINALSCORE)} ${gradeBadge(row.GRADE)}</span>
    </div>
  `;
}

function scoreCard(label, value) {
  return `<div class="score-card"><span class="muted">${label}</span><strong>${fmt(value)}</strong></div>`;
}

function gradeBadge(grade) {
  const cls = grade?.startsWith('A') ? 'grade-a' : grade === 'B' ? 'grade-b' : grade === 'C' ? 'grade-c' : 'grade-d';
  return `<span class="badge ${cls}">${grade || '-'}</span>`;
}

function fmt(value) {
  if (value == null || Number.isNaN(value)) return '-';
  if (typeof value === 'number') return value.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  return value;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
