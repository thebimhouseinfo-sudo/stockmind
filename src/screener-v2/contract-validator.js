import { getSandboxRegistry } from './registry.js';
import { observeNumber, USAGE_STATE } from './state.js';

const FIELD_ALIASES = Object.freeze({
  ticker: ['ticker', 'TICKER'],
  company_name: ['company_name', 'COMPANY_NAME'],
  sector: ['sector', 'SECTOR'],
  industry: ['industry', 'INDUSTRY'],
  price: ['price', 'PRICE'],
  high_52w: ['high_52w', 'HIGH_52W'],
  low_52w: ['low_52w', 'LOW_52W'],
  perf_1w: ['perf_1w', 'RET1W'],
  perf_1m: ['perf_1m', 'RET1M'],
  perf_3m: ['perf_3m', 'RET3M'],
  perf_6m: ['perf_6m', 'RET6M'],
  perf_1y: ['perf_1y', 'RET12M'],
  perf_ytd: ['perf_ytd', 'RETYTD'],
  volume: ['volume', 'VOL'],
  relative_volume: ['relative_volume', 'RELATIVE_VOLUME'],
  avg_volume_10d: ['avg_volume_10d', 'AVGVOL10D'],
  avg_volume_30d: ['avg_volume_30d', 'AVGVOL'],
  avg_volume_60d: ['avg_volume_60d', 'AVGVOL60D'],
  market_cap: ['market_cap', 'MARKET_CAP'],
  roe_ttm: ['roe_ttm', 'ROE'],
  roa_ttm: ['roa_ttm', 'ROA'],
  revenue_growth_annual_yoy: ['revenue_growth_annual_yoy', 'REVGROWTH'],
  revenue_growth_quarterly_yoy: ['revenue_growth_quarterly_yoy', 'REVGROWTH_Q'],
  eps_dil_growth_ttm_yoy: ['eps_dil_growth_ttm_yoy', 'EPSGROWTH'],
  fcf_growth_ttm_yoy: ['fcf_growth_ttm_yoy', 'FCFGROWTH'],
  gross_margin_ttm: ['gross_margin_ttm', 'GROSS_MARGIN'],
  operating_margin_ttm: ['operating_margin_ttm', 'OPERATING_MARGIN'],
  net_margin_ttm: ['net_margin_ttm', 'NET_MARGIN'],
  fcf_ttm: ['fcf_ttm', 'FCF'],
  debt_equity_fq: ['debt_equity_fq', 'DEBT'],
  debt_equity_fy: ['debt_equity_fy', 'DEBT_FY'],
  current_ratio_fq: ['current_ratio_fq', 'CURRENT_RATIO'],
  quick_ratio_fq: ['quick_ratio_fq', 'QUICK_RATIO'],
  pe: ['pe', 'PE'],
  peg: ['peg', 'PEG'],
  pb: ['pb', 'PB'],
  ps: ['ps', 'PS'],
  ev_ebitda: ['ev_ebitda', 'EV_EBITDA'],
  ev_revenue: ['ev_revenue', 'EV_REVENUE']
});

export function normalizeScreenerRow(row) {
  const normalized = {};
  for (const [target, aliases] of Object.entries(FIELD_ALIASES)) {
    normalized[target] = firstPresent(row, aliases);
  }
  return normalized;
}

export function validateScreenerContract(row, options = {}) {
  const registry = options.registry || getSandboxRegistry();
  const normalized = normalizeScreenerRow(row);
  const observations = {
    price: observeNumber(normalized.price, 'price', { positive: true }),
    high_52w: observeNumber(normalized.high_52w, 'high_52w', { positive: true }),
    low_52w: observeNumber(normalized.low_52w, 'low_52w', { positive: true }),
    perf_1w: observeNumber(normalized.perf_1w, 'perf_1w'),
    perf_1m: observeNumber(normalized.perf_1m, 'perf_1m'),
    perf_3m: observeNumber(normalized.perf_3m, 'perf_3m'),
    perf_6m: observeNumber(normalized.perf_6m, 'perf_6m'),
    perf_1y: observeNumber(normalized.perf_1y, 'perf_1y'),
    perf_ytd: observeNumber(normalized.perf_ytd, 'perf_ytd'),
    volume: observeNumber(normalized.volume, 'volume', { positive: true }),
    relative_volume: observeNumber(normalized.relative_volume, 'relative_volume', { positive: true }),
    avg_volume_10d: observeNumber(normalized.avg_volume_10d, 'avg_volume_10d', { positive: true }),
    avg_volume_30d: observeNumber(normalized.avg_volume_30d, 'avg_volume_30d', { positive: true }),
    avg_volume_60d: observeNumber(normalized.avg_volume_60d, 'avg_volume_60d', { positive: true }),
    market_cap: observeNumber(normalized.market_cap, 'market_cap', { positive: true }),
    roe_ttm: observeNumber(normalized.roe_ttm, 'roe_ttm'),
    roa_ttm: observeNumber(normalized.roa_ttm, 'roa_ttm'),
    revenue_growth_annual_yoy: observeNumber(normalized.revenue_growth_annual_yoy, 'revenue_growth_annual_yoy'),
    revenue_growth_quarterly_yoy: observeNumber(normalized.revenue_growth_quarterly_yoy, 'revenue_growth_quarterly_yoy'),
    eps_dil_growth_ttm_yoy: observeNumber(normalized.eps_dil_growth_ttm_yoy, 'eps_dil_growth_ttm_yoy'),
    fcf_growth_ttm_yoy: observeNumber(normalized.fcf_growth_ttm_yoy, 'fcf_growth_ttm_yoy'),
    gross_margin_ttm: observeNumber(normalized.gross_margin_ttm, 'gross_margin_ttm'),
    operating_margin_ttm: observeNumber(normalized.operating_margin_ttm, 'operating_margin_ttm'),
    net_margin_ttm: observeNumber(normalized.net_margin_ttm, 'net_margin_ttm'),
    fcf_ttm: observeNumber(normalized.fcf_ttm, 'fcf_ttm'),
    debt_equity_fq: observeNumber(normalized.debt_equity_fq, 'debt_equity_fq'),
    debt_equity_fy: observeNumber(normalized.debt_equity_fy, 'debt_equity_fy'),
    current_ratio_fq: observeNumber(normalized.current_ratio_fq, 'current_ratio_fq'),
    quick_ratio_fq: observeNumber(normalized.quick_ratio_fq, 'quick_ratio_fq'),
    pe: observeNumber(normalized.pe, 'pe'),
    peg: observeNumber(normalized.peg, 'peg'),
    pb: observeNumber(normalized.pb, 'pb'),
    ps: observeNumber(normalized.ps, 'ps'),
    ev_ebitda: observeNumber(normalized.ev_ebitda, 'ev_ebitda'),
    ev_revenue: observeNumber(normalized.ev_revenue, 'ev_revenue')
  };

  const issues = [];
  const criticalMissing = [];
  const invalidFields = [];

  for (const field of registry.price_dislocation.required_fields) {
    const observation = observations[field];
    if (observation.usage_state === USAGE_STATE.UNAVAILABLE) criticalMissing.push(field);
    if (observation.usage_state === USAGE_STATE.INVALID_FOR_USAGE) invalidFields.push(field);
  }

  if (criticalMissing.length) {
    issues.push({
      code: 'CRITICAL_INPUT_MISSING',
      fields: criticalMissing,
      severity: 'BLOCKING'
    });
  }

  if (invalidFields.length) {
    issues.push({
      code: 'CRITICAL_INPUT_INVALID_FOR_USAGE',
      fields: invalidFields,
      severity: 'BLOCKING'
    });
  }

  return {
    registry_id: registry.registry_id,
    registry_version: registry.registry_version,
    calibration_status: registry.calibration_status,
    input: normalized,
    observations,
    coverage: {
      coverage_set_id: 'price-dislocation-required-fields',
      intended_metric_ids: registry.price_dislocation.required_fields,
      applicable_metric_ids: registry.price_dislocation.required_fields,
      available_metric_ids: registry.price_dislocation.required_fields.filter(
        field => observations[field].usage_state === USAGE_STATE.ELIGIBLE
      ),
      critical_missing_metric_ids: criticalMissing,
      invalid_metric_ids: invalidFields,
      coverage_formula_version: 'sandbox-critical-inputs-v1'
    },
    family_coverage: {
      price_dislocation: coverageForFields('price-dislocation-required-fields', registry.price_dislocation.required_fields, observations),
      momentum_volume: coverageForFields('momentum-volume-required-fields', registry.momentum_volume.required_fields, observations, registry.momentum_volume.optional_fields)
    },
    issues,
    valid_for_price_dislocation: !criticalMissing.length && !invalidFields.length
  };
}

function coverageForFields(coverageSetId, requiredFields, observations, optionalFields = []) {
  const intended = [...requiredFields, ...optionalFields];
  const missing = requiredFields.filter(field => observations[field].usage_state === USAGE_STATE.UNAVAILABLE);
  const invalid = requiredFields.filter(field => observations[field].usage_state === USAGE_STATE.INVALID_FOR_USAGE);
  return {
    coverage_set_id: coverageSetId,
    intended_metric_ids: intended,
    applicable_metric_ids: intended,
    available_metric_ids: intended.filter(field => observations[field].usage_state === USAGE_STATE.ELIGIBLE),
    critical_missing_metric_ids: missing,
    invalid_metric_ids: invalid,
    optional_missing_metric_ids: optionalFields.filter(field => observations[field].usage_state === USAGE_STATE.UNAVAILABLE),
    coverage_formula_version: 'sandbox-critical-plus-optional-v1'
  };
}

function firstPresent(row, aliases) {
  for (const alias of aliases) {
    if (row?.[alias] !== undefined) return row[alias];
  }
  return null;
}
