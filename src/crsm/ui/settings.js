import { loadSettings, saveSettings, DEFAULT_SETTINGS, PROVIDER_INFO, NODES_LLM, NODES_LOCAL } from '../settings.js';

export function renderSettings() {
  const settings = loadSettings();
  return `
    <div class="panel panel-pad settings-panel">
      <div class="title-row">
        <div><p class="eyebrow">CRSM Settings</p><h2>Cấu hình model & routing</h2></div>
        <button class="btn" id="crsmSettingsClose">✕ Đóng</button>
      </div>
      ${renderProvidersSection(settings)}
      ${renderAssignmentSection(settings)}
      ${renderLocalSection(settings)}
    </div>`;
}

function renderProvidersSection(settings) {
  const providers = Object.entries(settings.crsm.providers).map(([id, cfg]) => `
    <div class="settings-block" data-provider="${id}">
      <div class="settings-row">
        <strong>${PROVIDER_INFO[id]?.label || id}</strong>
        <label class="settings-label">API Key
          <input type="password" class="search" data-field="apikey" value="${escapeAttr(cfg.apiKey || '')}" placeholder="${id === 'gemini' ? 'AIza...' : 'sk-...'}" autocomplete="off">
        </label>
      </div>
      <div class="settings-models" data-provider="${id}">
        ${(cfg.models || []).map(model => `
          <div class="settings-model">
            <div>
              <strong>${escapeHtml(model.displayName || model.id)}</strong>
              <span class="muted">${escapeHtml(model.id)}${model.builtin ? ' · built-in' : ' · user-declared'}</span>
            </div>
            ${model.builtin ? '' : `<button class="btn danger" data-removemodel="${escapeAttr(model.id)}">Xóa</button>`}
          </div>
        `).join('')}
        ${`<button class="btn" data-addmodel="${id}">+ Add model</button>`}
      </div>
    </div>`).join('');

  return `
    <div class="settings-section">
      <h3>1 · PROVIDERS & MODELS</h3>
      <div class="notice settings-notice">
        ⚠ Khi thêm model tự khai báo, app tin theo capability bạn khai báo. Nếu model thực tế thiếu capability (web grounding, structured output), các node bị block với lý do rõ ràng — không tự thay model.
      </div>
      ${providers}
    </div>`;
}

function renderAssignmentSection(settings) {
  const providerOptions = ['gemini', 'openai', 'ollamaCloud']
    .map(id => `<option value="${id}">${PROVIDER_INFO[id].label}</option>`)
    .join('');

  const rows = NODES_LLM.map(nodeId => {
    const a = settings.crsm.nodeAssignment[nodeId];
    const cfg = settings.crsm.providers[a.provider] || settings.crsm.providers.gemini;
    const modelOptions = (cfg.models || []).map(m => `<option value="${escapeAttr(m.id)}" ${m.id === a.model ? 'selected' : ''}>${escapeHtml(m.displayName || m.id)}</option>`).join('');
    const providerDrop = ['gemini', 'openai', 'ollamaCloud']
      .map(id => `<option value="${id}" ${id === a.provider ? 'selected' : ''}>${PROVIDER_INFO[id].label}</option>`)
      .join('');
    const label = { node1: 'Node 1', node2: 'Node 2', node3: 'Node 3', node4: 'Node 4', node5: 'Node 5' }[nodeId];
    const requirement = {
      node1: 'web grounding + structured output',
      node2: 'web grounding + structured output',
      node3: 'structured output',
      node4: 'web grounding + structured output',
      node5: 'structured output'
    }[nodeId];
    return `
      <div class="settings-row assignment" data-node="${nodeId}">
        <strong>${label}</strong>
        <span class="muted req">${requirement}</span>
        <label class="settings-label">Provider
          <select class="search" data-assign="provider">${providerDrop}</select>
        </label>
        <label class="settings-label">Model
          <select class="search" data-assign="model">${modelOptions}</select>
        </label>
        <label class="settings-check"><input type="checkbox" data-assign="enabled" ${a.enabled !== false ? 'checked' : ''}> bật</label>
      </div>`;
  }).join('');

  return `
    <div class="settings-section">
      <h3>2 · NODE MODEL ASSIGNMENT</h3>
      ${rows}
    </div>`;
}

function renderLocalSection(settings) {
  const rows = {
    node6a: 'HTML Report — local renderer',
    node6b: 'Word Report — local renderer',
    node7: 'Decision log — append-only localStorage'
  };
  const html = Object.entries(rows).map(([id, desc]) => `
    <div class="settings-row local">
      <strong>${id.toUpperCase()}</strong>
      <span class="badge grade-b">[Local Renderer]</span>
      <span class="muted">${desc}</span>
    </div>`).join('');
  return `<div class="settings-section"><h3>3 · LOCAL PIPELINE</h3>${html}</div>`;
}

export function bindSettingsEvents() {
  document.querySelectorAll('.settings-panel [data-field="apikey"]').forEach(input => {
    input.addEventListener('change', ev => {
      const provider = ev.target.closest('[data-provider]')?.dataset.provider;
      if (!provider) return;
      const settings = loadSettings();
      settings.crsm.providers[provider].apiKey = ev.target.value.trim() || null;
      saveSettings(settings);
    });
  });

  document.querySelectorAll('.settings-panel [data-addmodel]').forEach(btn => {
    btn.addEventListener('click', ev => {
      const provider = ev.target.dataset.addmodel;
      const displayName = prompt(`Model ID cho ${PROVIDER_INFO[provider]?.label || provider}:`);
      if (!displayName || !displayName.trim()) return;
      const id = displayName.trim();
      if (!id) return;
      const hasGrounding = confirm(`${id} — model này hỗ trợ web grounding? Chọn OK nếu CÓ, Cancel nếu KHÔNG.`);
      const settings = loadSettings();
      settings.crsm.providers[provider].models = settings.crsm.providers[provider].models || [];
      settings.crsm.providers[provider].models.push({
        id,
        displayName: id,
        builtin: false,
        capabilities: { webGrounding: hasGrounding, structuredOutput: true, reasoning: false }
      });
      saveSettings(settings);
      const panel = document.querySelector('.settings-panel');
      if (panel) panel.outerHTML = renderSettings();
      bindSettingsEvents();
    });
  });

  document.querySelectorAll('.settings-panel [data-removemodel]').forEach(btn => {
    btn.addEventListener('click', ev => {
      const modelId = ev.target.dataset.removemodel;
      const provider = ev.target.closest('[data-provider]')?.dataset.provider;
      const settings = loadSettings();
      settings.crsm.providers[provider].models = (settings.crsm.providers[provider].models || []).filter(m => m.id !== modelId);
      saveSettings(settings);
      const panel = document.querySelector('.settings-panel');
      if (panel) panel.outerHTML = renderSettings();
      bindSettingsEvents();
    });
  });

  document.querySelectorAll('.settings-panel [data-assign]').forEach(ctl => {
    ctl.addEventListener('change', ev => {
      const row = ev.target.closest('[data-node]');
      const nodeId = row?.dataset.node;
      if (!nodeId) return;
      const field = ev.target.dataset.assign;
      const settings = loadSettings();
      const a = settings.crsm.nodeAssignment[nodeId];
      if (field === 'provider') {
        a.provider = ev.target.value;
        const cfg = settings.crsm.providers[a.provider];
        a.model = (cfg.models && cfg.models[0]?.id) || null;
      } else if (field === 'model') {
        a.model = ev.target.value;
      } else if (field === 'enabled') {
        a.enabled = ev.target.checked;
      }
      saveSettings(settings);
      const panel = document.querySelector('.settings-panel');
      if (panel) panel.outerHTML = renderSettings();
      bindSettingsEvents();
    });
  });

  const close = document.getElementById('crsmSettingsClose');
  if (close) {
    close.addEventListener('click', () => {
      const panel = document.querySelector('.settings-panel');
      if (panel) panel.outerHTML = '';
    });
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}