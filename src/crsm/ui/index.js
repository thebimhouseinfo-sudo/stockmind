import { crsmState } from '../state.js';
import { renderProgress } from './progress.js';
import { renderSnapshot } from './snapshot.js';
import { renderStatusBadge } from './status.js';
import { renderError } from './error.js';
import { renderDirectEntry } from './direct.js';
import { renderSettings, bindSettingsEvents } from './settings.js';
import { totalUsage } from '../usage.js';

let settingsDelegationBound = false;

export function renderCRSMTab() {
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  return `<section class="grid">
    <div class="crsm-head"><div><p class="eyebrow">CRSM</p><h1>Capital Research & Strategy Machine</h1>${renderSourceBadge()}</div><div class="actions"><button class="btn" id="crsmBack">← Quay lại ranking</button><button class="btn" id="crsmOpenSettings" type="button">⚙ Settings</button></div></div>
    ${renderDirectEntry()}
    <div id="crsmDynamic">${renderDynamicContent()}</div>
    <div id="crsmSettingsRegion"></div>
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
  bindDynamicEvents();
  bindReportEvents();
  bindSettingsDelegation();
}

function bindSettingsDelegation() {
  if (settingsDelegationBound) return;
  settingsDelegationBound = true;
  document.addEventListener('click', event => {
    const settingsBtn = event.target.closest('#crsmOpenSettings');
    if (!settingsBtn) return;
    const region = document.getElementById('crsmSettingsRegion');
    if (!region) return;
    const existing = region.querySelector('.settings-panel');
    if (existing) {
      existing.remove();
      return;
    }
    region.innerHTML = renderSettings();
    bindSettingsEvents();
  });
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
