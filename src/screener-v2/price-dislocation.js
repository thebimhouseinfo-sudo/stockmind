import { getSandboxRegistry } from './registry.js';
import { PRICE_DISLOCATION_PROFILE, TRI_STATE, round } from './state.js';

export function evaluatePriceDislocation(contract, options = {}) {
  const registry = options.registry || getSandboxRegistry();
  const input = contract.input;
  const signals = [];
  const qualityFlags = [];
  const derived = {};
  const lineage = [];

  if (!contract.valid_for_price_dislocation) {
    return {
      family: 'PRICE_DISLOCATION',
      profile: PRICE_DISLOCATION_PROFILE.UNSCOREABLE,
      computability_state: 'UNAVAILABLE',
      derived,
      signals,
      quality_flags: qualityFlags,
      coverage: contract.coverage,
      lineage,
      decision_inputs: {
        severe_drawdown: TRI_STATE.UNKNOWN,
        near_52w_high: TRI_STATE.UNKNOWN,
        price_above_stored_52w_high: TRI_STATE.UNKNOWN,
        narrow_52w_range: TRI_STATE.UNKNOWN
      }
    };
  }

  const price = input.price;
  const high = input.high_52w;
  const low = input.low_52w;
  const thresholds = registry.price_dislocation.signals;

  if (price > high) {
    signals.push('PRICE_ABOVE_STORED_52W_HIGH', 'INCONSISTENT_REFERENCE');
    qualityFlags.push('PRICE_HIGH_52W_MISMATCH');
  }

  if (high <= low) {
    return {
      family: 'PRICE_DISLOCATION',
      profile: PRICE_DISLOCATION_PROFILE.UNSCOREABLE,
      computability_state: 'INVALID_REFERENCE',
      derived,
      signals: [...new Set(signals)],
      quality_flags: [...new Set([...qualityFlags, 'INVALID_52W_RANGE'])],
      coverage: contract.coverage,
      lineage,
      decision_inputs: {
        severe_drawdown: TRI_STATE.UNKNOWN,
        near_52w_high: TRI_STATE.UNKNOWN,
        price_above_stored_52w_high: price > high ? TRI_STATE.TRUE : TRI_STATE.FALSE,
        narrow_52w_range: TRI_STATE.UNKNOWN
      }
    };
  }

  const drawdown = round((price / high) - 1, 6);
  const upside = round((high / price) - 1, 6);
  const position = round((price - low) / (high - low), 6);
  const rangeRatio = (high - low) / high;

  derived.drawdown_52w = metric('drawdown_52w', drawdown, ['price', 'high_52w'], registry);
  derived.upside_to_52w_high = metric('upside_to_52w_high', upside, ['price', 'high_52w'], registry);
  derived.position_52w_range = metric('position_52w_range', position, ['price', 'high_52w', 'low_52w'], registry);

  lineage.push(
    edge('price', 'drawdown_52w'),
    edge('high_52w', 'drawdown_52w'),
    edge('price', 'upside_to_52w_high'),
    edge('high_52w', 'upside_to_52w_high'),
    edge('price', 'position_52w_range'),
    edge('high_52w', 'position_52w_range'),
    edge('low_52w', 'position_52w_range')
  );

  if (drawdown <= thresholds.severe_drawdown_threshold) signals.push('SEVERE_DRAWDOWN');
  if (drawdown >= thresholds.near_52w_high_threshold && price <= high) signals.push('NEAR_52W_HIGH');
  if (rangeRatio < thresholds.narrow_range_ratio_threshold) qualityFlags.push('LOW_BASE_UNRELIABLE');

  return {
    family: 'PRICE_DISLOCATION',
    profile: PRICE_DISLOCATION_PROFILE.PROFILE_ONLY,
    computability_state: 'AVAILABLE',
    derived,
    structural_relationships: [{
      metrics: ['drawdown_52w', 'upside_to_52w_high'],
      relationship_type: 'NONLINEAR_MONOTONIC_SAME_PRICE_TO_HIGH_EVIDENCE',
      scoring_policy: 'DO_NOT_COUNT_AS_INDEPENDENT_SCORING_EVIDENCE'
    }],
    signals: [...new Set(signals)],
    quality_flags: [...new Set(qualityFlags)],
    coverage: contract.coverage,
    lineage,
    decision_inputs: {
      severe_drawdown: drawdown <= thresholds.severe_drawdown_threshold ? TRI_STATE.TRUE : TRI_STATE.FALSE,
      near_52w_high: drawdown >= thresholds.near_52w_high_threshold && price <= high ? TRI_STATE.TRUE : TRI_STATE.FALSE,
      price_above_stored_52w_high: price > high ? TRI_STATE.TRUE : TRI_STATE.FALSE,
      narrow_52w_range: rangeRatio < thresholds.narrow_range_ratio_threshold ? TRI_STATE.TRUE : TRI_STATE.FALSE
    }
  };
}

function metric(metricId, value, sourceFields, registry) {
  const spec = registry.price_dislocation.metrics[metricId];
  return {
    metric_id: metricId,
    version: spec.version,
    family: spec.family,
    value,
    output_type: spec.output_type,
    direction: spec.direction,
    used_by_factors: spec.used_by_factors,
    observation_state: 'VALID',
    usage_state: 'ELIGIBLE',
    source_fields: sourceFields
  };
}

function edge(source, target) {
  return {
    source,
    target,
    target_type: 'DERIVED_METRIC',
    contribution_type: 'LINEAGE_ONLY',
    condition: 'INPUT_REQUIRED',
    unknown_policy: 'PROPAGATE_UNKNOWN',
    transformation: 'FORMULA',
    bounded_effect: 'NO_SCORE_EFFECT',
    impact_group: 'PRICE_TO_52W_REFERENCE',
    aggregation_policy: 'NONE'
  };
}
