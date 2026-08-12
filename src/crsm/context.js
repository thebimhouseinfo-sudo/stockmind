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
