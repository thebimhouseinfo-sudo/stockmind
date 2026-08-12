export function scoreStocks(rawRows) {
  const rows = rawRows.map(row => ({ ...row }));
  const industryGroups = groupBy(rows, row => row.INDUSTRY || 'Unknown');
  const industryStats = buildIndustryStats(industryGroups);

  rows.forEach(row => {
    const peers = industryGroups.get(row.INDUSTRY || 'Unknown') || rows;
    const roePct = percentileRank(valueList(peers, 'ROE'), row.ROE);
    const roicPct = percentileRank(valueList(peers, 'ROIC'), row.ROIC);
    const revPct = percentileRank(valueList(peers, 'REVGROWTH'), row.REVGROWTH);
    const epsPct = percentileRank(valueList(peers, 'EPSGROWTH'), row.EPSGROWTH);
    const pePct = 1 - percentileRank(valueList(peers, 'PE'), row.PE);
    const growthPct = average([revPct, epsPct], 0.5);
    const debtSafety = scoreDebt(row.DEBT);

    row.QUALITY_SCORE = round2(100 * (0.45 * roePct + 0.45 * roicPct + 0.10 * debtSafety));
    row.GROWTH_SCORE = round2(100 * growthPct);
    row.VALUATION_SCORE = round2(100 * pePct);
    row.MICRO = round2(0.40 * row.QUALITY_SCORE + 0.30 * row.GROWTH_SCORE + 0.30 * row.VALUATION_SCORE);
    row.MOMENTUM_RAW = weightedMomentum(row);
  });

  const momentumValues = rows.map(row => row.MOMENTUM_RAW).filter(isFiniteNumber);

  rows.forEach(row => {
    const stats = industryStats.get(row.INDUSTRY || 'Unknown') || {};
    row.MOMENTUM = round2(100 * percentileRank(momentumValues, row.MOMENTUM_RAW));
    row.MISPRICING = round2(mispricingScore(row, stats));
    row.FINALSCORE = round2(0.45 * row.MICRO + 0.30 * row.MOMENTUM + 0.25 * row.MISPRICING);
    row.GRADE = grade(row.FINALSCORE);
    row.INDUSTRY_MEDIAN_PE = stats.medianPE ?? null;
    row.INDUSTRY_MEDIAN_ROE = stats.medianROE ?? null;
  });

  rows
    .sort((a, b) => (b.FINALSCORE ?? -1) - (a.FINALSCORE ?? -1))
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
- Mispricing Score: ${line(stock.MISPRICING)}
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
      medianPE: round2(median(valueList(rows, 'PE'))),
      medianROE: round2(median(valueList(rows, 'ROE')))
    });
  });
  return stats;
}

function valueList(rows, key) {
  return rows.map(row => row[key]).filter(isFiniteNumber);
}

function percentileRank(values, value) {
  if (!isFiniteNumber(value) || values.length < 2) return 0.5;
  const sorted = [...values].filter(isFiniteNumber).sort((a, b) => a - b);
  if (sorted.length < 2) return 0.5;

  let below = 0;
  let equal = 0;
  sorted.forEach(item => {
    if (item < value) below += 1;
    if (item === value) equal += 1;
  });

  return clamp((below + 0.5 * equal) / sorted.length, 0, 1);
}

function scoreDebt(value) {
  if (!isFiniteNumber(value)) return 0.5;
  if (value <= 0.5) return 1;
  if (value <= 1) return 0.75;
  if (value <= 2) return 0.45;
  return 0.15;
}

function weightedMomentum(row) {
  const values = [
    [row.RET1M, 0.2],
    [row.RET3M, 0.3],
    [row.RET6M, 0.3],
    [row.RET12M, 0.2]
  ];

  const valid = values.filter(([value]) => isFiniteNumber(value));
  if (!valid.length) return null;
  const weight = valid.reduce((sum, [, w]) => sum + w, 0);
  return valid.reduce((sum, [value, w]) => sum + value * w, 0) / weight;
}

function mispricingScore(row, stats) {
  const panicSignal = row.RET1M < -0.2 && row.QUALITY_SCORE >= 60 ? 20 : 0;
  const earningsSignal = row.EPSGROWTH > 0 ? 15 : -15;
  const debtSignal = row.DEBT > 2 ? -15 : 10;
  const valuationSignal = isFiniteNumber(row.PE) && isFiniteNumber(stats.medianPE) && row.PE < stats.medianPE ? 15 : 0;
  return clamp(50 + panicSignal + earningsSignal + debtSignal + valuationSignal, 0, 100);
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
