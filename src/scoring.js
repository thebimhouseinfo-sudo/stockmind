export function scoreStocks(rawRows) {
  const rows = rawRows.map(row => ({ ...row }));
  const marketValues = buildMarketValues(rows);
  const industryGroups = groupBy(rows, row => row.INDUSTRY || 'Unknown');
  const industryStats = buildIndustryStats(industryGroups);

  rows.forEach(row => {
    const industryRows = industryGroups.get(row.INDUSTRY || 'Unknown') || [];

    const roePct = relativePercentile(industryRows, marketValues.ROE, row.ROE, 4);
    const roicPct = relativePercentile(industryRows, marketValues.ROIC, row.ROIC, 4);
    const revPct = relativePercentile(industryRows, marketValues.REVGROWTH, row.REVGROWTH, 4);
    const epsPct = relativePercentile(industryRows, marketValues.EPSGROWTH, row.EPSGROWTH, 4);
    const pePct = valuationPercentile(industryRows, marketValues.PE, row.PE, 4);

    const debtSafety = scoreDebt(row.DEBT);
    const growthConsistency = scoreGrowthConsistency(row.REVGROWTH, row.EPSGROWTH);

    // Quality = profitability + capital efficiency + leverage safety.
    row.QUALITY_SCORE = round2(100 * (
      0.40 * roePct +
      0.40 * roicPct +
      0.20 * debtSafety
    ));

    // Growth rewards revenue first, with EPS as a secondary confirmation.
    // A very large EPS-vs-revenue disconnect is treated as lower-quality growth,
    // not automatically as stronger growth.
    const rawGrowth = 0.60 * revPct + 0.40 * epsPct;
    row.GROWTH_SCORE = round2(100 * rawGrowth * growthConsistency);

    // Valuation is sector-relative. Non-positive P/E is not interpreted as "cheap".
    row.VALUATION_SCORE = round2(100 * pePct);

    // Micro is a compact diagnostic view, not an independent extra reward in Final Score.
    row.MICRO = round2(
      0.35 * row.QUALITY_SCORE +
      0.30 * row.GROWTH_SCORE +
      0.35 * row.VALUATION_SCORE
    );

    row.MOMENTUM_RAW = weightedMomentum(row);
  });

  const momentumValues = rows
    .map(row => row.MOMENTUM_RAW)
    .filter(isFiniteNumber);

  rows.forEach(row => {
    const stats = industryStats.get(row.INDUSTRY || 'Unknown') || {};
    const momentumPct = percentileRank(momentumValues, row.MOMENTUM_RAW, 3);

    row.MOMENTUM = round2(100 * momentumPct);
    row.MISPRICING = round2(opportunityScore(row, stats));

    // Final score uses the six displayed concepts without double-counting MICRO.
    // MICRO remains useful for diagnostics, while Final stays transparent:
    // Quality 30 + Growth 20 + Valuation 20 + Momentum 15 + Opportunity 15.
    row.FINALSCORE = round2(
      0.30 * row.QUALITY_SCORE +
      0.20 * row.GROWTH_SCORE +
      0.20 * row.VALUATION_SCORE +
      0.15 * row.MOMENTUM +
      0.15 * row.MISPRICING
    );

    row.GRADE = grade(row.FINALSCORE);
    row.INDUSTRY_MEDIAN_PE = stats.medianPE ?? null;
    row.INDUSTRY_MEDIAN_ROE = stats.medianROE ?? null;
  });

  rows
    .sort((a, b) => {
      const scoreDiff = (b.FINALSCORE ?? -1) - (a.FINALSCORE ?? -1);
      if (scoreDiff !== 0) return scoreDiff;
      const momentumDiff = (b.MOMENTUM ?? -1) - (a.MOMENTUM ?? -1);
      if (momentumDiff !== 0) return momentumDiff;
      return String(a.TICKER || '').localeCompare(String(b.TICKER || ''));
    })
    .forEach((row, index) => {
      row.RANK = index + 1;
    });

  return rows;
}

export function buildStats(rows) {
  const industryCount = {};
  rows.forEach(row => {
    industryCount[row.INDUSTRY] = (industryCount[row.INDUSTRY] || 0) + 1;
  });

  return {
    total: rows.length,
    avgScore: round2(average(rows.map(row => row.FINALSCORE), 0)),
    top10: [...rows].sort((a, b) => b.FINALSCORE - a.FINALSCORE).slice(0, 10),
    industryCount
  };
}

export function buildPrompt(stock) {
  const line = value => value == null ? 'chưa đủ dữ liệu' : value;

  return `Bạn là chuyên viên phân tích cổ phiếu Việt Nam cho một quỹ đầu tư kỷ luật.

Hãy phân tích mã ${stock.TICKER} trong ngành ${stock.INDUSTRY} dựa CHỈ trên dữ liệu được cung cấp. Nếu thiếu dữ liệu để kết luận, ghi rõ "chưa đủ dữ liệu", không bịa thông tin ngoài input.

Dữ liệu:
- Price: ${line(stock.PRICE)}
- P/E: ${line(stock.PE)}
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
- Mispricing / Opportunity Score: ${line(stock.MISPRICING)}
- Final Score: ${line(stock.FINALSCORE)}
- Rank: ${line(stock.RANK)}
- Grade: ${line(stock.GRADE)}
- Industry median P/E: ${line(stock.INDUSTRY_MEDIAN_PE)}
- Industry median ROE: ${line(stock.INDUSTRY_MEDIAN_ROE)}

Trả về JSON thuần, tiếng Việt, không markdown:

{
  "action": "MUA/THEO_DOI/TRACH",
  "confidence": 0-100,
  "summary": "1 câu kết luận đầu tư",
  "why_now": "vì sao đáng chú ý hiện tại",
  "quality": "đánh giá chất lượng nội tại",
  "valuation": "định giá rẻ/hợp lý/đắt dựa trên P/E và so sánh ngành",
  "momentum": "đánh giá động lượng giá",
  "risk": ["rủi ro 1", "rủi ro 2", "rủi ro 3"],
  "entry_plan": {
    "entry_zone": "vùng mua đề xuất hoặc THEO DÕI",
    "stop_loss": "mức cắt lỗ định tính/dựa trên %",
    "take_profit": "vùng chốt lời định tính/dựa trên upside"
  },
  "missing_data": ["các dữ liệu cần bổ sung nếu có"]
}`;
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
    stats.set(industry, {
      medianPE: median(valueList(rows, 'PE', value => value > 0)),
      medianROE: median(valueList(rows, 'ROE'))
    });
  });
  return stats;
}

function buildMarketValues(rows) {
  const fields = ['ROE', 'ROIC', 'REVGROWTH', 'EPSGROWTH', 'PE'];
  return Object.fromEntries(
    fields.map(field => [field, valueList(rows, field, field === 'PE' ? value => value > 0 : undefined)])
  );
}

function valueList(rows, key, predicate = undefined) {
  return rows
    .map(row => row[key])
    .filter(value => isFiniteNumber(value) && (!predicate || predicate(value)));
}

function relativePercentile(industryRows, marketValues, value, minIndustrySize = 4) {
  if (!isFiniteNumber(value)) return 0.5;
  const industryValues = valueList(industryRows, getKeyByReference(value));
  if (industryValues.length >= minIndustrySize) {
    return percentileRank(industryValues, value, 3);
  }
  return percentileRank(marketValues, value, 3);
}

// Used only to choose the same numeric field from an industry row.
function getKeyByReference(value) {
  return Number.isFinite(value) ? '__VALUE__' : '__VALUE__';
}

function valuationPercentile(industryRows, marketPE, value, minIndustrySize = 4) {
  if (!isFiniteNumber(value) || value <= 0) return 0.5;
  const industryValues = valueList(industryRows, 'PE', v => v > 0);
  const base = industryValues.length >= minIndustrySize ? industryValues : marketPE;
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

  // Positive operating growth with only a modest EPS lead gets full credit.
  // Very large EPS-vs-revenue gaps are treated as a quality warning.
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

  let score = 100 * (
    0.50 * valuation +
    0.20 * quality +
    0.20 * momentum +
    0.10 * growth
  );

  // Explicit risk adjustments: leverage and low-quality growth should not be
  // rewarded as "mispricing" merely because P/E is low.
  if (isFiniteNumber(row.DEBT) && row.DEBT > 2) score -= 10;
  if (isFiniteNumber(row.DEBT) && row.DEBT > 3) score -= 10;

  if (isFiniteNumber(row.REVGROWTH) && isFiniteNumber(row.EPSGROWTH)) {
    if (row.EPSGROWTH - row.REVGROWTH > 0.80) score -= 10;
  }

  // Keep industry median available for explanation/context even when no PE exists.
  if (stats?.medianPE != null && isFiniteNumber(row.PE) && row.PE > 0 && row.PE < stats.medianPE) {
    score += 3;
  }

  return clamp(score, 0, 100);
}

function weightedMomentum(row) {
  const values = [
    [row.RET1M, 0.20],
    [row.RET3M, 0.30],
    [row.RET6M, 0.30],
    [row.RET12M, 0.20]
  ];

  const valid = values.filter(([value]) => isFiniteNumber(value));
  if (!valid.length) return null;
  const weight = valid.reduce((sum, [, w]) => sum + w, 0);
  return valid.reduce((sum, [value, w]) => sum + value * w, 0) / weight;
}

function percentileRank(values, value, minSize = 2) {
  const sorted = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (!isFiniteNumber(value) || sorted.length < minSize) return 0.5;

  const below = sorted.filter(item => item < value).length;
  const equal = sorted.filter(item => item === value).length;
  const denominator = Math.max(1, sorted.length - 1);

  // Mid-rank percentile: min -> 0, max -> 1, ties share their midpoint.
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}
