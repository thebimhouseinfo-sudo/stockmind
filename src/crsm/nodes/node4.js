import { runLLM } from '../llm.js';
import { node4Prompt } from '../prompts/node4.js';
import { currentDateDDMMYYYY, detectSectorType } from './common.js';
import { extractJson, validateJsonObject } from './json.js';

export async function node4(ctx) {
  const node1Output = ctx.outputs.node1 || null;
  const node2Output = ctx.outputs.node2 || null;
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);

  const userPrompt = `
# CRSM RUN — NODE 4 (Macro Intelligence + Causal Inference)

## Runtime inputs
- TICKER: ${ctx.ticker}
- CURRENT_DATE: ${currentDateDDMMYYYY()}
- SECTOR_TYPE: ${sectorType}
- ANALYSIS_MODE: ${ctx.screeningContext ? 'SCREENED' : 'DIRECT'}
- Industry: ${ctx.screeningContext?.industry || 'unknown'}
- Node 1 JSON (liquidity/events/screening_metrics if SCREENED):
${JSON.stringify(node1Output, null, 2)}
- Node 2 JSON (sector benchmark):
${JSON.stringify(node2Output, null, 2)}

## Task
Execute Node 4 instructions: macro data collection (last 7-30 days relative to
current date), company-specific macro sensitivity, causal transmission chains
separating FACT / INFERENCE / ASSUMPTION, risk scenarios. Never use screen
scores as macro evidence. Output ONLY the specified JSON object — no
explanations, no markdown fences.
`.trim();

  const result = await runLLM({
    nodeId: 'node4',
    prompt: userPrompt,
    systemInstruction: node4Prompt,
    responseFormat: 'json'
  });

  const parsed = validateJsonObject(extractJson(result.text));
  parsed.ticker = ctx.ticker;
  return parsed;
}