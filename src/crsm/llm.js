import { resolveProviderModel } from './router.js';
import { getProvider } from './providers/index.js';
import { loadSettings } from './settings.js';
import { recordUsage } from './usage.js';
import { crsmState, notifyCRSM } from './state.js';

const RATE_LIMIT_RETRIES = 1;
const DEFAULT_RETRY_MS = 8000;
const MAX_RETRY_MS = 30000;

export async function runLLM({ nodeId, prompt, systemInstruction, responseFormat = 'json', signal }) {
  if (!nodeId) throw new Error('runLLM yêu cầu nodeId.');
  const settings = loadSettings();

  const resolved = await resolveProviderModel(nodeId, settings);
  if (resolved.local) throw new Error('Local node không được gọi runLLM.');

  const provider = getProvider(resolved.provider);
  const startedAt = Date.now();

  let text;
  let usage;
  let lastError = null;

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      const result = await provider.generate({
        prompt,
        systemInstruction,
        model: resolved.model,
        apiKey: resolved.apiKey,
        webGrounding: resolved.webGrounding,
        structuredOutput: responseFormat === 'json' && resolved.structuredOutput,
        responseFormat,
        signal
      });
      text = result.text;
      usage = result.usage || {};
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      const detail = error?.message || String(error);
      if (!isRateLimitError(detail) || attempt >= RATE_LIMIT_RETRIES) break;

      const retryMs = Math.min(extractRetryDelayMs(detail) ?? DEFAULT_RETRY_MS, MAX_RETRY_MS);
      crsmState.logRows = [...(crsmState.logRows || []), `⏳ ${nodeId}: quota/rate limit — retry sau ${Math.ceil(retryMs / 1000)}s`];
      notifyCRSM();
      await delay(retryMs, signal);
    }
  }

  if (lastError) {
    const detail = lastError?.message || String(lastError);
    const wrapped = new Error(`[${nodeId}] ${resolved.provider}/${resolved.model}: ${detail}`, { cause: lastError });
    throw wrapped;
  }

  recordUsage({
    nodeId,
    ticker: crsmState.ticker,
    mode: crsmState.mode,
    provider: resolved.provider,
    model: resolved.model,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt
  });

  return { text, usage };
}

function isRateLimitError(message) {
  const value = String(message || '').toLowerCase();
  return value.includes('429') || value.includes('resource_exhausted') || value.includes('rate limit') || value.includes('quota');
}

function extractRetryDelayMs(message) {
  const value = String(message || '');
  const secondsMatch = value.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/i);
  if (secondsMatch) return Number(secondsMatch[1]) * 1000;
  const retryAfterMatch = value.match(/retry(?: after| in)?\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(s|sec|seconds?)/i);
  if (retryAfterMatch) return Number(retryAfterMatch[1]) * 1000;
  return null;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
