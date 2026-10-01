import { markdownToHtml } from '../report-export.js';
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
        <p class="muted">Chọn run, chuyển mã và xem một báo cáo tại một thời điểm.</p>
      </div>
      <div class="results-refresh-block">
        <span class="muted results-updated">${updatedAt ? 'Updated ' + escapeHtml(formatRelative(updatedAt)) : (loading ? 'Updating…' : 'Not updated yet')}</span>
        <button class="btn" id="memoResultsRefresh" type="button" ${loading ? 'disabled' : ''}>Refresh</button>
      </div>
    </div>

    ${error ? `<div class="results-warning" aria-live="polite"><span>${escapeHtml(error)}</span><button class="btn" id="memoResultsRefreshInline" type="button">Refresh</button></div>` : ''}
    ${needsRepair ? renderRepairWarning(maintenance, repairing) : ''}

    ${renderRunNavigator({ currentRun, history, selectedRun, selectedTicker })}
    <div class="results-viewer">
      ${renderResultDetail(item, reportTab, selectedRun, retryingItemId)}
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

  const runSelect = document.getElementById('memoResultsRunSelect');
  if (runSelect) {
    runSelect.addEventListener('change', () => onSelectRun?.(runSelect.value));
  }

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

function renderRunNavigator({ currentRun, history, selectedRun, selectedTicker }) {
  const runs = dedupeRuns(currentRun, history);
  if (!runs.length) {
    return `<section class="panel panel-pad results-navigator results-empty">
      <div>
        <p class="eyebrow">Analysis Results</p>
        <h2>Chưa có analysis run</h2>
        <p class="muted">Tạo Analysis List và gửi sang Stockmind để bắt đầu.</p>
      </div>
    </section>`;
  }

  const summary = summarizeMemoRun(selectedRun);
  return `<section class="panel panel-pad results-navigator">
    <div class="results-navigator-top">
      <label class="results-run-field">
        <span>Run</span>
        <select id="memoResultsRunSelect" class="results-run-select" aria-label="Chọn analysis run">
          ${runs.map(run => `<option value="${escapeHtml(run.run_id)}" ${run.run_id === selectedRun?.run_id ? 'selected' : ''}>${escapeHtml(runLabel(run))}</option>`).join('')}
        </select>
      </label>
      <div class="results-run-meta">
        <span class="results-status status-${statusClass(selectedRun?.state)}">${escapeHtml(selectedRun?.state || 'UNKNOWN')}</span>
        <span class="muted">${summary.total ? `${summary.completed}/${summary.total} completed${summary.failed ? ` · ${summary.failed} failed` : ''}` : 'No items'}</span>
      </div>
    </div>
    ${selectedRun ? `<div class="results-ticker-switcher" role="tablist" aria-label="Chuyển báo cáo theo mã">
      ${selectedRun.items.map(item => renderTickerSwitch(selectedRun, item, selectedTicker)).join('')}
    </div>` : ''}
  </section>`;
}

function renderTickerSwitch(run, item, selectedTicker) {
  const active = item.ticker === selectedTicker;
  return `<button class="results-ticker-chip ${active ? 'active' : ''}" type="button"
    role="tab" aria-selected="${active ? 'true' : 'false'}"
    data-results-run="${escapeHtml(run.run_id)}"
    data-results-ticker="${escapeHtml(item.ticker)}">
    <strong>${escapeHtml(item.ticker)}</strong>
    <span class="results-status status-${statusClass(item.state)}">${escapeHtml(item.state)}</span>
  </button>`;
}

function renderResultDetail(item, reportTab, selectedRun, retryingItemId) {
  if (!item) {
    return `<section class="panel panel-pad results-empty">
      <p class="eyebrow">Result Viewer</p>
      <h2>Chọn một mã để xem báo cáo</h2>
    </section>`;
  }

  if (item.result_error) {
    return `<section class="panel panel-pad results-warning">
      <div><p class="eyebrow">Invalid Result</p><h2>${escapeHtml(item.ticker)}</h2><p>${escapeHtml(item.result_error)}</p></div>
    </section>`;
  }

  if (item.state !== 'COMPLETED' || !item.result) {
    const error = item.error?.message || item.error || null;
    const retrying = retryingItemId === item.item_id;
    return `<section class="panel panel-pad results-status-detail">
      <p class="eyebrow">Result Viewer</p>
      <div class="results-section-head">
        <div>
          <h2>${escapeHtml(item.ticker)}</h2>
          <p class="muted">${escapeHtml(sourceLabel(item.analysis_source))}</p>
        </div>
        <span class="results-status status-${statusClass(item.state)}">${escapeHtml(item.state)}</span>
      </div>
      ${error ? `<p class="results-error-detail">${escapeHtml(error)}</p>` : '<p class="muted">Result is not available yet.</p>'}
      ${item.state === 'FAILED' && selectedRun
        ? `<div class="results-status-actions"><button class="btn" type="button"
            data-results-retry-run="${escapeHtml(selectedRun.run_id)}"
            data-results-retry="${escapeHtml(item.item_id)}"
            ${retrying ? 'disabled' : ''}>${retrying ? 'Retrying…' : 'Retry ' + escapeHtml(item.ticker)}</button></div>`
        : ''}
    </section>`;
  }

  const result = item.result;
  const activeTab = ['html', 'word', 'log'].includes(reportTab) ? reportTab : 'html';
  const srcdoc = result.visualReport;

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
      : activeTab === 'word'
        ? `<div class="report-paper"><article class="crsm-word-preview">${markdownToHtml(result.detailReport)}</article></div>`
        : `<div class="report-paper"><iframe class="crsm-report-frame" srcdoc="${escapeAttr(srcdoc)}" sandbox></iframe></div>`}
  </section>`;
}

function dedupeRuns(currentRun, history) {
  const byId = new Map();
  if (currentRun?.run_id) {
    byId.set(currentRun.run_id, {
      run_id: currentRun.run_id,
      created_at: currentRun.created_at,
      state: currentRun.state,
      item_count: currentRun.items?.length || 0,
      completed_count: summarizeMemoRun(currentRun).completed,
      failed_count: summarizeMemoRun(currentRun).failed,
      tickers: (currentRun.items || []).map(item => item.ticker)
    });
  }
  for (const run of history || []) {
    if (run?.run_id && !byId.has(run.run_id)) byId.set(run.run_id, run);
  }
  return [...byId.values()];
}

function runLabel(run) {
  const when = formatDateTime(run.created_at) || run.run_id;
  const tickers = (run.tickers || []).join(', ');
  const completed = Number(run.completed_count || 0);
  const total = Number(run.item_count || 0);
  return `${when}${tickers ? ' · ' + tickers : ''}${total ? ` · ${completed}/${total}` : ''}`;
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
