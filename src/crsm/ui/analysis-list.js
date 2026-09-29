import { ANALYSIS_SOURCES } from '../contracts.js';
import { draftSummary } from '../draft-list.js';
import { isActiveMemoRun } from '../memo-client.js';

const SOURCE_LABELS = Object.freeze({
  [ANALYSIS_SOURCES.SCREENED_WEB]: 'Screener + Web',
  [ANALYSIS_SOURCES.EVIDENCE_WEB]: 'Documents + Web',
  [ANALYSIS_SOURCES.WEB_ONLY]: 'Web only'
});

export function renderAnalysisListPage({
  draft,
  memoCurrent = null,
  memoLoading = false,
  memoError = null,
  notice = null,
  submitting = false,
  busyItemId = null
} = {}) {
  const items = draft?.items || [];
  const summary = draftSummary(draft);
  const activeRun = isActiveMemoRun(memoCurrent);
  const disabled = !items.length || submitting || Boolean(busyItemId) || activeRun;
  const disabledReason = activeRun
    ? 'An analysis is already in progress.'
    : busyItemId
      ? 'Wait for document reading to finish.'
      : !items.length
        ? 'Add at least one ticker.'
        : null;

  return `<section class="analysis-list-page">
    <div class="analysis-list-head">
      <div>
        <p class="eyebrow">CRSM</p>
        <h1>Analysis List</h1>
        <p class="muted">Prepare tickers here. Analyze submits the list to Memo; ChatGPT processes it later.</p>
      </div>
      <div class="analysis-list-count">${items.length} ticker${items.length === 1 ? '' : 's'}</div>
    </div>

    ${renderMemoState({ memoCurrent, memoLoading, memoError, activeRun })}
    ${notice ? `<div class="analysis-list-notice ${escapeHtml(notice.type || 'info')}" aria-live="polite">${escapeHtml(notice.message || '')}${notice.viewResults ? '<button class="btn" id="analysisNoticeViewResults" type="button">View Results</button>' : ''}</div>` : ''}

    <div class="panel panel-pad analysis-list-composer">
      <label class="analysis-field-label" for="analysisTickerInput">Add ticker</label>
      <div class="analysis-add-row">
        <input class="search" id="analysisTickerInput" autocomplete="off" inputmode="text" placeholder="e.g. FPT">
        <button class="btn primary" id="analysisAddTicker" type="button">Add</button>
      </div>
      <p class="muted analysis-help">Manual tickers start as Web only. Attach a document to switch that ticker to Documents + Web.</p>
    </div>

    <div class="analysis-list-items" id="analysisListItems">
      ${items.length ? items.map(item => renderItem(item, busyItemId)).join('') : renderEmpty()}
    </div>

    <div class="panel analysis-submit-bar">
      <div>
        <strong>${summary.total} tickers</strong>
        <span class="muted">${summary.SCREENED_WEB} Screener + Web · ${summary.EVIDENCE_WEB} Documents + Web · ${summary.WEB_ONLY} Web only</span>
        ${disabledReason ? `<small class="analysis-disabled-reason">${escapeHtml(disabledReason)}</small>` : ''}
      </div>
      <div class="analysis-submit-actions">
        <button class="btn" id="analysisClearList" type="button" ${items.length && !submitting ? '' : 'disabled'}>Clear list</button>
        <button class="btn primary" id="analysisSubmit" type="button" ${disabled ? 'disabled' : ''}>${submitting ? 'Submitting…' : 'Analyze'}</button>
      </div>
    </div>
  </section>`;
}

export function bindAnalysisListPage({
  onAddTicker,
  onRemoveItem,
  onAttachDocuments,
  onRemoveDocument,
  onClear,
  onAnalyze,
  onViewResults
} = {}) {
  bindClick('analysisAddTicker', () => onAddTicker?.(readTicker()));
  const tickerInput = document.getElementById('analysisTickerInput');
  tickerInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onAddTicker?.(readTicker());
    }
  });

  document.querySelectorAll('[data-analysis-remove]').forEach(button => {
    button.addEventListener('click', () => onRemoveItem?.(button.dataset.analysisRemove));
  });

  document.querySelectorAll('[data-analysis-attach]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelector('[data-analysis-file-input="' + cssEscape(button.dataset.analysisAttach) + '"]')?.click();
    });
  });

  document.querySelectorAll('[data-analysis-file-input]').forEach(input => {
    input.addEventListener('change', async event => {
      const itemId = input.dataset.analysisFileInput;
      const files = Array.from(event.target.files || []);
      if (files.length) await onAttachDocuments?.(itemId, files);
      event.target.value = '';
    });
  });

  document.querySelectorAll('[data-analysis-document-remove]').forEach(button => {
    button.addEventListener('click', () => {
      onRemoveDocument?.(
        button.dataset.analysisItem,
        button.dataset.analysisDocumentRemove
      );
    });
  });

  bindClick('analysisClearList', () => onClear?.());
  bindClick('analysisSubmit', () => onAnalyze?.());
  bindClick('analysisViewResults', () => onViewResults?.());
  bindClick('analysisNoticeViewResults', () => onViewResults?.());
}

function renderItem(item, busyItemId) {
  const source = SOURCE_LABELS[item.analysis_source] || item.analysis_source;
  const documents = item.documents || [];
  const isScreened = item.analysis_source === ANALYSIS_SOURCES.SCREENED_WEB;
  const context = isScreened
    ? renderScreeningContext(item.screening_context)
    : item.analysis_source === ANALYSIS_SOURCES.EVIDENCE_WEB
      ? renderDocuments(item, documents)
      : `<div class="analysis-context muted">No Screener snapshot or attached documents.</div>`;
  const busy = busyItemId === item.item_id;

  return `<article class="panel analysis-list-item" data-analysis-item="${escapeHtml(item.item_id)}" tabindex="-1">
    <div class="analysis-item-main">
      <div class="analysis-item-ticker">
        <strong>${escapeHtml(item.ticker)}</strong>
        <span class="analysis-source-badge source-${item.analysis_source.toLowerCase()}">${escapeHtml(source)}</span>
      </div>
      <button class="analysis-icon-btn" type="button" data-analysis-remove="${escapeHtml(item.item_id)}" aria-label="Remove ${escapeHtml(item.ticker)}">×</button>
    </div>
    ${context}
    ${!isScreened ? `<div class="analysis-item-actions">
      <button class="btn" type="button" data-analysis-attach="${escapeHtml(item.item_id)}" ${busy ? 'disabled' : ''}>${busy ? 'Reading document…' : 'Add document'}</button>
      <input type="file" hidden multiple data-analysis-file-input="${escapeHtml(item.item_id)}" accept=".pdf,.xlsx,.xls,.csv,.tsv,.txt,.md,.json,.xml,.html,.htm,text/*,application/pdf">
    </div>` : ''}
  </article>`;
}

function renderScreeningContext(context) {
  const summary = context?.screening_summary || {};
  const bits = [
    context?.screening_as_of ? 'Snapshot ' + context.screening_as_of : 'TradingView snapshot',
    summary.screen_rank != null ? 'Rank #' + summary.screen_rank : null,
    summary.screen_score != null ? 'Score ' + summary.screen_score : null,
    summary.screen_grade ? 'Grade ' + summary.screen_grade : null
  ].filter(Boolean);
  return `<div class="analysis-context"><strong>TradingView snapshot</strong><span class="muted">${bits.map(escapeHtml).join(' · ')}</span></div>`;
}

function renderDocuments(item, documents) {
  return `<div class="analysis-context">
    <strong>${documents.length} document${documents.length === 1 ? '' : 's'}</strong>
    <div class="analysis-documents">
      ${documents.map(document => `<span class="analysis-document-chip">
        <span>${escapeHtml(document.filename)} · ${formatBytes(document.size)}</span>
        <button type="button" data-analysis-item="${escapeHtml(item.item_id)}" data-analysis-document-remove="${escapeHtml(document.document_id)}" aria-label="Remove ${escapeHtml(document.filename)}">×</button>
      </span>`).join('')}
    </div>
  </div>`;
}

function renderMemoState({ memoCurrent, memoLoading, memoError, activeRun }) {
  if (memoLoading) return '<div class="notice">Checking current analysis…</div>';
  if (memoError) return `<div class="errors">Memo connection: ${escapeHtml(memoError)}</div>`;
  if (activeRun) {
    return `<div class="notice analysis-active-run"><span>An analysis is already in progress. You can prepare the next list, but submit it after the current run finishes.</span><button class="btn" id="analysisViewResults" type="button">View Results</button></div>`;
  }
  return '';
}

function renderEmpty() {
  return `<div class="panel panel-pad analysis-list-empty">
    <p class="eyebrow">No tickers yet</p>
    <h2>Build your next analysis list</h2>
    <p class="muted">Add a ticker above or send selected tickers from Screener.</p>
  </div>`;
}

function readTicker() {
  return String(document.getElementById('analysisTickerInput')?.value || '').trim();
}

function bindClick(id, handler) {
  const node = document.getElementById(id);
  if (node) node.addEventListener('click', handler);
}

function cssEscape(value) {
  return globalThis.CSS?.escape ? globalThis.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
