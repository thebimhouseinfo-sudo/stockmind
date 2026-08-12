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

function metric(label, value, tone = '') {
  return `<div class="showcase-metric ${tone}"><span>${label}</span><strong>${fmt(value)}</strong></div>`;
}

function stockCard(row, index) {
  const hero = index === 0 ? ' hero' : '';
  return `<article class="showcase-stock${hero}">
    <div class="showcase-rank">#${String(index + 1).padStart(2, '0')}</div>
    <div class="showcase-main">
      <div class="showcase-identity">
        <div><button class="showcase-ticker" data-showcase-ticker="${escapeHtml(row.TICKER)}">${escapeHtml(row.TICKER)}</button><span class="showcase-industry">${escapeHtml(row.INDUSTRY)}</span></div>
        <div class="showcase-score"><strong>${fmt(row.FINALSCORE)}</strong><span class="badge ${gradeClass(row.GRADE)}">${escapeHtml(row.GRADE || '-')}</span></div>
      </div>
      <div class="showcase-metrics">
        ${metric('Price', row.PRICE)}
        ${metric('P/E', row.PE)}
        ${metric('Quality', row.QUALITY_SCORE)}
        ${metric('Growth', row.GROWTH_SCORE)}
        ${metric('Value', row.VALUATION_SCORE)}
        ${metric('Micro', row.MICRO)}
        ${metric('Momentum', row.MOMENTUM)}
        ${metric('Opportunity', row.MISPRICING)}
      </div>
    </div>
  </article>`;
}

function renderShowcase() {
  const rows = readRows()
    .sort((a, b) => Number(a.RANK || 9999) - Number(b.RANK || 9999))
    .slice(0, 10);
  if (!rows.length) return;
  const section = document.querySelector('.main > section.grid');
  if (!section || section.dataset.showcaseEnhanced === '1') return;
  section.dataset.showcaseEnhanced = '1';
  section.innerHTML = `<div class="showcase-wrap">
    <div class="showcase-header">
      <div><p class="eyebrow">Market Showcase</p><h1>Top 10 cổ phiếu</h1><p class="showcase-lead">Các mã có điểm tổng hợp cao nhất từ bộ lọc hiện tại. Bấm ticker để đi thẳng tới CRSM.</p></div>
      <div class="showcase-summary">${metric('Universe', readRows().length)}<span class="showcase-divider"></span>${metric('Top score', rows[0]?.FINALSCORE)}</div>
    </div>
    <div class="showcase-grid">${rows.map(stockCard).join('')}</div>
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
