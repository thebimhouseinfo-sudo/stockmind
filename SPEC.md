# Stock Mind Standalone Spec

## Goal

Stock Mind becomes a standalone web application. The user copies a TradingView screener table, pastes it into the app, and the app handles parsing, cleaning, scoring, ranking, dashboarding, and AI prompt generation without Google Sheets or Apps Script.

## Non Goals For V1

- No automatic TradingView scraping.
- No broker integration.
- No paid database dependency.
- No server-side portfolio storage.

## Primary Workflow

1. Copy rows from TradingView Screener.
2. Paste into Stock Mind.
3. The app detects columns, normalizes values, validates missing fields, and builds a clean dataset.
4. The scoring engine calculates industry-relative and market-relative scores.
5. The user reviews dashboard, ranking table, and detail view.
6. The user copies an optimized AI prompt for a selected ticker.
7. Data can be saved locally by the browser and exported as JSON.

## Required Input Columns

The parser accepts common aliases for each canonical field:

| Canonical field | Examples |
| --- | --- |
| TICKER | Ticker, Symbol, Mã |
| INDUSTRY | Industry, Sector, Ngành |
| AVGVOL | Avg Vol, Average Volume, Vol Avg |
| PRICE | Price, Last, Close |
| PE | P/E, PE, Price to Earnings |
| ROE | ROE, Return on Equity |
| ROIC | ROIC, Return on Invested Capital |
| REVGROWTH | Revenue Growth, Revenue_Growth, Sales Growth |
| EPSGROWTH | EPS Growth, EPS_Growth |
| DEBT | Debt Ratio, Debt/Equity, D/E |
| RET1M | Return 1M, 1M Perf |
| RET3M | Return 3M, 3M Perf |
| RET6M | Return 6M, 6M Perf |
| RET12M | Return 12M, 1Y Perf |

## Cleaning Rules

- Empty strings, dash, em dash, and TradingView missing marks become `null`.
- Unicode minus is converted to normal `-`.
- Percent values become decimal values. Example: `12.5%` becomes `0.125`.
- Commas used as thousands separators are removed.
- Numeric strings are parsed conservatively.

## Scoring Model V1

Scores use a 0-100 scale so the output is readable and comparable.

### Industry Relative Scores

For each industry peer group:

```text
roePct = percentileRank(ROE within industry)
roicPct = percentileRank(ROIC within industry)
growthPct = average(
  percentileRank(REVGROWTH within industry),
  percentileRank(EPSGROWTH within industry)
)
pePct = 1 - percentileRank(PE within industry)
```

When a peer group is too small or a value is missing, the neutral fallback is `0.5`.

### Quality Score

```text
debtSafety = DEBT <= 0.5 ? 1
           : DEBT <= 1.0 ? 0.75
           : DEBT <= 2.0 ? 0.45
           : 0.15

qualityScore = 100 * (0.45 * roePct + 0.45 * roicPct + 0.10 * debtSafety)
```

### Growth Score

```text
growthScore = 100 * growthPct
```

### Valuation Score

```text
valuationScore = 100 * pePct
```

### Micro Score

```text
microScore = 0.40 * qualityScore + 0.30 * growthScore + 0.30 * valuationScore
```

### Momentum Score

```text
momentumRaw = 0.20 * RET1M + 0.30 * RET3M + 0.30 * RET6M + 0.20 * RET12M
momentumScore = 100 * percentileRank(momentumRaw across all stocks)
```

### Mispricing Score

```text
panicSignal = RET1M < -0.20 && qualityScore >= 60 ? 20 : 0
earningsSignal = EPSGROWTH > 0 ? 15 : -15
debtSignal = DEBT > 2 ? -15 : 10
valuationSignal = PE below industry median ? 15 : 0

mispricingScore = clamp(50 + panicSignal + earningsSignal + debtSignal + valuationSignal, 0, 100)
```

### Final Score

```text
finalScore = 0.45 * microScore + 0.30 * momentumScore + 0.25 * mispricingScore
```

### Grade

```text
A+ >= 85
A  >= 75
B  >= 65
C  >= 50
D  <  50
```

## AI Prompt Policy

The AI prompt must:

- Use only computed and pasted data.
- Explicitly say when data is missing.
- Return JSON only.
- Avoid pretending to know business details, historical valuation, leadership quality, or catalysts unless those data are provided later.
- Separate quantitative signal from investment judgment.

## Optimized AI Prompt Template

```text
Bạn là chuyên viên phân tích cổ phiếu Việt Nam cho một quỹ đầu tư kỷ luật.

Hãy phân tích mã {TICKER} trong ngành {INDUSTRY} dựa CHỈ trên dữ liệu được cung cấp. Nếu thiếu dữ liệu để kết luận, ghi rõ "chưa đủ dữ liệu", không bịa thông tin ngoài input.

Dữ liệu:
- Price: {PRICE}
- P/E: {PE}
- ROE: {ROE}
- ROIC: {ROIC}
- Revenue Growth: {REVGROWTH}
- EPS Growth: {EPSGROWTH}
- Debt Ratio: {DEBT}
- Return 1M/3M/6M/12M: {RET1M}/{RET3M}/{RET6M}/{RET12M}
- Quality Score: {QUALITY_SCORE}
- Growth Score: {GROWTH_SCORE}
- Valuation Score: {VALUATION_SCORE}
- Micro Score: {MICRO_SCORE}
- Momentum Score: {MOMENTUM_SCORE}
- Mispricing Score: {MISPRICING_SCORE}
- Final Score: {FINAL_SCORE}
- Rank: {RANK}
- Grade: {GRADE}
- Industry median P/E: {INDUSTRY_MEDIAN_PE}
- Industry median ROE: {INDUSTRY_MEDIAN_ROE}

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
}
```
