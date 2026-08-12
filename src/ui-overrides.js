import { renderSettings, bindSettingsEvents } from './crsm/ui/settings.js';
import { crsmState, subscribeCRSM } from './crsm/state.js';
import { downloadHtmlReport, downloadWordReport } from './crsm/report-export.js';

const DATA_KEY = 'stock-mind.dataset.v1';
let observerScheduled = false;
let reportTab = 'html';

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
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/\n/g, ' ');
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
        ${metric('Mispricing', row.MISPRICING)}
      </div>
    </div>
  </article>`;
}

function renderShowcase() {
  const rows = readRows().sort((a, b) => Number(a.RANK || 9999) - Number(b.RANK || 9999)).slice(0, 10);
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

function ensureReportTab() {
  const tabs = document.querySelector('.tabs');
  if (!tabs || tabs.querySelector('[data-report-tab]')) return;
  const settingsButton = tabs.querySelector('#openSettings');
  const button = document.createElement('button');
  button.className = 'tab';
  button.type = 'button';
  button.dataset.reportTab = '1';
  button.innerHTML = 'Reports';
  if (crsmState.nodeOutputs?.node6a || crsmState.nodeOutputs?.node6b) {
    button.innerHTML = 'Reports <span class="report-ready-dot">•</span>';
  }
  tabs.insertBefore(button, settingsButton || null);
}

function reportAvailable() {
  return Boolean(crsmState.nodeOutputs?.node6a || crsmState.nodeOutputs?.node6b || crsmState.finalReport);
}

function openReportWorkspace(tab = reportTab) {
  reportTab = tab;
  const existing = document.getElementById('reportWorkspace');
  if (existing) {
    renderReportWorkspace(existing);
    return;
  }
  const overlay = document.createElement('div');
  overlay.id = 'reportWorkspace';
  overlay.className = 'report-workspace';
  document.body.appendChild(overlay);
  renderReportWorkspace(overlay);
  document.body.classList.add('report-open');
}

function closeReportWorkspace() {
  document.getElementById('reportWorkspace')?.remove();
  document.body.classList.remove('report-open');
}

function renderReportWorkspace(overlay) {
  const html = crsmState.nodeOutputs?.node6a || crsmState.finalReport || '';
  const markdown = crsmState.nodeOutputs?.node6b || '';
  const ticker = crsmState.ticker || '—';
  const available = Boolean(html || markdown);
  overlay.innerHTML = `<div class="report-shell" role="dialog" aria-modal="true" aria-label="CRSM Reports">
    <div class="report-toolbar">
      <div class="report-title"><div><strong>CRSM Reports</strong><span>${escapeHtml(ticker)}${available ? ' · báo cáo hoàn tất' : ' · chưa có báo cáo'}</span></div></div>
      <div class="report-actions">
        ${html ? '<button class="btn" data-report-download="html" type="button">Tải HTML</button>' : ''}
        ${html ? '<button class="btn" data-report-download="word" type="button">Tải Word</button>' : ''}
        <button class="btn report-close" data-report-close type="button">✕</button>
      </div>
    </div>
    <div class="report-tabs" role="tablist">
      <button class="report-tab ${reportTab === 'html' ? 'active' : ''}" data-report-view="html" type="button">HTML Report</button>
      <button class="report-tab ${reportTab === 'word' ? 'active' : ''}" data-report-view="word" type="button">Word Report</button>
    </div>
    <div class="report-content">${!available ? renderReportEmpty() : reportTab === 'word' ? renderWordPreview(markdown) : renderHtmlPreview(html)}</div>
  </div>`;
}

function renderReportEmpty() {
  return `<div class="report-empty"><div><strong>Chưa có báo cáo</strong><p>Chạy CRSM hoàn tất để mở HTML và Word Report.</p></div></div>`;
}

function renderHtmlPreview(html) {
  return `<iframe class="report-preview" sandbox="allow-same-origin" srcdoc="${escapeAttr(html)}" title="HTML Report"></iframe>`;
}

function renderWordPreview(markdown) {
  if (!markdown) return renderReportEmpty();
  return `<div class="report-word-preview"><article class="report-word-page">${markdownToHtml(markdown)}</article></div>`;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let listOpen = false;
  let table = null;
  const closeList = () => { if (listOpen) { out.push('</ul>'); listOpen = false; } };
  const closeTable = () => { if (!table) return; out.push('</tbody></table>'); table = null; };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) { closeList(); closeTable(); continue; }
    if (/^---+$/.test(line)) { closeList(); closeTable(); out.push('<hr>'); continue; }
    if (/^\|.*\|$/.test(line)) {
      const cells = parseMdRow(line);
      const next = lines[i + 1]?.trim() || '';
      if (!table) {
        closeList();
        out.push('<table><thead><tr>' + cells.map(c => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>');
        table = true;
        if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(next)) i += 1;
      } else {
        out.push('<tr>' + cells.map(c => `<td>${inlineMd(c)}</td>`).join('') + '</tr>');
      }
      continue;
    }
    closeTable();
    if (/^###\s+/.test(line)) { closeList(); out.push(`<h3>${inlineMd(line.replace(/^###\s+/, ''))}</h3>`); continue; }
    if (/^##\s+/.test(line)) { closeList(); out.push(`<h2>${inlineMd(line.replace(/^##\s+/, ''))}</h2>`); continue; }
    if (/^#\s+/.test(line)) { closeList(); out.push(`<h1>${inlineMd(line.replace(/^#\s+/, ''))}</h1>`); continue; }
    if (/^>\s?/.test(line)) { closeList(); out.push(`<blockquote>${inlineMd(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (/^[-*]\s+/.test(line)) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push(`<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }
  closeList(); closeTable();
  return out.join('');
}

function parseMdRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
}

function inlineMd(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

// Header interactions are handled at capture level so they survive app re-renders.
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
    return;
  }
  const reportButton = event.target.closest?.('[data-report-tab]');
  if (reportButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openReportWorkspace();
    return;
  }
  const closeReport = event.target.closest?.('[data-report-close]');
  if (closeReport && document.getElementById('reportWorkspace')) {
    event.preventDefault();
    closeReportWorkspace();
    return;
  }
  const reportView = event.target.closest?.('[data-report-view]');
  if (reportView && document.getElementById('reportWorkspace')) {
    event.preventDefault();
    reportTab = reportView.dataset.reportView;
    renderReportWorkspace(document.getElementById('reportWorkspace'));
    return;
  }
  const reportDownload = event.target.closest?.('[data-report-download]');
  if (reportDownload) {
    event.preventDefault();
    const html = crsmState.nodeOutputs?.node6a || crsmState.finalReport;
    const md = crsmState.nodeOutputs?.node6b || '';
    if (reportDownload.dataset.reportDownload === 'html' && html) downloadHtmlReport(html, crsmState.ticker || 'CRSM');
    if (reportDownload.dataset.reportDownload === 'word' && html) {
      const wordHtml = md ? markdownToHtmlDocument(md, crsmState.ticker || 'CRSM') : html;
      downloadWordReport(wordHtml, crsmState.ticker || 'CRSM');
    }
    return;
  }
}, true);

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeSettingsOverlay();
    closeReportWorkspace();
  }
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

function markdownToHtmlDocument(markdown, ticker) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033;line-height:1.55}h1{font-size:26px}h2{margin-top:24px}h3{margin-top:18px}table{border-collapse:collapse;width:100%;margin:12px 0 18px}td,th{border:1px solid #dbe2ec;padding:8px;text-align:left;vertical-align:top}th{background:#f5f8fc}blockquote{border-left:4px solid #93c5fd;background:#eff6ff;padding:8px 14px}li{margin:4px 0}</style></head><body>${markdownToHtml(markdown)}</body></html>`;
}

function updateReportReadyState() {
  const button = document.querySelector('[data-report-tab]');
  if (!button) return;
  button.innerHTML = reportAvailable() ? 'Reports <span class="report-ready-dot">•</span>' : 'Reports';
}

function scheduleEnhancement() {
  if (observerScheduled) return;
  observerScheduled = true;
  requestAnimationFrame(() => {
    observerScheduled = false;
    ensureReportTab();
    updateReportReadyState();
    if (document.querySelector('[data-tab="dashboard"].active')) renderShowcase();
  });
}

subscribeCRSM(() => {
  scheduleEnhancement();
  updateReportReadyState();
});

if (app) {
  new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
  scheduleEnhancement();
}
