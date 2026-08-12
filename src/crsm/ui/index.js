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
  return `<div class="panel panel-pad crsm-report"><div class="title-row"><div><p class="eyebrow">Output</p><h2>Báo cáo phân tích</h2></div><div class="actions"><span class="crsm-report-cost">Cost · $${Number(total.cost || 0).toFixed(4)}</span><button class="btn" id="crsmDownloadHtml" type="button">Tải HTML</button></div></div><iframe class="crsm-report-frame" sandbox="allow-same-origin" srcdoc="${escapeAttr(report)}"></iframe></div>`;
}

export function updateDynamicRegion() {
  const region = document.getElementById('crsmDynamic');
  if (region) { region.innerHTML = renderDynamicContent(); bindDynamicEvents(); }
  const reportRegion = document.getElementById('crsmReportRegion');
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  if (reportRegion) { reportRegion.innerHTML = report ? renderReport(report) : ''; bindReportEvents(); }
}

export function bindCRSMUIBindings() {
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

export function bindDynamicEvents() {
  const retryBtn = document.getElementById('crsmRetry');
  if (retryBtn && retryBtn.dataset.bound !== '1') {
    retryBtn.dataset.bound = '1';
    retryBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      await retryCurrentFailedNode();
    });
  }
  const retryAllBtn = document.getElementById('crsmRetryAll');
  if (retryAllBtn && retryAllBtn.dataset.bound !== '1') {
    retryAllBtn.dataset.bound = '1';
    retryAllBtn.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      await retryCurrentRunFromStart();
    });
  }
}

async function retryCurrentFailedNode() {
  const mode = crsmState.mode;
  const ticker = crsmState.ticker;
  const startFrom = crsmState.failedNode;
  const existingOutputs = { ...(crsmState.nodeOutputs || {}) };
  if (!mode || !ticker || !startFrom) {
    showLaunchError('Không có phiên CRSM lỗi để chạy lại.');
    return;
  }

  crsmState.error = null;
  crsmState.failedNode = null;
  crsmState.logRows = [...(crsmState.logRows || []), `↻ retry node ${startFrom}`];
  notifyCRSM();

  const result = await runCRSM({
    mode,
    ticker,
    screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null,
    startFrom,
    existingOutputs
  });

  if (result?.error && !result?.outputs) {
    showLaunchError(result.error?.message || String(result.error));
  }
}

async function retryCurrentRunFromStart() {
  const mode = crsmState.mode;
  const ticker = crsmState.ticker;
  if (!mode || !ticker) {
    showLaunchError('Không có phiên CRSM để chạy lại.');
    return;
  }

  crsmState.error = null;
  crsmState.failedNode = null;
  crsmState.logRows = [...(crsmState.logRows || []), '↻ chạy lại toàn bộ pipeline'];
  notifyCRSM();

  const result = await runCRSM({
    mode,
    ticker,
    screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null,
    startFrom: 'node1',
    existingOutputs: null,
    bypassCache: true
  });

  if (result?.error && !result?.outputs) {
    showLaunchError(result.error?.message || String(result.error));
  }
}

function bindReportEvents() {
  const downloadBtn = document.getElementById('crsmDownloadHtml');
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  if (downloadBtn && report && downloadBtn.dataset.bound !== '1') {
    downloadBtn.dataset.bound = '1';
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([report], { type: 'text/html' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url;
      link.download = `CRSM_${crsmState.ticker}_${new Date().toISOString().slice(0, 10)}.html`; link.click(); URL.revokeObjectURL(url);
    });
  }
}

function showLaunchError(message) {
  crsmState.isRunning = false;
  crsmState.error = { node: null, message: String(message) };
  crsmState.logRows = [...(crsmState.logRows || []), `✖ launch failed: ${message}`];
  notifyCRSM();
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(value) { return escapeHtml(value).replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
