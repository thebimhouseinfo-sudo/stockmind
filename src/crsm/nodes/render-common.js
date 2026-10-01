const MISSING_SHORT = 'Chưa có dữ liệu';

const DECISION_LABELS = Object.freeze({
  BUY: 'MUA',
  SELL: 'BÁN',
  HOLD: 'NẮM GIỮ',
  'BUY ON DIP': 'MUA KHI ĐIỀU CHỈNH',
  WATCH: 'THEO DÕI'
});

export function decisionLabel(value) {
  const normalized = String(value ?? '').trim();
  return DECISION_LABELS[normalized.toUpperCase()] || normalized || MISSING_SHORT;
}

export { MISSING_SHORT };
