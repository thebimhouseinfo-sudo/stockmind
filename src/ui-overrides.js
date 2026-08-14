import { renderSettings, bindSettingsEvents } from './crsm/ui/settings.js';

const DATA_KEY = 'stock-mind.dataset.v1';
let observerScheduled = false;
let activeDashboardGroup = 'CORE';
const selectedDashboardTickers = new Set();

const app = document.getElementById('app');

function readRows() {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmt(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function gradeClass(grade) {
  return grade?.startsWith('A') ? 'grade-a' : grade === 'B' ? 'grade-b' : grade === 'C' ? 'grade-c' : 'grade-d';
}

function hasFlags(row) {
  return Array.isArray(row?.DATA_FLAGS) && row.DATA_FLAGS.length > 0;
}

function noteSummary(row) {
  const notes = Array.isArray(row?.DATA_NOTES) ? row.DATA_NOTES : [];
  return !hasFlags(row) && notes.length ? `${notes.length} notes` : '';
}

function flagSummary(row) {
  if (!hasFlags(row)) return '';
  return row.DATA_FLAGS.slice(0, 2).map(flag => String(flag).replaceAll('_', ' ')).join(' / ');
}

function classificationLabel(value) {
  return ({
    CORE: 'Core Performer',
    QUALITY_UNDERPERFORMER: 'Quality Underperformer',
    HIGH_REWARD_HIGH_RISK: 'High Reward / High Risk',
    AVOID_VALUE_TRAP: 'Avoid / Value Trap',
    WATCH_NEUTRAL: 'Watch / Neutral'
  })[value] || value || '-';
}

function classificationDescription(value) {
  return ({
    CORE: 'Nền tảng và điểm tổng hợp tốt, phù hợp đưa vào danh sách ưu tiên để CRSM xác nhận thêm thesis.',
    QUALITY_UNDERPERFORMER: 'Doanh nghiệp có chất lượng tương đối ổn nhưng thị giá hoặc động lượng chưa ủng hộ, nên theo dõi điểm đảo chiều.',
    HIGH_REWARD_HIGH_RISK: 'Có dư địa hoặc tín hiệu hấp dẫn nhưng rủi ro dữ liệu, tài chính, định giá hoặc biến động cao hơn bình thường.',
    AVOID_VALUE_TRAP: 'Điểm rủi ro hoặc chất lượng yếu, dễ là bẫy giá rẻ; chỉ xem lại khi có catalyst thật rõ.',
    WATCH_NEUTRAL: 'Chưa đủ mạnh để ưu tiên nhưng cũng chưa xấu; giữ trong watchlist để chờ thêm dữ kiện.'
  })[value] || 'Nhóm ứng viên được phân loại theo Screener V2.';
}

function metric(label, value) {
  return `<div class="showcase-metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function rankingRow(row, localRank) {
  const flag = hasFlags(row);
  const note = noteSummary(row);
  const checked = selectedDashboardTickers.has(row.TICKER);
  return `<article class="ranking-row ${flag ? 'flagged' : 'clean'}">
    <label class="candidate-check" title="Chọn ${escapeHtml(row.TICKER)}"><input type="checkbox" data-dashboard-select="${escapeHtml(row.TICKER)}" ${checked ? 'checked' : ''}></label>
    <div class="ranking-rank">#${String(localRank).padStart(2, '0')}<span>R${fmt(row.RANK)}</span></div>
    <div class="ranking-main">
      <div class="ranking-head">
        <button class="ranking-ticker" data-showcase-ticker="${escapeHtml(row.TICKER)}">${escapeHtml(row.TICKER)}</button>
        <span class="ranking-industry">${escapeHtml(row.INDUSTRY || '')}</span>
        <span class="classification-chip">${escapeHtml(classificationLabel(row.SCREENING_GROUP))}</span>
        ${flag ? `<span class="flag-badge">! ${escapeHtml(flagSummary(row))}</span>` : ''}
        ${note ? `<span class="note-badge">${escapeHtml(note)}</span>` : ''}
      </div>
      <div class="ranking-metrics">
        ${metric('Price', fmt(row.PRICE))}
        ${metric('Quality', fmt(row.QUALITY_SCORE))}
        ${metric('Opportunity', fmt(row.MISPRICING))}
        ${metric('V2 Score', fmt(row.FINALSCORE))}
      </div>
    </div>
    <div class="ranking-score"><strong>${fmt(row.FINALSCORE)}</strong><span class="badge ${gradeClass(row.GRADE)}">${escapeHtml(row.GRADE || '-')}</span></div>
  </article>`;
}

function renderRankingPanel(title, subtitle, rows, tone, activeGroupRows) {
  const selectedInGroup = activeGroupRows.filter(row => selectedDashboardTickers.has(row.TICKER));
  const allSelected = activeGroupRows.length > 0 && selectedInGroup.length === activeGroupRows.length;
  return `<section class="ranking-panel ${tone}">
    <div class="ranking-panel-head">
      <div><p class="eyebrow">${title}</p><h2>${subtitle}</h2><p class="ranking-panel-description">${escapeHtml(classificationDescription(activeDashboardGroup))}</p></div>
      <span class="ranking-count">${rows.length} stocks</span>
    </div>
    <div class="dashboard-actions">
      <button class="btn" type="button" data-dashboard-select-group="${allSelected ? 'clear' : 'all'}">${allSelected ? 'Bỏ chọn nhóm' : 'Chọn cả nhóm'}</button>
      <button class="btn primary" type="button" data-dashboard-analyze-selected ${selectedDashboardTickers.size ? '' : 'disabled'}>Analyze selected${selectedDashboardTickers.size ? ` (${selectedDashboardTickers.size})` : ''}</button>
      ${selectedDashboardTickers.size ? '<button class="btn" type="button" data-dashboard-clear>Bỏ chọn</button>' : ''}
    </div>
    ${rows.length ? rows.map((row, index) => rankingRow(row, index + 1)).join('') : `<div class="ranking-empty"><strong>Chưa có ứng viên</strong><span>Nhóm này sẽ để trống nếu dataset hiện tại không có mã phù hợp.</span></div>`}
  </section>`;
}

const DASHBOARD_GROUPS = [
  ['CORE', 'Core', 'Core Performers', 'clean-panel'],
  ['QUALITY_UNDERPERFORMER', 'Underperform', 'Quality Underperformers', 'neutral-panel'],
  ['HIGH_REWARD_HIGH_RISK', 'High Reward', 'High Reward / High Risk', 'review-panel'],
  ['AVOID_VALUE_TRAP', 'Avoid', 'Avoid / Value Trap', 'flagged-panel'],
  ['WATCH_NEUTRAL', 'Watch', 'Watch / Neutral', 'watch-panel']
];

function groupRows(rows, group) {
  return rows.filter(row => row.SCREENING_GROUP === group).slice(0, 25);
}

function renderDashboardTabs(allRows) {
  return `<div class="dashboard-tabs" role="tablist">
    ${DASHBOARD_GROUPS.map(([group, label]) => {
      const count = allRows.filter(row => row.SCREENING_GROUP === group).length;
      return `<button class="dashboard-tab ${activeDashboardGroup === group ? 'active' : ''}" type="button" data-dashboard-group="${group}" role="tab" aria-selected="${activeDashboardGroup === group ? 'true' : 'false'}">
        <span>${escapeHtml(label)}</span><strong>${count}</strong>
      </button>`;
    }).join('')}
  </div>`;
}

function renderShowcase() {
  const allRows = readRows().sort((a, b) => Number(a.RANK || 9999) - Number(b.RANK || 9999));
  if (!allRows.length) return;

  const section = document.querySelector('.main > section.grid');
  if (!section || section.dataset.showcaseEnhanced === '1') return;
  section.dataset.showcaseEnhanced = '1';

  const criticalFlags = allRows.filter(hasFlags).length;
  if (!DASHBOARD_GROUPS.some(([group]) => group === activeDashboardGroup)) activeDashboardGroup = 'CORE';
  const activeMeta = DASHBOARD_GROUPS.find(([group]) => group === activeDashboardGroup) || DASHBOARD_GROUPS[0];
  const activeRows = groupRows(allRows, activeDashboardGroup);
  const allActiveGroupRows = allRows.filter(row => row.SCREENING_GROUP === activeDashboardGroup);

  section.innerHTML = `<div class="showcase-wrap">
    <div class="showcase-header">
      <div><p class="eyebrow">Screener V2 Dashboard</p><h1>Candidate Groups</h1></div>
      <div class="showcase-summary">${metric('Universe', allRows.length)}<span class="showcase-divider"></span>${metric('Top Score', allRows[0] ? fmt(allRows[0].FINALSCORE) : '-')}<span class="showcase-divider"></span>${metric('Critical Flags', criticalFlags)}</div>
    </div>
    ${renderDashboardTabs(allRows)}
    <div class="ranking-layout single-panel">
      ${renderRankingPanel(activeMeta[1].toUpperCase(), activeMeta[2], activeRows, activeMeta[3], allActiveGroupRows)}
    </div>
  </div>`;
}

function rerenderDashboard() {
  const section = document.querySelector('.main > section.grid');
  if (section) {
    section.dataset.showcaseEnhanced = '0';
    renderShowcase();
  }
}

function enhanceRankingPage() {
  const panel = document.querySelector('.main > section.panel.panel-pad');
  const listTabActive = document.querySelector('[data-tab="list"].active');
  if (!panel || !listTabActive || panel.dataset.rankingEnhanced === '1') return;
  const toolbar = panel.querySelector(':scope > .toolbar');
  const tableWrap = panel.querySelector(':scope > .table-wrap');
  if (!toolbar || !tableWrap) return;

  panel.dataset.rankingEnhanced = '1';
  toolbar.classList.add('ranking-title-card');
  tableWrap.classList.add('ranking-content-card');
}

function requestAnalyze(tickers) {
  document.dispatchEvent(new CustomEvent('stockmind:analyze-tickers', { detail: { tickers } }));
}

function openSettingsOverlay() {
  if (document.getElementById('settingsOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'settingsOverlay';
  overlay.className = 'settings-overlay';
  overlay.innerHTML = `<div class="settings-modal" role="dialog" aria-modal="true" aria-label="Stock Mind Settings">${renderSettings()}</div>`;
  document.body.appendChild(overlay);
  bindSettingsEvents();
  document.body.classList.add('settings-open');
}

function closeSettingsOverlay() {
  document.getElementById('settingsOverlay')?.remove();
  document.body.classList.remove('settings-open');
}

document.addEventListener('click', event => {
  const closeButton = event.target.closest?.('#crsmSettingsClose');
  if (closeButton && document.getElementById('settingsOverlay')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeSettingsOverlay();
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeSettingsOverlay();
});

document.addEventListener('click', event => {
  const dashboardTab = event.target.closest?.('[data-dashboard-group]');
  if (dashboardTab) {
    event.preventDefault();
    activeDashboardGroup = dashboardTab.dataset.dashboardGroup;
    rerenderDashboard();
    return;
  }

  const selectGroup = event.target.closest?.('[data-dashboard-select-group]');
  if (selectGroup) {
    event.preventDefault();
    const rows = readRows().filter(row => row.SCREENING_GROUP === activeDashboardGroup);
    if (selectGroup.dataset.dashboardSelectGroup === 'clear') rows.forEach(row => selectedDashboardTickers.delete(row.TICKER));
    else rows.forEach(row => selectedDashboardTickers.add(row.TICKER));
    rerenderDashboard();
    return;
  }

  const clearButton = event.target.closest?.('[data-dashboard-clear]');
  if (clearButton) {
    event.preventDefault();
    selectedDashboardTickers.clear();
    rerenderDashboard();
    return;
  }

  const analyzeSelected = event.target.closest?.('[data-dashboard-analyze-selected]');
  if (analyzeSelected) {
    event.preventDefault();
    requestAnalyze([...selectedDashboardTickers]);
    return;
  }

  const ticker = event.target.closest?.('[data-showcase-ticker]');
  if (!ticker) return;
  event.preventDefault();
  requestAnalyze([ticker.dataset.showcaseTicker]);
});

document.addEventListener('change', event => {
  const checkbox = event.target.closest?.('[data-dashboard-select]');
  if (!checkbox) return;
  const ticker = checkbox.dataset.dashboardSelect;
  if (checkbox.checked) selectedDashboardTickers.add(ticker);
  else selectedDashboardTickers.delete(ticker);
  rerenderDashboard();
});

function scheduleEnhancement() {
  if (observerScheduled) return;
  observerScheduled = true;
  requestAnimationFrame(() => {
    observerScheduled = false;
    if (document.querySelector('[data-tab="dashboard"].active')) renderShowcase();
    if (document.querySelector('[data-tab="list"].active')) enhanceRankingPage();
  });
}

if (app) {
  new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
  scheduleEnhancement();
}
