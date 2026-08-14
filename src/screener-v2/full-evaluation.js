import { TRI_STATE, USAGE_STATE, isFiniteNumber, round } from './state.js';

const FACTOR_FIELDS = {
  QUALITY: ['roe_ttm', 'roa_ttm', 'operating_margin_ttm', 'net_margin_ttm'],
  GROWTH: ['revenue_growth_annual_yoy', 'revenue_growth_quarterly_yoy', 'eps_dil_growth_ttm_yoy', 'fcf_growth_ttm_yoy'],
  VALUATION: ['pe', 'peg', 'pb', 'ps', 'ev_ebitda'],
  SAFETY: ['debt_equity_fq', 'current_ratio_fq', 'quick_ratio_fq', 'fcf_ttm'],
  MOMENTUM: ['perf_1m', 'perf_3m', 'perf_6m', 'relative_volume']
};

export function evaluateFullScreener(contract, families) {
  const factors = {
    QUALITY: factor('QUALITY', [
      highGood(contract, 'roe_ttm', 0, 25),
      highGood(contract, 'roa_ttm', 0, 12),
      highGood(contract, 'operating_margin_ttm', 0, 25),
      highGood(contract, 'net_margin_ttm', 0, 18)
    ]),
    GROWTH: factor('GROWTH', [
      highGood(contract, 'revenue_growth_annual_yoy', -10, 25),
      highGood(contract, 'revenue_growth_quarterly_yoy', -10, 30),
      highGood(contract, 'eps_dil_growth_ttm_yoy', -10, 30),
      highGood(contract, 'fcf_growth_ttm_yoy', -20, 30)
    ]),
    VALUATION: factor('VALUATION', [
      lowGoodPositive(contract, 'pe', 6, 25),
      lowGoodPositive(contract, 'peg', 0.2, 1.5),
      lowGoodPositive(contract, 'pb', 0.8, 4),
      lowGoodPositive(contract, 'ps', 0.5, 5),
      lowGoodPositive(contract, 'ev_ebitda', 4, 18)
    ]),
    SAFETY: factor('SAFETY', [
      lowGood(contract, 'debt_equity_fq', 0.3, 2.5),
      rangeGood(contract, 'current_ratio_fq', 1, 2.5),
      rangeGood(contract, 'quick_ratio_fq', 0.8, 2),
      signGood(contract, 'fcf_ttm')
    ]),
    MOMENTUM: factor('MOMENTUM', [
      scoreFromValue(families.momentum_volume?.derived?.medium_momentum?.value, -20, 25),
      scoreFromValue(scaleNullable(families.momentum_volume?.derived?.momentum_stack?.value, 100), 0, 100),
      highGood(contract, 'relative_volume', 0.5, 1.8)
    ])
  };

  const axes = {
    QUALITY_AXIS: axis('QUALITY_AXIS', [factors.QUALITY, factors.SAFETY]),
    OPPORTUNITY_AXIS: axis('OPPORTUNITY_AXIS', [factors.GROWTH, factors.MOMENTUM, factors.VALUATION])
  };

  const signals = [...new Set([
    ...Object.values(families).flatMap(family => family?.signals || []),
    ...businessSignals(contract, factors)
  ])];
  const riskGate = buildRiskGate(contract, signals, factors, families);
  const classification = classify(axes, riskGate, signals, factors);

  return {
    factors,
    axes,
    risk_gate: riskGate,
    classification,
    signals,
    registry_note: 'SANDBOX anchors. Replace registry calibration before production use.'
  };
}

export function buildCompositeScore(fullEvaluation) {
  const q = fullEvaluation.axes.QUALITY_AXIS.score;
  const o = fullEvaluation.axes.OPPORTUNITY_AXIS.score;
  if (!isFiniteNumber(q) && !isFiniteNumber(o)) return null;
  if (!isFiniteNumber(q)) return round(o, 2);
  if (!isFiniteNumber(o)) return round(q, 2);
  return round(q * 0.55 + o * 0.45, 2);
}

export function buildRanking(rows) {
  const rankable = rows
    .filter(row => isFiniteNumber(row.FINALSCORE))
    .sort((a, b) => b.FINALSCORE - a.FINALSCORE);
  const total = rankable.length;
  let lastScore = null;
  let lastRank = 0;
  rankable.forEach((row, index) => {
    const rank = row.FINALSCORE === lastScore ? lastRank : index + 1;
    lastScore = row.FINALSCORE;
    lastRank = rank;
    row.RANK = rank;
    row.RANKING_RECORD = {
      ticker: row.TICKER,
      ranking_key: 'COMPOSITE_RANKING',
      raw_score: row.FINALSCORE,
      percentile: total > 1 ? round(100 * (1 - index / (total - 1)), 2) : 100,
      rank_position: rank,
      rank_total: total,
      rankable_denominator: total,
      universe_id: 'displayed-universe-current',
      displayed_universe_id: 'displayed-universe-current',
      tie_policy_version: 'sandbox-shared-rank-v1',
      rankability: 'RANKABLE',
      partial_status: row.DATA_INTEGRITY
    };
  });
  rows.filter(row => !isFiniteNumber(row.FINALSCORE)).forEach(row => {
    row.RANK = null;
    row.RANKING_RECORD = {
      ticker: row.TICKER,
      ranking_key: 'COMPOSITE_RANKING',
      raw_score: null,
      percentile: null,
      rank_position: null,
      rank_total: total,
      rankable_denominator: total,
      universe_id: 'displayed-universe-current',
      displayed_universe_id: 'displayed-universe-current',
      tie_policy_version: 'sandbox-shared-rank-v1',
      rankability: 'UNRANKABLE',
      partial_status: row.DATA_INTEGRITY
    };
  });
  return [...rankable, ...rows.filter(row => !isFiniteNumber(row.FINALSCORE))];
}

function factor(name, scores) {
  const valid = scores.filter(isFiniteNumber);
  const coverage = round(100 * valid.length / scores.length, 2);
  return {
    factor: name,
    score: valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length, 2) : null,
    coverage,
    status: valid.length === scores.length ? 'FULL' : (valid.length ? 'LIMITED' : 'UNAVAILABLE'),
    intended_fields: FACTOR_FIELDS[name] || [],
    available_count: valid.length
  };
}

function axis(name, factors) {
  const valid = factors.filter(item => isFiniteNumber(item.score));
  const weakMembers = valid.filter(item => item.score < 45).map(item => item.factor);
  return {
    axis: name,
    score: valid.length ? round(valid.reduce((sum, item) => sum + item.score, 0) / valid.length, 2) : null,
    coverage: valid.length ? round(valid.reduce((sum, item) => sum + item.coverage, 0) / valid.length, 2) : 0,
    status: valid.length === factors.length ? 'FULL' : (valid.length ? 'LIMITED' : 'UNAVAILABLE'),
    weak_members: weakMembers,
    profile: weakMembers.length ? 'MIXED_WITH_WEAK_MEMBER' : 'BALANCED'
  };
}

function classify(axes, riskGate, signals, factors) {
  if (riskGate.state === 'FAIL') return classObject('AVOID_VALUE_TRAP', 'Hard risk/value-trap gate failed', axes, riskGate);
  const q = axes.QUALITY_AXIS.score;
  const o = axes.OPPORTUNITY_AXIS.score;
  if (!isFiniteNumber(q) || !isFiniteNumber(o)) return classObject('WATCH_NEUTRAL', 'Insufficient axis evidence', axes, riskGate);
  if (q >= 65 && o >= 60 && riskGate.soft_risk_profile.material === TRI_STATE.FALSE) return classObject('CORE', 'Strong quality and opportunity, no material soft risk', axes, riskGate);
  if (q >= 65 && o < 50 && riskGate.state !== 'FAIL') return classObject('QUALITY_UNDERPERFORMER', 'Strong quality with weak current opportunity', axes, riskGate);
  if ((o >= 70 || factors.MOMENTUM.score >= 70) && riskGate.state === 'PASS' && riskGate.soft_risk_profile.material === TRI_STATE.TRUE) return classObject('HIGH_REWARD_HIGH_RISK', 'Strong opportunity with material soft risk', axes, riskGate);
  if (signals.includes('VALUE_TRAP_WARNING')) return classObject('AVOID_VALUE_TRAP', 'Structured value-trap warning', axes, riskGate);
  return classObject('WATCH_NEUTRAL', 'Mixed or unresolved sandbox evidence', axes, riskGate);
}

function classObject(classification, reason, axes, riskGate) {
  return {
    classification,
    classification_version: 'sandbox-classification-v1',
    reason,
    quality_axis: axes.QUALITY_AXIS,
    opportunity_axis: axes.OPPORTUNITY_AXIS,
    risk_state: riskGate.state,
    band_versions: ['sandbox-bands-v1']
  };
}

function buildRiskGate(contract, signals, factors, families) {
  const debt = value(contract, 'debt_equity_fq');
  const current = value(contract, 'current_ratio_fq');
  const fcf = value(contract, 'fcf_ttm');
  const hard = (isFiniteNumber(debt) && debt > 3 && isFiniteNumber(current) && current < 0.8)
    || (isFiniteNumber(fcf) && fcf < 0 && factors.QUALITY.score != null && factors.QUALITY.score < 35);
  const materialSoft = signals.includes('SEVERE_DRAWDOWN')
    || signals.includes('WEAK_MEDIUM_MOMENTUM')
    || (isFiniteNumber(debt) && debt > 2);
  return {
    state: hard ? 'FAIL' : 'PASS',
    failed_reason: hard ? 'COMBINED_DISTRESS_EVIDENCE' : null,
    coverage: average([factors.SAFETY.coverage, factors.QUALITY.coverage]),
    soft_risk_profile: {
      material: materialSoft ? TRI_STATE.TRUE : TRI_STATE.FALSE,
      signals: signals.filter(signal => ['SEVERE_DRAWDOWN', 'WEAK_MEDIUM_MOMENTUM', 'HIGH_LEVERAGE'].includes(signal))
    },
    lineage: [
      ...(families.price_dislocation?.signals || []),
      ...(families.momentum_volume?.signals || [])
    ]
  };
}

function businessSignals(contract, factors) {
  const signals = [];
  const pe = value(contract, 'pe');
  const growth = value(contract, 'eps_dil_growth_ttm_yoy');
  const debt = value(contract, 'debt_equity_fq');
  const fcf = value(contract, 'fcf_ttm');
  if (factors.QUALITY.score >= 70) signals.push('STRONG_BUSINESS_QUALITY');
  if (factors.VALUATION.score >= 70) signals.push('ATTRACTIVE_VALUATION');
  if (isFiniteNumber(debt) && debt > 2) signals.push('HIGH_LEVERAGE');
  if (isFiniteNumber(fcf) && fcf < 0) signals.push('NEGATIVE_FCF');
  if (isFiniteNumber(pe) && pe > 0 && pe < 8 && factors.QUALITY.score < 45 && (!isFiniteNumber(growth) || growth < 0)) signals.push('VALUE_TRAP_WARNING');
  return signals;
}

function highGood(contract, field, low, high) {
  return scoreFromValue(value(contract, field), low, high);
}

function lowGoodPositive(contract, field, good, bad) {
  const current = value(contract, field);
  if (!isFiniteNumber(current) || current <= 0) return null;
  return round(100 - scoreFromValue(current, good, bad), 2);
}

function lowGood(contract, field, good, bad) {
  const current = value(contract, field);
  if (!isFiniteNumber(current)) return null;
  return round(100 - scoreFromValue(current, good, bad), 2);
}

function rangeGood(contract, field, low, high) {
  const current = value(contract, field);
  if (!isFiniteNumber(current)) return null;
  if (current >= low && current <= high) return 100;
  if (current < low) return scoreFromValue(current, 0, low);
  return round(100 - scoreFromValue(current, high, high * 2), 2);
}

function signGood(contract, field) {
  const current = value(contract, field);
  if (!isFiniteNumber(current)) return null;
  return current >= 0 ? 70 : 25;
}

function scoreFromValue(current, low, high) {
  if (!isFiniteNumber(current)) return null;
  if (high === low) return 50;
  return round(Math.max(0, Math.min(100, 100 * (current - low) / (high - low))), 2);
}

function scaleNullable(value, multiplier) {
  return isFiniteNumber(value) ? value * multiplier : null;
}

function value(contract, field) {
  const observation = contract.observations[field];
  return observation?.usage_state === USAGE_STATE.ELIGIBLE ? contract.input[field] : null;
}

function average(values) {
  const valid = values.filter(isFiniteNumber);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length, 2) : null;
}
