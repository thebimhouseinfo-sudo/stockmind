import { runLLM } from '../llm.js';
import { node1Prompt } from '../prompts/node1.js';
import { detectSectorType, currentDateDDMMYYYY } from './common.js';
import { extractJson, validateJsonObject } from './json.js';

export async function node1(ctx) {
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);
  ctx.sectorType = sectorType;

  const screeningPayload = ctx.screeningContext
    ? buildNode1ScreeningPayload(ctx.screeningContext)
    : null;
  const screeningJSON = screeningPayload
    ? JSON.stringify(screeningPayload, null, 2)
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

## Missing-data verification rule
If SCREENING_CONTEXT.data_integrity.missing_fields contains any fields, actively search external sources for those exact stock-level fields. Do not replace a missing value with an industry median, estimate, or inferred/back-solved value. Industry benchmarks are reference-only.

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
    parsed.screening_summary = ctx.screeningContext.screening_summary;
    parsed.data_integrity = ctx.screeningContext.data_integrity;
    parsed.ticker = parsed.ticker || ctx.ticker;
  } else {
    parsed.analysis_mode = 'DIRECT';
  }

  return parsed;
}

function buildNode1ScreeningPayload(context) {
  const summary = context.screening_summary || {};
  return {
    source: context.source,
    ticker: context.ticker,
    industry: context.industry,
    screening_as_of: context.screening_as_of,
    screen_score: summary.screen_score ?? null,
    screen_rank: summary.screen_rank ?? null,
    screen_grade: summary.screen_grade ?? null,
    quality_score: summary.quality_score ?? null,
    growth_score: summary.growth_score ?? null,
    valuation_score: summary.valuation_score ?? null,
    micro_score: summary.micro_score ?? null,
    momentum_score: summary.momentum_score ?? null,
    mispricing_score: summary.opportunity_score ?? null,
    metrics: context.metrics,
    industry_benchmarks: context.industry_benchmarks,
    data_integrity: context.data_integrity,
    verification_request: context.verification_request
  };
}
