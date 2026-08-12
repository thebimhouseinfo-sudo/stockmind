import { runLLM } from '../llm.js';
import { node3Prompt } from '../prompts/node3.js';
import { currentDateDDMMYYYY, detectSectorType } from './common.js';
import { extractJson, validateJsonObject, num } from './json.js';

const DISCONNECT_THRESHOLD = 0.15;

export async function node3(ctx) {
  const node1Output = ctx.outputs.node1 || null;
  const sectorType = detectSectorType(ctx.screeningContext?.industry || ctx.industry);

  const userPrompt = `
# CRSM RUN — NODE 3 (Deep Fundamentals + Peer Comparison)

## Runtime inputs
- TICKER: ${ctx.ticker}
- CURRENT_DATE: ${currentDateDDMMYYYY()}
- SECTOR_TYPE: ${sectorType}
- ANALYSIS_MODE: ${ctx.screeningContext ? 'SCREENED' : 'DIRECT'}
- Node 1 JSON (financial_core_raw, cost_of_capital_raw_inputs, screening_metrics if SCREENED):
${JSON.stringify(node1Output, null, 2)}

## Task
Execute Node 3 instructions: compute capital efficiency (WACC/ROIC), earnings
quality, sustainability, F/M scores, fair value (DCF + reverse DCF), peer
comparison. If SCREENED, run the screening anomaly checks and fill
screening_flags. Output ONLY the specified JSON object — no explanations, no
markdown fences.
`.trim();

  const result = await runLLM({
    nodeId: 'node3',
    prompt: userPrompt,
    systemInstruction: node3Prompt,
    responseFormat: 'json'
  });

  const parsed = validateJsonObject(extractJson(result.text));
  parsed.ticker = ctx.ticker;

  if (ctx.screeningContext) {
    parsed.screening_flags = injectDisconnectFlag(parsed.screening_flags, ctx.screeningContext);
  }

  return parsed;
}

export function detectEpsRevenueDisconnect(screeningContext) {
  const eps = num(screeningContext?.metrics?.eps_growth);
  const rev = num(screeningContext?.metrics?.revenue_growth);
  if (eps == null || rev == null) return false;
  return Math.abs(eps - rev) > DISCONNECT_THRESHOLD;
}

export function injectDisconnectFlag(screeningFlags, screeningContext) {
  if (!detectEpsRevenueDisconnect(screeningContext)) return screeningFlags || null;

  const flag = {
    flag: 'EPS_REVENUE_DISCONNECT',
    severity: 'HIGH',
    observation: `EPS Growth (${screeningContext.metrics.eps_growth}) chênh lệch lớn so với Revenue Growth (${screeningContext.metrics.revenue_growth}).`,
    investigation_question:
      'Điều gì tạo ra chênh lệch EPS so với doanh thu — margin expansion, one-off gain, financial income hay tax effect?',
    answer: ''
  };

  const flags = Array.isArray(screeningFlags) ? screeningFlags.filter(f => f.flag !== 'EPS_REVENUE_DISCONNECT') : [];
  flags.unshift(flag);
  return flags;
}