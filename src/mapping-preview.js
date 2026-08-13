import { parseTradingViewPaste } from './parser.js';

const STORAGE_KEY = 'stock-mind.dataset.v1';
const TAB_ID = 'mapping-preview';
const TAB_LABEL = 'Mapping';

const COLUMNS = [
  ['ticker', 'Symbol', 'Ticker'],
  ['company_name', 'Company', 'Company'],
  ['sector', 'Sector', 'Sector'],
  ['industry', 'Industry', 'Industry'],
  ['market_cap', 'Market Cap', 'Market Cap'],
  ['price', 'Price', 'Price'],
  ['change_pct', 'Chg %', 'Change %'],
  ['perf_1w', 'Perf 1W', '1W'],
  ['perf_1m', 'Perf 1M', '1M'],
  ['perf_3m', 'Perf 3M', '3M'],
  ['perf_6m', 'Perf 6M', '6M'],
  ['perf_1y', 'Perf 1Y', '1Y'],
  ['perf_ytd', 'Perf YTD', 'YTD'],
  ['high_52w', 'High 52W', '52W High'],
  ['low_52w', 'Low 52W', '52W Low'],
  ['volume', 'Vol', 'Volume'],
  ['relative_volume', 'Rel Vol', 'Relative Vol'],
  ['avg_volume_10d', 'Avg Vol 10D', 'Avg Vol 10D'],
  ['avg_volume_30d', 'Avg Vol 30D', 'Avg Vol 30D'],
  ['avg_volume_60d', 'Avg Vol 60D', 'Avg Vol 60D'],
  ['roe_ttm', 'ROE TTM', 'ROE TTM'],
  ['roa_ttm', 'ROA TTM', 'ROA TTM'],
  ['revenue_fq', 'Revenue FQ', 'Revenue FQ'],
  ['revenue_fy', 'Revenue FY', 'Revenue FY'],
  ['revenue_ttm', 'Revenue TTM', 'Revenue TTM'],
  ['revenue_growth_quarterly_yoy', 'Revenue Growth Quarterly YoY', 'Revenue Growth Q YoY'],
  ['revenue_growth_annual_yoy', 'Revenue Growth Annual YoY', 'Revenue Growth FY YoY'],
  ['eps_dil_ttm', 'EPS Dil TTM', 'EPS TTM'],
  ['eps_dil_growth_ttm_yoy', 'EPS Dil Growth TTM YoY', 'EPS Growth TTM YoY'],
  ['peg_ttm', 'PEG TTM', 'PEG TTM'],
  ['gross_margin_ttm', 'Gross Margin % TTM', 'Gross Margin TTM'],
  ['operating_margin_ttm', 'Op Margin % TTM', 'Operating Margin TTM'],
  ['net_margin_ttm', 'Net Margin % TTM', 'Net Margin TTM'],
  ['fcf_ttm', 'FCF TTM', 'FCF TTM'],
  ['fcf_growth_ttm_yoy', 'FCF Growth TTM YoY', 'FCF Growth TTM YoY'],
  ['debt_equity_fq', 'Debt/Equity FQ', 'D/E FQ'],
  ['debt_equity_fy', 'Debt/Equity FY', 'D/E FY'],
  ['current_ratio_fq', 'Current Ratio FQ', 'Current Ratio FQ'],
  ['current_ratio_fy', 'Current Ratio FY', 'Current Ratio FY'],
  ['quick_ratio_fq', 'Quick Ratio FQ', 'Quick Ratio FQ'],
  ['quick_ratio_fy', 'Quick Ratio FY', 'Quick Ratio FY'],
  ['pe', 'P/E', 'P/E'],
  ['peg', 'PEG', 'PEG'],
  ['pb', 'P/B', 'P/B'],
  ['ps', 'P/S', 'P/S'],
  ['ev_ebitda', 'EV/EBITDA', 'EV/EBITDA'],
  ['ev_revenue', 'EV/Revenue', 'EV/Revenue'],
  ['dividend_yield_ttm', 'Div Yield % TTM', 'Dividend Yield TTM']
];

const DEBUG_COLUMNS = [
  'symbol', 'ui_marker', 'sector', 'industry', 'market_cap', 'price', 'change_pct', 'perf_1w', 'perf_1m',
  'perf_3m', 'perf_6m', 'perf_1y', 'perf_ytd', 'high_52w', 'low_52w', 'volume', 'relative_volume',
  'avg_volume_10d', 'avg_volume_30d', 'avg_volume_60d', 'roe_ttm', 'roa_ttm', 'revenue_fq', 'revenue_fy',
  'revenue_ttm', 'revenue_growth_quarterly_yoy', 'revenue_growth_annual_yoy', 'eps_dil_ttm',
  'eps_dil_growth_ttm_yoy', 'peg_ttm', 'gross_margin_ttm', 'operating_margin_ttm', 'net_margin_ttm',
  'fcf_ttm', 'fcf_growth_ttm_yoy', 'debt_equity_fq', 'debt_equity_fy', 'current_ratio_fq', 'current_ratio_fy',
  'quick_ratio_fq', 'quick_ratio_fy', 'pe', 'peg', 'pb', 'ps', 'ev_ebitda', 'ev_revenue', 'dividend_yield_ttm'
];

let previewOpen = false;
let observerStarted = false;
let debugState = { status: 'Chưa lấy clipboard debug.', rawRow: [], parsedRow: null, result: null, error: null };

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function readRows() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.rows)) return data.rows;
    if (Array.isArray(data.data)) return data.data;
  } catch (error) {
    console.warn('[Mapping Preview] Cannot read dataset:', error);
  }
  return [];
}

function displayValue(row, key) {
  const value = row?.[key];
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toLocaleString('vi-VN', { maximumFractionDigits: 4 }) : '—';
  }
  return String(value);
}

function splitDebugMarkdownRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|')) return [];
  const body = trimmed.slice(1).endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1);
  return body.split('|').map(cell => cell.trim());
}

function findFirstDebugDataRow(text) {
  const rows = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const tableRows = rows.filter(line => /^\s*\|/.test(line) && line.includes('|')).map(splitDebugMarkdownRow);
  for (let index = 0; index < tableRows.length - 1; index += 1) {
    const row = tableRows[index];
    const separator = row.length > 0 && row.every(cell => /^\s*:?-{1,}:?\s*$/.test(cell) || cell === '');
    if (!separator) continue;
    for (let next = index + 1; next < tableRows.length; next += 1) {
      const candidate = tableRows[next];
      if (candidate.every(cell => /^\s*:?-{1,}:?\s*$/.test(cell) || cell === '')) continue;
      if (candidate.length && candidate[0]) return candidate;
    }
  }
  return [];
}

async function captureDebug() {
  debugState = { status: 'Đang đọc clipboard…', rawRow: [], parsedRow: null, result: null, error: null };
  renderPreview();
  try {
    if (!navigator.clipboard?.readText) throw new Error('Trình duyệt không hỗ trợ đọc Clipboard.');
    const text = await navigator.clipboard.readText();
    if (!text.trim()) throw new Error('Clipboard đang trống.');
    const rawRow = findFirstDebugDataRow(text);
    const result = parseTradingViewPaste(text);
    debugState = {
      status: rawRow.length ? `Đã đọc clipboard · ${rawRow.length} cells ở dòng mẫu đầu tiên` : 'Không tìm thấy dòng Markdown data.',
      rawRow,
      parsedRow: result.rows?.[0] || null,
      result,
      error: null
    };
  } catch (error) {
    debugState = { status: 'Debug lỗi', rawRow: [], parsedRow: null, result: null, error: error?.message || String(error) };
  }
  renderPreview();
}

function renderDebugPanel() {
  const result = debugState.result;
  const parsed = debugState.parsedRow;
  const cells = debugState.rawRow || [];
  const mode = result?.mode || result?.columns?.mode || '—';
  const rowCount = result?.rows?.length ?? '—';
  const expected = DEBUG_COLUMNS.length;
  const countClass = cells.length === expected ? 'debug-ok' : 'debug-warn';

  const rows = DEBUG_COLUMNS.map((field, index) => {
    const raw = cells[index] ?? '∅';
    const parsedKey = field === 'symbol' ? 'ticker + company_name' : field === 'ui_marker' ? 'ignored' : field;
    let parsedValue = '—';
    if (parsed) {
      if (field === 'symbol') parsedValue = `ticker=${parsed.ticker ?? '—'} · company=${parsed.company_name ?? '—'}`;
      else if (field === 'ui_marker') parsedValue = 'ignored';
      else parsedValue = displayValue(parsed, field);
    }
    return `<tr><td>${index}</td><td>${escapeHtml(field)}</td><td>${escapeHtml(raw)}</td><td>${escapeHtml(parsedKey)}</td><td>${escapeHtml(parsedValue)}</td></tr>`;
  }).join('');

  return `<section class="mapping-debug-panel">
    <div class="mapping-debug-head">
      <div><p class="eyebrow">PARSER DEBUG</p><h2>Raw Clipboard → Parser → Internal</h2><p class="muted">Debug chỉ đọc mẫu dòng đầu tiên để xác định chính xác parser đang nhận bao nhiêu cell và map từng vị trí như thế nào.</p></div>
      <button class="btn" id="mappingDebugRefresh">Đọc lại Clipboard</button>
    </div>
    <div class="mapping-debug-summary">
      <div><span>Mode</span><strong>${escapeHtml(mode)}</strong></div>
      <div><span>Parsed rows</span><strong>${escapeHtml(String(rowCount))}</strong></div>
      <div><span>Raw cells</span><strong class="${countClass}">${cells.length} / ${expected}</strong></div>
      <div><span>Status</span><strong>${escapeHtml(debugState.status)}</strong></div>
    </div>
    ${debugState.error ? `<div class="mapping-debug-error">${escapeHtml(debugState.error)}</div>` : ''}
    <div class="mapping-debug-table-wrap"><table class="mapping-debug-table"><thead><tr><th>#</th><th>Parser position</th><th>Raw cell</th><th>Expected mapping</th><th>Parsed value</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function renderPreview() {
  const main = document.querySelector('.main');
  if (!main) return;
  const rows = readRows();

  main.innerHTML = `<section class="mapping-preview-page">
    <div class="mapping-preview-head">
      <div>
        <p class="eyebrow">DATA MAPPING</p>
        <h1>TradingView → Stock Mind</h1>
        <p class="muted">Bảng này tái tạo dữ liệu sau khi parser map sang schema nội bộ. Dùng để kiểm tra trực quan trước khi sửa scoring.</p>
      </div>
      <div class="mapping-preview-meta">
        <strong>${rows.length.toLocaleString('vi-VN')}</strong>
        <span>mã đã map</span>
      </div>
    </div>
    <div class="mapping-preview-note">
      <span class="mapping-dot"></span>
      <span>Header hiển thị <strong>tên TradingView</strong> và <strong>Internal field</strong>. Dấu <strong>—</strong> nghĩa là parser hiện chưa nhận giá trị cho field đó.</span>
    </div>
    ${rows.length ? `<div class="mapping-table-wrap"><table class="mapping-table">
      <thead><tr>
        <th class="sticky-col">#</th>
        ${COLUMNS.map(([key, tv, label]) => `<th title="TradingView: ${escapeHtml(tv)}"><span>${escapeHtml(tv)}</span><small>${escapeHtml(key)}</small></th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map((row, index) => `<tr>
          <td class="sticky-col row-number">${index + 1}</td>
          ${COLUMNS.map(([key]) => `<td class="${key === 'ticker' ? 'ticker-cell' : ''}">${escapeHtml(displayValue(row, key))}</td>`).join('')}
        </tr>`).join('')}
      </tbody>
    </table></div>` : `<div class="mapping-empty"><strong>Chưa có dữ liệu.</strong><span>Vào Screen → Import &amp; Screen trước, sau đó mở lại tab Mapping.</span></div>`}
    ${renderDebugPanel()}
  </section>`;

  const debugButton = document.getElementById('mappingDebugRefresh');
  if (debugButton) debugButton.addEventListener('click', captureDebug);
}

function activateTab() {
  previewOpen = true;
  document.querySelectorAll('.tabs .tab').forEach(button => button.classList.remove('active'));
  const button = document.querySelector(`[data-tab="${TAB_ID}"]`);
  if (button) button.classList.add('active');
  renderPreview();
}

function deactivatePreview() {
  previewOpen = false;
}

function ensureTab() {
  const nav = document.querySelector('.tabs');
  if (!nav) return;
  if (nav.querySelector(`[data-tab="${TAB_ID}"]`)) return;

  const button = document.createElement('button');
  button.className = 'tab';
  button.type = 'button';
  button.dataset.tab = TAB_ID;
  button.textContent = TAB_LABEL;
  button.title = 'Preview dữ liệu sau mapping';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    activateTab();
  });
  nav.insertBefore(button, nav.querySelector('#openSettings') || null);
}

function observeApp() {
  if (observerStarted) return;
  observerStarted = true;
  const app = document.getElementById('app');
  if (!app) return;

  const observer = new MutationObserver(() => {
    ensureTab();
    if (previewOpen && !document.querySelector('.mapping-preview-page')) renderPreview();
  });
  observer.observe(app, { childList: true, subtree: true });
  ensureTab();
}

function boot() {
  observeApp();
  document.addEventListener('click', event => {
    const nativeTab = event.target.closest('.tabs .tab[data-tab]:not([data-tab="mapping-preview"])');
    if (nativeTab) deactivatePreview();
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
