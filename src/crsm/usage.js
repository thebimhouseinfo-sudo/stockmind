import { crsmState, notifyCRSM } from './state.js';
import { loadSettings } from './settings.js';

const HISTORY_KEY = 'stock-mind.crsm.usage.v1';
const MAX_HISTORY = 5000;

export function calculateCost({ provider, model, inputTokens = 0, outputTokens = 0 }) {
  const settings = loadSettings();
  const modelCfg = settings?.crsm?.providers?.[provider]?.models?.find(m => m.id === model);
  const pricing = modelCfg?.pricing;
  if (!pricing || pricing.inputPer1M == null || pricing.outputPer1M == null) return null;

  return {
    inputCost: (Number(inputTokens) || 0) / 1_000_000 * (Number(pricing.inputPer1M) || 0),
    outputCost: (Number(outputTokens) || 0) / 1_000_000 * (Number(pricing.outputPer1M) || 0),
    currency: pricing.currency || 'USD'
  };
}

export function recordUsage(entry) {
  const inputTokens = entry.inputTokens ?? null;
  const outputTokens = entry.outputTokens ?? null;
  const cost = calculateCost({ provider: entry.provider, model: entry.model, inputTokens, outputTokens });
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nodeId: entry.nodeId,
    ticker: entry.ticker || crsmState.ticker || null,
    mode: entry.mode || crsmState.mode || null,
    provider: entry.provider,
    model: entry.model,
    inputTokens,
    outputTokens,
    inputCost: cost?.inputCost ?? null,
    outputCost: cost?.outputCost ?? null,
    totalCost: cost ? cost.inputCost + cost.outputCost : null,
    currency: cost?.currency || 'USD',
    startedAt: entry.startedAt ?? null,
    durationMs: entry.durationMs ?? null,
    recordedAt: new Date().toISOString()
  };

  crsmState.usage.push(row);
  persistUsage(row);
  notifyCRSM();
}

function persistUsage(row) {
  try {
    const history = loadUsageHistory();
    history.push(row);
    const trimmed = history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // History is observability only; never break a CRSM run.
  }
}

export function loadUsageHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function clearUsageHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function filterUsageHistory(period = '7d', now = new Date()) {
  const rows = loadUsageHistory();
  if (period === 'all') return rows;
  const days = period === 'today' ? 1 : period === '30d' ? 30 : 7;
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return rows.filter(row => new Date(row.recordedAt || row.startedAt || 0) >= cutoff);
}

export function usageSummary(rows = crsmState.usage) {
  return rows.reduce((acc, u) => {
    acc.requests += 1;
    acc.input += u.inputTokens || 0;
    acc.output += u.outputTokens || 0;
    acc.cost += u.totalCost || 0;
    return acc;
  }, { requests: 0, input: 0, output: 0, cost: 0 });
}

export function totalUsage() {
  const summary = usageSummary(crsmState.usage);
  return { input: summary.input, output: summary.output, cost: summary.cost };
}

export function usageByNode(usage = crsmState.usage) {
  const map = {};
  usage.forEach(u => {
    const row = map[u.nodeId] || { nodeId: u.nodeId, runs: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 };
    row.runs += 1;
    row.inputTokens += u.inputTokens || 0;
    row.outputTokens += u.outputTokens || 0;
    row.totalCost += u.totalCost || 0;
    map[u.nodeId] = row;
  });
  return Object.values(map);
}

export function usageByModel(usage = crsmState.usage) {
  const map = {};
  usage.forEach(u => {
    const key = `${u.provider}:${u.model}`;
    const row = map[key] || { provider: u.provider, model: u.model, runs: 0, inputTokens: 0, outputTokens: 0, totalCost: 0 };
    row.runs += 1;
    row.inputTokens += u.inputTokens || 0;
    row.outputTokens += u.outputTokens || 0;
    row.totalCost += u.totalCost || 0;
    map[key] = row;
  });
  return Object.values(map).sort((a, b) => b.totalCost - a.totalCost);
}
