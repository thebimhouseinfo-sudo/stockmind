# Screener V2 — Implementation Plan

## Purpose

Redesign the Screener for the new StockMind architecture:

**TradingView → Screener → CRSM**

The Screener is a preliminary candidate selector. It still needs a score to distinguish stronger and weaker businesses, but it must not try to replace CRSM's deep research.

> **Important:** This document is a plan only. No implementation is specified until a real TradingView export is available and the input mapping has been validated.

---

## 1. Data Contract

### 1.1 TradingView Filter

Use TradingView only to remove clearly weak businesses and stocks with insufficient liquidity.

Initial filter candidates:

- Average Volume — minimum liquidity threshold
- Current Volume — minimum liquidity threshold
- ROE
- ROIC
- Debt/Equity
- Revenue Growth YoY
- EPS Growth YoY
- P/E

Performance and detailed volume behavior are **not hard filters**.

### 1.2 TradingView Data

Export as much useful data as TradingView actually provides, without assuming fields that may not exist.

Potential groups:

- Ticker / Company
- Sector / Industry
- Price
- Performance by available periods
- Volume
- Average Volume and available period variants
- Relative Volume, if available
- Fundamentals
- Growth
- Margins
- Balance sheet
- Cash flow
- Valuation
- Earnings / revenue surprise

The final field list must be based on a real TradingView export.

---

## 2. Data Mapping

After obtaining a real TradingView export, create a complete mapping:

**TradingView field → internal field → type → intended use → notes**

Validate:

- field names
- units and percentage representation
- positive/negative values
- `N/A`, `-`, blank and other missing-value forms
- numeric vs text values
- currency/unit differences
- duplicate or ambiguous fields
- period definitions

Do **not** finalize formulas before this mapping is validated.

---

## 3. Data Normalization

Normalize the real TradingView input into a stable internal representation.

Requirements:

- preserve original evidence where useful
- distinguish missing from zero
- avoid invented replacement values
- preserve negative values correctly
- preserve source period information
- make normalization deterministic

No synthetic historical price or volume data should be created from a snapshot.

---

## 4. Screener Score

The Screener keeps a score, but the score is deliberately simpler than the previous strategy.

### 4.1 Business Quality

Candidate inputs:

- ROE
- ROIC
- Revenue Growth
- EPS Growth
- Debt/Equity

Purpose:

> Is this business preliminarily good or weak?

### 4.2 Valuation

Candidate inputs:

- P/E
- PEG
- P/B or other valuation fields only if the real input supports them reliably

Purpose:

> Is the current valuation worth attention?

### 4.3 Market Expression

Candidate inputs:

- Performance 1M
- Performance 3M
- Performance 6M
- Performance 1Y
- available volume evidence

Purpose:

> How is the market currently behaving around the stock?

Volume should be treated as evidence for market behavior, not as a business-quality measure. If only limited volume data is available, do not manufacture additional periods.

### 4.4 Final Screening Score

The final score combines the three components:

- Business Quality
- Valuation
- Market Expression

Exact normalization, weighting and handling of missing metrics must be determined **after inspecting real TradingView data**.

The Screener score is a ranking aid, not an investment decision.

---

## 5. Flags

Missing or unusual data must remain visible rather than being silently replaced.

Candidate flags include:

- Missing fundamental data
- Missing valuation data
- Missing market data
- EPS / Revenue divergence
- Excessive leverage
- Abnormal valuation
- Insufficient data coverage
- Other material data anomalies discovered during implementation

A flag does not automatically make a stock bad. It marks something that may require CRSM verification.

Do not silently replace missing company metrics with industry medians in the Screener.

---

## 6. Screener → CRSM Data Contract

CRSM should receive both the derived screening information and the underlying TradingView evidence.

Expected conceptual payload:

- raw/normalized TradingView data
- Business Score
- Valuation Score
- Market Score
- Final Screening Score
- Rank
- preliminary classification
- flags
- data coverage / integrity information

The Screener should not compress all evidence into scores only.

### Node 1 role

When a stock comes from the Screener, Node 1 should primarily:

- verify missing information
- investigate flagged or anomalous information
- retrieve information not available from TradingView
- obtain newer or authoritative information when necessary

It should **not unnecessarily re-fetch data already supplied by TradingView**.

### Manual check

Manual ticker analysis remains supported. Without Screener data, Node 1 may need to collect and verify the required information from external sources before CRSM analysis.

---

## 7. Dashboard Contract

Dashboard is separate from Screener calculation.

It will contain two ranking tables:

### 7.1 Good — View Now / Potential Buy

Stocks with strong preliminary business quality and favorable current market expression, ranked by Screening Score.

### 7.2 Good — Undervalued / Underperform

Stocks with good preliminary business quality and attractive preliminary valuation signals but weak/underperforming market expression.

This table may be empty when no candidates meet the classification criteria.

Flags remain attached to stocks and are not used to create a separate Dashboard ranking table.

Dashboard should show only a small set of key metrics per stock rather than the full Screener dataset.

---

## 8. Validation With Real TradingView Data

This phase must happen **before implementation**.

Use a real export from the newly designed TradingView table to validate:

1. field availability
2. field names and mapping
3. units and formats
4. missing-value behavior
5. period definitions
6. volume fields and units
7. price/performance fields
8. score inputs
9. score behavior with missing metrics
10. flag behavior
11. ranking behavior
12. Dashboard classification inputs
13. Screener → CRSM payload completeness

Only after this validation should the exact formulas, weights and implementation details be finalized.

---

## 9. Implementation

After the real-data validation is complete:

1. implement the normalized data contract
2. implement metric mapping
3. implement Business Quality scoring
4. implement Valuation scoring
5. implement Market Expression scoring
6. implement final Screening Score and ranking
7. implement flags and data coverage
8. update Screener → CRSM payload
9. update Dashboard classification/output
10. add tests for the new strategy

No compatibility requirement with the old AppScript scoring strategy is imposed. The old implementation is reference material only where useful for understanding legacy fields or behavior.

---

## Guiding Principles

- **Filter less, collect more.**
- TradingView removes clearly weak / illiquid candidates and supplies hard-to-obtain market data.
- The Screener scores candidates so stronger and weaker businesses can be ranked.
- The Screener performs preliminary evaluation only.
- Missing data is flagged, not invented.
- Volume and price-performance data are evidence for CRSM, not automatically hard filters.
- CRSM performs deep verification and investment analysis.
- Manual ticker analysis remains available outside the Screener flow.
