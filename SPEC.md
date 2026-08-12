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
4. The scoring engine calculates sector-relative and market-relative scores.
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

## Scoring Model V2

The scorer is deterministic and designed for screening rather than deep investment judgment. It uses industry-relative ranks where the industry has enough observations and falls back to market-relative ranks for small groups.

### Percentile rules

- Percentile ranks are mid-ranked and normalized so the lowest comparable value is 0 and the highest is 1.
- For groups with fewer than 4 valid observations, use the market universe for that metric instead of treating the whole industry as neutral.
- Missing numeric values use a neutral 0.5 score.
- Non-positive P/E is not interpreted as "cheap" and receives a neutral valuation score of 50.

### Quality Score

```text
qualityScore = 100 * (
  0.40 * percentile(ROE)
+ 0.40 * percentile(ROIC)
+ 0.20 * debtSafety
)
```

Debt safety:

```text
debt <= 0.5  -> 1.00
debt <= 1.0  -> 0.80
debt <= 2.0  -> 0.50
debt <= 3.0  -> 0.25
debt >  3.0  -> 0.00
missing      -> 0.50
```

### Growth Score

```text
rawGrowth = 0.60 * percentile(REVGROWTH)
          + 0.40 * percentile(EPSGROWTH)

growthScore = 100 * rawGrowth * growthConsistency
```

Growth consistency is 1.0 when EPS growth is broadly consistent with revenue growth. A very large EPS-over-revenue gap reduces the score because headline EPS growth can be less reliable when it is not supported by top-line growth.

### Valuation Score

```text
valuationScore = 100 * (1 - percentile(positive P/E))
```

The comparison is performed within a sufficiently populated industry, otherwise against the market. Negative/zero P/E receives 50 rather than being ranked as an extreme bargain.

### Micro Score

```text
microScore = 0.35 * Quality
           + 0.30 * Growth
           + 0.35 * Valuation
```

Micro is a diagnostic summary for the dashboard. It is not added again into Final Score, which avoids double-counting the underlying factors.

### Momentum Score

```text
momentumRaw = 0.20 * RET1M
            + 0.30 * RET3M
            + 0.30 * RET6M
            + 0.20 * RET12M

momentumScore = 100 * percentile(momentumRaw across all stocks)
```

### Opportunity / Mispricing Score

This score estimates whether the valuation signal is supported by quality and market behavior rather than rewarding a low P/E by itself.

```text
opportunity = 0.50 * Valuation
            + 0.20 * Quality
            + 0.20 * Momentum
            + 0.10 * Growth
```

Adjustments:

```text
Debt > 2   -> -10
Debt > 3   -> additional -10
EPS growth - Revenue growth > 0.80 -> -10
PE below industry median -> +3 contextual bonus
```

The final value is clamped to 0–100.

### Final Score

```text
finalScore = 0.30 * Quality
           + 0.20 * Growth
           + 0.20 * Valuation
           + 0.15 * Momentum
           + 0.15 * Opportunity
```

This weighting is deliberately transparent and avoids counting `Micro` twice.

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
- Mispricing / Opportunity Score: {MISPRICING_SCORE}
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
