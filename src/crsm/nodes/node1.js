import { runLLM } from '../llm.js';
import { node1Prompt } from '../prompts/node1.js';
import { detectSectorType, currentDateDDMMYYYY } from './common.js';
import { extractJson, validateJsonObject } from './json.js';

export async function node1(ctx) {
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);
  ctx.sectorType = sectorType;

  const screeningJSON = ctx.screeningContext
    ? JSON.stringify(ctx.screeningContext, null, 2)
    : 'null';
  const analysisMode = ctx.screeningContext ? 'SCREENED' : 'DIRECT';

  const userPrompt = `
# CRSM RUN — NODE 1 (Financial Data Verification)

## Runtime inputs for this run
- TICKER: ${ctx.ticker}
- CURRENT_DATE: ${currentDateDDMMYYYY()}
- SECTOR_TYPE: ${sectorType}
- ANALYSIS_MODE: ${analysisMode}
- SCREENING_CONTEXT: ${screeningJSON}

## Task
Execute the Node 1 instructions exactly (DATA COMPLETION mode if SCREENED,
full research mode if DIRECT). Output ONLY the specified JSON object — no
explanatory text, no markdown fences.
`.trim();

  const result = await runLLM({
    nodeId: 'node1',
    prompt: userPrompt,
    systemInstruction: node1Prompt,
    responseFormat: 'json'
  });

  const parsed = validateJsonObject(extractJson(result.text));

  if (ctx.screeningContext) {
    parsed.analysis_mode = 'SCREENED';
    parsed.screening_metrics = {
      ...ctx.screeningContext.metrics,
      industry_benchmarks: ctx.screeningContext.industry_benchmarks
    };
    parsed.ticker = parsed.ticker || ctx.ticker;
  } else {
    parsed.analysis_mode = 'DIRECT';
  }

  return parsed;
}