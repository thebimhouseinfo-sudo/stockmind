import { currentDateDDMMYYYY } from './common.js';

const STORAGE_KEY = 'stock-mind.crsm.log.v1';

// Decision Log stores only the CRSM decision outcome needed for later review/calibration.
// Reference files are read-only; this is the runtime writer consumed by the Reports UI.
const LOG_COLUMNS = [
  'date',
  'ticker',
  'price_at_analysis',
  'decision',
  'ai_score',
  'confidence',
  'entry_zone',
  'trading_stop',
  'tp1',
  'tp2',
  'thesis_invalidation'
];

export async function node7(ctx) {
  const node5 = ctx.outputs.node5 || {};
  const node1 = ctx.outputs.node1 || {};

  const row = {
    date: currentDateDDMMYYYY(),
    ticker: ctx.ticker,
    price_at_analysis: node1.market_data?.price?.value ?? null,
    decision: node5.decision ?? null,
    ai_score: node5.ai_score?.value ?? null,
    confidence: node5.confidence?.value ?? null,
    entry_zone: node5.strategy?.entry_zone ?? null,
    trading_stop: node5.trading_stop?.price ?? null,
    tp1: node5.strategy?.tp1 ?? null,
    tp2: node5.strategy?.tp2 ?? null,
    thesis_invalidation: node5.thesis_invalidation ?? null
  };

  const log = loadLog();
  log.rows = Array.isArray(log.rows) ? log.rows : [];
  log.rows.push(normalizeRow(row));
  appendLog(log);

  return { row: log.rows[log.rows.length - 1], totalRows: log.rows.length };
}

export function loadLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : { rows: [] };
    return { rows: Array.isArray(parsed?.rows) ? parsed.rows.map(normalizeRow) : [] };
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

function normalizeRow(row = {}) {
  const normalized = {};
  for (const key of LOG_COLUMNS) normalized[key] = row[key] ?? null;
  return normalized;
}

function appendLog(log) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // quota — best effort
  }
}