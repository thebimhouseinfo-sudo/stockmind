export const OBSERVATION_STATE = Object.freeze({
  VALID: 'VALID',
  MISSING: 'MISSING',
  INVALID: 'INVALID',
  NOT_APPLICABLE: 'NOT_APPLICABLE'
});

export const USAGE_STATE = Object.freeze({
  ELIGIBLE: 'ELIGIBLE',
  SUPPRESSED: 'SUPPRESSED',
  INVALID_FOR_USAGE: 'INVALID_FOR_USAGE',
  UNAVAILABLE: 'UNAVAILABLE'
});

export const TRI_STATE = Object.freeze({
  TRUE: 'TRUE',
  FALSE: 'FALSE',
  UNKNOWN: 'UNKNOWN'
});

export const PRICE_DISLOCATION_PROFILE = Object.freeze({
  PROFILE_ONLY: 'PROFILE_ONLY',
  UNKNOWN: 'UNKNOWN',
  PARTIALLY_SCOREABLE: 'PARTIALLY_SCOREABLE',
  UNSCOREABLE: 'UNSCOREABLE'
});

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function round(value, digits = 4) {
  if (!isFiniteNumber(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function observeNumber(value, field, { positive = false } = {}) {
  if (value == null || value === '') {
    return {
      field,
      raw_value: value ?? null,
      value: null,
      observation_state: OBSERVATION_STATE.MISSING,
      usage_state: USAGE_STATE.UNAVAILABLE,
      reason: 'MISSING'
    };
  }

  if (!isFiniteNumber(value)) {
    return {
      field,
      raw_value: value,
      value: null,
      observation_state: OBSERVATION_STATE.INVALID,
      usage_state: USAGE_STATE.INVALID_FOR_USAGE,
      reason: 'NOT_NUMERIC'
    };
  }

  if (positive && value <= 0) {
    return {
      field,
      raw_value: value,
      value,
      observation_state: OBSERVATION_STATE.VALID,
      usage_state: USAGE_STATE.INVALID_FOR_USAGE,
      reason: 'NON_POSITIVE'
    };
  }

  return {
    field,
    raw_value: value,
    value,
    observation_state: OBSERVATION_STATE.VALID,
    usage_state: USAGE_STATE.ELIGIBLE,
    reason: null
  };
}
