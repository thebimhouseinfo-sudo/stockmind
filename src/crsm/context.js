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
  return {
    source: 'StockScreener',
    ticker: stock.TICKER,
    industry: stock.INDUSTRY,
    screening_as_of: todayISODate(),
    screen_score: stock.FINALSCORE ?? null,
    screen_rank: stock.RANK ?? null,
    screen_grade: stock.GRADE ?? null,
    quality_score: stock.QUALITY_SCORE ?? null,
    growth_score: stock.GROWTH_SCORE ?? null,
    valuation_score: stock.VALUATION_SCORE ?? null,
    micro_score: stock.MICRO ?? null,
    momentum_score: stock.MOMENTUM ?? null,
    mispricing_score: stock.MISPRICING ?? null,
    data_coverage: stock.DATA_COVERAGE ?? null,
    data_integrity: stock.DATA_INTEGRITY ?? null,
    data_flags: Array.isArray(stock.DATA_FLAGS) ? stock.DATA_FLAGS : [],
    data_references: stock.DATA_REFERENCES ?? {},
    metrics: {
      price: stock.PRICE ?? null,
      pe: stock.PE ?? null,
      peg: stock.PEG ?? null,
      roe: stock.ROE ?? null,
      roic: stock.ROIC ?? null,
      revenue_growth: stock.REVGROWTH ?? null,
      eps_growth: stock.EPSGROWTH ?? null,
      debt_ratio: stock.DEBT ?? null,
      return_1m: stock.RET1M ?? null,
      return_3m: stock.RET3M ?? null,
      return_6m: stock.RET6M ?? null,
      return_12m: stock.RET12M ?? null
    },
    industry_benchmarks: {
      pe_median: stock.INDUSTRY_MEDIAN_PE ?? null,
      roe_median: stock.INDUSTRY_MEDIAN_ROE ?? null,
      ...((stock.INDUSTRY_REFERENCES && typeof stock.INDUSTRY_REFERENCES === 'object') ? stock.INDUSTRY_REFERENCES : {})
    }
  };
}