import { runLLM } from '../llm.js';
import { node5Prompt } from '../prompts/node5.js';
import { currentDateDDMMYYYY, detectSectorType } from './common.js';
import { extractJson, validateJsonObject, num } from './json.js';

export async function node5(ctx) {
  const outputs = ctx.outputs;
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);

  const userPrompt = `
# CRSM RUN — NODE 5 (CIO Decision)

## Runtime inputs
- TICKER: ${ctx.ticker}
- CURRENT_DATE: ${currentDateDDMMYYYY()}
- SECTOR_TYPE: ${sectorType}
- ANALYSIS_MODE: ${ctx.screeningContext ? 'SCREENED' : 'DIRECT'}
- Node 1 JSON: ${JSON.stringify(outputs.node1, null, 2)}
- Node 2 JSON: ${JSON.stringify(outputs.node2, null, 2)}
- Node 3 JSON: ${JSON.stringify(outputs.node3, null, 2)}
- Node 4 JSON: ${JSON.stringify(outputs.node4, null, 2)}

## Task
Execute Node 5 instructions: score the SIX factors with the fixed weights,
compute AI Score (0-100) with formula shown, calculate confidence components,
run the Conflict Detector, catalyst horizon, liquidity check, and produce a
final decision with trade strategy. If SCREENED, compare ai_score against Node 1
screening_summary.screen_score and produce screen_vs_crsm (status derived
exactly from |score_difference| — you may compute it, but it will be
re-verified deterministically). Output ONLY the specified JSON object — no
explanations, no markdown fences.
`.trim();

  const result = await runLLM({
    nodeId: 'node5',
    prompt: userPrompt,
    systemInstruction: node5Prompt,
    responseFormat: 'json'
  });

  const parsed = validateJsonObject(extractJson(result.text));
  parsed.ticker = ctx.ticker;

  if (ctx.screeningContext) {
    const screenScore = num(outputs.node1?.screening_summary?.screen_score ?? ctx.screeningContext.screen_score);
    const crsmScore = num(parsed.ai_score?.value);
    const scoreDifference = crsmScore != null && screenScore != null ? Math.round((crsmScore - screenScore) * 100) / 100 : null;
    const status = deriveStatus(scoreDifference);

    parsed.screen_vs_crsm = {
      screen_score: screenScore,
      crsm_score: crsmScore,
      score_difference: scoreDifference,
      status,
      interpretation:
        typeof parsed.screen_vs_crsm?.interpretation === 'string' ? parsed.screen_vs_crsm.interpretation : ''
    };
  } else {
    parsed.screen_vs_crsm = null;
  }

  return parsed;
}

export function deriveStatus(scoreDifference) {
  if (scoreDifference == null) return null;
  const abs = Math.abs(scoreDifference);
  if (abs <= 5) return 'CONFIRMED';
  if (abs <= 15) return 'PARTIAL';
  return 'DIVERGENT';
}