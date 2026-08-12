const STORAGE_KEY = 'stock-mind.crsm.settings.v1';

export const DEFAULT_SETTINGS = {
  theme: 'light',
  crsm: {
    providers: {
      gemini: {
        apiKey: null,
        models: [
          {
            id: 'gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            builtin: true,
            capabilities: { webGrounding: true, structuredOutput: true, reasoning: true }
          },
          {
            id: 'gemini-3-flash',
            displayName: 'Gemini 3.0 Flash',
            builtin: true,
            capabilities: { webGrounding: true, structuredOutput: true, reasoning: true }
          }
        ]
      },
      openai: { apiKey: null, models: [] },
      ollamaCloud: { apiKey: null, models: [] }
    },
    nodeAssignment: {
      node1: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node2: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node3: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node4: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true },
      node5: { provider: 'gemini', model: 'gemini-2.5-flash', enabled: true }
    }
  }
};

export const PROVIDER_INFO = {
  gemini: { label: 'Gemini' },
  openai: { label: 'OpenAI' },
  ollamaCloud: { label: 'Ollama Cloud' }
};

export const NODES_LLM = ['node1', 'node2', 'node3', 'node4', 'node5'];
export const NODES_LOCAL = ['node6a', 'node6b', 'node7'];
export const NODES_ALL = [...NODES_LLM, ...NODES_LOCAL];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const parsed = JSON.parse(raw);
    return mergeSettings(DEFAULT_SETTINGS, parsed);
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function mergeSettings(base, override) {
  if (Array.isArray(base)) return override;
  if (typeof base !== 'object' || base === null) return override ?? base;
  const out = { ...base };
  for (const key of Object.keys(base)) {
    if (key in override) {
      out[key] = mergeDeep(base[key], override[key]);
    }
  }
  return out;
}

function mergeDeep(a, b) {
  if (Array.isArray(a)) {
    return b && Array.isArray(b) ? b : a;
  }
  if (a && typeof a === 'object') {
    const out = { ...a };
    for (const key of Object.keys(a)) {
      if (b && key in b) out[key] = mergeDeep(a[key], b[key]);
    }
    for (const key of Object.keys(b || {})) {
      if (!(key in a)) out[key] = b[key];
    }
    return out;
  }
  return b !== undefined && b !== null ? b : a;
}

export function getProviderConfig(settings, providerId) {
  return settings?.crsm?.providers?.[providerId] || null;
}

export function getAssignment(settings, nodeId) {
  return settings?.crsm?.nodeAssignment?.[nodeId] || null;
}

export function addModel(settings, providerId, model) {
  const cfg = settings.crsm.providers[providerId];
  if (!cfg) throw new Error(`Provider không tồn tại: ${providerId}`);
  cfg.models = [...(cfg.models || []), model];
}

export function removeModel(settings, providerId, modelId) {
  const cfg = settings.crsm.providers[providerId];
  if (!cfg) return;
  const kept = (cfg.models || []).filter(m => m.id !== modelId);
  cfg.models = kept;
  if (kept.length === 0) return;
  NODES_LLM.forEach(nodeId => {
    const a = settings.crsm.nodeAssignment[nodeId];
    if (a && a.provider === providerId && a.model === modelId) {
      a.model = kept[0].id;
    }
  });
}