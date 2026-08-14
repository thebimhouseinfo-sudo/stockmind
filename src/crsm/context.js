const SCREENING_FIELD_MAP = {
  price: 'PRICE',
  pe: 'PE',
  peg: 'PEG',
  roe: 'ROE',
  roic: 'ROIC',
  revenue_growth: 'REVGROWTH',
  eps_growth: 'EPSGROWTH',
  debt_ratio: 'DEBT',
  return_1m: 'RET1M',
  return_3m: 'RET3M',
  return_6m: 'RET6M',
  return_12m: 'RET12M'
};

export function todayISODate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDateVN(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function buildScreeningContext(stock) {
  if (!stock) return null;
  if (stock.SCREENER_V2) return buildScreenerV2Context(stock);

  const metrics = Object.fromEntries(
    Object.entries(SCREENING_FIELD_MAP).map(([key, source]) => [key, stock[source] ?? null])
  );

  const missingFields = Object.entries(metrics)
    .filter(([, value]) => value == null || value === '')
    .map(([key]) => key);

  const dataFlags = Array.isArray(stock.DATA_FLAGS) ? stock.DATA_FLAGS : [];

  return {
    source: 'StockScreener',
    ticker: stock.TICKER,
    industry: stock.INDUSTRY,
    screening_as_of: todayISODate(),

    // Immutable snapshot: Node 1 must not recalculate or replace these.
    screening_summary: {
      screen_score: stock.FINALSCORE ?? null,
      screen_rank: stock.RANK ?? null,
      screen_grade: stock.GRADE ?? null,
      quality_score: stock.QUALITY_SCORE ?? null,
      growth_score: stock.GROWTH_SCORE ?? null,
      valuation_score: stock.VALUATION_SCORE ?? null,
      micro_score: stock.MICRO ?? null,
      momentum_score: stock.MOMENTUM ?? null,
      opportunity_score: stock.MISPRICING ?? null
    },

    data_integrity: {
      coverage: stock.DATA_COVERAGE ?? null,
      status: stock.DATA_INTEGRITY ?? null,
      flags: dataFlags,
      missing_fields: missingFields,
      references: stock.DATA_REFERENCES ?? {}
    },

    // Only the values actually present in the screener are supplied here.
    // Industry medians are references only and must never be used as substitutes.
    metrics,

    industry_benchmarks: {
      pe_median: stock.INDUSTRY_MEDIAN_PE ?? null,
      roe_median: stock.INDUSTRY_MEDIAN_ROE ?? null,
      ...((stock.INDUSTRY_REFERENCES && typeof stock.INDUSTRY_REFERENCES === 'object')
        ? stock.INDUSTRY_REFERENCES
        : {})
    },

    verification_request: {
      enabled: true,
      rule: 'Every missing screening metric must be independently searched and verified from external sources. Never substitute an industry benchmark, estimate, or inferred value for a missing stock-level metric.',
      fields: missingFields
    }
  };
}

function buildScreenerV2Context(stock) {
  const v2 = stock.SCREENER_V2;
  const priceDislocation = v2.price_dislocation || {};
  const momentumVolume = v2.momentum_volume || {};
  const derived = priceDislocation.derived || {};
  const momentumDerived = momentumVolume.derived || {};
  const dataFlags = Array.isArray(stock.DATA_FLAGS) ? stock.DATA_FLAGS : [];
  const missingFields = v2.contract?.coverage?.critical_missing_metric_ids || [];

  return {
    source: 'StockScreenerV2',
    ticker: stock.TICKER,
    industry: stock.INDUSTRY,
    screening_as_of: todayISODate(),
    registry: {
      registry_id: v2.registry?.registry_id ?? null,
      registry_version: v2.registry?.registry_version ?? null,
      calibration_status: v2.registry?.calibration_status ?? null,
      evaluation_version: v2.registry?.evaluation_version ?? null,
      classification_version: v2.registry?.classification_version ?? null
    },

    // Compatibility shell for existing report renderers. Values come from
    // Screener V2 sandbox registry, not the legacy formula.
    screening_summary: {
      screen_score: stock.FINALSCORE ?? null,
      screen_rank: stock.RANK ?? null,
      screen_grade: stock.GRADE ?? null,
      quality_score: stock.QUALITY_SCORE ?? null,
      growth_score: stock.GROWTH_SCORE ?? null,
      valuation_score: stock.VALUATION_SCORE ?? null,
      micro_score: stock.MICRO ?? null,
      momentum_score: stock.MOMENTUM ?? null,
      opportunity_score: stock.MISPRICING ?? null,
      classification: v2.classification?.classification ?? 'WATCH_NEUTRAL'
    },

    data_integrity: {
      coverage: stock.DATA_COVERAGE ?? null,
      status: stock.DATA_INTEGRITY ?? null,
      flags: dataFlags,
      missing_fields: missingFields,
      observations: v2.contract?.observations ?? {},
      issues: v2.contract?.issues ?? []
    },

    raw_metrics: {
      price: stock.PRICE ?? null,
      high_52w: stock.HIGH_52W ?? null,
      low_52w: stock.LOW_52W ?? null
    },

    factors: v2.factors ?? {},
    axes: v2.axes ?? {},
    risk_gate: v2.risk_gate ?? {},
    classification: v2.classification ?? {},

    price_dislocation: {
      profile: priceDislocation.profile ?? 'UNKNOWN',
      computability_state: priceDislocation.computability_state ?? 'UNKNOWN',
      drawdown_52w: derived.drawdown_52w?.value ?? null,
      upside_to_52w_high: derived.upside_to_52w_high?.value ?? null,
      position_52w_range: derived.position_52w_range?.value ?? null,
      signals: priceDislocation.signals ?? [],
      quality_flags: priceDislocation.quality_flags ?? [],
      decision_inputs: priceDislocation.decision_inputs ?? {},
      structural_relationships: priceDislocation.structural_relationships ?? [],
      lineage: priceDislocation.lineage ?? []
    },

    momentum_volume: {
      profile: momentumVolume.profile ?? 'UNKNOWN',
      computability_state: momentumVolume.computability_state ?? 'UNKNOWN',
      perf_1w: stock.RET1W ?? null,
      perf_1m: stock.RET1M ?? null,
      perf_3m: stock.RET3M ?? null,
      perf_6m: stock.RET6M ?? null,
      perf_1y: stock.RET12M ?? null,
      perf_ytd: stock.RETYTD ?? null,
      volume: stock.VOL ?? null,
      relative_volume: stock.RELATIVE_VOLUME ?? null,
      avg_volume_30d: stock.AVGVOL ?? null,
      medium_momentum: momentumDerived.medium_momentum?.value ?? null,
      momentum_stack: momentumDerived.momentum_stack?.value ?? null,
      volume_confirmation: momentumDerived.volume_confirmation?.value ?? null,
      signals: momentumVolume.signals ?? [],
      quality_flags: momentumVolume.quality_flags ?? [],
      decision_inputs: momentumVolume.decision_inputs ?? {},
      structural_relationships: momentumVolume.structural_relationships ?? [],
      lineage: momentumVolume.lineage ?? []
    },

    ranking: stock.RANKING_RECORD ?? null,

    verification_request: {
      enabled: true,
      rule: 'Screener V2 is a sandbox-calibrated quantitative pre-screen. Verify important raw inputs, investigate signals/anomalies, and do not treat sandbox score/classification as a final investment thesis.',
      fields: missingFields,
      signals: [...new Set([...(priceDislocation.signals ?? []), ...(momentumVolume.signals ?? []), ...(v2.signals ?? [])])]
    }
  };
}
