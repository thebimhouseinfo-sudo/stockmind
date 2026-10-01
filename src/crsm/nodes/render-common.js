import { detectSectorType, currentDateDDMMYYYY } from './common.js';

const MISSING_SHORT = 'Chưa có dữ liệu';

export const crsmResult = {};

export function field(path, fallback = MISSING_SHORT) {
  const value = resolvePath(crsmResult, path);
  if (value == null || value === '') return fallback;
  return value;
}

export function setResult(outputs) {
  const localized = outputs.node5?.localized_upstream || {};

  // Node 5 is the final semantic normalization layer. Apply only the
  // explicit translations supplied by Node 5 to copies of Node 1–4 so the
  // report templates keep their fixed structure while consuming Vietnamese
  // narrative content. Original upstream outputs remain untouched.
  crsmResult.node1 = applyLocalizedValues(outputs.node1 || null, 'node1', localized);
  crsmResult.node2 = applyLocalizedValues(outputs.node2 || null, 'node2', localized);
  crsmResult.node3 = applyLocalizedValues(outputs.node3 || null, 'node3', localized);
  crsmResult.node4 = applyLocalizedValues(outputs.node4 || null, 'node4', localized);
  crsmResult.node5 = outputs.node5 || null;
  crsmResult.screening = outputs.screeningContext || null;
  crsmResult.mode = outputs.mode || (crsmResult.screening ? 'SCREENED' : 'DIRECT');
  crsmResult.ticker = outputs.ticker || crsmResult.node1?.ticker || '';
  crsmResult.sectorType = outputs.sectorType || detectSectorType(crsmResult.screening?.industry);
  crsmResult.date = currentDateDDMMYYYY();
}

function applyLocalizedValues(source, prefix, localized) {
  if (!source || !localized || typeof localized !== 'object') return source;
  const copy = cloneValue(source);

  for (const [path, value] of Object.entries(localized)) {
    if (!path.startsWith(`${prefix}.`)) continue;
    const relativePath = path.slice(prefix.length + 1);
    setPath(copy, relativePath, cloneValue(value));
  }

  return copy;
}

function setPath(target, path, value) {
  if (!target || typeof target !== 'object') return;
  const parts = String(path).split('.').filter(Boolean);
  if (!parts.length) return;

  let cur = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (cur[part] == null || typeof cur[part] !== 'object') {
      cur[part] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
}

function cloneValue(value) {
  if (value == null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

export function resolvePath(obj, path) {
  if (!obj) return null;
  const parts = String(path).split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur == null) return null;
    cur = cur[part];
  }
  return cur;
}

// Node 5's `decision` field is a fixed machine enum (BUY/HOLD/SELL/...), kept in
// English so downstream logic and the Decision Log stay unambiguous. Every
// human-facing renderer (Node 6A HTML, Node 6B Markdown, Decision Log) must
// translate it through this single map rather than displaying it raw.
const DECISION_LABELS = { BUY: 'MUA', SELL: 'BÁN', HOLD: 'NẮM GIỮ', 'BUY ON DIP': 'MUA KHI ĐIỀU CHỈNH', WATCH: 'THEO DÕI' };

export function decisionLabel(value) {
  const v = String(value ?? '').trim();
  return DECISION_LABELS[v.toUpperCase()] || v || MISSING_SHORT;
}

export { MISSING_SHORT };