import { runLLM } from '../llm.js';
import { node1Prompt } from '../prompts/node1.js';
import { detectSectorType, currentDateDDMMYYYY } from './common.js';
import { extractJson, validateJsonObject } from './json.js';

const SCREENING_FIELD_LABELS = {
  price: 'price',
  pe: 'pe_ttm',
  peg: 'PEG',
  roe: 'ROE',
  roic: 'ROIC',
  revenue_growth: 'revenue_growth',
  eps_growth: 'eps_growth',
  debt_ratio: 'debt_ratio',
  return_1m: 'return_1m',
  return_3m: 'return_3m',
  return_6m: 'return_6m',
  return_12m: 'return_12m'
};

function missingScreeningFields(screeningContext) {
  const metrics = screeningContext?.metrics;
  if (!metrics || typeof metrics !== 'object') return [];
  return Object.entries(SCREENING_FIELD_LABELS)
    .filter(([key]) => metrics[key] == null || metrics[key] === '')
    .map(([, label]) => label);
}

export async function node1(ctx) {
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);
  ctx.sectorType = sectorType;

  const screeningJSON = ctx.screeningContext
    ? JSON.stringify(ctx.screeningContext, null, 2)
    : 'null';
  const analysisMode = ctx.screeningContext ? 'SCREENED' : 'DIRECT';
  const missingFields = missingScreeningFields(ctx.screeningContext);
  const missingInstruction = missingFields.length
    ? `\n\nIMPORTANT — SCREENING DATA GAPS:\nStockScreener did not provide verified values for these screening fields: ${missingFields.join(', ')}. A missing/null screening value is NOT a substitute value and MUST NOT be copied from an industry median, benchmark, estimate, or model assumption. Actively search external sources and primary/company filings to try to verify each missing field. If you still cannot verify a field after a genuine search attempt, return null for that field and list it in data_completion.still_missing. Do not invent or back-solve the value.`
    : '\n\nSCREENING DATA GAPS: None of the core screening fields are missing. Do not spend searches re-verifying supplied values unless a different period/method is specifically required downstream.';

  const userPrompt = `
# CRSM RUN — NODE 1 (Financial Data Verification)

## Runtime inputs for this run
- TICKER: ${ctx.ticker}
- CURRENT_DATE: ${currentDateDDMMYYYY()}
- SECTOR_TYPE: ${sectorType}
- ANALYSIS_MODE: ${analysisMode}
- SCREENING_CONTEXT: ${screeningJSON}
${missingInstruction}

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