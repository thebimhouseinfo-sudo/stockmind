import { runLLM } from '../llm.js';
import { node2Prompt } from '../prompts/node2.js';
import { currentDateDDMMYYYY, detectSectorType } from './common.js';
import { extractJson, validateJsonObject } from './json.js';

export async function node2(ctx) {
  const node1Output = ctx.outputs.node1 || null;
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);

  const userPrompt = `
# CRSM RUN — NODE 2 (Technical & Smart Money)

## Runtime inputs
- TICKER: ${ctx.ticker}
- CURRENT_DATE: ${currentDateDDMMYYYY()}
- SECTOR_TYPE: ${sectorType}
- ANALYSIS_MODE: ${ctx.screeningContext ? 'SCREENED' : 'DIRECT'}
- Node 1 JSON (may include screening_metrics if SCREENED):
${JSON.stringify(node1Output, null, 2)}

## Task
Execute Node 2 instructions: fetch your own OHLCV history, run Wyckoff/VSA
analysis, compare with sector benchmark. Output ONLY the specified JSON object —
no explanations, no markdown fences.
`.trim();

  const result = await runLLM({
    nodeId: 'node2',
    prompt: userPrompt,
    systemInstruction: node2Prompt,
    responseFormat: 'json'
  });

  const parsed = validateJsonObject(extractJson(result.text));
  parsed.ticker = ctx.ticker;
  return parsed;
}