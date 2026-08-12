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

function flagSummary(row) {
  if (!hasFlags(row)) return '';
  return row.DATA_FLAGS.slice(0, 2).map(flag => String(flag).split(':')[0].replaceAll('_', ' ')).join(' · ');
}

function metric(label, value) {
  return `<div class="showcase-metric"><span>${label}</span><strong>${value}</strong></div>`;
}

function rankingRow(row, localRank) {
  const flag = hasFlags(row);
  return `<article class="ranking-row ${flag ? 'flagged' : 'clean'}">
    <div class="ranking-rank">#${String(localRank).padStart(2, '0')}<span>R${fmt(row.RANK)}</span></div>
    <div class="ranking-main">
      <div class="ranking-head">
        <button class="ranking-ticker" data-showcase-ticker="${escapeHtml(row.TICKER)}">${escapeHtml(row.TICKER)}</button>
        <span class="ranking-industry">${escapeHtml(row.INDUSTRY || '')}</span>
        ${flag ? `<span class="flag-badge">⚠ ${escapeHtml(flagSummary(row))}</span>` : ''}
      </div>
      <div class="ranking-metrics">
        ${metric('Giá', fmt(row.PRICE))}
        ${metric('P/E', fmt(row.PE))}
        ${metric('Score', fmt(row.FINALSCORE))}
        ${metric('Hạng', `#${fmt(row.RANK)}`)}
      </div>
    </div>
    <div class="ranking-score"><strong>${fmt(row.FINALSCORE)}</strong><span class="badge ${gradeClass(row.GRADE)}">${escapeHtml(row.GRADE || '-')}</span></div>
  </article>`;
}

function renderRankingPanel(title, subtitle, rows, tone) {
  return `<section class="ranking-panel ${tone}">
    <div class="ranking-panel-head">
      <div><p class="eyebrow">${title}</p><h2>${subtitle}</h2></div>
      <span class="ranking-count">${rows.length} mã</span>
    </div>
    ${rows.length ? rows.map((row, index) => rankingRow(row, index + 1)).join('') : `<div class="ranking-empty"><strong>Không có mã phù hợp</strong><span>Nhóm này sẽ để trống khi không có ứng viên trong điều kiện hiện tại.</span></div>`}
  </section>`;
}

function renderShowcase() {
  const allRows = readRows().sort((a, b) => Number(a.RANK || 9999) - Number(b.RANK || 9999));
  if (!allRows.length) return;

  const section = document.querySelector('.main > section.grid');
  if (!section || section.dataset.showcaseEnhanced === '1') return;
  section.dataset.showcaseEnhanced = '1';

  const cleanTop10 = allRows.filter(row => !hasFlags(row)).slice(0, 10);
  const flaggedTop20 = allRows.filter(row => hasFlags(row) && Number(row.RANK || 9999) <= 20).slice(0, 10);

  section.innerHTML = `<div class="showcase-wrap">
    <div class="showcase-header">
      <div><p class="eyebrow">Market Showcase</p><h1>Ứng viên từ Screener</h1><p class="showcase-lead">Hai bảng tách biệt: mã sạch để ưu tiên xem xét và mã có flag nhưng vẫn nằm trong Top 20 để CRSM xác minh.</p></div>
      <div class="showcase-summary">${metric('Universe', allRows.length)}<span class="showcase-divider"></span>${metric('Clean Top 1', cleanTop10[0] ? fmt(cleanTop10[0].FINALSCORE) : '-')}<span class="showcase-divider"></span>${metric('Flagged Top 20', flaggedTop20.length)}</div>
    </div>
    <div class="ranking-layout">
      ${renderRankingPanel('CLEAN CANDIDATES', 'Top 10 — Không có flag', cleanTop10, 'clean-panel')}
      ${renderRankingPanel('REVIEW CANDIDATES', 'Top 20 — Có flag', flaggedTop20, 'flagged-panel')}
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
