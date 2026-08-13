import { runLLM } from '../llm.js';
import { node5Prompt } from '../prompts/node5.js';
import { currentDateDDMMYYYY, detectSectorType } from './common.js';
import { extractJson, validateJsonObject, num } from './json.js';

const NODE5_LOCALIZATION_INSTRUCTION = `

# DOWNSTREAM REPORT LANGUAGE NORMALIZATION — REQUIRED
Node 5 is the final semantic normalization layer before the report/log nodes.
Keep all existing scoring, decision, formulas, machine enums, numeric values,
source names, tickers, dates and field structure unchanged.

In addition to the normal Node 5 JSON fields, add a top-level object named
\`localized_upstream\`. It is a translation map for human-facing content from
Node 1–4 that downstream Node 6A, Node 6B and Node 7 may display.

Rules for \`localized_upstream\`:
1. Keys are exact source paths such as \`node4.macro_view\` or
   \`node3.moat\`.
2. Translate human-readable English text into natural, concise Vietnamese.
3. Preserve the original meaning, numbers, units, dates, caveats and uncertainty.
4. Do NOT translate ticker symbols, source names, URLs, formulas, numeric values,
   field identifiers, or machine-control enums such as BUY/HOLD/SELL,
   CONFIRMED/PARTIAL/DIVERGENT.
5. If a source value is already Vietnamese, keep it unchanged.
6. For arrays of prose, return an array with each item translated.
7. Do not invent missing data. Omit a key when the source field is null/missing.
8. Cover all human-facing prose fields from Node 1–4 that are likely to appear
   in the report, especially macro_view, sector/trend/volume descriptions,
   smart-money commentary, earnings-quality flags/reasoning, moat, valuation
   commentary, causal-chain text, scenario conditions/descriptions, and other
   narrative fields used by Node 6A/6B.

The localization map is presentation data only. It MUST NOT affect the six-factor
score, confidence calculation, conflict detector, decision, or any numeric output.
`;

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
    systemInstruction: `${node5Prompt}${NODE5_LOCALIZATION_INSTRUCTION}`,
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