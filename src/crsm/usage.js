import { crsmState, notifyCRSM } from './state.js';
import { loadSettings } from './settings.js';

export function calculateCost({ provider, model, inputTokens = 0, outputTokens = 0 }) {
  const settings = loadSettings();
  const modelCfg = settings?.crsm?.providers?.[provider]?.models?.find(m => m.id === model);
  const pricing = modelCfg?.pricing;
  if (!pricing) return null;

  return {
    inputCost: (Number(inputTokens) || 0) / 1_000_000 * (Number(pricing.inputPer1M) || 0),
    outputCost: (Number(outputTokens) || 0) / 1_000_000 * (Number(pricing.outputPer1M) || 0),
    currency: pricing.currency || 'USD'
  };
}

export function recordUsage(entry) {
  const inputTokens = entry.inputTokens ?? null;
  const outputTokens = entry.outputTokens ?? null;
  const cost = calculateCost({
    provider: entry.provider,
    model: entry.model,
    inputTokens,
    outputTokens
  });

  crsmState.usage.push({
    nodeId: entry.nodeId,
    provider: entry.provider,
    model: entry.model,
    inputTokens,
    outputTokens,
    inputCost: cost?.inputCost ?? null,
    outputCost: cost?.outputCost ?? null,
    totalCost: cost ? cost.inputCost + cost.outputCost : null,
    currency: cost?.currency || 'USD',
    startedAt: entry.startedAt ?? null,
    durationMs: entry.durationMs ?? null
  });
  notifyCRSM();
}

export function clearUsage() {
  crsmState.usage = [];
}

export function totalUsage() {
  return crsmState.usage.reduce(
    (acc, u) => {
      acc.input += u.inputTokens || 0;
      acc.output += u.outputTokens || 0;
      acc.cost += u.totalCost || 0;
      return acc;
    },
    { input: 0, output: 0, cost: 0 }
  );
}

export function usageByNode(usage = crsmState.usage) {
  const map = {};
  usage.forEach(u => {
    const row = map[u.nodeId] || {
      nodeId: u.nodeId,
      runs: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCost: 0
    };
    row.runs += 1;
    row.inputTokens += u.inputTokens || 0;
    row.outputTokens += u.outputTokens || 0;
    row.totalCost += u.totalCost || 0;
    map[u.nodeId] = row;
  });
  return Object.values(map);
}
