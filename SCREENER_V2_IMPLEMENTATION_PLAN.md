# Screener V2 — Implementation Plan

## 0. Purpose

Redesign Stock Mind Screener around the current TradingView dataset. Legacy formulas, thresholds and classifications are reference material only.

Target flow:

```text
TradingView clipboard
  ↓
Parser / Ingestion
  ↓
Internal dataset
  ↓
Screener Evaluation V2
  ↓
Ranking / Classification
  ↓
Dashboard + Ranking
  ↓
User selects stock
  ↓
Explicit CRSM action
  ↓
Node 1
```

**Screener never automatically starts CRSM.** Dashboard and Ranking are the end of the automated Screener flow; the user is the decision point before deep analysis.

---

# 1. Current Checkpoint — TradingView Ingestion

## 1.1 Source format

Each TradingView stock record is four lines:

1. Ticker / Symbol
2. Company name
3. UI marker `D`
4. 46 analytical fields separated by TAB

`D` is UI metadata and is ignored.

Symbol + company are mapped to:

- `ticker`
- `company_name`

## 1.2 Mapping status

The 46 analytical fields were validated against raw TradingView data using the Mapping tab and raw clipboard inspector.

**Mapping: PASS.**

The Mapping UI exists specifically because a correct ticker does not prove that the remaining columns are correct.

---

# 2. Data Contract — Preserve Meaning, Decode Quantities

The ingestion layer restores source meaning. It does not perform investment judgment or scoring transformations.

## 2.1 Percentage fields

Percentages are stored as **percentage points**.

```text
-0.58%  → -0.58
+4.86%  → 4.86
8%      → 8
-37.12% → -37.12
```

Never divide these values by 100 during ingestion.

## 2.2 Ratio fields

True ratios stay ratios.

```text
PEG              0.06
Current Ratio    1.02
Debt/Equity      0.65
Relative Volume  0.46
P/E              29.82
```

Never multiply ratios by 100.

## 2.3 Quantity fields

TradingView uses compact suffixes and separators to save table space. Stock Mind should decode the following quantity fields into full numeric quantities:

- `market_cap`
- `price`
- `volume`
- `avg_volume_10d`
- `avg_volume_30d`
- `avg_volume_60d`
- `revenue_fq`
- `revenue_fy`
- `revenue_ttm`
- `fcf_ttm`

Examples:

```text
148.69 T → 148,690,000,000,000
6.26 B   → 6,260,000,000
1.58 M   → 1,580,000
857.4 K  → 857,400
41.000   → 41,000
17.600   → 17,600
```

This is **display-format decoding**, not scoring.

## 2.4 Field-specific parsing

Do not use one generic numeric parser for all fields. The parser must distinguish:

- percentage
- ratio
- quantity
- text
- missing
- invalid/unparseable

For example:

```text
41.000 Price → 41,000
41.000 P/E   → 41.0
```

Missing never becomes zero.

FQ/FY/TTM remain separate.

---

# 3. Target Architecture

```text
TradingView Raw
      ↓
Ingestion / Parser
      ↓
Internal Dataset
      ├───────────────┐
      ↓               ↓
Evaluation       Signal / Anomaly
      ↓               ↓
      └───────┬───────┘
              ↓
      Screener Result Set
          ┌────┴────┐
          ↓         ↓
      Dashboard   Ranking
          │         │
          └────┬────┘
               ↓
        User selects stock
               ↓
       Explicit CRSM action
               ↓
             Node 1
```

Raw, Derived and Signal representations are separate.

---

# 4. Dashboard and Ranking Boundary

After evaluation, Dashboard contains exactly four primary tables:

1. **Core Performers**
2. **Quality Underperformers**
3. **High Reward / High Risk**
4. **Avoid / Value Trap**

The existing **Ranking tab remains**.

Dashboard and Ranking must consume the **same Screener Result Set**. They must not calculate separate scores.

A stock normally has one primary classification and may carry multiple signal tags.

If evidence is insufficient, the stock may remain Watch / Neutral / Unclassified rather than being forced into one of the four investment tables.

### CRSM

There is **no automatic candidate gate and no automatic handoff**.

When the user explicitly chooses a stock and starts CRSM:

```text
Selected stock
  ↓
Screener result
  ↓
Screener context builder
  ↓
Node 1
```

Node 1 performs deeper research and verification. Screener does not invent catalysts, legal/project stories or qualitative explanations unavailable from the source data.

---

# 5. Phase 1 — Freeze and Validate the Data Layer

### Tasks

- [x] Four-line TradingView parser is primary parser.
- [x] Mapping visual verification exists.
- [x] Raw Clipboard Inspector / Parser Debug exists.
- [x] Ticker/company separation validated.
- [x] 46-field mapping validated.
- [ ] Validate all quantity decoding across the full dataset.
- [ ] Validate percentage semantics across the full dataset.
- [ ] Validate missing/invalid states.
- [ ] Re-run raw TradingView vs reconstructed table after the quantity-decoding update.

### Acceptance

The reconstructed table must match raw TradingView by ticker and field meaning, with full quantities, percentage points, ratios, text and explicit missing values.

---

# 6. Phase 2 — Audit Legacy Screener

Inventory:

- filters
- formulas
- thresholds
- weights
- score ranges
- ranking rules
- classification rules
- missing-data behavior
- exclusions
- legacy aliases
- old Node 1 context

Each legacy rule becomes:

`Keep / Adapt / Replace / Remove / Review`

Legacy is never retained merely because it already exists.

---

# 7. Phase 3 — Universe and Row States

Define what enters the evaluation universe.

At minimum distinguish:

```text
VALID_SCOREABLE
VALID_WITH_DATA_GAPS
INVALID / UNSCOREABLE
```

Do not let a row with only a valid ticker receive a fabricated score.

### Liquidity

Do not automatically preserve a hard filter such as `Volume > 30K`. Liquidity must be evaluated as one or more of:

- risk signal
- scoring input
- context
- limited eligibility rule

The goal is to avoid destroying the candidate universe too early.

The current ~76-stock set is a validation universe, not a list to overfit.

---

# 8. Phase 4 — Field Role Mapping

Every current field must have one explicit role:

- Raw Evidence
- Scoring Input
- Derived Input
- Anomaly Trigger
- Context
- Unused

For each field document:

```text
source label
internal name
unit
period
missing semantics
role
possible factor
ranking direction
ranking universe
anomaly usage
notes
```

FQ/FY/TTM must not be silently merged. Decide whether each is independently scored, compared for consistency/trend, used as signal/context, or unused.

---

# 9. Phase 5 — Raw / Derived / Signal Contract

## Raw

Mapped source meaning. Never overwritten for scoring.

## Derived

Evaluation-only calculations, for example:

```text
FCF Yield
Volume Trend
Drawdown from High 52W
Upside to High 52W
Momentum Reversal
Range Volatility
Growth Divergence
```

## Signal / Anomaly

Machine-readable warnings such as:

```text
EXTREME_GROWTH
EARNINGS_QUALITY_CONCERN
VALUE_TRAP_WARNING
DEEP_DRAWDOWN
HIGH_LEVERAGE
LOW_LIQUIDITY
DATA_GAP
```

An anomaly is not automatically a score penalty.

Example:

```text
Raw EPS Growth = +640%
Derived scoring value = robust/ranked representation
Signal = EXTREME_EPS_GROWTH
```

---

# 10. Phase 6 — Relative Ranking Design

Relative ranking should replace arbitrary thresholds where appropriate.

## Direction

Every scoring metric declares:

```text
HIGHER_IS_BETTER
LOWER_IS_BETTER
TWO_SIDED / OPTIMAL_RANGE
CONTEXT_ONLY
```

Do not use `1/x` for valuation direction. Use explicit ranking direction to avoid zero/negative-value problems.

## Granularity

Each metric must declare:

```text
GLOBAL
SECTOR
INDUSTRY
```

Global should be the initial default; sector/industry ranking should be used only when the sample size and metric semantics justify it.

## Extreme values

Do not automatically winsorize everything at 1–99%.

Use bounded transforms, robust ranking or anomaly signals where needed. Raw values remain intact.

---

# 11. Phase 7 — Missing Data and Coverage

Missing is not zero and does not automatically mean poor business quality.

Per-factor policy must define whether missing inputs:

- reduce coverage
- are excluded from the factor
- create a DATA_GAP signal
- make the factor unscoreable
- block classification only when critical

Every factor should expose coverage, e.g.:

```text
Valuation Score      78
Valuation Coverage   4/6
Signal               DATA_GAP_VALUATION
```

---

# 12. Phase 8 — Signal / Anomaly Engine

Initial signal families to review:

### Earnings quality
- `EARNINGS_QUALITY_CONCERN`
- `NEGATIVE_OPERATING_MARGIN`
- `NET_MARGIN_FAR_ABOVE_OPERATING_MARGIN`
- `FCF_NEGATIVE_DESPITE_PROFIT`

### Growth
- `EXTREME_REVENUE_GROWTH`
- `EXTREME_EPS_GROWTH`
- `GROWTH_ACCELERATION`
- `GROWTH_DIVERGENCE`
- `EXTREME_FCF_GROWTH`

### Financial safety
- `HIGH_LEVERAGE`
- `WEAK_CURRENT_RATIO`
- `WEAK_QUICK_RATIO`
- `NEGATIVE_FCF`

### Market behavior
- `DEEP_DRAWDOWN`
- `MOMENTUM_REVERSAL`
- `UNUSUAL_RELATIVE_VOLUME`
- `LOW_LIQUIDITY`

### Data quality
- `DATA_GAP_CRITICAL`
- `DATA_GAP_VALUATION`
- `DATA_GAP_FCF`
- `DATA_GAP_GROWTH`
- `INVALID_PE`
- `INVALID_PEG`
- `PARSE_WARNING`

Signals should expose severity and evidence fields. They tell the system/user what needs attention; they do not automatically determine the investment outcome.

---

# 13. Phase 9 — Factor Evaluation Model

Factor architecture must be designed before final weights.

Candidate dimensions:

```text
Quality
Growth
Financial Safety
Cash Flow
Valuation
Momentum
High Reward
Risk
```

For each factor define:

```text
purpose
inputs
derived inputs
missing policy
coverage
direction
ranking universe
signal interaction
double-counting risk
```

Potential boundaries:

### Quality
ROE, ROA, Gross Margin, Operating Margin, Net Margin

### Growth
Revenue Growth Quarterly YoY, Revenue Growth Annual YoY, EPS Growth TTM YoY, FCF Growth only if robust enough

### Financial Safety
Debt/Equity FQ/FY, Current Ratio FQ/FY, Quick Ratio FQ/FY

### Cash Flow
FCF TTM, FCF Yield, cash/profit consistency where justified

### Valuation
P/E, PEG TTM/PEG, P/B, P/S, EV/EBITDA, EV/Revenue, Dividend Yield if justified

### Momentum
Perf 1W/1M/3M/6M/1Y/YTD, volume trend, reversal/stabilization

### High Reward
Overlay based on growth acceleration, price dislocation, valuation optionality, turnaround momentum and a minimum quality floor.

### Risk
Overlay based on leverage, liquidity, cash-flow weakness, volatility proxy, size/liquidity, earnings-quality concerns and severe data gaps where appropriate.

No final weights are approved at this stage.

---

# 14. Phase 10 — Double-Counting Review

Before weights, check correlated evidence:

- ROE / ROA
- Revenue FQ / FY / TTM
- Current Ratio / Quick Ratio
- PEG TTM / PEG
- overlapping momentum periods
- Quality / Cash Flow
- Growth / High Reward
- Momentum / High Reward
- Safety / Risk

Rule:

> One piece of evidence should have one primary factor role; reuse elsewhere must be intentional.

---

# 15. Phase 11 — Classification Model

Primary Dashboard classifications:

```text
Core Performers
Quality Underperformers
High Reward / High Risk
Avoid / Value Trap
```

A stock normally has one primary classification and may carry multiple secondary signal tags.

Classification must be derived from V2 evaluation, not copied from legacy.

Important rules:

- severe evidence-based Avoid conditions may override a positive composite score
- data gaps do not automatically mean Avoid
- quality underperformers must remain discoverable
- High Reward / High Risk must not become a list of low-quality speculative stocks
- insufficient evidence may remain Watch / Neutral / Unclassified

Each classification should expose confidence:

`High / Medium / Low / Insufficient Data`

---

# 16. Phase 12 — Shared Screener Result Set

Dashboard and Ranking consume one result object.

Conceptual structure:

```text
identity
component scores
overall score
rank
classification
signals
coverage
confidence
relevant evidence
reason codes
version metadata
```

Recommended version metadata:

```text
parser_version
mapping_version
evaluation_version
classification_version
dataset_import_id
dataset_as_of
```

---

# 17. Phase 13 — User-Initiated Node 1 Context

Node 1 context is generated only after the user explicitly starts CRSM for a selected stock.

It should contain:

- identity
- classification and confidence
- rank
- factor scores and coverage
- signals/anomalies
- relevant current metrics
- warnings
- verification priorities

Node 1 should verify important Screener conclusions, investigate anomalies, fill data gaps and research information unavailable from TradingView.

Node 1 must not treat Screener signals as confirmed facts.

DIRECT mode remains supported independently.

---

# 18. Phase 14 — Validation

### Data validation

```text
field position = correct
field meaning  = correct
quantity      = full numeric quantity
percentage    = percentage points
ratio         = ratio
```

### Evaluation validation

Use representative cases:

- strong quality / strong growth
- strong quality / weak momentum
- high growth / expensive valuation
- cheap / weak business
- high leverage
- negative FCF
- missing valuation data
- extreme growth
- deep drawdown
- low liquidity
- earnings-quality anomaly

### Ranking validation

Inspect:

- score distribution
- top/bottom ranks
- sector/industry concentration
- missing-data effects
- metric sensitivity
- current validation cases

Do not alter formulas merely to force specific tickers into desired groups.

### UI consistency

Dashboard and Ranking must display the same Screener Result Set.

### CRSM boundary

Confirm no automatic CRSM start occurs after Screener evaluation.

---

# 19. Developer / Validation Tools

Retain during V2 implementation:

- Mapping tab
- Raw Clipboard Inspector
- Parser Debug
- reconstructed table
- full-table copy/export validation

These are QA/developer tools, not part of the analytical model. Keep them until the new evaluation engine passes real-data validation.

---

# 20. Artifacts Before Final Scoring

Create reviewable artifacts in this order:

1. `screener_v2_data_dictionary.md`
2. `screener_v2_legacy_audit.md`
3. `screener_v2_field_role_mapping.md`
4. `screener_v2_derived_metrics.md`
5. `screener_v2_signals.md`
6. `screener_v2_factor_spec.md`
7. `screener_v2_classification_model.md`
8. `screener_v2_result_contract.md`
9. `screener_v2_decision_log.md`
10. `screener_v2_validation_plan.md`

No final scoring weights are coded before these decisions are reviewed.

---

# 21. Implementation Order

```text
1. Freeze/validate ingestion
2. Audit legacy
3. Define universe/row states
4. Map field roles
5. Define Raw / Derived / Signal
6. Define ranking direction/granularity
7. Define missing-data/coverage
8. Define anomaly taxonomy
9. Define factor architecture
10. Review double-counting
11. Define classification
12. Define shared result set
13. Define user-initiated Node 1 context
14. Validate on real data
15. Implement final evaluation/scoring
```

Do not jump directly from the new dataset to scoring formulas.

---

# 22. Explicit Non-Goals

This phase does not include:

- automatic CRSM handoff
- automatic Node 1 execution after Screener
- SSI / future native market-data integration
- replacing TradingView as current source
- rewriting CRSM architecture
- changing CRSM provider/model routing
- redesigning unrelated CRSM nodes
- reproducing legacy scoring for compatibility
- inventing catalysts or qualitative narratives inside Screener

`legacy/` is reference material only.

---

# 23. Definition of Done

## Data

- [ ] Four-line TradingView format parsed reliably.
- [ ] Ticker/company separation correct.
- [ ] All 46 analytical fields mapped correctly.
- [ ] Market Cap / Price / Volume / Avg Volume / Revenue / FCF decoded to full quantities.
- [ ] Percentage fields remain percentage points.
- [ ] Ratio fields remain ratios.
- [ ] Missing and invalid states are explicit.
- [ ] FQ/FY/TTM remain separate.
- [ ] Raw TradingView comparison passes after quantity-decoding update.

## Evaluation

- [ ] Legacy audited.
- [ ] Every field has a documented role or is intentionally unused.
- [ ] Universe states defined.
- [ ] Liquidity policy defined.
- [ ] Ranking direction/granularity defined.
- [ ] Missing-data/coverage defined.
- [ ] Signal taxonomy defined.
- [ ] Factors defined.
- [ ] Double-counting reviewed.
- [ ] Final weights justified and validated.
- [ ] Classification validated.
- [ ] Ranking validated on real data.

## Dashboard / Ranking

- [ ] Four Dashboard tables use one result set.
- [ ] Ranking uses the same result set.
- [ ] Data-gap/ambiguous stocks are not forced into investment tables.
- [ ] Signals/confidence are visible where appropriate.

## CRSM

- [ ] No automatic CRSM handoff.
- [ ] User explicitly starts CRSM from a selected stock.
- [ ] Node 1 context is generated from the shared result set.
- [ ] Node 1 receives verification priorities.
- [ ] DIRECT mode remains functional.

---

# 24. Golden Rules

1. **Map first, evaluate second, code third.**
2. **Preserve TradingView meaning.**
3. **Decode quantity formatting; do not change financial semantics.**
4. **Percentages are percentage points; never divide by 100 during ingestion.**
5. **Ratios remain ratios.**
6. **Missing is not zero.**
7. **FQ/FY/TTM are not merged prematurely.**
8. **Raw, Derived and Signal are separate.**
9. **Do not use `1/x` to reverse ranking direction.**
10. **Do not blindly winsorize extreme values.**
11. **Avoid double-counting correlated evidence.**
12. **Data quality is separate from business quality.**
13. **Dashboard and Ranking use the same Screener Result Set.**
14. **Screener never automatically starts CRSM.**
15. **Node 1 context is created only after explicit user action.**
16. **Screener does not invent catalysts or qualitative stories unavailable in source data.**
17. **Legacy is reference, not specification.**
