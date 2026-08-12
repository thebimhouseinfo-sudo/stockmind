import { crsmState, notifyCRSM } from './state.js';

export function recordUsage(entry) {
  crsmState.usage.push({
    nodeId: entry.nodeId,
    provider: entry.provider,
    model: entry.model,
    inputTokens: entry.inputTokens ?? null,
    outputTokens: entry.outputTokens ?? null,
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
      return acc;
    },
    { input: 0, output: 0 }
  );
}