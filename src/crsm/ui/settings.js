import { loadSettings, saveSettings, PROVIDER_INFO, NODES_LLM } from '../settings.js';
import { crsmState } from '../state.js';
import { totalUsage, usageByNode, usageByModel, filterUsageHistory, usageSummary, clearUsageHistory } from '../usage.js';
import { discoverProviderModels, mergeDiscoveredModels } from '../model-discovery.js';

// Settings is compact: CRSM Engine controls execution policy and model assignments;
// Providers manages API connections/model registry; Usage and Cost are monitoring views.
const TAB_DEFS = [['engine', 'CRSM Engine'], ['providers', 'Providers'], ['usage', 'Usage'], ['cost', 'Cost']];
let draftSettings = null;
let savedSnapshot = '';
let providerScanStatus = {};
let providerScanTimers = {};
let providerScanControllers = {};

const EXECUTION_GROUPS = [
  {
    key: 'research',
    title: 'Phân tích chuyên sâu',
    description: 'Kỹ thuật & Smart Money và Cơ bản & Định giá có thể chạy song song vì cùng phụ thuộc vào dữ liệu đầu vào đã hoàn tất.',
    members: ['Kỹ thuật & Smart Money', 'Cơ bản & Định giá']
  },
  {
    key: 'reports',
    title: 'Đầu ra báo cáo',
    description: 'Báo cáo HTML, Báo cáo Word và Nhật ký quyết định độc lập sau Tổng hợp & Quyết định.',
    members: ['Báo cáo HTML', 'Báo cáo Word', 'Nhật ký quyết định']
  }
];

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
  const rows = NODES_LLM.map(nodeId => {
    const a = settings.crsm.nodeAssignment[nodeId] || {};
    const label = {
      node1: 'Dữ liệu & Tài chính',
      node2: 'Kỹ thuật & Smart Money',
      node3: 'Cơ bản & Định giá',
      node4: 'Vĩ mô & Nhân quả',
      node5: 'Tổng hợp & Quyết định'
    }[nodeId] || nodeId;
    const requirement = {
      node1: 'Web grounding + JSON',
      node2: 'Web grounding + JSON',
      node3: 'JSON / reasoning',
      node4: 'Web grounding + JSON',
      node5: 'JSON / reasoning'
    }[nodeId] || 'AI';
    const providerDrop = Object.keys(PROVIDER_INFO).map(id => `<option value="${id}" ${id === a.provider ? 'selected' : ''}>${PROVIDER_INFO[id].label}</option>`).join('');
    const cfg = settings.crsm.providers[a.provider] || { models: [] };
    const modelOptions = (cfg.models || []).map(m => `<option value="${escapeAttr(m.id)}" ${m.id === a.model ? 'selected' : ''}>${escapeHtml(m.displayName || m.id)}</option>`).join('');
    return `<div class="settings-row assignment" data-node="${nodeId}">
      <div class="assignment-title"><strong>${label}</strong><span class="muted">${requirement}</span></div>
      <label class="settings-label"><select class="search" data-assign="provider">${providerDrop}</select></label>
      <label class="settings-label"><select class="search" data-assign="model">${modelOptions}</select></label>
      <label class="settings-check" title="Bật node"><input type="checkbox" data-assign="enabled" ${a.enabled !== false ? 'checked' : ''}><span class="sr-only">Bật node</span></label>
    </div>`;
  }).join('');

  const executionPolicy = settings.crsm.executionPolicy || {};
  const stageCards = EXECUTION_GROUPS.map(group => {
    const mode = executionPolicy.parallelStages?.[group.key] || 'auto';
    return `<div class="execution-policy-card" data-execution-stage="${group.key}">
      <div class="execution-policy-head">
        <div><strong>${group.title}</strong></div>
      </div>
      <div class="execution-policy-controls">
        ${['auto','parallel','sequential'].map(value => `<label class="policy-option"><input type="radio" name="execution-${group.key}" value="${value}" data-execution-stage="${group.key}" data-execution-policy ${mode === value ? 'checked' : ''}><span>${value === 'auto' ? 'Tự động' : value === 'parallel' ? 'Cho phép song song' : 'Buộc tuần tự'}</span></label>`).join('')}
      </div>
    </div>`;
  }).join('');

  return `<div class="settings-section">
    <div class="settings-section-head"><div><h3>CRSM ENGINE</h3><p class="muted">Execution policy chỉ điều khiển cách các tác vụ độc lập chạy trong phạm vi dependency cho phép. Không có một công tắc song song cho toàn pipeline.</p></div></div>
    <div class="execution-policy-list">
      ${stageCards}
    </div>
    <div class="settings-section-head settings-subsection-head"><div><h3>MODEL THEO CHỨC NĂNG</h3><p class="muted">Các chức năng AI bên dưới vẫn có thể chọn provider/model riêng. Đây là cấu hình model, không phải dependency của pipeline.</p></div></div>
    ${rows}
  </div>`;
}

function renderProvidersTab(settings) {
  const entries = Object.entries(settings.crsm.providers);
  const providerCards = entries.map(([id, cfg]) => renderProviderCard(id, cfg)).join('');
  const modelInventory = entries.map(([id, cfg]) => renderModelInventory(id, cfg)).join('');
  return `<div class="settings-section provider-console">
    <div class="settings-section-head"><div><h3>PROVIDERS & MODELS</h3></div></div>
    <div class="provider-grid">${providerCards}</div>
    <div class="model-inventory">
      <div class="model-inventory-head"><h3>MODEL INVENTORY</h3><span>${entries.reduce((total, [, cfg]) => total + (cfg.models || []).length, 0)} models</span></div>
      ${modelInventory}
    </div>
  </div>`;
}

function renderProviderCard(providerId, cfg) {
  const info = PROVIDER_INFO[providerId] || {};
  const hasKey = Boolean(cfg.apiKey);
  const models = cfg.models || [];
  const scanLabel = providerId === 'ollamaCloud' ? 'Quét thủ công' : 'Tự quét khi nhập key';
  return `<section class="provider-card ${hasKey ? 'connected' : ''}" data-provider="${providerId}">
    <div class="provider-card-head">
      <div>
        <strong>${escapeHtml(info.label || providerId)}</strong>
        <span>${escapeHtml(info.subtitle || 'API provider')}</span>
      </div>
      <em>${hasKey ? 'Đã có key' : 'Chưa có key'}</em>
    </div>
    <label class="provider-key-field">
      <span>API key</span>
      <input type="password" class="search" data-field="apikey" value="${escapeAttr(cfg.apiKey || '')}" placeholder="Dán API key" autocomplete="off">
    </label>
    ${renderProviderScanStatus(providerId)}
    <div class="provider-card-foot">
      <span>${models.length} model</span>
      <span>${scanLabel}</span>
      <button class="btn" data-addmodel="${providerId}">+ Model</button>
    </div>
  </section>`;
}

function renderProviderScanStatus(providerId) {
  if (providerId === 'ollamaCloud') return '';
  const status = providerScanStatus[providerId];
  if (!status) return `<div class="settings-scan-status muted" data-scan-status="${providerId}">Nhập API key để tự quét model khả dụng.</div>`;
  const cls = status.type === 'error' ? 'error' : status.type === 'success' ? 'success' : 'loading';
  return `<div class="settings-scan-status ${cls}" data-scan-status="${providerId}">${escapeHtml(status.message)}</div>`;
}

function renderModelInventory(providerId, cfg) {
  const models = cfg.models || [];
  const providerLabel = PROVIDER_INFO[providerId]?.label || providerId;
  return `<section class="model-provider-group" data-provider="${providerId}">
    <div class="model-provider-head"><strong>${escapeHtml(providerLabel)}</strong><span>${models.length} model</span></div>
    <div class="settings-models">${models.length ? models.map(model => renderModelRow(model, providerId)).join('') : '<div class="empty-state">Chưa có model nào.</div>'}</div>
  </section>`;
}

function renderModelRow(model, providerId) {
  const p = model.pricing || {};
  const caps = model.capabilities || {};
  const capText = [
    caps.webGrounding ? 'Web' : '',
    caps.structuredOutput ? 'JSON' : '',
    caps.reasoning ? 'Reasoning' : ''
  ].filter(Boolean).join(' · ') || 'Basic';
  const priceText = p.inputPer1M != null && p.outputPer1M != null ? `$${p.inputPer1M}/M in · $${p.outputPer1M}/M out` : 'Chưa có giá';
  return `<div class="settings-model" data-provider="${providerId}">
    <div><strong>${escapeHtml(model.displayName || model.id)}</strong><span class="muted">${escapeHtml(model.id)}</span></div>
    <span class="model-capability">${escapeHtml(capText)}</span>
    <span class="settings-mini">${escapeHtml(priceText)}</span>
    <span class="model-source">${model.builtin ? 'available' : 'manual'}</span>
    ${model.builtin ? '<span></span>' : `<button class="btn danger" data-removemodel="${escapeAttr(model.id)}">Xóa</button>`}
  </div>`;
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
  document.querySelectorAll('.settings-panel [data-execution-policy]').forEach(input => input.addEventListener('change', ev => {
    const settings = getDraftSettings();
    const stage = ev.target.dataset.executionStage;
    if (!stage) return;
    settings.crsm.executionPolicy = settings.crsm.executionPolicy || { default: 'auto', parallelStages: {} };
    settings.crsm.executionPolicy.parallelStages = settings.crsm.executionPolicy.parallelStages || {};
    settings.crsm.executionPolicy.parallelStages[stage] = ev.target.value;
    replaceSettings('engine');
  }));
  document.querySelectorAll('.settings-panel [data-field="apikey"]').forEach(input => input.addEventListener('input', ev => {
    const provider = ev.target.closest('[data-provider]')?.dataset.provider;
    if (!provider) return;
    const apiKey = ev.target.value.trim();
    getDraftSettings().crsm.providers[provider].apiKey = apiKey || null;
    updateSaveState();
    scheduleProviderModelScan(provider, apiKey);
  }));
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

function scheduleProviderModelScan(provider, apiKey) {
  if (provider === 'ollamaCloud') return;
  clearTimeout(providerScanTimers[provider]);
  if (providerScanControllers[provider]) providerScanControllers[provider].abort();
  if (!apiKey) {
    providerScanStatus = { ...providerScanStatus, [provider]: null };
    updateProviderScanStatus(provider);
    return;
  }
  providerScanStatus = { ...providerScanStatus, [provider]: { type: 'loading', message: 'Đang quét model khả dụng...' } };
  updateProviderScanStatus(provider);
  providerScanTimers[provider] = setTimeout(() => scanProviderModels(provider, apiKey), 900);
}

async function scanProviderModels(provider, apiKey) {
  const controller = new AbortController();
  providerScanControllers[provider] = controller;
  try {
    const discovered = await discoverProviderModels(provider, apiKey, { signal: controller.signal });
    const settings = getDraftSettings();
    const cfg = settings.crsm.providers[provider];
    cfg.models = mergeDiscoveredModels(cfg.models || [], discovered);
    ensureAssignmentsUseAvailableModel(settings, provider);
    providerScanStatus = {
      ...providerScanStatus,
      [provider]: { type: 'success', message: `Đã quét ${discovered.length} model khả dụng.` }
    };
    updateSaveState();
    replaceSettings('providers');
  } catch (error) {
    if (error?.name === 'AbortError') return;
    providerScanStatus = {
      ...providerScanStatus,
      [provider]: { type: 'error', message: `Không quét được model: ${error?.message || error}` }
    };
    refreshProviderBlock(provider);
  } finally {
    if (providerScanControllers[provider] === controller) providerScanControllers[provider] = null;
  }
}

function refreshProviderBlock(provider) {
  const current = document.querySelector('[data-setting-tab="providers"].active');
  if (current) replaceSettings('providers');
}

function updateProviderScanStatus(provider) {
  const el = document.querySelector(`[data-scan-status="${provider}"]`);
  if (!el) return;
  const status = providerScanStatus[provider];
  el.className = `settings-scan-status ${status?.type || 'muted'}`;
  el.textContent = status?.message || 'Nhập API key để tự quét model khả dụng.';
}

function ensureAssignmentsUseAvailableModel(settings, provider) {
  const models = settings.crsm.providers[provider]?.models || [];
  const firstModel = models[0]?.id || null;
  if (!firstModel) return;
  NODES_LLM.forEach(nodeId => {
    const assignment = settings.crsm.nodeAssignment[nodeId];
    if (assignment?.provider === provider && !models.some(model => model.id === assignment.model)) {
      assignment.model = firstModel;
    }
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
