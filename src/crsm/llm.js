import { resolveProviderModel } from './router.js';
import { getProvider } from './providers/index.js';
import { loadSettings } from './settings.js';
import { recordUsage } from './usage.js';

export async function runLLM({ nodeId, prompt, systemInstruction, responseFormat = 'json', signal }) {
  if (!nodeId) throw new Error('runLLM yêu cầu nodeId.');
  const settings = loadSettings();

  const resolved = await resolveProviderModel(nodeId, settings);
  if (resolved.local) throw new Error('Local node không được gọi runLLM.');

  const provider = getProvider(resolved.provider);
  const startedAt = Date.now();

  let text;
  let usage;
  try {
    const result = await provider.generate({
      prompt,
      systemInstruction,
      model: resolved.model,
      apiKey: resolved.apiKey,
      webGrounding: resolved.webGrounding,
      structuredOutput: resolved.structuredOutput,
      responseFormat,
      signal
    });
    text = result.text;
    usage = result.usage || {};
  } catch (error) {
    const wrapped = new Error(`[${nodeId}] ${error?.message || error}`, { cause: error });
    throw wrapped;
  }

  recordUsage({
    nodeId,
    provider: resolved.provider,
    model: resolved.model,
    inputTokens: usage.inputTokens ?? null,
    outputTokens: usage.outputTokens ?? null,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt
  });

  return { text, usage };
}