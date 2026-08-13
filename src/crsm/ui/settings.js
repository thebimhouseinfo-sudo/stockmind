import { loadSettings, saveSettings, PROVIDER_INFO } from '../settings.js';
import { crsmState } from '../state.js';
import { totalUsage, usageByNode, usageByModel, filterUsageHistory, usageSummary, clearUsageHistory } from '../usage.js';

// Settings is intentionally operational and compact.
// Node/model assignment remains an internal runtime concern and is not exposed here.
const TAB_DEFS = [['system', 'System'], ['usage', 'Usage'], ['cost', 'Cost']];

export function renderSettings(activeTab = 'system', period = '7d') {
  const settings = loadSettings();
  const active = TAB_DEFS.some(([id]) => id === activeTab) ? activeTab : 'system';
  return `<div class="panel panel-pad settings-panel">
    <div class="title-row"><div><p class="eyebrow">CRSM Control Center</p><h2>Cấu hình & theo dõi hệ thống</h2></div><button class="btn" id="crsmSettingsClose">✕ Đóng</button></div>
    <div class="settings-tabs" role="tablist">${TAB_DEFS.map(([id, label]) => `<button class="settings-tab ${id === active ? 'active' : ''}" data-setting-tab="${id}" role="tab">${label}</button>`).join('')}</div>
    <div class="settings-tab-content">${active === 'system' ? renderSystemTab(settings) : ''}${active === 'usage' ? renderUsageTab() : ''}${active === 'cost' ? renderCostTab(settings, period) : ''}</div>
  </div>`;
}

function renderSystemTab(settings) {
  const parallel = settings.crsm.executionMode === 'parallel';
  const providers = Object.entries(settings.crsm.providers).map(([id, cfg]) => `<div class="settings-block" data-provider="${id}">
    <div class="settings-row">
      <div><strong>${PROVIDER_INFO[id]?.label || id}</strong><div class="muted settings-caption">${PROVIDER_INFO[id]?.subtitle || 'API provider'}</div></div>
      <label class="settings-label">API Key<input type="password" class="search" data-field="apikey" value="${escapeAttr(cfg.apiKey || '')}" placeholder="API key" autocomplete="off"></label>
    </div>
  </div>`).join('');

  return `<div class="settings-section">
    <div class="settings-section-head"><div><h3>PIPELINE</h3><p class="muted">Chỉ các thiết lập ảnh hưởng trực tiếp đến cách CRSM chạy.</p></div></div>
    <div class="settings-row execution-row">
      <div><strong>Execution mode</strong><div class="muted settings-caption">Parallel chỉ chạy khi dependency cho phép; mặc định backend vẫn kiểm soát thứ tự.</div></div>
      <label class="settings-check execution-toggle"><span>Sequential</span><input type="checkbox" id="crsmExecutionMode" data-execution-mode ${parallel ? 'checked' : ''}><span>Parallel</span></label>
    </div>

    <div class="settings-section-head settings-subsection-head"><div><h3>API PROVIDERS</h3><p class="muted">Chỉ nhập API key. Model và node assignment không cấu hình tại đây.</p></div></div>
    ${providers}
  </div>`;
}

function renderUsageTab() {
  const rows = crsmState.usage || [];
  const total = totalUsage();
  const byNode = usageByNode(rows);
  return `<div class="settings-section">
    <div class="settings-section-head"><div><h3>USAGE · CURRENT RUN</h3><p class="muted">Token usage của lần CRSM hiện tại.</p></div><button class="btn" id="crsmClearUsage">Xóa run</button></div>
    <div class="grid metrics settings-metrics">${metric('Requests', rows.length)}${metric('Input tokens', formatNumber(total.input))}${metric('Output tokens', formatNumber(total.output))}${metric('Total tokens', formatNumber(total.input + total.output))}</div>
    ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Node</th><th>Provider</th><th>Model</th><th>Input</th><th>Output</th><th>Cost</th><th>Time</th></tr></thead><tbody>${rows.map(u => `<tr><td>${escapeHtml(u.nodeId)}</td><td>${escapeHtml(u.provider)}</td><td>${escapeHtml(u.model)}</td><td>${formatNumber(u.inputTokens)}</td><td>${formatNumber(u.outputTokens)}</td><td>${formatCost(u.totalCost)}</td><td>${formatDuration(u.durationMs)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Chưa có request nào trong lần chạy này.</div>'}
    ${byNode.length ? `<div class="settings-node-summary">${byNode.map(n => `<div class="settings-summary-row"><strong>${n.nodeId}</strong><span>${n.runs} request</span><span>${formatNumber(n.inputTokens + n.outputTokens)} tokens</span><strong>${formatCost(n.totalCost)}</strong></div>`).join('')}</div>` : ''}
  </div>`;
}

function renderCostTab(settings, period) {
  const current = usageSummary(crsmState.usage || []);
  const history = filterUsageHistory(period);
  const summary = usageSummary(history);
  const models = usageByModel(history);
  const budget = Number(settings.crsm.costControl?.monthlyBudgetUsd || 0);
  const threshold = Number(settings.crsm.costControl?.warningThresholdPct || 80);
  const monthRows = filterUsageHistory('all').filter(row => {
    const d = new Date(row.recordedAt || 0); const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthCost = usageSummary(monthRows).cost;
  const budgetPct = budget > 0 ? monthCost / budget * 100 : 0;
  const warning = budget > 0 && budgetPct >= threshold;

  return `<div class="settings-section">
    <div class="settings-section-head"><div><h3>COST MONITOR</h3><p class="muted">Chi phí từ token usage và pricing nội bộ của model.</p></div></div>
    <div class="settings-period-tabs">${[['today','Hôm nay'],['7d','7 ngày'],['30d','30 ngày'],['all','Tất cả']].map(([id,label]) => `<button class="settings-tab ${period === id ? 'active' : ''}" data-cost-period="${id}">${label}</button>`).join('')}</div>
    <div class="grid metrics settings-metrics">${metric('Current run', formatCost(current.cost))}${metric('Period cost', formatCost(summary.cost))}${metric('Avg / request', summary.requests ? formatCost(summary.cost / summary.requests) : '$0.0000')}${metric('Requests', summary.requests)}</div>
    <div class="cost-budget-card"><div><span class="muted">Monthly budget</span><strong>$${budget.toFixed(2)}</strong></div><div><span class="muted">This month</span><strong>${formatCost(monthCost)} · ${budget ? budgetPct.toFixed(1) : '0.0'}%</strong></div><div><label class="settings-label">Budget USD<input class="search" id="crsmBudgetInput" type="number" min="0" step="1" value="${budget}"></label></div><div><label class="settings-label">Warning %<input class="search" id="crsmBudgetThreshold" type="number" min="1" max="100" step="1" value="${threshold}"></label></div></div>
    ${warning ? `<div class="notice settings-notice">⚠ Chi phí tháng này đã đạt ${budgetPct.toFixed(1)}% ngân sách.</div>` : ''}
    ${models.length ? `<h3>COST BY PROVIDER / MODEL</h3><div class="cost-node-list">${models.map(m => `<div class="cost-node-row"><div><strong>${escapeHtml(m.provider)} · ${escapeHtml(m.model)}</strong><span class="muted">${m.runs} request · ${formatNumber(m.inputTokens + m.outputTokens)} tokens</span></div><strong>${formatCost(m.totalCost)}</strong></div>`).join('')}</div>` : ''}
    ${summary.requests ? `<div class="cost-total"><span>${period === 'all' ? 'TỔNG LỊCH SỬ' : `TỔNG ${period.toUpperCase()}`}</span><strong>${formatCost(summary.cost)}</strong></div>` : '<div class="empty-state">Chưa có lịch sử cost. Chạy CRSM để bắt đầu ghi nhận.</div>'}
    <div class="settings-actions"><button class="btn danger" id="crsmClearHistory">Xóa lịch sử usage</button></div>
  </div>`;
}

function metric(label, value) { return `<div class="panel metric"><p class="metric-label">${label}</p><p class="metric-value settings-metric-value">${value}</p></div>`; }

export function bindSettingsEvents() {
  document.querySelectorAll('.settings-panel [data-setting-tab]').forEach(btn => btn.addEventListener('click', ev => replaceSettings(ev.currentTarget.dataset.settingTab)));
  document.querySelectorAll('.settings-panel [data-cost-period]').forEach(btn => btn.addEventListener('click', ev => replaceSettings('cost', ev.currentTarget.dataset.costPeriod)));

  document.querySelectorAll('.settings-panel [data-execution-mode]').forEach(input => input.addEventListener('change', ev => {
    const settings = loadSettings();
    settings.crsm.executionMode = ev.target.checked ? 'parallel' : 'sequential';
    saveSettings(settings);
  }));

  document.querySelectorAll('.settings-panel [data-field="apikey"]').forEach(input => input.addEventListener('change', ev => {
    const provider = ev.target.closest('[data-provider]')?.dataset.provider;
    if (!provider) return;
    const settings = loadSettings();
    settings.crsm.providers[provider].apiKey = ev.target.value.trim() || null;
    saveSettings(settings);
  }));

  const budget = document.getElementById('crsmBudgetInput');
  if (budget) budget.addEventListener('change', ev => {
    const settings = loadSettings();
    settings.crsm.costControl.monthlyBudgetUsd = Math.max(0, Number(ev.target.value) || 0);
    saveSettings(settings);
    replaceSettings('cost');
  });

  const threshold = document.getElementById('crsmBudgetThreshold');
  if (threshold) threshold.addEventListener('change', ev => {
    const settings = loadSettings();
    settings.crsm.costControl.warningThresholdPct = Math.min(100, Math.max(1, Number(ev.target.value) || 80));
    saveSettings(settings);
    replaceSettings('cost');
  });

  const clearRun = document.getElementById('crsmClearUsage');
  if (clearRun) clearRun.addEventListener('click', () => { crsmState.usage = []; replaceSettings('usage'); });

  const clearHistory = document.getElementById('crsmClearHistory');
  if (clearHistory) clearHistory.addEventListener('click', () => {
    if (confirm('Xóa toàn bộ lịch sử usage/cost trên trình duyệt này?')) {
      clearUsageHistory();
      replaceSettings('cost', 'all');
    }
  });

  const close = document.getElementById('crsmSettingsClose');
  if (close) close.addEventListener('click', () => {
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.outerHTML = '';
  });
}

function replaceSettings(tab = 'system', period = '7d') {
  const panel = document.querySelector('.settings-panel');
  if (!panel) return;
  panel.outerHTML = renderSettings(tab, period);
  bindSettingsEvents();
}

function formatNumber(value) { return Number(value || 0).toLocaleString('en-US'); }
function formatCost(value) { return `$${Number(value || 0).toFixed(4)}`; }
function formatDuration(ms) { if (!Number.isFinite(ms)) return '—'; return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`; }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(value) { return escapeHtml(value).replace(/"/g, '&quot;'); }
