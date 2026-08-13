const STORAGE_KEY = 'stock-mind.dataset.v1';
const TAB_ID = 'mapping-preview';
const TAB_LABEL = 'Mapping';

const COLUMNS = [
  ['ticker', 'TICKER', 'Ticker'],
  ['company_name', 'COMPANY', 'Company'],
  ['sector', 'SECTOR', 'Sector'],
  ['industry', 'INDUSTRY', 'Industry'],
  ['market_cap', 'MKT CAP', 'Market Cap'],
  ['price', 'PRICE', 'Price'],
  ['change_pct', 'CHG %', 'Change %'],
  ['perf_1w', 'PERF 1W', '1W'],
  ['perf_1m', 'PERF 1M', '1M'],
  ['perf_3m', 'PERF 3M', '3M'],
  ['perf_6m', 'PERF 6M', '6M'],
  ['perf_1y', 'PERF 1Y', '1Y'],
  ['perf_ytd', 'PERF YTD', 'YTD'],
  ['high_52w', 'HIGH 52W', '52W High'],
  ['low_52w', 'LOW 52W', '52W Low'],
  ['volume', 'VOL', 'Volume'],
  ['relative_volume', 'REL VOL', 'Relative Vol'],
  ['avg_volume_10d', 'AVG VOL 10D', 'Avg Vol 10D'],
  ['avg_volume_30d', 'AVG VOL 30D', 'Avg Vol 30D'],
  ['avg_volume_60d', 'AVG VOL 60D', 'Avg Vol 60D'],
  ['roe_ttm', 'ROE TTM', 'ROE TTM'],
  ['roa_ttm', 'ROA TTM', 'ROA TTM'],
  ['revenue_fq', 'REVENUE FQ', 'Revenue FQ'],
  ['revenue_fy', 'REVENUE FY', 'Revenue FY'],
  ['revenue_ttm', 'REVENUE TTM', 'Revenue TTM'],
  ['revenue_growth_quarterly_yoy', 'REV GROWTH Q YOY', 'Revenue Growth Q YoY'],
  ['revenue_growth_annual_yoy', 'REV GROWTH FY YOY', 'Revenue Growth FY YoY'],
  ['eps_dil_ttm', 'EPS DIL TTM', 'EPS TTM'],
  ['eps_dil_growth_ttm_yoy', 'EPS DIL GROWTH TTM YOY', 'EPS Growth TTM YoY'],
  ['peg_ttm', 'PEG TTM', 'PEG TTM'],
  ['gross_margin_ttm', 'GROSS MARGIN TTM', 'Gross Margin TTM'],
  ['operating_margin_ttm', 'OPERATING MARGIN TTM', 'Operating Margin TTM'],
  ['net_margin_ttm', 'NET MARGIN TTM', 'Net Margin TTM'],
  ['fcf_ttm', 'FCF TTM', 'FCF TTM'],
  ['fcf_growth_ttm_yoy', 'FCF GROWTH TTM YOY', 'FCF Growth TTM YoY'],
  ['debt_equity_fq', 'DEBT/EQUITY FQ', 'D/E FQ'],
  ['debt_equity_fy', 'DEBT/EQUITY FY', 'D/E FY'],
  ['current_ratio_fq', 'CURRENT RATIO FQ', 'Current Ratio FQ'],
  ['current_ratio_fy', 'CURRENT RATIO FY', 'Current Ratio FY']
];

let previewOpen = false;
let observerStarted = false;

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
      <span>Header hiển thị <strong>Internal field</strong> và tên TradingView tương ứng. Giá trị bên dưới là dữ liệu parser đã lưu.</span>
    </div>
    ${rows.length ? `<div class="mapping-table-wrap"><table class="mapping-table">
      <thead><tr>
        <th class="sticky-col">#</th>
        ${COLUMNS.map(([key, tv, label]) => `<th title="${escapeHtml(tv)}"><span>${escapeHtml(label)}</span><small>${escapeHtml(key)}</small></th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map((row, index) => `<tr>
          <td class="sticky-col row-number">${index + 1}</td>
          ${COLUMNS.map(([key]) => `<td class="${key === 'ticker' ? 'ticker-cell' : ''}">${escapeHtml(displayValue(row, key))}</td>`).join('')}
        </tr>`).join('')}
      </tbody>
    </table></div>` : `<div class="mapping-empty"><strong>Chưa có dữ liệu.</strong><span>Vào Screen → Import &amp; Screen trước, sau đó mở lại tab Mapping.</span></div>`}
  </section>`;
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
