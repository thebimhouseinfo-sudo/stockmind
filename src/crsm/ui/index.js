import { crsmState } from '../state.js';
import { renderProgress } from './progress.js';
import { renderSnapshot } from './snapshot.js';
import { renderStatusBadge } from './status.js';
import { renderError } from './error.js';
import { renderDirectEntry } from './direct.js';
import { renderSettings, bindSettingsEvents } from './settings.js';

export function renderCRSMTab() {
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;

  return `
    <section class="grid">
      <div class="crsm-head">
        <div>
          <p class="eyebrow">CRSM</p>
          <h1>Capital Research & Strategy Machine</h1>
        </div>
        <div class="actions">
          <button class="btn" id="crsmBack">← Quay lại ranking</button>
          <button class="btn" id="crsmOpenSettings">⚙ Settings</button>
        </div>
      </div>

      ${!crsmState.mode || crsmState.mode === 'DIRECT' ? renderDirectEntry() : ''}

      <div id="crsmDynamic">
        ${renderDynamicContent()}
      </div>

      <div id="crsmSettingsRegion"></div>

      <div id="crsmReportRegion">
        ${report ? renderReport(report) : ''}
      </div>
    </section>`;
}

export function renderDynamicContent() {
  const hasScreening = crsmState.mode === 'SCREENED' && crsmState.screeningContext;
  return `${hasScreening && crsmState.mode === 'SCREENED' ? renderSnapshot() : ''}
        ${renderProgress()}
        ${renderStatusBadge()}
        ${renderError()}`;
}

export function renderReport(report) {
  return `
    <div class="panel panel-pad crsm-report">
      <div class="title-row">
        <div><p class="eyebrow">Output</p><h2>Báo cáo phân tích</h2></div>
        <button class="btn" id="crsmDownloadHtml">Tải HTML</button>
      </div>
      <iframe class="crsm-report-frame" sandbox="allow-same-origin" srcdoc="${escapeAttr(report)}"></iframe>
    </div>`;
}

export function updateDynamicRegion() {
  const region = document.getElementById('crsmDynamic');
  if (region) {
    region.innerHTML = renderDynamicContent();
    bindDynamicEvents();
  }
  const reportRegion = document.getElementById('crsmReportRegion');
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  if (reportRegion) {
    reportRegion.innerHTML = report ? renderReport(report) : '';
    bindReportEvents();
  }
}

export function bindCRSMUIBindings() {
  bindDynamicEvents();
  bindReportEvents();
  const settingsBtn = document.getElementById('crsmOpenSettings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      const region = document.getElementById('crsmSettingsRegion');
      if (!region) return;
      if (region.querySelector('.settings-panel')) {
        region.innerHTML = '';
      } else {
        const settings = document.getElementById('crsmSettingsRegion');
        settings.innerHTML = renderSettings();
        bindSettingsEvents();
      }
    });
  }
}

export function bindDynamicEvents() {
  const retryBtn = document.getElementById('crsmRetry');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('crsm:retry-from-failed'));
    });
  }
  const retryAllBtn = document.getElementById('crsmRetryAll');
  if (retryAllBtn) {
    retryAllBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('crsm:retry-all'));
    });
  }
}

export function bindReportEvents() {
  const downloadBtn = document.getElementById('crsmDownloadHtml');
  const report = crsmState.nodeOutputs.node6a || crsmState.finalReport;
  if (downloadBtn && report) {
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([report], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CRSM_${crsmState.ticker}_${new Date().toISOString().slice(0, 10)}.html`;
      link.click();
      URL.revokeObjectURL(url);
    });
  }
}

export function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}