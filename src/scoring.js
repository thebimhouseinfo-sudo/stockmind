const BUSINESS_FIELDS = ['ROE', 'ROIC', 'REVGROWTH', 'EPSGROWTH', 'DEBT'];
const VALUATION_FIELDS = ['PE', 'PEG'];
const MARKET_FIELDS = ['PRICE', 'RET1M', 'RET3M', 'RET6M', 'RET12M'];
const OPTIONAL_FIELDS = ['AVGVOL', 'VOL'];
const ALL_FIELDS = [...MARKET_FIELDS, ...VALUATION_FIELDS, ...BUSINESS_FIELDS, ...OPTIONAL_FIELDS];

const SCORE_WEIGHTS = {
  business: 0.50,
  valuation: 0.25,
  market: 0.25
};

export function scoreStocks(rawRows) {
  const rows = rawRows.map(row => ({ ...row }));
  const marketValues = buildMarketValues(rows);
  const industryGroups = groupBy(rows, row => row.INDUSTRY || 'Unknown');
  const industryStats = buildIndustryStats(industryGroups);

  rows.forEach(row => {
    const industry = row.INDUSTRY || 'Unknown';
    const stats = industryStats.get(industry) || {};
    const industryRows = industryGroups.get(industry) || [];

    attachDataIntegrity(row, stats);

    const roe = relativePercentile(industryRows, marketValues.ROE, row.ROE, 'ROE');
    const roic = relativePercentile(industryRows, marketValues.ROIC, row.ROIC, 'ROIC');
    const revenueGrowth = relativePercentile(industryRows, marketValues.REVGROWTH, row.REVGROWTH, 'REVGROWTH');
    const epsGrowth = relativePercentile(industryRows, marketValues.EPSGROWTH, row.EPSGROWTH, 'EPSGROWTH');
    const debt = debtScore(row.DEBT);

    // Business Quality is deliberately simple: this is screening, not CRSM.
    row.BUSINESS_QUALITY = round2(100 * weightedAvailable([
      [roe, 0.25, isFiniteNumber(row.ROE)],
      [roic, 0.25, isFiniteNumber(row.ROIC)],
      [revenueGrowth, 0.20, isFiniteNumber(row.REVGROWTH)],
      [epsGrowth, 0.15, isFiniteNumber(row.EPSGROWTH)],
      [debt, 0.15, isFiniteNumber(row.DEBT)]
    ]));

    // Keep the old component names as compatibility aliases for the UI/CRSM,
    // but do not use a second Micro/Opportunity layer in the final score.
    row.QUALITY_SCORE = round2(100 * weightedAvailable([
      [roe, 0.50, isFiniteNumber(row.ROE)],
      [roic, 0.50, isFiniteNumber(row.ROIC)]
    ]));
    row.GROWTH_SCORE = round2(100 * weightedAvailable([
      [revenueGrowth, 0.60, isFiniteNumber(row.REVGROWTH)],
      [epsGrowth, 0.40, isFiniteNumber(row.EPSGROWTH)]
    ]));

    const pe = valuationPercentile(industryRows, marketValues.PE, row.PE);
    const peg = pegPercentile(industryRows, marketValues.PEG, row.PEG);
    row.VALUATION_SCORE = round2(100 * weightedAvailable([
      [pe, 0.70, isFiniteNumber(row.PE) && row.PE > 0],
      [peg, 0.30, isFiniteNumber(row.PEG) && row.PEG > 0]
    ]));

    row.MARKET_RAW = weightedMarketExpression(row);
  });

  const marketValuesForRank = rows.map(row => row.MARKET_RAW).filter(isFiniteNumber);

  rows.forEach(row => {
    row.MARKET_SCORE = round2(100 * percentileRank(marketValuesForRank, row.MARKET_RAW, 3));
    row.MOMENTUM = row.MARKET_SCORE;

    row.FINALSCORE = round2(
      SCORE_WEIGHTS.business * row.BUSINESS_QUALITY +
      SCORE_WEIGHTS.valuation * row.VALUATION_SCORE +
      SCORE_WEIGHTS.market * row.MARKET_SCORE
    );

    row.GRADE = grade(row.FINALSCORE);
    row.SCREENING_GROUP = classifyScreening(row);
    row.INDUSTRY_MEDIAN_PE = industryStats.get(row.INDUSTRY || 'Unknown')?.medians?.PE ?? null;
    row.INDUSTRY_MEDIAN_ROE = industryStats.get(row.INDUSTRY || 'Unknown')?.medians?.ROE ?? null;
    row.INDUSTRY_REFERENCES = industryStats.get(row.INDUSTRY || 'Unknown')?.medians ?? {};
    row.DATA_COVERAGE = dataCoverage(row);
    row.DATA_INTEGRITY = integrityLevel(row);
  });

  rows.sort((a, b) => {
    const scoreDiff = (b.FINALSCORE ?? -1) - (a.FINALSCORE ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    const businessDiff = (b.BUSINESS_QUALITY ?? -1) - (a.BUSINESS_QUALITY ?? -1);
    if (businessDiff !== 0) return businessDiff;
    const marketDiff = (b.MARKET_SCORE ?? -1) - (a.MARKET_SCORE ?? -1);
    if (marketDiff !== 0) return marketDiff;
    return String(a.TICKER || '').localeCompare(String(b.TICKER || ''));
  });

  rows.forEach((row, index) => { row.RANK = index + 1; });
  return rows;
}

export function buildStats(rows) {
  const industryCount = {};
  rows.forEach(row => { industryCount[row.INDUSTRY] = (industryCount[row.INDUSTRY] || 0) + 1; });
  return {
    total: rows.length,
    avgScore: round2(average(rows.map(row => row.FINALSCORE), 0)),
    top10: [...rows].sort((a, b) => b.FINALSCORE - a.FINALSCORE).slice(0, 10),
    cleanTop10: rows.filter(row => !row.DATA_FLAGS?.length).slice(0, 10),
    flaggedTop20: rows.filter(row => row.DATA_FLAGS?.length && row.RANK <= 20),
    industryCount
  };
}

export function buildPrompt(stock) {
  const line = value => value == null ? 'chưa đủ dữ liệu' : value;
  const flags = Array.isArray(stock.DATA_FLAGS) && stock.DATA_FLAGS.length
    ? stock.DATA_FLAGS.join('; ')
    : 'Không có flag dữ liệu';

  return `Bạn là chuyên viên phân tích cổ phiếu Việt Nam cho một quỹ đầu tư kỷ luật.

Hãy phân tích mã ${stock.TICKER} trong ngành ${stock.INDUSTRY} dựa trên dữ liệu screening được cung cấp. Screener chỉ là đánh giá sơ bộ; không coi Screen Score là kết luận đầu tư. Nếu thiếu dữ liệu, ghi rõ và xác minh bằng nguồn phù hợp.

Dữ liệu Screener:
- Price: ${line(stock.PRICE)}
- P/E: ${line(stock.PE)}
- PEG: ${line(stock.PEG)}
- ROE: ${line(stock.ROE)}
- ROIC: ${line(stock.ROIC)}
- Revenue Growth: ${line(stock.REVGROWTH)}
- EPS Growth: ${line(stock.EPSGROWTH)}
- Debt/Equity: ${line(stock.DEBT)}
- Return 1M/3M/6M/12M: ${line(stock.RET1M)}/${line(stock.RET3M)}/${line(stock.RET6M)}/${line(stock.RET12M)}
- Volume: ${line(stock.VOL)}
- Average Volume: ${line(stock.AVGVOL)}
- Business Quality Score: ${line(stock.BUSINESS_QUALITY)}
- Valuation Score: ${line(stock.VALUATION_SCORE)}
- Market Expression Score: ${line(stock.MARKET_SCORE)}
- Screening Score: ${line(stock.FINALSCORE)}
- Rank: ${line(stock.RANK)}
- Grade: ${line(stock.GRADE)}
- Screening Group: ${line(stock.SCREENING_GROUP)}
- Data Coverage: ${line(stock.DATA_COVERAGE)}%
- Data Integrity: ${line(stock.DATA_INTEGRITY)}
- Data Flags: ${flags}
- Industry median P/E: ${line(stock.INDUSTRY_MEDIAN_PE)}
- Industry median ROE: ${line(stock.INDUSTRY_MEDIAN_ROE)}

Data flags are screening alerts, not conclusions. Do not substitute industry medians for missing company data. Verify missing or anomalous fields with external sources when needed.`;
}

function classifyScreening(row) {
  const business = row.BUSINESS_QUALITY ?? 0;
  const valuation = row.VALUATION_SCORE ?? 0;
  const market = row.MARKET_SCORE ?? 0;

  if (business >= 70 && market >= 60) return 'GOOD_IN_FORM';
  if (business >= 70 && valuation >= 60 && market < 60) return 'GOOD_UNDERPERFORM';
  return 'OTHER';
}

function groupBy(rows, getKey) {
  const map = new Map();
  rows.forEach(row => {
    const key = getKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

function buildIndustryStats(groups) {
  const stats = new Map();
  groups.forEach((rows, industry) => {
    const medians = {};
    const coverage = {};
    ALL_FIELDS.forEach(key => {
      const values = valueList(rows, key, key === 'PE' || key === 'PEG' ? value => value > 0 : undefined);
      medians[key] = median(values);
      coverage[key] = values.length;
    });
    stats.set(industry, { medians, coverage });
  });
  return stats;
}

function buildMarketValues(rows) {
  return Object.fromEntries(ALL_FIELDS.map(field => [
    field,
    valueList(rows, field, field === 'PE' || field === 'PEG' ? value => value > 0 : undefined)
  ]));
}

function valueList(rows, key, predicate = undefined) {
  return rows.map(row => row[key]).filter(value => isFiniteNumber(value) && (!predicate || predicate(value)));
}

function relativePercentile(industryRows, marketValues, value, key, minIndustrySize = 4) {
  if (!isFiniteNumber(value)) return 0.5;
  const predicate = key === 'PE' || key === 'PEG' ? item => item > 0 : undefined;
  const industryValues = valueList(industryRows, key, predicate);
  const base = industryValues.length >= minIndustrySize ? industryValues : marketValues;
  return percentileRank(base, value, 3);
}

function valuationPercentile(industryRows, marketPE, value, minIndustrySize = 4) {
  if (!isFiniteNumber(value) || value <= 0) return 0.5;
  const industryValues = valueList(industryRows, 'PE', v => v > 0);
  const base = industryValues.length >= minIndustrySize ? industryValues : marketPE;
  if (base.length < 2) return 0.5;
  return clamp(1 - percentileRank(base, value, 3), 0, 1);
}

function pegPercentile(industryRows, marketPEG, value, minIndustrySize = 4) {
  if (!isFiniteNumber(value) || value <= 0) return 0.5;
  const industryValues = valueList(industryRows, 'PEG', v => v > 0);
  const base = industryValues.length >= minIndustrySize ? industryValues : marketPEG;
  if (base.length < 2) return 0.5;
  return clamp(1 - percentileRank(base, value, 3), 0, 1);
}

function debtScore(value) {
  if (!isFiniteNumber(value)) return 0.5;
  if (value <= 0.5) return 1;
  if (value <= 1.0) return 0.80;
  if (value <= 2.0) return 0.50;
  if (value <= 3.0) return 0.25;
  return 0;
}

function weightedMarketExpression(row) {
  const values = [
    [row.RET1M, 0.10],
    [row.RET3M, 0.25],
    [row.RET6M, 0.35],
    [row.RET12M, 0.30]
  ].filter(([value]) => isFiniteNumber(value));

  if (!values.length) return null;
  const weight = values.reduce((sum, [, w]) => sum + w, 0);
  return values.reduce((sum, [value, w]) => sum + value * w, 0) / weight;
}

function weightedAvailable(parts, fallback = 0.5) {
  const valid = parts.filter(([, , available]) => available);
  if (!valid.length) return fallback;
  const weight = valid.reduce((sum, [, w]) => sum + w, 0);
  return valid.reduce((sum, [value, w]) => sum + value * w, 0) / weight;
}

function attachDataIntegrity(row, stats) {
  const flags = [];
  const references = {};
  let missingCore = 0;

  ALL_FIELDS.forEach(field => {
    const value = row[field];
    const valid = isFiniteNumber(value) && (!['PE', 'PEG'].includes(field) || value > 0);
    const industryMedian = stats.medians?.[field] ?? null;
    const industryCoverage = stats.coverage?.[field] ?? 0;
    const isCore = [...BUSINESS_FIELDS, ...VALUATION_FIELDS, ...MARKET_FIELDS].includes(field);

    references[field] = {
      status: valid ? 'AVAILABLE' : (industryMedian != null ? 'MISSING_WITH_INDUSTRY_REFERENCE' : 'MISSING_UNVERIFIED'),
      industryMedian,
      industryCoverage
    };

    if (!valid && isCore) {
      missingCore += 1;
      flags.push(industryMedian != null
        ? `MISSING_${field}: industry median ${formatRef(industryMedian)}`
        : `MISSING_${field}: no industry reference`);
    } else if (!valid && !isCore) {
      flags.push(industryMedian != null
        ? `OPTIONAL_MISSING_${field}: industry median ${formatRef(industryMedian)}`
        : `OPTIONAL_MISSING_${field}`);
    }
  });

  if (isFiniteNumber(row.EPSGROWTH) && isFiniteNumber(row.REVGROWTH) && row.EPSGROWTH - row.REVGROWTH > 0.50) {
    flags.push('EARNINGS_GROWTH_DIVERGENCE');
  }
  if (isFiniteNumber(row.DEBT) && row.DEBT > 2) flags.push('HIGH_LEVERAGE');

  row.DATA_FLAGS = [...new Set(flags)];
  row.DATA_REFERENCES = references;
  row.DATA_MISSING_CORE = missingCore;
}

function dataCoverage(row) {
  const available = ALL_FIELDS.filter(field => {
    const value = row[field];
    return isFiniteNumber(value) && (!['PE', 'PEG'].includes(field) || value > 0);
  }).length;
  return round2(100 * available / ALL_FIELDS.length);
}

function integrityLevel(row) {
  const missing = row.DATA_MISSING_CORE ?? 0;
  const flags = row.DATA_FLAGS?.length ?? 0;
  if (missing === 0 && flags === 0) return 'DATA_OK';
  if (missing <= 1 && flags <= 2) return 'DATA_PARTIAL';
  if (missing <= 3) return 'DATA_WARNING';
  return 'DATA_CRITICAL';
}

function formatRef(value) { return isFiniteNumber(value) ? round2(value) : 'N/A'; }

function percentileRank(values, value, minSize = 2) {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (!isFiniteNumber(value) || sorted.length < minSize) return 0.5;
  const below = sorted.filter(item => item < value).length;
  const equal = sorted.filter(item => item === value).length;
  const denominator = Math.max(1, sorted.length - 1);
  return clamp((below + 0.5 * Math.max(0, equal - 1)) / denominator, 0, 1);
}

function grade(score) {
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function median(values) {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(values, fallback = null) {
  const valid = values.filter(isFiniteNumber);
  if (!valid.length) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function round2(value) {
  return isFiniteNumber(value) ? Math.round(value * 100) / 100 : null;
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
