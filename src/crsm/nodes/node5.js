import { runLLM } from '../llm.js';
import { node5Prompt } from '../prompts/node5.js';
import { currentDateDDMMYYYY, detectSectorType } from './common.js';
import { extractJson, validateJsonObject } from './json.js';

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
   field identifiers, or machine-control enums such as BUY/HOLD/SELL.
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

const NODE5_OWN_LANGUAGE_INSTRUCTION = `

# NODE 5 OUTPUT LANGUAGE — REQUIRED
Every free-text field Node 5 itself writes must be in Vietnamese, because Node
6A, Node 6B and Node 7 display these fields as-is with no further translation
step. This applies to (non-exhaustive, apply the same rule to any other prose
field in the output structure):
- \`ai_score.formula_shown\`
- \`conflict_detector.override_applied\`
- \`catalyst_horizon.nearest_catalyst\`
- \`drivers\` (each item)
- \`thesis_invalidation\`
- \`trading_stop.basis\`
- \`liquidity_note\`
- \`strategy.entry_zone\`, \`strategy.allocation_plan\`, \`strategy.position_size_note\`
- \`full_reasoning\`

You MAY keep finance/technical terminology in its standard English or
abbreviated form where that is how Vietnamese analysts actually write it
(e.g. "P/E", "ROIC", "WACC", "stop-loss", "breakout", "P/B", "FCF yield",
source names like SSI/VNDirect/Bloomberg) — do not force-translate jargon
into awkward Vietnamese. But sentence structure, connecting words and
explanations must be Vietnamese, not English prose.

Do NOT translate the following — they are fixed machine-control enums the
pipeline and Decision Log parse programmatically, and downstream nodes are
responsible for their display translation:
- \`decision\` (BUY / HOLD / SELL / "BUY ON DIP" / WATCH)
- \`conflict_detector.fundamental/technical/macro/liquidity\` (🟢/🟡/🔴)
- \`strategy.position_type\` (Initial / Add-on)
Leave these exactly as specified in the OUTPUT STRUCTURE section.
`;

const NODE5_SCREENING_ROLE_INSTRUCTION = `

# SCREENING CONTEXT ROLE — CURRENT ARCHITECTURE, OVERRIDES LEGACY COMPARISON TEXT
When ANALYSIS_MODE is SCREENED, Screener V2 is candidate-selection context only.
Its score/rank/grade are NOT on the same scale or methodology as CRSM AI Score.
Therefore:
- Do NOT compare CRSM AI Score with any Screener score.
- Do NOT calculate score_difference.
- Do NOT produce CONFIRMED / PARTIAL / DIVERGENT status.
- Do NOT produce a screen_vs_crsm object.
- Screener metrics/signals may still be used as trusted upstream context to investigate facts and risks, but never as a benchmark for the final CRSM score.
If any earlier instruction in the base prompt requests screen_vs_crsm comparison, ignore that instruction; this section is the current architecture rule.
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
final decision with trade strategy. In SCREENED mode, use Screener data only as
candidate-selection/research context; do not compare its score with CRSM AI Score.
Output ONLY the specified JSON object — no explanations, no markdown fences.
`.trim();

  const result = await runLLM({
    nodeId: 'node5',
    prompt: userPrompt,
    systemInstruction: `${node5Prompt}${NODE5_LOCALIZATION_INSTRUCTION}${NODE5_OWN_LANGUAGE_INSTRUCTION}${NODE5_SCREENING_ROLE_INSTRUCTION}`,
    responseFormat: 'json'
  });

  return normalizeNode5ReportOutput(validateJsonObject(extractJson(result.text)), ctx.ticker);
}

export function normalizeNode5ReportOutput(value, ticker = null) {
  const out = value && typeof value === 'object' ? { ...value } : {};
  out.ticker = ticker || out.ticker || null;

  // Legacy screen-vs-CRSM comparison is intentionally removed. Screener V2
  // selects candidates; CRSM owns the deep-analysis score and decision.
  delete out.screen_vs_crsm;

  const conflict = out.conflict_detector && typeof out.conflict_detector === 'object'
    ? { ...out.conflict_detector }
    : {};
  const alignment = conflict.signal_alignment ?? conflict.alignment ?? conflict.signalAlignment ?? null;
  conflict.signal_alignment = alignment;
  // Compatibility alias for fixed/local report renderers that historically read `alignment`.
  conflict.alignment = alignment;
  out.conflict_detector = conflict;

  const catalyst = out.catalyst_horizon && typeof out.catalyst_horizon === 'object'
    ? { ...out.catalyst_horizon }
    : {};
  catalyst.nearest_catalyst = catalyst.nearest_catalyst ?? catalyst.nearestCatalyst ?? catalyst.catalyst ?? '';
  catalyst.bucket = catalyst.bucket ?? catalyst.horizon ?? catalyst.time_bucket ?? '';
  out.catalyst_horizon = catalyst;

  const stop = out.trading_stop && typeof out.trading_stop === 'object'
    ? { ...out.trading_stop }
    : {};
  stop.price = stop.price ?? stop.value ?? stop.stop_price ?? null;
  stop.basis = stop.basis ?? stop.rationale ?? stop.reason ?? '';
  out.trading_stop = stop;

  if (!Array.isArray(out.drivers)) {
    out.drivers = out.drivers == null || out.drivers === '' ? [] : [out.drivers];
  }
  out.drivers = out.drivers.slice(0, 3).map(item => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item ?? '');
    return item.description ?? item.reason ?? item.driver ?? item.value ?? item.name ?? JSON.stringify(item);
  });

  if (!out.localized_upstream || typeof out.localized_upstream !== 'object' || Array.isArray(out.localized_upstream)) {
    out.localized_upstream = {};
  }

  return out;
}
