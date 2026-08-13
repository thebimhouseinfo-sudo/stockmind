# Screener V2 — Implementation Plan

## 0. Purpose

Screener V2 redesigns Stock Mind's stock evaluation layer around the **current TradingView Screener dataset**.

The old Screener formulas and thresholds are **legacy/reference material only**. They are not the target design.

The objective is to build a clean pipeline that:

```text
TradingView clipboard
        ↓
Parser / Ingestion
        ↓
Internal mapped dataset
        ↓
Screener Evaluation V2
        ↓
Ranking / Classification
        ↓
Dashboard + Ranking
        ↓
User selects a stock
        ↓
User manually starts CRSM analysis
        ↓
Node 1
```

### Critical system boundary

**Screener does not automatically hand off stocks to CRSM.**

After Screener evaluation is complete:

- Dashboard presents the four classification tables.
- Ranking tab continues to present the full ranking/universe view.
- The user decides which stock deserves deeper analysis.
- CRSM is started only by an explicit user action.
- The Screener may provide context to Node 1 when the user starts CRSM for a selected stock.

The Screener is a **quantitative candidate discovery and organization layer**. CRSM remains the deeper research and analysis layer.

> Planning rule: do not implement final scoring formulas until the data contract and evaluation model have been explicitly reviewed and approved.

---

# 1. Current Checkpoint — Data Ingestion

## 1.1 TradingView source format

The actual TradingView clipboard format has been identified.

Each stock is represented by four lines:

1. Ticker / Symbol
2. Company name
3. UI marker (`D`)
4. One TAB-separated line containing 46 analytical fields

The `D` marker is UI metadata, not an analytical field.

The Symbol and Company lines are therefore mapped into:

- `ticker`
- `company_name`

## 1.2 Mapping

The 46 current TradingView analytical fields have been mapped into the internal schema in the exact positional order of the current export.

The Mapping UI and raw clipboard inspector were deliberately added because ticker correctness alone is not enough to prove parser correctness.

Mapping was validated by reconstructing the table and comparing it against raw TradingView data.

**Status: PASS.**

## 1.3 Current field inventory

The current input set contains:

- Symbol / Company
- Sector / Industry
- Market Cap / Price / Chg %
- Perf % 1W / 1M / 3M / 6M / 1Y / YTD
- High 52W / Low 52W
- Vol / Rel Vol
- Avg Vol 10D / 30D / 60D
- ROE TTM / ROA TTM
- Revenue FQ / FY / TTM
- Revenue Growth Quarterly YoY / Annual YoY
- EPS Dil TTM / EPS Dil Growth TTM YoY
- PEG TTM / PEG
- Gross / Operating / Net Margin % TTM
- FCF TTM / FCF Growth TTM YoY
- Debt/Equity FQ / FY
- Current Ratio FQ / FY
- Quick Ratio FQ / FY
- P/E / P/B / P/S
- EV/EBITDA / EV/Revenue
- Dividend Yield % TTM

---

# 2. Data Contract — Preserve Raw Meaning

The ingestion layer is a data-ingestion layer, not an investment-judgment layer.

TradingView uses K/M/B/T and percentage formatting to make the table compact. Stock Mind does not need to preserve the visual compactness.

## 2.1 General rule

> Read the source value, preserve its meaning, and do not apply strategy-specific transformations during ingestion.

For percentage fields, the internal representation is **percentage points**:

```text
-0.58% → -0.58
8%     → 8
3.62%  → 3.62
```

This means `-15` represents `-15%`, not `-0.15%`.

Ratios remain ratios:

```text
PEG              0.06
Current Ratio    1.02
Debt/Equity      0.65
Relative Volume  0.46
P/E              29.82
```

These must not be multiplied by 100.

## 2.2 K/M/B/T decoding

Where TradingView uses compact suffixes, the parser may decode them back to the full quantity:

```text
857.4K → 857,400
1.58M  → 1,580,000
1.2B   → 1,200,000,000
14.31T → 14,310,000,000,000
```

This is display-format decoding only.

It may apply to quantity fields such as:

- Market Cap
- Price when expressed with a suffix
- Volume
- Avg Volume 10D / 30D / 60D
- Revenue
- FCF

It is not a scoring transformation.

## 2.3 Evaluation-time derived values

When the Screener needs a metric in another mathematical form, the derived value is created in the **evaluation layer**, not by mutating the source representation.

Example:

```text
Raw Revenue Growth = 717.92%
Scoring representation = bounded/ranked derived value
Anomaly signal = EXTREME_GROWTH
```

The raw value remains available.

## 2.4 Missing-value semantics

The data contract must distinguish:

```text
missing
zero
negative
not applicable
invalid / unparseable
```

Missing must never silently become zero.

---

# 3. Target Architecture

Screener V2 is divided into explicit responsibilities.

```text
                    TradingView Raw
                          │
                          ▼
                  Ingestion / Parser
                          │
                          ▼
                 Internal Dataset
                          │
             ┌────────────┴────────────┐
             ▼                         ▼
      Evaluation Layer          Signal / Anomaly
             │                         │
             ├── ranking              ├── extreme growth
             ├── factor scores        ├── value-trap warning
             ├── composites           ├── earnings-quality concern
             └── classification       ├── deep drawdown
                                       └── data-gap alerts
             └────────────┬────────────┘
                          ▼
                  Screener Result Set
                          │
                ┌─────────┴─────────┐
                ▼                   ▼
           Dashboard             Ranking
        four classification      full ranking
             tables                view
                │                   │
                └─────────┬─────────┘
                          ▼
                  User selects stock
                          │
                          ▼
                 Explicit CRSM action
                          │
                          ▼
                        Node 1
```

## 3.1 Screener does not auto-handoff

There is **no automatic candidate gate that starts CRSM**.

The evaluation engine can determine classifications and rankings, but it must stop at presentation.

The user remains the decision point between Screener and CRSM.

## 3.2 Node 1 boundary

When a user explicitly starts analysis for a selected stock, the system may construct a Screener context for Node 1 containing:

- the selected stock identity
- its classification
- ranking
- component scores
- signals/anomalies
- relevant current metrics
- data-quality warnings
- suggested verification priorities

Node 1 then performs deeper research and verification.

The Screener must not invent catalysts, legal events, project stories, macro explanations, or other information that is unavailable from the TradingView dataset.

---

# 4. Phase 1 — Freeze and Validate the Data Layer

Before changing evaluation logic, freeze the current data contract.

### Tasks

- [ ] Keep the four-line TradingView parser as the primary parser.
- [ ] Keep Mapping visual verification during development.
- [ ] Keep Raw Clipboard Inspector / Parser Debug during validation.
- [ ] Verify all 46 fields against raw TradingView data.
- [ ] Verify ticker/company separation.
- [ ] Verify percentage semantics.
- [ ] Verify ratio semantics.
- [ ] Verify K/M/B/T decoding.
- [ ] Verify missing values are not zero.
- [ ] Preserve FQ/FY/TTM as separate source fields.

### Acceptance

The reconstructed table must match the raw TradingView table by ticker and field position.

This phase is already validated sufficiently to proceed to evaluation design.

---

# 5. Phase 2 — Audit the Legacy Screener

Legacy code is reference material only.

Create an inventory of:

- filters
- formulas
- thresholds
- weights
- score ranges
- classification rules
- ranking rules
- missing-data behavior
- exclusions
- legacy aliases
- Node 1 context fields

For every legacy rule classify it as:

| Decision | Meaning |
|---|---|
| Keep | Valid with the new dataset and strategy |
| Adapt | Concept useful but implementation changes |
| Replace | Old approach no longer appropriate |
| Remove | No longer useful |
| Review | Requires evidence before deciding |

A legacy formula must never be retained merely because it already exists.

---

# 6. Phase 3 — Universe Definition

Universe definition must be decided before relative ranking.

The initial universe is the set of successfully imported TradingView Screener rows.

The evaluation design must determine whether the working universe is:

```text
All valid imported rows
```

or:

```text
Imported rows
    ↓
minimum data validity
    ↓
optional conservative liquidity gate
    ↓
evaluation universe
```

## 6.1 Liquidity rule

Liquidity thresholds must be treated carefully.

A fixed threshold such as `Volume > 30K` must not automatically remain a hard filter if it unnecessarily destroys the candidate universe.

The design must explicitly decide whether liquidity is:

- hard filter
- scoring input
- risk signal
- context only

## 6.2 Universe must not be overfit

The current 76-stock dataset is a real validation universe, not a list whose expected winners should be hard-coded into the model.

Any examples such as GMD, MWG, HHS, etc. are validation cases only.

---

# 7. Phase 4 — Metric Role Mapping

Every current field receives an explicit role before scoring formulas are designed.

Allowed roles:

- **Raw Evidence** — preserved and available for inspection/Node 1.
- **Scoring Input** — used by one or more factor scores.
- **Derived Input** — used only after a deterministic derived metric is calculated.
- **Anomaly Trigger** — used to generate a warning/signal.
- **Context** — shown to the user but not scored.
- **Unused** — deliberately excluded with a documented reason.

## 7.1 Important rule

A field does not need to be scored merely because TradingView provides it.

## 7.2 Period handling

FQ / FY / TTM must not be silently merged.

For each period-specific metric, decide whether it is:

- independently scored
- used together as a consistency check
- used to calculate a trend
- used as anomaly/context evidence
- unused

---

# 8. Phase 5 — Raw vs Derived vs Signal Contract

This phase formalizes the three representations of data.

## 8.1 Raw

Raw means the mapped value with source meaning preserved.

Example:

```text
Revenue Growth Annual YoY = 717.92%
```

## 8.2 Derived

Derived values are created only for evaluation.

Possible examples:

```text
FCF Yield
Volume Trend
Price Drawdown
Upside to 52W High
Momentum Reversal
Range Volatility
```

A derived value may use math, scaling, log transformation, or percentile ranking, but it must not overwrite the raw value.

## 8.3 Signal / anomaly

Signals identify patterns that require attention.

Possible examples:

```text
EXTREME_GROWTH
VALUE_TRAP_WARNING
EARNINGS_QUALITY_CONCERN
DEEP_DRAWDOWN
HIGH_LEVERAGE
LOW_LIQUIDITY
DATA_GAP
```

An anomaly is not automatically a score penalty.

For example:

```text
EPS Growth = +640%
```

may become:

```text
raw = +640%
scoring representation = bounded/ranked
signal = EXTREME_GROWTH
```

This preserves both information and robustness.

---

# 9. Phase 6 — Relative Ranking Design

The system should favor relative ranking over arbitrary hard thresholds where appropriate.

## 9.1 Ranking direction

Each scoring metric must explicitly define direction:

```text
HIGHER_IS_BETTER
LOWER_IS_BETTER
TWO_SIDED / OPTIMAL_RANGE
CONTEXT_ONLY
```

Do not implement valuation as `1/x` merely to reverse direction.

Prefer a ranking operation such as:

```text
rank(metric, direction=LOWER_IS_BETTER)
```

This avoids divide-by-zero, negative-value inversion and extreme-value explosions.

## 9.2 Ranking granularity

Each metric must be assigned a ranking universe:

```text
GLOBAL / FULL UNIVERSE
SECTOR
INDUSTRY
```

This is particularly important for metrics whose meaning varies structurally by business type.

Possible examples to evaluate:

- Momentum → likely universe-level
- Volume Trend → likely universe-level
- P/B → potentially industry/sector-relative
- Net Margin → potentially industry-relative
- Debt/Equity → potentially industry/sector-relative

These are design candidates, not final assignments.

## 9.3 Small-universe caution

The current universe is only around 76 rows.

Avoid pretending that percentile behavior is statistically equivalent to a large cross-section.

The model should remain stable when the universe changes moderately.

## 9.4 No automatic winsorization policy

Do not automatically winsorize everything at 1–99%.

Extreme values may contain important information.

Instead consider:

- bounded scoring representation
- monotonic transformations
- robust ranking
- explicit anomaly signals

The raw value must remain unchanged.

---

# 10. Phase 7 — Missing Data and Coverage

Missing data must be handled by field role and context, not by one universal rule.

For each factor decide whether missing data should:

- reduce factor coverage
- remain neutral
- exclude the metric from that factor's calculation
- create a `DATA_GAP` signal
- block a candidate only when the missing field is critical

Do not use `missing = 0`.

## 10.1 Factor coverage

A factor should expose how much of its intended evidence is actually available.

Conceptual example:

```text
Valuation Score       78
Valuation Coverage    4/6
Signal                DATA_GAP
```

This is preferable to hiding missing inputs behind a fabricated score.

## 10.2 Data quality is not business quality

A company with missing FCF data is not automatically a bad company.

It is a company with lower evidence quality for the FCF-dependent evaluation.

---

# 11. Phase 8 — Anomaly / Signal Engine

The anomaly engine runs in parallel with scoring.

It should identify patterns such as:

### Earnings quality

- Operating margin negative while net margin is strongly positive.
- Net margin materially exceeds operating margin.
- EPS growth is extreme relative to other periods.
- FCF is negative while accounting profitability is strong.

### Growth

- Extreme Revenue Growth.
- Extreme EPS Growth.
- Quarterly growth diverges sharply from annual growth.

### Financial safety

- High Debt/Equity.
- Weak Current/Quick Ratio.
- Negative FCF.

### Market behavior

- Deep drawdown from 52W high.
- Momentum reversal.
- Strong price movement with unusual volume behavior.

### Data quality

- Missing critical metrics.
- Inconsistent or unparseable values.

Signals should be explicit and machine-readable.

Example:

```json
{
  "code": "EARNINGS_QUALITY_CONCERN",
  "severity": "high",
  "evidence": [
    "operating_margin_ttm",
    "net_margin_ttm",
    "fcf_ttm"
  ]
}
```

The signal describes **what needs attention**. It does not automatically decide the investment outcome.

---

# 12. Phase 9 — Factor Evaluation Model

The factor architecture is deliberately defined before weights.

Potential factors:

```text
Quality
Growth
Financial Strength / Safety
Cash Flow
Valuation
Momentum
High Reward
Risk
```

The final factor set must be based on Phase 7 and Phase 8 analysis.

## 12.1 Quality

Potential evidence:

- ROE
- ROA
- Gross Margin
- Operating Margin
- Net Margin

Possible derived evidence:

- FCF Yield
- margin consistency

## 12.2 Growth

Potential evidence:

- Revenue Growth Quarterly YoY
- Revenue Growth Annual YoY
- EPS Growth TTM YoY
- FCF Growth TTM YoY

Possible derived evidence:

- growth acceleration
- quarterly vs annual divergence

## 12.3 Financial Strength / Safety

Potential evidence:

- Debt/Equity FQ / FY
- Current Ratio FQ / FY
- Quick Ratio FQ / FY
- FCF TTM

Possible derived evidence:

- leverage change
- liquidity deterioration

## 12.4 Valuation

Potential evidence:

- P/E
- P/B
- P/S
- EV/EBITDA
- EV/Revenue
- PEG / PEG TTM
- Dividend Yield

The model must explicitly define how invalid/negative P/E and PEG values are treated.

## 12.5 Momentum

Potential evidence:

- Perf 1W / 1M / 3M / 6M / 1Y / YTD
- Rel Vol
- Avg Vol Trend

Potential derived metrics:

```text
Volume Trend = Avg Vol 10D / Avg Vol 60D
Reversal = Perf 1M - Perf 6M
Drawdown = Price / High 52W - 1
```

## 12.6 High Reward

High Reward is a separate dimension from Core Quality.

Potential ingredients:

- Growth acceleration
- Price dislocation / drawdown
- Valuation optionality
- Turnaround momentum
- minimum quality floor

High Reward does not mean “good company”. It identifies a potentially asymmetric opportunity worth investigating.

## 12.7 Risk

Risk remains a separate overlay.

Potential ingredients:

- Leverage
- Liquidity
- Cash-flow weakness
- Volatility proxies
- Size/liquidity
- Earnings quality concerns

Risk should not simply be subtracted from every other factor.

---

# 13. Phase 10 — Weighting and Composite Scores

Weights are intentionally **not defined yet**.

Before selecting weights:

1. inspect metric correlation
2. inspect double counting
3. inspect score distributions
4. test candidate sensitivity
5. inspect sector/industry effects
6. inspect extreme values
7. inspect missing-data effects

Only then define:

- factor weights
- submetric weights
- score ranges
- confidence/coverage treatment

## 13.1 Candidate composites

The eventual model may have separate composites such as:

```text
Core Score
Quality Underperformer Score
High Reward Score
Risk Score
```

The exact equations are to be designed after the factor specifications are approved.

## 13.2 No example-based overfitting

Stocks such as GMD, MWG, HHS, GEE, VCG, DIG, KSF, ASP, etc. may be used as validation cases.

They must never be hard-coded into the model or used to force expected classifications.

---

# 14. Phase 11 — Classification Model and Four Dashboard Tables

After scoring, every valid stock is classified for presentation.

The Dashboard will contain exactly four major tables for Screener V2.

## 14.1 Table 1 — Core Performers

Purpose:

> Identify companies with strong overall quality/economic characteristics and reasonably supportive market behavior.

Typical evidence may include:

- strong Core Score
- acceptable Safety/Risk
- sufficient data coverage
- no severe earnings-quality warning
- supportive Momentum where adopted

The exact threshold is not yet fixed.

## 14.2 Table 2 — Quality Underperformers

Purpose:

> Identify relatively strong businesses that are currently underperforming in price and may deserve deeper investigation.

The table should combine:

- strong underlying quality
- acceptable safety
- attractive/acceptable valuation
- weak or lagging Momentum
- evidence of stabilization where that concept is retained

This group must not automatically imply “buy”.

## 14.3 Table 3 — High Reward / High Risk

Purpose:

> Identify potentially asymmetric opportunities where upside characteristics are strong but risk is also elevated.

The classification should require both:

```text
High Reward Score = high
Risk Score = high
```

The table must show risk signals prominently so the user cannot mistake it for the Core list.

Typical visible signals may include:

- deep drawdown
- extreme growth
- leverage
- negative FCF
- earnings quality concern
- low liquidity

## 14.4 Table 4 — Avoid / Value Trap

Purpose:

> Identify candidates whose apparent value or headline performance is contradicted by weak quality, financial risk or serious anomaly signals.

This group is not merely “low score”.

It should be based on explicit evidence such as:

- weak business quality
- poor growth
- weak financial safety
- expensive/invalid valuation despite poor quality
- strong value-trap signals
- severe data-risk combinations

The exact classification logic must be approved after evaluation testing.

## 14.5 Stocks not suitable for any four-table category

The model must define what happens to valid but ambiguous stocks.

Possible behavior:

- show in Ranking only
- show as an unclassified/neutral result inside the Dashboard
- retain in the full universe without forcing an investment-style category

The implementation must not force every stock into a story merely for presentation.

---

# 15. Phase 12 — Ranking Tab

The existing **Ranking tab remains**.

It is not replaced by the four Dashboard tables.

## 15.1 Purpose

Ranking is the complete-universe quantitative view.

It should allow the user to:

- inspect the full ranked universe
- sort/inspect overall score
- see factor/component scores as appropriate
- inspect classification
- identify any stock regardless of Dashboard category
- manually choose a stock for CRSM analysis

## 15.2 Dashboard vs Ranking

They are two views of the same Screener result set:

```text
Screener Result Set
       │
       ├── Dashboard
       │    ├── Core Performers
       │    ├── Quality Underperformers
       │    ├── High Reward / High Risk
       │    └── Avoid / Value Trap
       │
       └── Ranking tab
            └── Full ranked universe
```

There must be a single source of truth for scoring/ranking. The Dashboard must not calculate a separate score.

---

# 16. Phase 13 — Explicit User-Initiated CRSM Workflow

This replaces the previous concept of an automatic candidate gate.

## 16.1 No automatic handoff

When Screener finishes:

```text
Screener evaluation complete
        ↓
Dashboard + Ranking updated
        ↓
STOP
```

No CRSM request is created automatically.

No Node 1 request is created automatically.

No hidden queue of candidates is generated.

## 16.2 User selection

The user may select a stock from:

- any of the four Dashboard tables
- the Ranking tab
- the existing manual analysis interface

The selected stock becomes the explicit input to the CRSM workflow.

## 16.3 User action

Only after explicit user action:

```text
User selects stock
      ↓
User starts CRSM analysis
      ↓
Screener context is attached
      ↓
Node 1 receives context
```

## 16.4 What the Screener context should provide

For the selected stock, the context may include:

```text
identity
classification
rank
factor scores
signals/anomalies
data coverage
key current metrics
relevant derived metrics
screening conclusion
verification priorities
```

The context should be concise enough for Node 1 to consume efficiently and detailed enough to prevent redundant quantitative searching.

## 16.5 What Node 1 should verify

Node 1 may investigate:

- why a strong company is underperforming
- whether valuation is justified
- whether abnormal growth is sustainable
- whether an earnings-quality concern is material
- missing/current information not available in TradingView
- catalyst/event explanations
- industry/company context

These are **verification tasks**, not data invented by the Screener.

## 16.6 DIRECT mode

Direct/manual analysis remains functional.

A user can analyze a ticker without first using the Screener.

---

# 17. Phase 14 — Screener Result Contract

The Screener result is the shared source for both Dashboard and Ranking and the optional context for user-initiated CRSM.

Conceptual result shape:

```text
Stock
├── identity
│   ├── ticker
│   ├── company
│   ├── sector
│   └── industry
│
├── source_data
│   └── relevant current TradingView values
│
├── derived_metrics
│   └── evaluation-only calculations
│
├── evaluation
│   ├── factor scores
│   ├── composite scores
│   ├── overall score
│   └── rank
│
├── classification
│   └── one dashboard classification when applicable
│
├── signals
│   ├── positive
│   ├── risk
│   └── anomaly/data-gap
│
├── coverage
│   ├── factor coverage
│   └── missing critical fields
│
└── analysis_context
    └── verification priorities for user-started CRSM
```

This result must be generated once and consumed by both Dashboard and Ranking.

---

# 18. Phase 15 — Node 1 JSON Contract

The Node 1 JSON is an output contract of the Screener result, but is only constructed when the user explicitly starts CRSM.

Conceptual shape:

```json
{
  "schema_version": "screener_v2",
  "source": {
    "dataset": "tradingview",
    "as_of": "..."
  },
  "stock": {
    "ticker": "KDC",
    "company": "KIDO Group Corporation",
    "sector": "...",
    "industry": "..."
  },
  "screen": {
    "classification": "...",
    "rank": 0,
    "overall_score": 0,
    "factor_scores": {},
    "signals": [],
    "warnings": [],
    "coverage": {}
  },
  "metrics": {},
  "verification_priorities": []
}
```

This is a contract shape example only. Exact fields are decided after the evaluation result schema is finalized.

Node 1 must use the Screener context as a starting point and should not unnecessarily repeat searches for current quantitative fields already supplied and valid.

---

# 19. Phase 16 — Validation on the Real Dataset

The current 76-row dataset should be the primary validation universe during development.

## 19.1 Distribution validation

Inspect:

- overall score distribution
- factor-score distribution
- number of stocks in each dashboard table
- number of unclassified stocks
- sector concentration
- industry concentration

## 19.2 Sensitivity validation

Test whether one metric can dominate the result.

Examples:

- extreme EPS Growth
- extreme Revenue Growth
- very high ROE
- very low P/E
- deep drawdown
- high Dividend Yield

## 19.3 Missing-data validation

Test representative stocks with:

- missing PEG
- missing FCF
- missing growth
- partial period data

Verify that missingness is visible and does not silently become zero or falsely positive evidence.

## 19.4 Anomaly validation

Use real examples to verify that unusual values are handled as intended.

Examples are validation cases, not hard-coded expected winners.

## 19.5 Dashboard validation

Verify that each stock appears in the correct table and that a stock is not simultaneously presented as contradictory classifications unless the design explicitly permits this.

## 19.6 Ranking validation

Ensure Ranking and Dashboard use the same underlying result object and score.

A stock must not have one score in Ranking and another score in Dashboard.

## 19.7 CRSM workflow validation

Verify:

```text
Open Screener
    ↓
Screener runs
    ↓
Dashboard + Ranking update
    ↓
No CRSM request occurs
    ↓
User selects stock
    ↓
User explicitly starts CRSM
    ↓
Correct Screener context reaches Node 1
```

## 19.8 Legacy comparison

Compare V2 and legacy only as a diagnostic.

The purpose is not to reproduce legacy rankings.

Substantial differences must be investigated, not automatically corrected.

---

# 20. UI / Developer Validation Tools

During development, retain:

- Mapping tab
- Raw Clipboard Inspector
- Parser Debug
- reconstructed Mapping table
- Excel-copy-friendly table output if useful

These tools are validation/debug infrastructure, not part of the investment model.

They should remain available until the V2 data layer and evaluation have passed real-data validation.

The Mapping table proved essential because a parser can return correct tickers while all downstream fields are shifted.

---

# 21. Expected Implementation Areas

Exact files must be confirmed from the repository before coding.

Likely areas include:

```text
Parser / ingestion
        ↓
Internal data contract
        ↓
Derived metric helpers
        ↓
Screener filters
        ↓
Factor evaluation
        ↓
Signals / anomaly engine
        ↓
Ranking / classification
        ↓
Screener result object
        ↓
Dashboard (4 tables)
        ↓
Ranking tab
        ↓
User-initiated Screener context builder
        ↓
Node 1
```

Do not modify unrelated CRSM components unless a direct dependency is identified.

---

# 22. Implementation Order

The implementation order is intentionally strict.

```text
1. Freeze / validate ingestion
        ↓
2. Audit legacy Screener
        ↓
3. Define universe
        ↓
4. Map metric roles
        ↓
5. Define raw / derived / signal layers
        ↓
6. Define ranking granularity
        ↓
7. Define missing-data policy
        ↓
8. Define anomaly engine
        ↓
9. Design factor specifications
        ↓
10. Design composite / weights
        ↓
11. Design classification
        ↓
12. Design single Screener result contract
        ↓
13. Implement evaluation engine
        ↓
14. Implement Dashboard 4-table presentation
        ↓
15. Preserve / integrate Ranking tab
        ↓
16. Implement user-initiated Screener → CRSM context
        ↓
17. Update Node 1 JSON / prompt contract
        ↓
18. Real-dataset validation
        ↓
19. UI cleanup
```

Do not jump directly from the new dataset to formulas.

Do not add an automatic CRSM candidate gate.

---

# 23. Explicit Non-Goals

This phase does not include:

- automatic CRSM handoff
- automatic Node 1 analysis after Screener completion
- automatic candidate queues for CRSM
- SSI / future native market-data integration
- replacing TradingView as the current data source
- rewriting CRSM architecture
- changing CRSM provider/model routing
- redesigning unrelated CRSM nodes
- reproducing legacy scoring for compatibility
- adding arbitrary metrics merely because they exist in legacy code
- inventing catalysts or qualitative investment stories inside Screener

`legacy/` remains reference material only.

---

# 24. Definition of Done

## Data layer

- [ ] TradingView four-line format parsed correctly.
- [ ] Ticker/company separation correct.
- [ ] All 46 fields mapped correctly.
- [ ] Percentage semantics preserved as percentage points.
- [ ] Ratios remain ratios.
- [ ] K/M/B/T display suffixes decoded only to recover quantities.
- [ ] FQ/FY/TTM remain explicit.
- [ ] Missing values remain explicit.
- [ ] Mapping validated against raw TradingView data.

## Evaluation layer

- [ ] Legacy rules audited.
- [ ] Universe defined.
- [ ] Every current field has an explicit role or is intentionally unused.
- [ ] Raw/derived/signal boundaries defined.
- [ ] Ranking granularity defined.
- [ ] Missing-data policy defined.
- [ ] Anomaly engine defined.
- [ ] Factor specifications defined.
- [ ] Correlation/double-counting reviewed.
- [ ] Weights defined and justified.
- [ ] Composite scores defined.
- [ ] Classification rules defined.
- [ ] Ranking validated on real data.

## Dashboard / Ranking

- [ ] Four Dashboard tables implemented.
- [ ] Core Performers table works.
- [ ] Quality Underperformers table works.
- [ ] High Reward / High Risk table works.
- [ ] Avoid / Value Trap table works.
- [ ] Ambiguous/unclassified behavior defined.
- [ ] Ranking tab remains functional.
- [ ] Dashboard and Ranking use one shared Screener result source.

## CRSM / Node 1

- [ ] No automatic CRSM handoff exists.
- [ ] User can manually select a stock from Dashboard.
- [ ] User can manually select a stock from Ranking.
- [ ] User can explicitly start CRSM.
- [ ] Screener context is attached only after explicit user action.
- [ ] Node 1 JSON schema is versioned.
- [ ] Node 1 receives relevant Screener context.
- [ ] Verification priorities are explicit.
- [ ] Node 1 does not unnecessarily duplicate Screener quantitative research.
- [ ] DIRECT mode remains functional.

---

# 25. Current Status

| Area | Status |
|---|---|
| TradingView clipboard format | ✅ Identified |
| Four-line parser | ✅ Implemented |
| Symbol / Company separation | ✅ Implemented |
| 46-field mapping | ✅ Validated visually and against raw data |
| Mapping debug tools | ✅ Available |
| Raw-data convention | ✅ Established |
| K/M/B/T decoding | ✅ Implemented |
| Automatic CRSM handoff | ❌ Explicitly not part of V2 |
| Legacy Screener audit | ⏳ Next |
| Universe definition | ⏳ To define |
| Metric role mapping | ⏳ To define |
| Raw/Derived/Signal contract | ⏳ To define |
| Ranking granularity | ⏳ To define |
| Missing-data policy | ⏳ To define |
| Anomaly engine | ⏳ To define |
| Factor specifications | ⏳ To define |
| Scoring formulas | ⏳ Not decided |
| Weights | ⏳ Not decided |
| Classification rules | ⏳ Not decided |
| Dashboard four tables | ⏳ Evaluation dependent |
| Ranking tab | ✅ Existing function retained |
| User-initiated CRSM context | ⏳ After evaluation contract |
| Node 1 JSON | ⏳ After Screener result contract |
| SSI | ⏸ Future |

---

# 26. Golden Rules

1. **Map first, evaluate second, code third.**
2. **Raw ingestion contains no investment judgment.**
3. **Do not silently change TradingView data meaning.**
4. **Percentages are percentage points; ratios remain ratios.**
5. **K/M/B/T decoding restores quantity; it is not a scoring transformation.**
6. **FQ/FY/TTM remain separate until an explicit evaluation reason exists to combine them.**
7. **Legacy formulas are reference material, not the V2 specification.**
8. **Do not use 1/x merely to reverse ranking direction.**
9. **Do not automatically winsorize extreme values and destroy useful signals.**
10. **Raw values, derived scoring values and anomaly signals are separate representations.**
11. **Missing is not zero.**
12. **Data quality is separate from business quality.**
13. **Signals explain what needs attention; they do not automatically determine the score.**
14. **Do not invent catalysts or qualitative investment explanations in Screener.**
15. **Dashboard and Ranking consume one shared Screener result set.**
16. **Screener never automatically starts CRSM.**
17. **CRSM starts only after explicit user action.**
18. **Node 1 JSON is derived from the V2 Screener result, not the other way around.**
19. **DIRECT analysis remains functional.**
20. **Keep Mapping/debug tools until real-data validation is complete.**
