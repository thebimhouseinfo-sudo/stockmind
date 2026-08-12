import { todayISODate } from './context.js';

const STORAGE_KEY = 'stock-mind.crsm.cache.v1';

const DEFAULT_OVERRIDES = null;

export function cacheKey({ mode, ticker }) {
  if (mode === 'SCREENED') return `SCREENED:${ticker}:${todayISODate()}`;
  return `DIRECT:${ticker}:${todayISODate()}`;
}

export function cacheGet({ mode, ticker }) {
  return loadCache()[cacheKey({ mode, ticker })] || null;
}

export function cacheSet({ mode, ticker }, outputs) {
  if (DEFAULT_OVERRIDES === 'disable') return;
  const cache = loadCache();
  cache[cacheKey({ mode, ticker })] = { ...outputs, completedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded — bỏ qua, không làm hỏng run hiện tại
  }
}

export function cacheClear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
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