import { detectSectorType, currentDateDDMMYYYY } from './common.js';

const MISSING_SHORT = 'Chưa có dữ liệu';

export const crsmResult = {};

export function field(path, fallback = MISSING_SHORT) {
  const value = resolvePath(crsmResult, path);
  if (value == null || value === '') return fallback;
  return value;
}

export function setResult(outputs) {
  crsmResult.node1 = outputs.node1 || null;
  crsmResult.node2 = outputs.node2 || null;
  crsmResult.node3 = outputs.node3 || null;
  crsmResult.node4 = outputs.node4 || null;
  crsmResult.node5 = outputs.node5 || null;
  crsmResult.screening = outputs.screeningContext || null;
  crsmResult.mode = outputs.mode || (crsmResult.screening ? 'SCREENED' : 'DIRECT');
  crsmResult.ticker = outputs.ticker || crsmResult.node1?.ticker || '';
  crsmResult.sectorType = outputs.sectorType || detectSectorType(crsmResult.screening?.industry);
  crsmResult.date = currentDateDDMMYYYY();
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

export { MISSING_SHORT };