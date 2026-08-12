import { todayISODate } from './context.js';
import { loadSettings } from './settings.js';

const STORAGE_KEY = 'stock-mind.crsm.cache.v3';
const CACHE_VERSION = 'crsm-v3';
const DEFAULT_OVERRIDES = null;

function configFingerprint() {
  const settings = loadSettings();
  const assignments = settings?.crsm?.nodeAssignment || {};
  const providers = settings?.crsm?.providers || {};
  const executionMode = settings?.crsm?.executionMode || 'sequential';
  const relevant = Object.keys(assignments).sort().map(nodeId => {
    const a = assignments[nodeId] || {};
    const model = providers?.[a.provider]?.models?.find(m => m.id === a.model);
    return {
      nodeId,
      provider: a.provider,
      model: a.model,
      enabled: a.enabled !== false,
      capabilities: model?.capabilities || {},
      pricing: model?.pricing || {},
      executionMode
    };
  });
  return simpleHash(JSON.stringify(relevant));
}

function simpleHash(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function cacheKey({ mode, ticker }) {
  const date = todayISODate();
  const fingerprint = configFingerprint();
  return `${CACHE_VERSION}:${fingerprint}:${mode}:${String(ticker).toUpperCase()}:${date}`;
}

export function cacheGet({ mode, ticker }) {
  return loadCache()[cacheKey({ mode, ticker })] || null;
}

export function cacheSet({ mode, ticker }, outputs) {
  if (DEFAULT_OVERRIDES === 'disable') return;
  const cache = loadCache();
  cache[cacheKey({ mode, ticker })] = {
    ...outputs,
    completedAt: new Date().toISOString(),
    cacheVersion: CACHE_VERSION,
    configFingerprint: configFingerprint()
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    localStorage.removeItem('stock-mind.crsm.cache.v2');
  } catch {
    // Quota exceeded — bỏ qua, không làm hỏng run hiện tại
  }
}

export function cacheClear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('stock-mind.crsm.cache.v2');
    localStorage.removeItem('stock-mind.crsm.cache.v1');
  } catch {
    // ignore
  }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
