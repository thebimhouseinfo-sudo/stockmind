import { renderSettings, bindSettingsEvents } from './crsm/ui/settings.js';

const DATA_KEY = 'stock-mind.dataset.v1';
let observerScheduled = false;

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
    .replace(/\"/g, '&quot;')
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

function compactMetric(label, value) {
  return `<div class="ranking-metric"><span>${label}</span><strong>${fmt(value)}</strong></div>`;
}

function flagSummary(row) {
  const flags = Array.isArray(row?.DATA_FLAGS) ? row.DATA_FLAGS : [];
  if (!flags.length) return '';
  const labels = flags.slice(0, 2).map(flag => String(flag).split(':')[0].replace(/_/g, ' '));
  const extra = flags.length > 2 ? ` +${flags.length - 2}` : '';
  return `<span class="ranking-flags" title="${escapeHtml(flags.join(' · '))}">⚠ ${escapeHtml(labels.join(' · '))}${extra}</span>`;
}

function stockRow(row, index, flagged = false) {
  return `<article class="ranking-stock ${flagged ? 'flagged' : 'clean'}" data-ranking-ticker="${escapeHtml(row.TICKER)}">
    <div class="ranking-position">#${String(index + 1).padStart(2, '0')}<span>R${fmt(row.RANK)}</span></div>
    <div class="ranking-identity">
      <button class="ranking-ticker" data-showcase-ticker="${escapeHtml(row.TICKER)}">${escapeHtml(row.TICKER)}</button>
      <span class="ranking-industry">${escapeHtml(row.INDUSTRY || '-')}</span>
      ${flagSummary(row)}
    </div>
    <div class="ranking-metrics">
      ${compactMetric('Giá', row.PRICE)}
      ${compactMetric('P/E', row.PE)}
      ${compactMetric('Điểm', row.FINALSCORE)}
      <div class="ranking-metric ranking-grade"><span>Hạng</span><strong>${fmt(row.RANK)}</strong><em class="badge ${gradeClass(row.GRADE)}">${escapeHtml(row.GRADE || '-')}</em></div>
    </div>
  </article>`;
}

function rankingPanel(title, eyebrow, rows, flagged = false) {
  return `<section class="ranking-panel ${flagged ? 'ranking-panel-flagged' : 'ranking-panel-clean'}">
    <div class="ranking-panel-head">
      <div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2><p class="ranking-panel-lead">${flagged ? 'Các mã vẫn đáng xem nhưng có tín hiệu hoặc dữ liệu cần CRSM kiểm tra lại.' : 'Các mã hiện không có data flag và đang đứng cao trong bộ lọc.'}</p></div>
      <div class="ranking-count">${rows.length} mã</div>
    </div>
    <div class="ranking-list">
      ${rows.length ? rows.map((row, index) => stockRow(row, index, flagged)).join('') : '<div class="ranking-empty">Chưa có mã trong nhóm này.</div>'}
    </div>
  </section>`;
}

function renderShowcase() {
  const allRows = readRows().sort((a, b) => {
    const scoreDiff = Number(b.FINALSCORE ?? -1) - Number(a.FINALSCORE ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    return Number(a.RANK ?? 9999) - Number(b.RANK ?? 9999);
  });
  if (!allRows.length) return;

  const section = document.querySelector('.main > section.grid');
  if (!section || section.dataset.showcaseEnhanced === '1') return;
  section.dataset.showcaseEnhanced = '1';

  const cleanRows = allRows.filter(row => !hasFlags(row)).slice(0, 10);
  const flaggedRows = allRows.filter(hasFlags).slice(0, 10);
  const topScore = allRows[0]?.FINALSCORE;
  const cleanCount = allRows.filter(row => !hasFlags(row)).length;
  const flaggedCount = allRows.length - cleanCount;

  section.innerHTML = `<div class="showcase-wrap">
    <div class="showcase-header">
      <div><p class="eyebrow">Market Showcase</p><h1>Ranking sàng lọc</h1><p class="showcase-lead">Tách riêng nhóm không có flag và nhóm cần CRSM kiểm tra. Chỉ hiển thị các chỉ số cốt lõi để nhìn nhanh.</p></div>
      <div class="showcase-summary">
        ${metric('Universe', allRows.length)}
        <span class="showcase-divider"></span>
        ${metric('Không flag', cleanCount)}
        <span class="showcase-divider"></span>
        ${metric('Có flag', flaggedCount)}
        <span class="showcase-divider"></span>
        ${metric('Top score', topScore)}
      </div>
    </div>
    <div class="ranking-grid">
      ${rankingPanel('Không có flag', 'CLEAN CANDIDATES', cleanRows, false)}
      ${rankingPanel('Có flag', 'REVIEW CANDIDATES', flaggedRows, true)}
    </div>
  </div>`;
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
  const settingsButton = event.target.closest?.('#openSettings');
  if (settingsButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openSettingsOverlay();
    return;
  }
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
  const ticker = event.target.closest?.('[data-showcase-ticker]');
  if (!ticker) return;
  const rankingTab = document.querySelector('[data-tab="list"]');
  if (!rankingTab) return;
  rankingTab.click();
  const symbol = ticker.dataset.showcaseTicker;
  window.setTimeout(() => document.querySelector(`[data-crsm="${CSS.escape(symbol)}"]`)?.click(), 0);
});

function scheduleEnhancement() {
  if (observerScheduled) return;
  observerScheduled = true;
  requestAnimationFrame(() => {
    observerScheduled = false;
    if (document.querySelector('[data-tab="dashboard"].active')) renderShowcase();
  });
}

if (app) {
  new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
  scheduleEnhancement();
}
