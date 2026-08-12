import { crsmState, notifyCRSM } from '../state.js';
import { renderProgress } from './progress.js';
import { renderSnapshot } from './snapshot.js';
import { renderStatusBadge } from './status.js';
import { renderError } from './error.js';
import { renderDirectEntry } from './direct.js';
import { totalUsage } from '../usage.js';
import { buildScreeningContext } from '../context.js';
import { runCRSM } from '../engine.js';
import { ingestUserEvidence, getPendingUserEvidence } from '../user-evidence.js';

const DATASET_KEY = 'stock-mind.dataset.v1';
let crsmClickHandlerInstalled = false;

export function renderCRSMTab() {
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  return `<section class="grid">
    <div class="crsm-head"><div><p class="eyebrow">CRSM</p><h1>Capital Research & Strategy Machine</h1>${renderSourceBadge()}</div></div>
    ${renderDirectEntry()}
    <div id="crsmDynamic">${renderDynamicContent()}</div>
    <div id="crsmReportRegion">${report ? renderReport(report) : ''}</div>
  </section>`;
}

function renderSourceBadge() {
  if (!crsmState.mode) return '<p class="muted">Screening → CRSM hoặc Direct Analysis</p>';
  const screened = crsmState.mode === 'SCREENED';
  const label = screened ? 'SCREENED · từ Ranking' : 'DIRECT · nhập tay';
  return `<div class="crsm-source ${screened ? 'screened' : 'direct'}"><strong>${label}</strong>${crsmState.ticker ? `<span>${escapeHtml(crsmState.ticker)}</span>` : ''}</div>`;
}

export function renderDynamicContent() {
  const hasScreening = crsmState.mode === 'SCREENED' && crsmState.screeningContext;
  return `${hasScreening ? renderSnapshot() : ''}${renderProgress()}${renderStatusBadge()}${renderCostStrip()}${renderError()}`;
}

function renderCostStrip() {
  const total = totalUsage();
  if (!crsmState.usage?.length) return '';
  return `<div class="panel panel-pad crsm-cost-strip"><span><span class="muted">Run cost</span><strong>$${Number(total.cost || 0).toFixed(4)}</strong></span><span><span class="muted">Tokens</span><strong>${((total.input || 0) + (total.output || 0)).toLocaleString('en-US')}</strong></span><span><span class="muted">Requests</span><strong>${crsmState.usage.length}</strong></span></div>`;
}

export function renderReport(report) {
  const total = totalUsage();
  return `<div class="panel panel-pad crsm-report"><div class="title-row"><div><p class="eyebrow">Output</p><h2>Báo cáo phân tích</h2></div><div class="actions"><span class="crsm-report-cost">Cost · $${Number(total.cost || 0).toFixed(4)}</span><button class="btn" id="crsmDownloadHtml">Tải HTML</button></div></div><iframe class="crsm-report-frame" sandbox="allow-same-origin" srcdoc="${escapeAttr(report)}"></iframe></div>`;
}

export function updateDynamicRegion() {
  const region = document.getElementById('crsmDynamic');
  if (region) { region.innerHTML = renderDynamicContent(); bindDynamicEvents(); }
  const reportRegion = document.getElementById('crsmReportRegion');
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  if (reportRegion) { reportRegion.innerHTML = report ? renderReport(report) : ''; bindReportEvents(); }
}

export function bindCRSMUIBindings() {
  installCRSMClickHandler();
  bindDynamicEvents();
  bindReportEvents();
  bindEvidenceUpload();
}

function bindEvidenceUpload() {
  const input = document.getElementById('crsmEvidenceFiles');
  if (!input || input.dataset.bound === '1') return;
  input.dataset.bound = '1';
  input.addEventListener('change', async event => {
    const status = document.getElementById('crsmEvidenceStatus');
    const files = event.target.files;
    if (!files?.length) return;
    if (status) status.textContent = `Đang đọc ${files.length} file…`;
    try {
      const evidence = await ingestUserEvidence(files);
      if (status) status.textContent = `✓ Đã đọc ${evidence.documents.length} file · ${evidence.totalChars.toLocaleString('vi-VN')} ký tự. Sẽ đưa vào Node 3/4 khi chạy CRSM.`;
    } catch (error) {
      if (status) status.textContent = `✖ ${error?.message || error}`;
    }
    event.target.value = '';
  });
}

function installCRSMClickHandler() {
  if (crsmClickHandlerInstalled) return;
  crsmClickHandlerInstalled = true;

  document.addEventListener('click', event => {
    const directTrigger = event.target?.closest?.('[data-crsm-direct]');
    if (directTrigger) {
      event.preventDefault();
      event.stopPropagation();
      void launchDirectFromUI();
      return;
    }

    const trigger = event.target?.closest?.('[data-crsm]');
    if (!trigger) return;

    const ticker = String(trigger.dataset.crsm || '').trim().toUpperCase();
    if (!ticker) return;

    event.preventDefault();
    event.stopPropagation();

    const stock = findScreeningStock(ticker);
    if (!stock) {
      showLaunchError(`Không tìm thấy dữ liệu screening cho mã ${ticker}.`);
      return;
    }

    const crsmTab = document.querySelector('[data-tab="crsm"]');
    if (!crsmTab) {
      showLaunchError('Không tìm thấy tab CRSM để mở phiên phân tích.');
      return;
    }

    crsmTab.click();
    const screeningContext = buildScreeningContext(stock);
    void runCRSM({ mode: 'SCREENED', ticker, screeningContext }).catch(error => {
      showLaunchError(error?.message || String(error));
    });
  }, true);
}

async function launchDirectFromUI() {
  const input = document.getElementById('crsmTickerInput');
  const ticker = String(input?.value || '').trim().toUpperCase();
  if (!ticker) {
    showLaunchError('Hãy nhập mã cổ phiếu trước khi phân tích.');
    input?.focus();
    return;
  }

  const crsmTab = document.querySelector('[data-tab="crsm"]');
  if (!crsmTab) {
    showLaunchError('Không tìm thấy tab CRSM để chạy phiên phân tích.');
    return;
  }

  // The direct form is already inside CRSM, but this keeps the handoff robust
  // if the UI was re-rendered by another action.
  crsmTab.click();
  try {
    await runCRSM({ mode: 'DIRECT', ticker, screeningContext: null });
  } catch (error) {
    showLaunchError(error?.message || String(error));
  }
}

function findScreeningStock(ticker) {
  try {
    const raw = localStorage.getItem(DATASET_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.find(row => String(row?.TICKER || '').toUpperCase() === ticker) : null;
  } catch {
    return null;
  }
}

function showLaunchError(message) {
  crsmState.isRunning = false;
  crsmState.error = { node: null, message: String(message) };
  crsmState.logRows = [...(crsmState.logRows || []), `✖ launch failed: ${message}`];
  notifyCRSM();
}

export function bindDynamicEvents() {
  const retryBtn = document.getElementById('crsmRetry');
  if (retryBtn) retryBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('crsm:retry-from-failed')));
  const retryAllBtn = document.getElementById('crsmRetryAll');
  if (retryAllBtn) retryAllBtn.addEventListener('click', () => window.dispatchEvent(new CustomEvent('crsm:retry-all')));
}

export function bindReportEvents() {
  const downloadBtn = document.getElementById('crsmDownloadHtml');
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  if (downloadBtn && report) downloadBtn.addEventListener('click', () => {
    const blob = new Blob([report], { type: 'text/html' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
    link.download = `CRSM_${crsmState.ticker}_${new Date().toISOString().slice(0, 10)}.html`; link.click(); URL.revokeObjectURL(url);
  });
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(value) { return escapeHtml(value).replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
