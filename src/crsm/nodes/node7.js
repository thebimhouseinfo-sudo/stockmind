import { currentDateDDMMYYYY } from './common.js';

const STORAGE_KEY = 'stock-mind.crsm.log.v1';

export async function node7(ctx) {
  const node5 = ctx.outputs.node5 || {};
  const node1 = ctx.outputs.node1 || {};
  const screeningSummary = node1.screening_summary || {};
  const isScreened = ctx.mode === 'SCREENED';

  const row = {
    date: currentDateDDMMYYYY(),
    ticker: ctx.ticker,
    mode: ctx.mode,
    price_at_analysis: node1.market_data?.price?.value ?? null,
    screen_score: isScreened ? screeningSummary.screen_score : null,
    screen_rank: isScreened ? screeningSummary.screen_rank : null,
    screen_grade: isScreened ? screeningSummary.screen_grade : null,
    decision: node5.decision ?? null,
    ai_score: node5.ai_score?.value ?? null,
    confidence: node5.confidence?.value ?? null,
    score_difference: node5.screen_vs_crsm?.score_difference ?? null,
    status: node5.screen_vs_crsm?.status ?? null,
    entry_zone: node5.strategy?.entry_zone ?? null,
    trading_stop: node5.trading_stop?.price ?? null,
    tp1: node5.strategy?.tp1 ?? null,
    tp2: node5.strategy?.tp2 ?? null,
    thesis_invalidation: node5.thesis_invalidation ?? null
  };

  const log = loadLog();
  log.rows = log.rows || [];
  log.rows.push(row);
  appendLog(log);

  return { row, totalRows: log.rows.length };
}

export function loadLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { rows: [] };
  } catch {
    return { rows: [] };
  }
}

export function clearLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function appendLog(log) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // quota — best effort
  }
}