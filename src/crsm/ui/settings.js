import { loadSettings, saveSettings, PROVIDER_INFO, NODES_LLM } from '../settings.js';
import { crsmState } from '../state.js';
import { totalUsage, usageByNode, usageByModel, filterUsageHistory, usageSummary, clearUsageHistory } from '../usage.js';

// Settings is compact: CRSM Engine controls execution and node assignments;
// Providers manages API connections/model registry; Usage and Cost are monitoring views.
const TAB_DEFS = [['engine', 'CRSM Engine'], ['providers', 'Providers'], ['usage', 'Usage'], ['cost', 'Cost']];
let draftSettings = null;
let savedSnapshot = '';

function getDraftSettings() {
  if (!draftSettings) {
    const source = loadSettings();
    draftSettings = typeof structuredClone === 'function' ? structuredClone(source) : JSON.parse(JSON.stringify(source));
    savedSnapshot = JSON.stringify(draftSettings);
  }
  return draftSettings;
}

function settingsDirty() {
  return JSON.stringify(draftSettings || {}) !== savedSnapshot;
}

function discardDraft() {
  draftSettings = null;
  savedSnapshot = '';
}

export function renderSettings(activeTab = 'engine', period = '7d') {
  const settings = getDraftSettings();
  const active = TAB_DEFS.some(([id]) => id === activeTab) ? activeTab : 'engine';
  return `<div class="panel panel-pad settings-panel">
    <div class="title-row"><div><p class="eyebrow">CRSM Control Center</p><h2>Cấu hình & theo dõi hệ thống</h2></div></div>
    <div class="settings-tabs" role="tablist">${TAB_DEFS.map(([id, label]) => `<button class="settings-tab ${id === active ? 'active' : ''}" data-setting-tab="${id}" role="tab">${label}</button>`).join('')}</div>
    <div class="settings-tab-content">${active === 'engine' ? renderEngineTab(settings) : ''}${active === 'providers' ? renderProvidersTab(settings) : ''}${active === 'usage' ? renderUsageTab() : ''}${active === 'cost' ? renderCostTab(settings, period) : ''}</div>
    <div class="settings-footer">
      <div class="settings-save-state">${settingsDirty() ? 'Có thay đổi chưa lưu' : 'Đã lưu'}</div>
      <div class="settings-footer-actions"><button class="btn" id="crsmSettingsClose">Đóng</button><button class="btn primary" id="crsmSettingsSave">Save Changes</button></div>
    </div>
  </div>`;
}

function renderEngineTab(settings) {
  const parallel = settings.crsm.executionMode === 'parallel';
  const rows = NODES_LLM.map(nodeId => {
    const a = settings.crsm.nodeAssignment[nodeId] || {};
    const label = { node1: 'Node 1', node2: 'Node 2', node3: 'Node 3', node4: 'Node 4', node5: 'Node 5' }[nodeId] || nodeId;
    const requirement = { node1: 'Web grounding + JSON', node2: 'Web grounding + JSON', node3: 'JSON / reasoning', node4: 'Web grounding + JSON', node5: 'JSON / reasoning' }[nodeId] || 'AI node';
    const providerDrop = Object.keys(PROVIDER_INFO).map(id => `<option value="${id}" ${id === a.provider ? 'selected' : ''}>${PROVIDER_INFO[id].label}</option>`).join('');
    const cfg = settings.crsm.providers[a.provider] || { models: [] };
    const modelOptions = (cfg.models || []).map(m => `<option value="${escapeAttr(m.id)}" ${m.id === a.model ? 'selected' : ''}>${escapeHtml(m.displayName || m.id)}</option>`).join('');
    return `<div class="settings-row assignment" data-node="${nodeId}">
      <div class="assignment-title"><strong>${label}</strong><span class="muted">${requirement}</span></div>
      <label class="settings-label">Provider<select class="search" data-assign="provider">${providerDrop}</select></label>
      <label class="settings-label">Model<select class="search" data-assign="model">${modelOptions}</select></label>
      <label class="settings-check"><input type="checkbox" data-assign="enabled" ${a.enabled !== false ? 'checked' : ''}> bật</label>
    </div>`;
  }).join('');

  return `<div class="settings-section">
    <div class="settings-section-head"><div><h3>CRSM ENGINE</h3><p class="muted">Điều khiển cách pipeline chạy và model được dùng cho từng node.</p></div></div>
    <div class="settings-row execution-row">
      <div><strong>Execution mode</strong><div class="muted settings-caption">Parallel chỉ chạy khi dependency cho phép; backend vẫn kiểm soát thứ tự thực thi.</div></div>
      <label class="settings-check execution-toggle"><span>Sequential</span><input type="checkbox" id="crsmExecutionMode" data-execution-mode ${parallel ? 'checked' : ''}><span>Parallel</span></label>
    </div>
    <div class="settings-section-head settings-subsection-head"><div><h3>NODE MODEL ASSIGNMENT</h3><p class="muted">Chỉ Node 1–5 sử dụng AI. Node 6A, 6B và Node 7 là local.</p></div></div>
    ${rows}
  </div>`;
}

function renderProvidersTab(settings) {
  const providers = Object.entries(settings.crsm.providers).map(([id, cfg]) => `<div class="settings-block" data-provider="${id}">
    <div class="settings-row"><div><strong>${PROVIDER_INFO[id]?.label || id}</strong><div class="muted settings-caption">${PROVIDER_INFO[id]?.subtitle || 'API provider'}</div></div>
      <label class="settings-label">API Key<input type="password" class="search" data-field="apikey" value="${escapeAttr(cfg.apiKey || '')}" placeholder="API key" autocomplete="off"></label>
    </div>
    <div class="settings-models">${(cfg.models || []).map(model => renderModelRow(model)).join('')}<button class="btn" data-addmodel="${id}">+ Add model</button></div>
  </div>`).join('');
  return `<div class="settings-section"><div class="settings-section-head"><div><h3>PROVIDERS & MODELS</h3><p class="muted">API connection và model registry. Assignment cho từng node nằm trong CRSM Engine.</p></div></div><div class="notice settings-notice">Capability và pricing được lưu cùng model để router và cost monitor sử dụng.</div>${providers}</div>`;
}

function renderModelRow(model) {
  const p = model.pricing || {};
  return `<div class="settings-model"><div><strong>${escapeHtml(model.displayName || model.id)}</strong><span class="muted">${escapeHtml(model.id)}${model.builtin ? ' · built-in' : ' · user-declared'}</span><span class="settings-mini">${p.inputPer1M != null && p.outputPer1M != null ? `$${p.inputPer1M}/M in · $${p.outputPer1M}/M out` : 'Chưa có giá'}</span></div>${model.builtin ? '' : `<button class="btn danger" data-removemodel="${escapeAttr(model.id)}">Xóa</button>`}</div>`;
}

function renderUsageTab() {
  const rows = crsmState.usage || []; const total = totalUsage(); const byNode = usageByNode(rows);
  return `<div class="settings-section"><div class="settings-section-head"><div><h3>USAGE · CURRENT RUN</h3><p class="muted">Token usage của lần CRSM hiện tại.</p></div><button class="btn" id="crsmClearUsage">Xóa run</button></div><div class="grid metrics settings-metrics">${metric('Requests', rows.length)}${metric('Input tokens', formatNumber(total.input))}${metric('Output tokens', formatNumber(total.output))}${metric('Total tokens', formatNumber(total.input + total.output))}</div>${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Node</th><th>Provider</th><th>Model</th><th>Input</th><th>Output</th><th>Cost</th><th>Time</th></tr></thead><tbody>${rows.map(u => `<tr><td>${escapeHtml(u.nodeId)}</td><td>${escapeHtml(u.provider)}</td><td>${escapeHtml(u.model)}</td><td>${formatNumber(u.inputTokens)}</td><td>${formatNumber(u.outputTokens)}</td><td>${formatCost(u.totalCost)}</td><td>${formatDuration(u.durationMs)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">Chưa có request nào trong lần chạy này.</div>'}${byNode.length ? `<div class="settings-node-summary">${byNode.map(n => `<div class="settings-summary-row"><strong>${n.nodeId}</strong><span>${n.runs} request</span><span>${formatNumber(n.inputTokens + n.outputTokens)} tokens</span><strong>${formatCost(n.totalCost)}</strong></div>`).join('')}</div>` : ''}</div>`;
}

function renderCostTab(settings, period) {
  const current = usageSummary(crsmState.usage || []); const history = filterUsageHistory(period); const summary = usageSummary(history); const models = usageByModel(history);
  const budget = Number(settings.crsm.costControl?.monthlyBudgetUsd || 0); const threshold = Number(settings.crsm.costControl?.warningThresholdPct || 80);
  const monthRows = filterUsageHistory('all').filter(row => { const d = new Date(row.recordedAt || 0); const now = new Date(); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); });
  const monthCost = usageSummary(monthRows).cost; const budgetPct = budget > 0 ? monthCost / budget * 100 : 0; const warning = budget > 0 && budgetPct >= threshold;
  return `<div class="settings-section"><div class="settings-section-head"><div><h3>COST MONITOR</h3><p class="muted">Chi phí từ token usage và pricing của model.</p></div></div>
    <div class="settings-period-tabs">${[['today','Hôm nay'],['7d','7 ngày'],['30d','30 ngày'],['all','Tất cả']].map(([id,label]) => `<button class="settings-tab ${period === id ? 'active' : ''}" data-cost-period="${id}">${label}</button>`).join('')}</div>
    <div class="grid metrics settings-metrics">${metric('Current run', formatCost(current.cost))}${metric('Period cost', formatCost(summary.cost))}${metric('Avg / request', summary.requests ? formatCost(summary.cost / summary.requests) : '$0.0000')}${metric('Requests', summary.requests)}</div>
    <div class="cost-budget-card"><div><span class="muted">Monthly budget</span><strong>$${budget.toFixed(2)}</strong></div><div><span class="muted">This month</span><strong>${formatCost(monthCost)} · ${budget ? budgetPct.toFixed(1) : '0.0'}%</strong></div><div><label class="settings-label">Budget USD<input class="search" id="crsmBudgetInput" type="number" min="0" step="1" value="${budget}"></label></div><div><label class="settings-label">Warning %<input class="search" id="crsmBudgetThreshold" type="number" min="1" max="100" step="1" value="${threshold}"></label></div></div>
    ${warning ? `<div class="notice settings-notice">⚠ Chi phí tháng này đã đạt ${budgetPct.toFixed(1)}% ngân sách.</div>` : ''}
    ${models.length ? `<h3>COST BY PROVIDER / MODEL</h3><div class="cost-node-list">${models.map(m => `<div class="cost-node-row"><div><strong>${escapeHtml(m.provider)} · ${escapeHtml(m.model)}</strong><span class="muted">${m.runs} request · ${formatNumber(m.inputTokens + m.outputTokens)} tokens</span></div><strong>${formatCost(m.totalCost)}</strong></div>`).join('')}</div>` : ''}
    ${summary.requests ? `<div class="cost-total"><span>${period === 'all' ? 'TỔNG LỊCH SỬ' : `TỔNG ${period.toUpperCase()}`}</span><strong>${formatCost(summary.cost)}</strong></div>` : '<div class="empty-state">Chưa có lịch sử cost. Chạy CRSM để bắt đầu ghi nhận.</div>'}
    <div class="settings-actions"><button class="btn danger" id="crsmClearHistory">Xóa lịch sử usage</button></div></div>`;
}

function metric(label, value) { return `<div class="panel metric"><p class="metric-label">${label}</p><p class="metric-value settings-metric-value">${value}</p></div>`; }

export function bindSettingsEvents() {
  document.querySelectorAll('.settings-panel [data-setting-tab]').forEach(btn => btn.addEventListener('click', ev => replaceSettings(ev.currentTarget.dataset.settingTab)));
  document.querySelectorAll('.settings-panel [data-cost-period]').forEach(btn => btn.addEventListener('click', ev => replaceSettings('cost', ev.currentTarget.dataset.costPeriod)));
  document.querySelectorAll('.settings-panel [data-execution-mode]').forEach(input => input.addEventListener('change', ev => { const settings = getDraftSettings(); settings.crsm.executionMode = ev.target.checked ? 'parallel' : 'sequential'; replaceSettings('engine'); }));
  document.querySelectorAll('.settings-panel [data-field="apikey"]').forEach(input => input.addEventListener('input', ev => { const provider = ev.target.closest('[data-provider]')?.dataset.provider; if (!provider) return; getDraftSettings().crsm.providers[provider].apiKey = ev.target.value.trim() || null; updateSaveState(); }));
  document.querySelectorAll('.settings-panel [data-addmodel]').forEach(btn => btn.addEventListener('click', ev => {
    const provider = ev.target.dataset.addmodel;
    const id = prompt(`Model ID cho ${PROVIDER_INFO[provider]?.label || provider}:`);
    if (!id?.trim()) return;
    const inputPrice = prompt('Input USD / 1M tokens (để trống nếu chưa biết):', '');
    const outputPrice = prompt('Output USD / 1M tokens (để trống nếu chưa biết):', '');
    const hasGrounding = confirm(`${id.trim()} — model hỗ trợ web grounding? OK = Có.`);
    const settings = getDraftSettings();
    settings.crsm.providers[provider].models = settings.crsm.providers[provider].models || [];
    settings.crsm.providers[provider].models.push({ id:id.trim(), displayName:id.trim(), builtin:false, pricing:{ inputPer1M:parsePrice(inputPrice), outputPer1M:parsePrice(outputPrice), currency:'USD' }, capabilities:{ webGrounding:hasGrounding, structuredOutput:true, reasoning:false } });
    replaceSettings('providers');
  }));
  document.querySelectorAll('.settings-panel [data-removemodel]').forEach(btn => btn.addEventListener('click', ev => {
    const modelId = ev.target.dataset.removemodel;
    const provider = ev.target.closest('[data-provider]')?.dataset.provider;
    const settings = getDraftSettings();
    settings.crsm.providers[provider].models = (settings.crsm.providers[provider].models || []).filter(m => m.id !== modelId);
    replaceSettings('providers');
  }));
  document.querySelectorAll('.settings-panel [data-assign]').forEach(ctl => ctl.addEventListener('change', ev => {
    const row = ev.target.closest('[data-node]'); const nodeId = row?.dataset.node; if (!nodeId) return;
    const field = ev.target.dataset.assign; const settings = getDraftSettings(); const a = settings.crsm.nodeAssignment[nodeId];
    if (field === 'provider') { a.provider = ev.target.value; a.model = settings.crsm.providers[a.provider]?.models?.[0]?.id || null; }
    else if (field === 'model') a.model = ev.target.value;
    else if (field === 'enabled') a.enabled = ev.target.checked;
    replaceSettings('engine');
  }));
  const budget = document.getElementById('crsmBudgetInput'); if (budget) budget.addEventListener('input', ev => { const settings = getDraftSettings(); settings.crsm.costControl.monthlyBudgetUsd = Math.max(0, Number(ev.target.value) || 0); updateSaveState(); });
  const threshold = document.getElementById('crsmBudgetThreshold'); if (threshold) threshold.addEventListener('input', ev => { const settings = getDraftSettings(); settings.crsm.costControl.warningThresholdPct = Math.min(100, Math.max(1, Number(ev.target.value) || 80)); updateSaveState(); });
  const clearRun = document.getElementById('crsmClearUsage'); if (clearRun) clearRun.addEventListener('click', () => { crsmState.usage = []; replaceSettings('usage'); });
  const clearHistory = document.getElementById('crsmClearHistory'); if (clearHistory) clearHistory.addEventListener('click', () => { if (confirm('Xóa toàn bộ lịch sử usage/cost trên trình duyệt này?')) { clearUsageHistory(); replaceSettings('cost','all'); } });
  const save = document.getElementById('crsmSettingsSave'); if (save) save.addEventListener('click', () => { const settings = getDraftSettings(); saveSettings(settings); savedSnapshot = JSON.stringify(settings); updateSaveState(); });
  const close = document.getElementById('crsmSettingsClose'); if (close) close.addEventListener('click', () => {
    if (settingsDirty() && !confirm('Bạn có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?')) return;
    discardDraft();
    const toggle = document.getElementById('openSettings');
    if (toggle) toggle.click();
    else { const panel = document.querySelector('.settings-panel'); if (panel) panel.remove(); }
  });
}

function updateSaveState() {
  const state = document.querySelector('.settings-save-state');
  if (state) state.textContent = settingsDirty() ? 'Có thay đổi chưa lưu' : 'Đã lưu';
}

function replaceSettings(tab = 'engine', period = '7d') {
  const panel = document.querySelector('.settings-panel');
  if (!panel) return;
  panel.outerHTML = renderSettings(tab, period);
  bindSettingsEvents();
}

function parsePrice(value) { if (value == null || value.trim() === '') return null; const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }
function formatNumber(value) { return Number(value || 0).toLocaleString('en-US'); }
function formatCost(value) { return `$${Number(value || 0).toFixed(4)}`; }
function formatDuration(ms) { if (!Number.isFinite(ms)) return '—'; return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`; }
function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeAttr(value) { return escapeHtml(value).replace(/\"/g,'&quot;'); }
