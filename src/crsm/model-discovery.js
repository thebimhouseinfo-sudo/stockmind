const GEMINI_LIST_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_LIST_ENDPOINT = 'https://api.openai.com/v1/models';

const KNOWN_PRICING = {
  'gemini-2.5-flash': { inputPer1M: 0.30, outputPer1M: 2.50, currency: 'USD' },
  'gemini-3.0-flash': { inputPer1M: 0.50, outputPer1M: 3.00, currency: 'USD' },
  'gpt-5-mini': { inputPer1M: 0.25, outputPer1M: 2.00, currency: 'USD' },
  'gpt-5.4-mini': { inputPer1M: 0.75, outputPer1M: 4.50, currency: 'USD' }
};

export async function discoverProviderModels(providerId, apiKey, { signal } = {}) {
  const key = String(apiKey || '').trim();
  if (!key) return [];
  if (providerId === 'ollamaCloud') return [];
  if (providerId === 'gemini') return discoverGeminiModels(key, signal);
  if (providerId === 'openai') return discoverOpenAIModels(key, signal);
  throw new Error(`Chưa hỗ trợ tự quét model cho provider: ${providerId}`);
}

export function mergeDiscoveredModels(existingModels = [], discoveredModels = []) {
  const byId = new Map();
  existingModels.filter(model => !model.builtin).forEach(model => byId.set(model.id, model));
  discoveredModels.forEach(model => {
    const current = existingModels.find(item => item.id === model.id) || byId.get(model.id) || {};
    byId.set(model.id, {
      ...current,
      ...model,
      builtin: current.builtin || false,
      pricing: current.pricing || model.pricing || {},
      capabilities: { ...(current.capabilities || {}), ...(model.capabilities || {}) }
    });
  });
  return [...byId.values()].sort((a, b) => String(a.displayName || a.id).localeCompare(String(b.displayName || b.id)));
}

async function discoverGeminiModels(apiKey, signal) {
  const url = `${GEMINI_LIST_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson(url, {}, signal);
  const models = Array.isArray(data.models) ? data.models : [];
  return models
    .filter(model => {
      const methods = model.supportedGenerationMethods || [];
      return methods.includes('generateContent') || methods.includes('streamGenerateContent');
    })
    .map(model => {
      const id = String(model.name || '').replace(/^models\//, '');
      return normalizeModel(id, model.displayName || toDisplayName(id), {
        webGrounding: true,
        structuredOutput: true,
        reasoning: /reason|thinking|pro/i.test(id)
      });
    })
    .filter(model => model.id);
}

async function discoverOpenAIModels(apiKey, signal) {
  const data = await fetchJson(OPENAI_LIST_ENDPOINT, {
    headers: { Authorization: `Bearer ${apiKey}` }
  }, signal);
  const models = Array.isArray(data.data) ? data.data : [];
  return models
    .map(model => String(model.id || '').trim())
    .filter(Boolean)
    .filter(isLikelyOpenAIChatModel)
    .map(id => normalizeModel(id, toDisplayName(id), {
      webGrounding: false,
      structuredOutput: true,
      reasoning: /^o\d|reason|gpt-5/i.test(id)
    }));
}

async function fetchJson(url, options, signal) {
  const res = await fetch(url, { ...options, signal });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const message = data?.error?.message || data?.error || `${res.status} ${res.statusText}`;
    throw new Error(String(message));
  }
  return data || {};
}

function normalizeModel(id, displayName, capabilities) {
  return {
    id,
    displayName,
    builtin: false,
    pricing: KNOWN_PRICING[id] || {},
    capabilities
  };
}

function isLikelyOpenAIChatModel(id) {
  return /^(gpt-|o\d|chatgpt-)/i.test(id) && !/audio|image|transcribe|tts|embedding|moderation|realtime|search|dall-e/i.test(id);
}

function toDisplayName(id) {
  return String(id || '')
    .replace(/^models\//, '')
    .split(/[-_:]/)
    .filter(Boolean)
    .map(part => part.toUpperCase() === part ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
