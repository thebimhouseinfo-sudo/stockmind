const CORE_FIELDS = [
  'PRICE', 'PE', 'ROE', 'ROIC', 'REVGROWTH', 'EPSGROWTH', 'DEBT',
  'RET1M', 'RET3M', 'RET6M', 'RET12M'
];
const OPTIONAL_FIELDS = ['PEG', 'AVGVOL', 'VOL'];
const ALL_FIELDS = [...CORE_FIELDS, ...OPTIONAL_FIELDS];

export function scoreStocks(rawRows) {
  const rows = rawRows.map(row => ({ ...row }));
  const marketValues = buildMarketValues(rows);
  const industryGroups = groupBy(rows, row => row.INDUSTRY || 'Unknown');
  const industryStats = buildIndustryStats(industryGroups);

  rows.forEach(row => {
    const stats = industryStats.get(row.INDUSTRY || 'Unknown') || {};
    attachDataIntegrity(row, stats);
    const industryRows = industryGroups.get(row.INDUSTRY || 'Unknown') || [];

    const roePct = relativePercentile(industryRows, marketValues.ROE, row.ROE, 'ROE', 4);
    const roicPct = relativePercentile(industryRows, marketValues.ROIC, row.ROIC, 'ROIC', 4);
    const revPct = relativePercentile(industryRows, marketValues.REVGROWTH, row.REVGROWTH, 'REVGROWTH', 4);
    const epsPct = relativePercentile(industryRows, marketValues.EPSGROWTH, row.EPSGROWTH, 'EPSGROWTH', 4);
    const pePct = valuationPercentile(industryRows, marketValues.PE, row.PE, 4);
    const pegPct = pegPercentile(industryRows, marketValues.PEG, row.PEG, 4);

    const qualityBase = weightedAvailable([
      [roePct, 0.40, isFiniteNumber(row.ROE)],
      [roicPct, 0.40, isFiniteNumber(row.ROIC)],
      [scoreDebt(row.DEBT), 0.20, isFiniteNumber(row.DEBT)]
    ], 0.50);
    row.QUALITY_SCORE = round2(100 * qualityBase);

    const growthBase = weightedAvailable([
      [revPct, 0.60, isFiniteNumber(row.REVGROWTH)],
      [epsPct, 0.40, isFiniteNumber(row.EPSGROWTH)]
    ], 0.50);
    row.GROWTH_SCORE = round2(100 * growthBase * scoreGrowthConsistency(row.REVGROWTH, row.EPSGROWTH));

    const valuationBase = weightedAvailable([
      [pePct, 0.60, isFiniteNumber(row.PE) && row.PE > 0],
      [pegPct, 0.40, isFiniteNumber(row.PEG) && row.PEG > 0]
    ], 0.50);
    row.VALUATION_SCORE = round2(100 * valuationBase);

    row.MICRO = round2(
      0.35 * row.QUALITY_SCORE +
      0.30 * row.GROWTH_SCORE +
      0.35 * row.VALUATION_SCORE
    );

    row.MOMENTUM_RAW = weightedMomentum(row);
  });

  const momentumValues = rows.map(row => row.MOMENTUM_RAW).filter(isFiniteNumber);

  rows.forEach(row => {
    const stats = industryStats.get(row.INDUSTRY || 'Unknown') || {};
    row.MOMENTUM = round2(100 * percentileRank(momentumValues, row.MOMENTUM_RAW, 3));
    row.MISPRICING = round2(opportunityScore(row, stats));

    row.FINALSCORE = round2(
      0.30 * row.QUALITY_SCORE +
      0.20 * row.GROWTH_SCORE +
      0.20 * row.VALUATION_SCORE +
      0.15 * row.MOMENTUM +
      0.15 * row.MISPRICING
    );

    row.GRADE = grade(row.FINALSCORE);
    row.INDUSTRY_MEDIAN_PE = stats.medians?.PE ?? null;
    row.INDUSTRY_MEDIAN_ROE = stats.medians?.ROE ?? null;
    row.INDUSTRY_REFERENCES = stats.medians ?? {};
    row.DATA_COVERAGE = dataCoverage(row);
    row.DATA_INTEGRITY = integrityLevel(row);
  });

  rows.sort((a, b) => {
    const scoreDiff = (b.FINALSCORE ?? -1) - (a.FINALSCORE ?? -1);
    if (scoreDiff !== 0) return scoreDiff;
    const momentumDiff = (b.MOMENTUM ?? -1) - (a.MOMENTUM ?? -1);
    if (momentumDiff !== 0) return momentumDiff;
    const coverageDiff = (b.DATA_COVERAGE ?? 0) - (a.DATA_COVERAGE ?? 0);
    if (coverageDiff !== 0) return coverageDiff;
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
    industryCount
  };
}

export function buildPrompt(stock) {
  const line = value => value == null ? 'chưa đủ dữ liệu' : value;
  const flags = Array.isArray(stock.DATA_FLAGS) && stock.DATA_FLAGS.length
    ? stock.DATA_FLAGS.join('; ')
    : 'Không có flag dữ liệu';

  return `Bạn là chuyên viên phân tích cổ phiếu Việt Nam cho một quỹ đầu tư kỷ luật.

Hãy phân tích mã ${stock.TICKER} trong ngành ${stock.INDUSTRY} dựa CHỈ trên dữ liệu được cung cấp. Nếu thiếu dữ liệu để kết luận, ghi rõ "chưa đủ dữ liệu", không bịa thông tin ngoài input.

Dữ liệu:
- Price: ${line(stock.PRICE)}
- P/E: ${line(stock.PE)}
- PEG: ${line(stock.PEG)}
- ROE: ${line(stock.ROE)}
- ROIC: ${line(stock.ROIC)}
- Revenue Growth: ${line(stock.REVGROWTH)}
- EPS Growth: ${line(stock.EPSGROWTH)}
- Debt Ratio: ${line(stock.DEBT)}
- Return 1M/3M/6M/12M: ${line(stock.RET1M)}/${line(stock.RET3M)}/${line(stock.RET6M)}/${line(stock.RET12M)}
- Quality Score: ${line(stock.QUALITY_SCORE)}
- Growth Score: ${line(stock.GROWTH_SCORE)}
- Valuation Score: ${line(stock.VALUATION_SCORE)}
- Micro Score: ${line(stock.MICRO)}
- Momentum Score: ${line(stock.MOMENTUM)}
- Opportunity Score: ${line(stock.MISPRICING)}
- Final Score: ${line(stock.FINALSCORE)}
- Rank: ${line(stock.RANK)}
- Grade: ${line(stock.GRADE)}
- Data Coverage: ${line(stock.DATA_COVERAGE)}%
- Data Integrity: ${line(stock.DATA_INTEGRITY)}
- Data Flags: ${flags}
- Industry median P/E: ${line(stock.INDUSTRY_MEDIAN_PE)}
- Industry median ROE: ${line(stock.INDUSTRY_MEDIAN_ROE)}

Data flags are screening alerts, not conclusions. Verify them with primary/company sources before making an investment judgment.`;
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
    stats.set(industry, { medians, coverage, medianPE: medians.PE, medianROE: medians.ROE });
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

function scoreDebt(value) {
  if (!isFiniteNumber(value)) return 0.5;
  if (value <= 0.5) return 1;
  if (value <= 1.0) return 0.80;
  if (value <= 2.0) return 0.50;
  if (value <= 3.0) return 0.25;
  return 0;
}

function scoreGrowthConsistency(revenueGrowth, epsGrowth) {
  if (!isFiniteNumber(revenueGrowth) || !isFiniteNumber(epsGrowth)) return 1;
  const gap = epsGrowth - revenueGrowth;
  if (gap <= 0.20) return 1;
  const penalty = clamp((gap - 0.20) / 0.80, 0, 1) * 0.25;
  return 1 - penalty;
}

function opportunityScore(row, stats) {
  const valuation = row.VALUATION_SCORE / 100;
  const quality = row.QUALITY_SCORE / 100;
  const momentum = row.MOMENTUM / 100;
  const growth = row.GROWTH_SCORE / 100;

  let score = 100 * (0.50 * valuation + 0.20 * quality + 0.20 * momentum + 0.10 * growth);

  if (isFiniteNumber(row.DEBT) && row.DEBT > 2) score -= 10;
  if (isFiniteNumber(row.DEBT) && row.DEBT > 3) score -= 10;
  if (isFiniteNumber(row.REVGROWTH) && isFiniteNumber(row.EPSGROWTH) && row.EPSGROWTH - row.REVGROWTH > 0.80) score -= 10;
  if (stats?.medianPE != null && isFiniteNumber(row.PE) && row.PE > 0 && row.PE < stats.medianPE) score += 3;

  return clamp(score, 0, 100);
}

function weightedMomentum(row) {
  const values = [[row.RET1M, 0.10], [row.RET3M, 0.25], [row.RET6M, 0.35], [row.RET12M, 0.30]];
  const valid = values.filter(([value]) => isFiniteNumber(value));
  if (!valid.length) return null;
  const weight = valid.reduce((sum, [, w]) => sum + w, 0);
  return valid.reduce((sum, [value, w]) => sum + value * w, 0) / weight;
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
    const isCore = CORE_FIELDS.includes(field);

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
  if (isFiniteNumber(row.VOL) && isFiniteNumber(row.AVGVOL) && row.AVGVOL > 0 && row.VOL < row.AVGVOL * 0.25) {
    flags.push('LOW_CURRENT_VOLUME');
  }

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

function round2(value) { return isFiniteNumber(value) ? Math.round(value * 100) / 100 : null; }
function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function isFiniteNumber(value) { return typeof value === 'number' && Number.isFinite(value); }
