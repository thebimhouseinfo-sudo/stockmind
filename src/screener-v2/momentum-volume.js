import { getSandboxRegistry } from './registry.js';
import { PRICE_DISLOCATION_PROFILE, TRI_STATE, USAGE_STATE, isFiniteNumber, round } from './state.js';

const MOMENTUM_FIELDS = ['perf_1w', 'perf_1m', 'perf_3m', 'perf_6m', 'perf_1y', 'perf_ytd'];
const CORE_MOMENTUM_FIELDS = ['perf_1m', 'perf_3m', 'perf_6m'];

export function evaluateMomentumVolume(contract, options = {}) {
  const registry = options.registry || getSandboxRegistry();
  const coverage = contract.family_coverage?.momentum_volume;
  const observations = contract.observations;
  const input = contract.input;
  const thresholds = registry.momentum_volume.signals;
  const signals = [];
  const qualityFlags = [];
  const derived = {};
  const lineage = [];

  const validCore = CORE_MOMENTUM_FIELDS.filter(field => observations[field].usage_state === USAGE_STATE.ELIGIBLE);
  const validMomentum = MOMENTUM_FIELDS.filter(field => observations[field].usage_state === USAGE_STATE.ELIGIBLE);

  if (!validCore.length) {
    return {
      family: 'MOMENTUM_VOLUME',
      profile: PRICE_DISLOCATION_PROFILE.UNKNOWN,
      computability_state: 'UNAVAILABLE',
      derived,
      signals,
      quality_flags: qualityFlags,
      coverage,
      lineage,
      decision_inputs: {
        strong_medium_momentum: TRI_STATE.UNKNOWN,
        weak_medium_momentum: TRI_STATE.UNKNOWN,
        volume_confirmation: TRI_STATE.UNKNOWN,
        low_relative_volume: TRI_STATE.UNKNOWN
      }
    };
  }

  const mediumMomentum = weightedAvailable([
    ['perf_1m', 0.20],
    ['perf_3m', 0.35],
    ['perf_6m', 0.45]
  ], input, observations);
  const positiveCount = validMomentum.filter(field => input[field] > 0).length;
  const momentumStack = round(positiveCount / validMomentum.length, 6);

  derived.medium_momentum = metric('medium_momentum', round(mediumMomentum, 6), validCore, registry);
  derived.momentum_stack = metric('momentum_stack', momentumStack, validMomentum, registry);
  lineage.push(...validCore.map(field => edge(field, 'medium_momentum')));
  lineage.push(...validMomentum.map(field => edge(field, 'momentum_stack')));

  const relativeVolume = observations.relative_volume.usage_state === USAGE_STATE.ELIGIBLE
    ? input.relative_volume
    : null;

  const strongMedium = mediumMomentum >= thresholds.strong_medium_momentum_threshold;
  const weakMedium = mediumMomentum <= thresholds.weak_medium_momentum_threshold;
  const lowRelativeVolume = isFiniteNumber(relativeVolume) && relativeVolume < thresholds.low_relative_volume_threshold;
  const confirmedVolume = isFiniteNumber(relativeVolume)
    ? mediumMomentum > 0 && relativeVolume >= thresholds.volume_confirmation_rel_vol_threshold
    : null;

  if (strongMedium) signals.push('STRONG_MEDIUM_MOMENTUM');
  if (weakMedium) signals.push('WEAK_MEDIUM_MOMENTUM');
  if (lowRelativeVolume) qualityFlags.push('LOW_RELATIVE_VOLUME_CONTEXT');
  if (confirmedVolume === true) signals.push('PRICE_VOLUME_CONFIRMATION');

  derived.volume_confirmation = {
    metric_id: 'volume_confirmation',
    version: registry.momentum_volume.metrics.volume_confirmation.version,
    family: 'MOMENTUM_VOLUME',
    value: confirmedVolume == null ? null : (confirmedVolume ? TRI_STATE.TRUE : TRI_STATE.FALSE),
    output_type: 'tri_state',
    direction: 'SIGNAL_DERIVED',
    used_by_factors: [],
    observation_state: relativeVolume == null ? 'MISSING' : 'VALID',
    usage_state: relativeVolume == null ? 'UNAVAILABLE' : 'ELIGIBLE',
    source_fields: ['relative_volume', ...validCore]
  };
  if (relativeVolume != null) lineage.push(edge('relative_volume', 'volume_confirmation'));
  lineage.push(...validCore.map(field => edge(field, 'volume_confirmation')));

  return {
    family: 'MOMENTUM_VOLUME',
    profile: validCore.length === CORE_MOMENTUM_FIELDS.length
      ? PRICE_DISLOCATION_PROFILE.PROFILE_ONLY
      : PRICE_DISLOCATION_PROFILE.PARTIALLY_SCOREABLE,
    computability_state: validCore.length === CORE_MOMENTUM_FIELDS.length ? 'AVAILABLE' : 'PARTIAL_INPUT',
    derived,
    structural_relationships: [{
      metrics: ['perf_1w', 'perf_1m', 'perf_3m', 'perf_6m', 'perf_1y', 'perf_ytd'],
      relationship_type: 'OVERLAPPING_PERFORMANCE_WINDOWS',
      scoring_policy: 'DO_NOT_COUNT_ALL_PERIODS_AS_INDEPENDENT_SCORING_EVIDENCE'
    }],
    signals: [...new Set(signals)],
    quality_flags: [...new Set(qualityFlags)],
    coverage,
    lineage,
    decision_inputs: {
      strong_medium_momentum: strongMedium ? TRI_STATE.TRUE : TRI_STATE.FALSE,
      weak_medium_momentum: weakMedium ? TRI_STATE.TRUE : TRI_STATE.FALSE,
      volume_confirmation: confirmedVolume == null ? TRI_STATE.UNKNOWN : (confirmedVolume ? TRI_STATE.TRUE : TRI_STATE.FALSE),
      low_relative_volume: relativeVolume == null ? TRI_STATE.UNKNOWN : (lowRelativeVolume ? TRI_STATE.TRUE : TRI_STATE.FALSE)
    }
  };
}

function weightedAvailable(parts, input, observations) {
  const valid = parts.filter(([field]) => observations[field].usage_state === USAGE_STATE.ELIGIBLE);
  const weight = valid.reduce((sum, [, w]) => sum + w, 0);
  return valid.reduce((sum, [field, w]) => sum + input[field] * w, 0) / weight;
}

function metric(metricId, value, sourceFields, registry) {
  const spec = registry.momentum_volume.metrics[metricId];
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
    condition: 'INPUT_AVAILABLE',
    unknown_policy: 'PROPAGATE_UNKNOWN',
    transformation: 'FORMULA',
    bounded_effect: 'NO_SCORE_EFFECT',
    impact_group: 'MOMENTUM_VOLUME_CONTEXT',
    aggregation_policy: 'NONE'
  };
}
