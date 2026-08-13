const STORAGE_KEY = 'stock-mind.crsm.settings.v1';

const GEMINI_2_5_PRICING = { inputPer1M: 0.30, outputPer1M: 2.50, currency: 'USD' };
const GEMINI_3_PRICING = { inputPer1M: 0.50, outputPer1M: 3.00, currency: 'USD' };
const OPENAI_GPT5_MINI_PRICING = { inputPer1M: 0.25, outputPer1M: 2.00, currency: 'USD' };
const OPENAI_GPT54_MINI_PRICING = { inputPer1M: 0.75, outputPer1M: 4.50, currency: 'USD' };

const OPENAI_REASONING_MODELS = [
  { id: 'gpt-5-mini', displayName: 'GPT-5 mini', builtin: true, pricing: OPENAI_GPT5_MINI_PRICING, capabilities: { webGrounding: false, structuredOutput: true, reasoning: true } },
  { id: 'gpt-5.4-mini', displayName: 'GPT-5.4 mini', builtin: true, pricing: OPENAI_GPT54_MINI_PRICING, capabilities: { webGrounding: false, structuredOutput: true, reasoning: true } }
];

const OLLAMA_CLOUD_MODELS = [
  { id: 'gpt-oss:120b-cloud', displayName: 'GPT-OSS 120B', builtin: true, pricing: {}, capabilities: { webGrounding: false, structuredOutput: true, reasoning: true } },
  { id: 'minimax-m3:cloud', displayName: 'MiniMax M3', builtin: true, pricing: {}, capabilities: { webGrounding: false, structuredOutput: true, reasoning: true } }
];

const GEMINI_3_FLASH = {
  id: 'gemini-3.0-flash',
  displayName: 'Gemini 3.0 Flash',
  builtin: true,
  pricing: GEMINI_3_PRICING,
  capabilities: { webGrounding: true, structuredOutput: true, reasoning: true }
};

export const DEFAULT_SETTINGS = {
  theme: 'light',
  crsm: {
    // Legacy field kept for migration/backward compatibility. The engine now
    // resolves execution from dependency stages + executionPolicy below.
    executionMode: 'sequential',
    executionPolicy: {
      default: 'auto',
      parallelStages: {
        research: 'auto',
        reports: 'auto'
      }
    },
    costControl: { monthlyBudgetUsd: 50, warningThresholdPct: 80 },
    providers: {
      gemini: {
        apiKey: null,
        models: [
          { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', builtin: true, pricing: GEMINI_2_5_PRICING, capabilities: { webGrounding: true, structuredOutput: true, reasoning: true } },
          GEMINI_3_FLASH
        ]
      },
      openai: { apiKey: null, models: OPENAI_REASONING_MODELS },
      ollamaCloud: { apiKey: null, models: OLLAMA_CLOUD_MODELS }
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
  gemini: { label: 'Gemini', subtitle: 'Web-grounded research layer' },
  openai: { label: 'OpenAI', subtitle: 'Reasoning layer' },
  ollamaCloud: { label: 'Ollama Cloud', subtitle: 'Cloud reasoning alternatives' }
};
export const NODES_LLM = ['node1', 'node2', 'node3', 'node4', 'node5'];
export const NODES_LOCAL = ['node6a', 'node6b', 'node7'];
export const NODES_ALL = [...NODES_LLM, ...NODES_LOCAL];

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw);
    const merged = normalizeModelPricing(mergeSettings(DEFAULT_SETTINGS, parsed));
    ensureBuiltinModels(merged);
    migrateGemini3ModelId(merged);
    if (!merged.crsm.costControl) merged.crsm.costControl = clone(DEFAULT_SETTINGS.crsm.costControl);
    if (!merged.crsm.executionMode) merged.crsm.executionMode = 'sequential';
    if (!merged.crsm.executionPolicy) merged.crsm.executionPolicy = clone(DEFAULT_SETTINGS.crsm.executionPolicy);
    if (!merged.crsm.executionPolicy.default) merged.crsm.executionPolicy.default = 'auto';
    if (!merged.crsm.executionPolicy.parallelStages) {
      merged.crsm.executionPolicy.parallelStages = clone(DEFAULT_SETTINGS.crsm.executionPolicy.parallelStages);
    }
    return merged;
  } catch {
    return clone(DEFAULT_SETTINGS);
  }
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function ensureBuiltinModels(settings) {
  Object.entries(DEFAULT_SETTINGS.crsm.providers).forEach(([providerId, defaultProvider]) => {
    const provider = settings.crsm.providers[providerId];
    if (!provider) return;
    const current = provider.models || [];
    const existing = new Set(current.map(model => model.id));
    const missing = (defaultProvider.models || []).filter(model => model.builtin && !existing.has(model.id));
    if (missing.length) provider.models = [...current, ...clone(missing)];
  });
}

function migrateGemini3ModelId(settings) {
  const provider = settings?.crsm?.providers?.gemini;
  if (!provider) return;
  const stableId = GEMINI_3_FLASH.id;
  const legacyIds = ['gemini-3-flash', 'gemini-3-flash-preview'];
  const models = provider.models || [];
  const existingStable = models.some(model => model.id === stableId);

  provider.models = models.reduce((out, model) => {
    if (!legacyIds.includes(model.id)) {
      out.push(model);
      return out;
    }
    if (!existingStable && !out.some(item => item.id === stableId)) {
      out.push({ ...GEMINI_3_FLASH, ...model, id: stableId, displayName: GEMINI_3_FLASH.displayName, builtin: true });
    }
    return out;
  }, []);

  Object.values(settings.crsm.nodeAssignment || {}).forEach(assignment => {
    if (assignment?.provider === 'gemini' && legacyIds.includes(assignment.model)) assignment.model = stableId;
  });
}

function normalizeModelPricing(settings) {
  Object.entries(DEFAULT_SETTINGS.crsm.providers).forEach(([providerId, defaultProvider]) => {
    const provider = settings.crsm.providers[providerId];
    if (!provider) return;
    const defaults = new Map((defaultProvider.models || []).map(model => [model.id, model]));
    provider.models = (provider.models || []).map(model => {
      const fallback = defaults.get(model.id);
      if (!fallback || model.pricing) return model;
      return { ...model, pricing: clone(fallback.pricing) };
    });
  });
  return settings;
}

export function saveSettings(settings) { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); }

export function mergeSettings(base, override) {
  if (Array.isArray(base)) return override;
  if (typeof base !== 'object' || base === null) return override ?? base;
  const out = { ...base };
  for (const key of Object.keys(base)) if (key in (override || {})) out[key] = mergeDeep(base[key], override[key]);
  return out;
}

function mergeDeep(a, b) {
  if (Array.isArray(a)) return b && Array.isArray(b) ? b : a;
  if (a && typeof a === 'object') {
    const out = { ...a };
    for (const key of Object.keys(a)) if (b && key in b) out[key] = mergeDeep(a[key], b[key]);
    for (const key of Object.keys(b || {})) if (!(key in a)) out[key] = b[key];
    return out;
  }
  return b !== undefined && b !== null ? b : a;
}

export function getProviderConfig(settings, providerId) { return settings?.crsm?.providers?.[providerId] || null; }
export function getAssignment(settings, nodeId) { return settings?.crsm?.nodeAssignment?.[nodeId] || null; }

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
    if (a && a.provider === providerId && a.model === modelId) a.model = kept[0].id;
  });
}
