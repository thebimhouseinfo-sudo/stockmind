import { crsmState, notifyCRSM } from '../state.js';
import { renderAnalysisDashboard } from './analysis-dashboard.js';
import { renderStatusBadge } from './status.js';
import { renderError } from './error.js';
import { totalUsage } from '../usage.js';
import { ingestUserEvidence } from '../user-evidence.js';

export function renderCRSMTab() {
  return `<section class="grid crsm-analysis-page">
    <div id="crsmDynamic">${renderDynamicContent()}</div>
  </section>`;
}

export function renderDynamicContent() {
  return `${renderAnalysisDashboard()}${renderStatusBadge()}${renderCostStrip()}${renderError()}`;
}

function renderCostStrip() {
  const total = totalUsage();
  if (!crsmState.usage?.length) return '';
  return `<div class="panel panel-pad crsm-cost-strip"><span><span class="muted">Chi phí lần chạy</span><strong>$${Number(total.cost || 0).toFixed(4)}</strong></span><span><span class="muted">Tokens</span><strong>${((total.input || 0) + (total.output || 0)).toLocaleString('vi-VN')}</strong></span><span><span class="muted">Requests</span><strong>${crsmState.usage.length}</strong></span></div>`;
}

export function updateDynamicRegion() {
  const region = document.getElementById('crsmDynamic');
  if (region) { region.innerHTML = renderDynamicContent(); bindDynamicEvents(); bindEvidenceUpload(); }
}

export function bindCRSMUIBindings() {
  bindDynamicEvents();
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
      if (status) status.textContent = `✓ Đã đọc ${evidence.documents.length} file · ${evidence.totalChars.toLocaleString('vi-VN')} ký tự.`;
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
    retryBtn.addEventListener('click', async event => { event.preventDefault(); event.stopPropagation(); await retryCurrentFailedNode(); });
  }
  const retryAllBtn = document.getElementById('crsmRetryAll');
  if (retryAllBtn && retryAllBtn.dataset.bound !== '1') {
    retryAllBtn.dataset.bound = '1';
    retryAllBtn.addEventListener('click', async event => { event.preventDefault(); event.stopPropagation(); await retryCurrentRunFromStart(); });
  }
}

async function retryCurrentFailedNode() {
  const mode = crsmState.mode, ticker = crsmState.ticker, startFrom = crsmState.failedNode;
  const existingOutputs = { ...(crsmState.nodeOutputs || {}) };
  if (!mode || !ticker || !startFrom) return showLaunchError('Không có phiên CRSM lỗi để chạy lại.');
  crsmState.error = null; crsmState.failedNode = null; crsmState.logRows = [...(crsmState.logRows || []), `↻ chạy lại ${startFrom}`]; notifyCRSM();
  const result = await runCRSM({ mode, ticker, screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null, startFrom, existingOutputs });
  if (result?.error && !result?.outputs) showLaunchError(result.error?.message || String(result.error));
}

async function retryCurrentRunFromStart() {
  const mode = crsmState.mode, ticker = crsmState.ticker;
  if (!mode || !ticker) return showLaunchError('Không có phiên CRSM để chạy lại.');
  crsmState.error = null; crsmState.failedNode = null; crsmState.logRows = [...(crsmState.logRows || []), '↻ chạy lại toàn bộ pipeline']; notifyCRSM();
  const result = await runCRSM({ mode, ticker, screeningContext: mode === 'SCREENED' ? crsmState.screeningContext : null, startFrom: 'node1', existingOutputs: null, bypassCache: true });
  if (result?.error && !result?.outputs) showLaunchError(result.error?.message || String(result.error));
}

function showLaunchError(message) {
  crsmState.isRunning = false; crsmState.error = { node: null, message: String(message) }; crsmState.logRows = [...(crsmState.logRows || []), `✖ launch failed: ${message}`]; notifyCRSM();
}
