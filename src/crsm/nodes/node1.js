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

## Trusted screener rule
In SCREENED mode, TradingView / StockScreener values in SCREENING_CONTEXT.trusted_screener_snapshot are already verified user-provided inputs. Carry them forward unchanged and spend search effort only on missing fields, additional raw financial data, and anomaly signals requested by verification_request.

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
    parsed.screening_metrics = buildScreeningMetrics(ctx.screeningContext);
    parsed.screening_summary = ctx.screeningContext.screening_summary;
    parsed.trusted_screener_snapshot = buildTrustedScreenerSnapshot(ctx.screeningContext);
    parsed.data_integrity = ctx.screeningContext.data_integrity;
    parsed.screening_as_of = ctx.screeningContext.screening_as_of;
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
    screening_summary: summary,
    screening_metrics: buildScreeningMetrics(context),
    trusted_screener_snapshot: buildTrustedScreenerSnapshot(context),
    data_integrity: context.data_integrity,
    verification_request: context.verification_request
  };
}

function buildScreeningMetrics(context) {
  if (context.source === 'StockScreenerV2') {
    return {
      raw_metrics: context.raw_metrics ?? {},
      factors: context.factors ?? {},
      axes: context.axes ?? {},
      risk_gate: context.risk_gate ?? {},
      classification: context.classification ?? {},
      price_dislocation: context.price_dislocation ?? {},
      momentum_volume: context.momentum_volume ?? {},
      ranking: context.ranking ?? null
    };
  }

  return {
    ...(context.metrics ?? {}),
    industry_benchmarks: context.industry_benchmarks ?? {}
  };
}

function buildTrustedScreenerSnapshot(context) {
  if (context.source === 'StockScreenerV2') {
    return {
      source: context.source,
      registry: context.registry ?? null,
      ticker: context.ticker,
      industry: context.industry,
      screening_as_of: context.screening_as_of,
      screening_summary: context.screening_summary ?? null,
      raw_metrics: context.raw_metrics ?? {},
      factors: context.factors ?? {},
      axes: context.axes ?? {},
      risk_gate: context.risk_gate ?? {},
      classification: context.classification ?? {},
      price_dislocation: context.price_dislocation ?? {},
      momentum_volume: context.momentum_volume ?? {},
      ranking: context.ranking ?? null,
      data_integrity: context.data_integrity ?? null
    };
  }

  return {
    source: context.source,
    ticker: context.ticker,
    industry: context.industry,
    screening_as_of: context.screening_as_of,
    screening_summary: context.screening_summary ?? null,
    metrics: context.metrics ?? {},
    industry_benchmarks: context.industry_benchmarks ?? {},
    data_integrity: context.data_integrity ?? null
  };
}
