import { loadSettings, saveSettings, PROVIDER_INFO, NODES_LLM, NODES_LOCAL } from '../settings.js';
import { crsmState } from '../state.js';
import { totalUsage, usageByNode } from '../usage.js';

const TAB_DEFS = [
  ['models', 'Models'],
  ['nodes', 'Nodes'],
  ['usage', 'Usage'],
  ['cost', 'Cost']
];

export function renderSettings(activeTab = 'models') {
  const settings = loadSettings();
  const active = TAB_DEFS.some(([id]) => id === activeTab) ? activeTab : 'models';
  return `
    <div class="panel panel-pad settings-panel">
      <div class="title-row">
        <div><p class="eyebrow">CRSM Control Center</p><h2>Cấu hình & theo dõi hệ thống</h2></div>
        <button class="btn" id="crsmSettingsClose">✕ Đóng</button>
      </div>
      <div class="settings-tabs" role="tablist">
        ${TAB_DEFS.map(([id, label]) => `<button class="settings-tab ${id === active ? 'active' : ''}" data-setting-tab="${id}" role="tab">${label}</button>`).join('')}
      </div>
      <div class="settings-tab-content">
        ${active === 'models' ? renderModelsTab(settings) : ''}
        ${active === 'nodes' ? renderNodesTab(settings) : ''}
        ${active === 'usage' ? renderUsageTab() : ''}
        ${active === 'cost' ? renderCostTab() : ''}
      </div>
    </div>`;
}

function renderModelsTab(settings) {
  const providers = Object.entries(settings.crsm.providers).map(([id, cfg]) => `
    <div class="settings-block" data-provider="${id}">
      <div class="settings-row">
        <div><strong>${PROVIDER_INFO[id]?.label || id}</strong><div class="muted settings-caption">API provider</div></div>
        <label class="settings-label">API Key
          <input type="password" class="search" data-field="apikey" value="${escapeAttr(cfg.apiKey || '')}" placeholder="API key" autocomplete="off">
        </label>
      </div>
      <div class="settings-models">
        ${(cfg.models || []).map(model => renderModelRow(id, model)).join('')}
        <button class="btn" data-addmodel="${id}">+ Add model</button>
      </div>
    </div>`).join('');

  return `
    <div class="settings-section">
      <div class="settings-section-head"><div><h3>PROVIDERS & MODELS</h3><p class="muted">API key và danh sách model dùng bởi CRSM.</p></div></div>
      <div class="notice settings-notice">Model có capability không phù hợp sẽ bị router chặn trước khi gọi API.</div>
      ${providers}
    </div>`;
}

function renderModelRow(provider, model) {
  const p = model.pricing || {};
  return `
    <div class="settings-model">
      <div>
        <strong>${escapeHtml(model.displayName || model.id)}</strong>
        <span class="muted">${escapeHtml(model.id)}${model.builtin ? ' · built-in' : ' · user-declared'}</span>
        <span class="settings-mini">${p.inputPer1M != null ? `$${p.inputPer1M}/M in · $${p.outputPer1M}/M out` : 'Chưa có giá'}</span>
      </div>
      ${model.builtin ? '' : `<button class="btn danger" data-removemodel="${escapeAttr(model.id)}">Xóa</button>`}
    </div>`;
}

function renderNodesTab(settings) {
  const rows = NODES_LLM.map(nodeId => {
    const a = settings.crsm.nodeAssignment[nodeId];
    const label = { node1: 'Node 1', node2: 'Node 2', node3: 'Node 3', node4: 'Node 4', node5: 'Node 5' }[nodeId];
    const requirement = { node1: 'web grounding + JSON', node2: 'web grounding + JSON', node3: 'JSON', node4: 'web grounding + JSON', node5: 'JSON' }[nodeId];
    const providerDrop = Object.keys(PROVIDER_INFO).map(id => `<option value="${id}" ${id === a.provider ? 'selected' : ''}>${PROVIDER_INFO[id].label}</option>`).join('');
    const cfg = settings.crsm.providers[a.provider] || { models: [] };
    const modelOptions = (cfg.models || []).map(m => `<option value="${escapeAttr(m.id)}" ${m.id === a.model ? 'selected' : ''}>${escapeHtml(m.displayName || m.id)}</option>`).join('');
    return `
      <div class="settings-row assignment" data-node="${nodeId}">
        <div class="assignment-title"><strong>${label}</strong><span class="muted">${requirement}</span></div>
        <label class="settings-label">Provider<select class="search" data-assign="provider">${providerDrop}</select></label>
        <label class="settings-label">Model<select class="search" data-assign="model">${modelOptions}</select></label>
        <label class="settings-check"><input type="checkbox" data-assign="enabled" ${a.enabled !== false ? 'checked' : ''}> bật</label>
      </div>`;
  }).join('');

  return `<div class="settings-section"><h3>NODE MODEL ASSIGNMENT</h3><p class="muted">Mỗi node có thể dùng provider/model riêng.</p>${rows}<div class="settings-section local-section"><h3>LOCAL PIPELINE</h3>${renderLocalSection()}</div></div>`;
}

function renderLocalSection() {
  const rows = {
    node6a: 'HTML Report — local renderer',
    node6b: 'Word Report — local renderer',
    node7: 'Decision log — local'
  };
  return Object.entries(rows).map(([id, desc]) => `<div class="settings-row local"><strong>${id.toUpperCase()}</strong><span class="badge grade-b">LOCAL</span><span class="muted">${desc}</span></div>`).join('');
}

function renderUsageTab() {
  const rows = crsmState.usage || [];
  const total = totalUsage();
  const byNode = usageByNode(rows);
  return `
    <div class="settings-section">
      <div class="settings-section-head"><div><h3>USAGE</h3><p class="muted">Thông số của lần CRSM hiện tại.</p></div><button class="btn" id="crsmClearUsage">Xóa dữ liệu</button></div>
      <div class="grid metrics settings-metrics">
        ${metric('Requests', rows.length)}
        ${metric('Input tokens', formatNumber(total.input))}
        ${metric('Output tokens', formatNumber(total.output))}
        ${metric('Total tokens', formatNumber(total.input + total.output))}
      </div>
      ${rows.length ? `<div class="table-wrap"><table><thead><tr><th>Node</th><th>Provider</th><th>Model</th><th>Input</th><th>Output</th><th>Time</th></tr></thead><tbody>${rows.map(u => `<tr><td>${u.nodeId}</td><td>${u.provider}</td><td>${u.model}</td><td>${formatNumber(u.inputTokens)}</td><td>${formatNumber(u.outputTokens)}</td><td>${formatDuration(u.durationMs)}</td></tr>`).join('')}</tbody></table></div>` : `<div class="empty-state">Chưa có request nào trong lần chạy này.</div>`}
      ${byNode.length ? `<div class="settings-node-summary">${byNode.map(n => `<div class="settings-summary-row"><strong>${n.nodeId}</strong><span>${n.runs} request</span><span>${formatNumber(n.inputTokens + n.outputTokens)} tokens</span></div>`).join('')}</div>` : ''}
    </div>`;
}

function renderCostTab() {
  const rows = crsmState.usage || [];
  const total = totalUsage();
  const byNode = usageByNode(rows);
  const known = rows.some(u => u.totalCost != null);
  return `
    <div class="settings-section">
      <div class="settings-section-head"><div><h3>COST MONITOR</h3><p class="muted">Chi phí ước tính từ token usage và bảng giá của model.</p></div></div>
      <div class="grid metrics settings-metrics">
        ${metric('Current run', formatCost(total.cost))}
        ${metric('Requests', rows.length)}
        ${metric('Avg / request', rows.length ? formatCost(total.cost / rows.length) : '$0.00')}
        ${metric('Total tokens', formatNumber(total.input + total.output))}
      </div>
      ${!known && rows.length ? `<div class="notice settings-notice">Một hoặc nhiều model chưa có bảng giá. Hãy khai báo giá trong model configuration để cost được tính chính xác.</div>` : ''}
      ${byNode.length ? `<div class="cost-node-list">${byNode.map(n => `<div class="cost-node-row"><div><strong>${n.nodeId}</strong><span class="muted">${n.runs} request · ${formatNumber(n.inputTokens + n.outputTokens)} tokens</span></div><strong>${formatCost(n.totalCost)}</strong></div>`).join('')}</div>` : `<div class="empty-state">Chưa có dữ liệu chi phí. Chạy một CRSM analysis để bắt đầu.</div>`}
      <div class="cost-total"><span>TỔNG CRSM RUN</span><strong>${formatCost(total.cost)}</strong></div>
    </div>`;
}

function metric(label, value) {
  return `<div class="panel metric"><p class="metric-label">${label}</p><p class="metric-value settings-metric-value">${value}</p></div>`;
}

export function bindSettingsEvents() {
  document.querySelectorAll('.settings-panel [data-setting-tab]').forEach(btn => btn.addEventListener('click', ev => {
    const panel = document.querySelector('.settings-panel');
    if (!panel) return;
    panel.outerHTML = renderSettings(ev.currentTarget.dataset.settingTab);
    bindSettingsEvents();
  }));

  document.querySelectorAll('.settings-panel [data-field="apikey"]').forEach(input => input.addEventListener('change', ev => {
    const provider = ev.target.closest('[data-provider]')?.dataset.provider;
    if (!provider) return;
    const settings = loadSettings();
    settings.crsm.providers[provider].apiKey = ev.target.value.trim() || null;
    saveSettings(settings);
  }));

  document.querySelectorAll('.settings-panel [data-addmodel]').forEach(btn => btn.addEventListener('click', ev => {
    const provider = ev.target.dataset.addmodel;
    const id = prompt(`Model ID cho ${PROVIDER_INFO[provider]?.label || provider}:`);
    if (!id?.trim()) return;
    const inputPrice = prompt('Input USD / 1M tokens (để trống nếu chưa biết):', '');
    const outputPrice = prompt('Output USD / 1M tokens (để trống nếu chưa biết):', '');
    const hasGrounding = confirm(`${id.trim()} — model hỗ trợ web grounding? OK = Có.`);
    const settings = loadSettings();
    settings.crsm.providers[provider].models = settings.crsm.providers[provider].models || [];
    settings.crsm.providers[provider].models.push({
      id: id.trim(), displayName: id.trim(), builtin: false,
      pricing: { inputPer1M: parsePrice(inputPrice), outputPer1M: parsePrice(outputPrice), currency: 'USD' },
      capabilities: { webGrounding: hasGrounding, structuredOutput: true, reasoning: false }
    });
    saveSettings(settings);
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.outerHTML = renderSettings('models');
    bindSettingsEvents();
  }));

  document.querySelectorAll('.settings-panel [data-removemodel]').forEach(btn => btn.addEventListener('click', ev => {
    const modelId = ev.target.dataset.removemodel;
    const provider = ev.target.closest('[data-provider]')?.dataset.provider;
    const settings = loadSettings();
    settings.crsm.providers[provider].models = (settings.crsm.providers[provider].models || []).filter(m => m.id !== modelId);
    saveSettings(settings);
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.outerHTML = renderSettings('models');
    bindSettingsEvents();
  }));

  document.querySelectorAll('.settings-panel [data-assign]').forEach(ctl => ctl.addEventListener('change', ev => {
    const row = ev.target.closest('[data-node]');
    const nodeId = row?.dataset.node;
    if (!nodeId) return;
    const field = ev.target.dataset.assign;
    const settings = loadSettings();
    const a = settings.crsm.nodeAssignment[nodeId];
    if (field === 'provider') {
      a.provider = ev.target.value;
      a.model = settings.crsm.providers[a.provider]?.models?.[0]?.id || null;
    } else if (field === 'model') a.model = ev.target.value;
    else if (field === 'enabled') a.enabled = ev.target.checked;
    saveSettings(settings);
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.outerHTML = renderSettings('nodes');
    bindSettingsEvents();
  }));

  const clear = document.getElementById('crsmClearUsage');
  if (clear) clear.addEventListener('click', () => {
    crsmState.usage = [];
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.outerHTML = renderSettings('usage');
    bindSettingsEvents();
  });

  const close = document.getElementById('crsmSettingsClose');
  if (close) close.addEventListener('click', () => {
    const panel = document.querySelector('.settings-panel');
    if (panel) panel.outerHTML = '';
  });
}

function parsePrice(value) {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatCost(value) {
  return `$${Number(value || 0).toFixed(4)}`;
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '—';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
