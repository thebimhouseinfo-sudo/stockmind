import { buildWordHtmlDocument } from '../report-export.js';
import {
  decisionLogRows,
  selectedRunItem,
  sourceLabel,
  summarizeMemoRun
} from '../result-adapter.js';

export function renderResultsPage({
  currentRun = null,
  history = [],
  selectedRun = null,
  selectedTicker = null,
  reportTab = 'html',
  loading = false,
  error = null,
  updatedAt = null,
  retryingItemId = null,
  maintenance = null,
  repairing = false
} = {}) {
  const item = selectedRunItem(selectedRun, selectedTicker);
  const needsRepair = Boolean(
    maintenance
    && (
      (maintenance.missing_from_index || []).length
      || (maintenance.missing_run_dirs || []).length
    )
  );

  return `<section class="results-page">
    <div class="results-head">
      <div>
        <p class="eyebrow">CRSM</p>
        <h1>Results</h1>
        <p class="muted">Current ticker status, analysis history and immutable CRSM results.</p>
      </div>
      <div class="results-refresh-block">
        <span class="muted results-updated">${updatedAt ? 'Updated ' + escapeHtml(formatRelative(updatedAt)) : (loading ? 'Updating…' : 'Not updated yet')}</span>
        <button class="btn" id="memoResultsRefresh" type="button" ${loading ? 'disabled' : ''}>Refresh</button>
      </div>
    </div>

    ${error ? `<div class="results-warning" aria-live="polite"><span>${escapeHtml(error)}</span><button class="btn" id="memoResultsRefreshInline" type="button">Refresh</button></div>` : ''}
    ${needsRepair ? renderRepairWarning(maintenance, repairing) : ''}

    <div class="results-layout">
      <aside class="results-master">
        ${renderCurrentRun(currentRun, selectedRun?.run_id, selectedTicker, retryingItemId)}
        ${renderHistory(history, selectedRun?.run_id)}
      </aside>
      <div class="results-detail">
        ${renderSelectedRunHeader(selectedRun, selectedTicker)}
        ${renderResultDetail(item, reportTab)}
      </div>
    </div>
  </section>`;
}

export function bindResultsPage({
  onRefresh,
  onRepair,
  onSelectRun,
  onSelectTicker,
  onRetry,
  onReportTab,
  onDownloadImage,
  onDownloadWord
} = {}) {
  bindClick('memoResultsRefresh', onRefresh);
  bindClick('memoResultsRefreshInline', onRefresh);
  bindClick('memoRepairHistory', onRepair);
  bindClick('memoDownloadImage', onDownloadImage);
  bindClick('memoDownloadWord', onDownloadWord);

  document.querySelectorAll('[data-results-run]').forEach(node => {
    node.addEventListener('click', () => onSelectRun?.(node.dataset.resultsRun));
  });

  document.querySelectorAll('[data-results-ticker]').forEach(node => {
    node.addEventListener('click', () => {
      onSelectTicker?.(
        node.dataset.resultsRun || null,
        node.dataset.resultsTicker
      );
    });
  });

  document.querySelectorAll('[data-results-retry]').forEach(node => {
    node.addEventListener('click', event => {
      event.stopPropagation();
      onRetry?.(
        node.dataset.resultsRetryRun,
        node.dataset.resultsRetry
      );
    });
  });

  document.querySelectorAll('[data-memo-report-tab]').forEach(node => {
    node.addEventListener('click', () => onReportTab?.(node.dataset.memoReportTab));
  });
}

function renderCurrentRun(run, selectedRunId, selectedTicker, retryingItemId) {
  if (!run) {
    return `<section class="panel panel-pad results-current">
      <p class="eyebrow">Current Run</p>
      <h2>No submitted analysis</h2>
      <p class="muted">Submit an Analysis List to create a run.</p>
    </section>`;
  }

  const summary = summarizeMemoRun(run);
  return `<section class="panel panel-pad results-current">
    <div class="results-section-head">
      <div>
        <p class="eyebrow">Current Run</p>
        <h2>${escapeHtml(formatDateTime(run.created_at) || run.run_id)}</h2>
      </div>
      <span class="results-status status-${statusClass(run.state)}">${escapeHtml(run.state)}</span>
    </div>
    <p class="muted results-progress">${summary.completed}/${summary.total} completed${summary.failed ? ' · ' + summary.failed + ' failed' : ''}</p>
    <div class="results-ticker-list">
      ${run.items.map(item => renderTickerRow(run, item, selectedRunId, selectedTicker, retryingItemId)).join('')}
    </div>
  </section>`;
}

function renderTickerRow(run, item, selectedRunId, selectedTicker, retryingItemId) {
  const selected = run.run_id === selectedRunId && item.ticker === selectedTicker;
  const retrying = retryingItemId === item.item_id;
  const error = item.error?.message || item.error || null;

  return `<div class="results-ticker-row ${selected ? 'selected' : ''}">
    <button class="results-ticker-select" type="button"
      data-results-run="${escapeHtml(run.run_id)}"
      data-results-ticker="${escapeHtml(item.ticker)}">
      <span class="results-ticker-main">
        <strong>${escapeHtml(item.ticker)}</strong>
        <small>${escapeHtml(sourceLabel(item.analysis_source))}</small>
      </span>
      <span class="results-status status-${statusClass(item.state)}">${escapeHtml(item.state)}</span>
    </button>
    ${item.state === 'FAILED'
      ? `<div class="results-retry-wrap">
          ${error ? `<small class="results-error-short">${escapeHtml(error)}</small>` : ''}
          <button class="btn results-retry-button" type="button"
            data-results-retry-run="${escapeHtml(run.run_id)}"
            data-results-retry="${escapeHtml(item.item_id)}"
            aria-label="Retry ${escapeHtml(item.ticker)}" ${retrying ? 'disabled' : ''}>${retrying ? 'Retrying…' : 'Retry'}</button>
        </div>`
      : ''}
  </div>`;
}

function renderHistory(history, selectedRunId) {
  return `<section class="panel panel-pad results-history">
    <div class="results-section-head">
      <div>
        <p class="eyebrow">History</p>
        <h2>${history.length} run${history.length === 1 ? '' : 's'}</h2>
      </div>
    </div>
    <div class="results-history-list">
      ${history.length
        ? history.map(run => {
            const selected = run.run_id === selectedRunId;
            return `<button class="results-history-row ${selected ? 'selected' : ''}" type="button" data-results-run="${escapeHtml(run.run_id)}">
              <span><strong>${escapeHtml(formatDateTime(run.created_at) || run.run_id)}</strong><small>${escapeHtml((run.tickers || []).join(', '))}</small></span>
              <span><b>${escapeHtml(run.state)}</b><small>${Number(run.completed_count || 0)}/${Number(run.item_count || 0)} completed${run.failed_count ? ' · ' + run.failed_count + ' failed' : ''}</small></span>
            </button>`;
          }).join('')
        : '<p class="muted">No completed history yet.</p>'}
    </div>
  </section>`;
}

function renderSelectedRunHeader(run, selectedTicker) {
  if (!run) return '';
  return `<section class="panel panel-pad results-run-picker">
    <div class="results-section-head">
      <div>
        <p class="eyebrow">Selected Run</p>
        <h2>${escapeHtml(formatDateTime(run.created_at) || run.run_id)}</h2>
      </div>
      <span class="results-status status-${statusClass(run.state)}">${escapeHtml(run.state)}</span>
    </div>
    <div class="results-run-tickers">
      ${run.items.map(item => `<button class="results-run-ticker ${item.ticker === selectedTicker ? 'active' : ''}" type="button"
        data-results-run="${escapeHtml(run.run_id)}"
        data-results-ticker="${escapeHtml(item.ticker)}">${escapeHtml(item.ticker)} · ${escapeHtml(item.state)}</button>`).join('')}
    </div>
  </section>`;
}

function renderResultDetail(item, reportTab) {
  if (!item) {
    return `<section class="panel panel-pad results-empty">
      <p class="eyebrow">Result Detail</p>
      <h2>Select a run or ticker</h2>
      <p class="muted">Choose a ticker from Current Run or History.</p>
    </section>`;
  }

  if (item.result_error) {
    return `<section class="panel panel-pad results-warning">
      <p class="eyebrow">Invalid Result</p>
      <h2>${escapeHtml(item.ticker)}</h2>
      <p>${escapeHtml(item.result_error)}</p>
    </section>`;
  }

  if (item.state !== 'COMPLETED' || !item.result) {
    const error = item.error?.message || item.error || null;
    return `<section class="panel panel-pad results-status-detail">
      <p class="eyebrow">Result Detail</p>
      <div class="results-section-head">
        <h2>${escapeHtml(item.ticker)}</h2>
        <span class="results-status status-${statusClass(item.state)}">${escapeHtml(item.state)}</span>
      </div>
      <p class="muted">${escapeHtml(sourceLabel(item.analysis_source))}</p>
      ${error ? `<p class="results-error-detail">${escapeHtml(error)}</p>` : '<p class="muted">Result is not available yet.</p>'}
    </section>`;
  }

  const result = item.result;
  const activeTab = ['html', 'word', 'log'].includes(reportTab) ? reportTab : 'html';
  const srcdoc = activeTab === 'word'
    ? buildWordHtmlDocument(result.detailReport, result.ticker)
    : result.visualReport;

  return `<section class="results-completed">
    <div class="panel panel-pad results-summary-card">
      <div class="results-section-head">
        <div>
          <p class="eyebrow">Completed Result</p>
          <h1>${escapeHtml(result.ticker)}</h1>
          <p class="muted">${escapeHtml(result.analysisSourceLabel)} · ${escapeHtml(result.analysisDate)}</p>
        </div>
        <span class="results-decision">${escapeHtml(result.decisionLabel)}</span>
      </div>
      <div class="results-summary-grid">
        ${summaryMetric('AI Score', result.aiScore)}
        ${summaryMetric('Confidence', result.confidence)}
        ${summaryMetric('Price', result.priceAtAnalysis)}
        ${summaryMetric('Entry', result.entryZone)}
      </div>
    </div>

    <div class="report-controls">
      <div class="report-tabs">
        <button class="report-tab ${activeTab === 'html' ? 'active' : ''}" type="button" data-memo-report-tab="html">Visual Report</button>
        <button class="report-tab ${activeTab === 'word' ? 'active' : ''}" type="button" data-memo-report-tab="word">Detail Report</button>
        <button class="report-tab ${activeTab === 'log' ? 'active' : ''}" type="button" data-memo-report-tab="log">Decision Log</button>
      </div>
      <div class="report-export-actions">
        <button class="btn primary" id="memoDownloadImage" type="button">Tải ảnh</button>
        <button class="btn" id="memoDownloadWord" type="button">Tải Word</button>
      </div>
    </div>

    ${activeTab === 'log'
      ? renderDecisionLog(decisionLogRows(item))
      : `<div class="report-paper"><iframe class="crsm-report-frame" srcdoc="${escapeAttr(srcdoc)}" sandbox></iframe></div>`}
  </section>`;
}

function renderDecisionLog(rows) {
  const columns = [
    ['date','Ngày phân tích'],
    ['ticker','Mã'],
    ['price_at_analysis','Giá tại thời điểm PT'],
    ['decision','Quyết định'],
    ['ai_score','AI Score'],
    ['confidence','Confidence'],
    ['entry_zone','Entry'],
    ['trading_stop','Trading Stop'],
    ['tp1','TP1'],
    ['tp2','TP2'],
    ['thesis_invalidation','Điều kiện vô hiệu hóa']
  ];
  return `<div class="panel panel-pad decision-log-panel">
    <div class="title-row"><div><p class="eyebrow">DECISION LOG</p><h2>Canonical result record</h2></div></div>
    <div class="table-wrap decision-log-wrap">
      <table class="decision-log-table"><thead><tr>${columns.map(([,label]) => `<th>${label}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${columns.map(([key]) => `<td>${formatValue(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table>
    </div>
  </div>`;
}

function renderRepairWarning(maintenance, repairing) {
  const orphanCount = (maintenance.missing_from_index || []).length;
  const missingCount = (maintenance.missing_run_dirs || []).length;
  return `<div class="results-repair-warning">
    <div><strong>History index needs repair</strong><span>${orphanCount} run(s) missing from index · ${missingCount} missing run folder(s)</span></div>
    <button class="btn" id="memoRepairHistory" type="button" ${repairing ? 'disabled' : ''}>${repairing ? 'Repairing…' : 'Repair history index'}</button>
  </div>`;
}

function summaryMetric(label, value) {
  return `<div class="score-card"><span class="muted">${escapeHtml(label)}</span><strong>${formatValue(value)}</strong></div>`;
}

function statusClass(value) {
  return String(value || 'UNKNOWN').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 15) return 'moments ago';
  if (seconds < 60) return seconds + 's ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + 'm ago';
  return formatDateTime(value);
}

function formatValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'number') return Number.isFinite(value)
    ? value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
    : '—';
  return escapeHtml(String(value));
}

function bindClick(id, handler) {
  const node = document.getElementById(id);
  if (node && typeof handler === 'function') node.addEventListener('click', handler);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
