# Screener V2 — Implementation Plan

## 0. Purpose

Screener V2 is a redesign of Stock Mind's stock filtering and candidate-selection layer around the **current TradingView Screener dataset**.

The old Screener was designed around an older dataset and older evaluation assumptions. Those formulas are now treated as **legacy/reference**, not as the target implementation.

The objective is not to patch the old formulas field-by-field. The objective is to establish a clean pipeline:

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
Candidate Gate
        ↓
CRSM / Node 1
```

The Screener is a **candidate-selection layer**, not the final investment-analysis engine. CRSM / Node 1 remains responsible for deeper verification and analysis.

> **Planning rule:** do not implement new scoring formulas until the data contract and evaluation design have been reviewed and approved.

---

# 1. Current Checkpoint

## 1.1 TradingView source format — understood

The actual TradingView clipboard format has been identified.

Each stock is represented by four lines:

1. Ticker / Symbol
2. Company name
3. UI marker (`D`)
4. One TAB-separated line containing the 46 analytical fields

The `D` marker is not an analytical field and is ignored.

The Symbol line is split into:

- `ticker`
- `company_name` from the following line

## 1.2 Mapping — validated

The 46 TradingView fields have been mapped to the internal schema in the exact positional order of the current export.

The Mapping UI and raw clipboard debug view were intentionally added so the mapping could be visually validated before changing the Screener.

**Status: PASS.**

## 1.3 Current field set

The current Screener input contains:

- Symbol / Company
- Sector
- Industry
- Market Cap
- Price
- Chg %
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

# 2. Data Contract: Raw Means Raw

The ingestion layer must **not invent financial meaning**.

TradingView's compact display is a presentation choice. Stock Mind does not need to preserve that compactness.

### 2.1 General rule

For ordinary fields:

> **Read the source value and keep its meaning. Do not arbitrarily multiply, divide, or reinterpret it during ingestion.**

Examples:

```text
-0.58%  → -0.58   (percentage-point representation)
8%      → 8
3.62%   → 3.62
0.65    → 0.65
29.82   → 29.82
```

A percentage field is therefore stored as **percentage points**, not as a decimal fraction.

`-15` means `-15%`; it must not silently become `-0.15`.

Ratios remain ratios:

```text
PEG              0.06
Current Ratio    1.02
Debt/Equity      0.65
Relative Volume  0.46
P/E              29.82
```

These must not be multiplied by 100 merely because they are numeric.

### 2.2 K/M/B/T decoding

TradingView uses suffixes to make large numbers compact.

Where the internal representation requires a numeric quantity, decode the suffix without changing the underlying value:

```text
857.4K → 857,400
1.58M  → 1,580,000
1.2B   → 1,200,000,000
14.31T → 14,310,000,000,000
```

This applies especially to:

- Price when TradingView formats it with a suffix
- Volume
- Average Volume 10D / 30D / 60D
- Market Cap
- Revenue
- FCF

The purpose is only to recover the full quantity. It is **not a scoring transformation**.

### 2.3 Evaluation-time conversion

If the Screener needs a numeric value for a calculation, that conversion belongs to the **evaluation layer** or a clearly defined evaluation helper.

The ingestion layer must not perform strategy-specific transformations.

### 2.4 Missing values

The data contract must distinguish:

```text
missing
zero
negative
not applicable
invalid/unparseable
```

Missing must never silently become zero.

---

# 3. Architecture Boundaries

The V2 implementation must preserve four responsibilities.

## Layer 1 — Ingestion

Responsible for:

- reading TradingView clipboard
- detecting the actual TradingView format
- parsing records
- separating ticker/company
- mapping the 46 fields
- decoding display suffixes when required to recover the actual quantity
- preserving source meaning

Not responsible for scoring.

## Layer 2 — Internal Dataset

Provides a stable schema between ingestion and evaluation.

The Screener evaluation must be replaceable without rewriting the parser.

## Layer 3 — Evaluation

Responsible for:

- interpreting metrics
- applying hard filters
- calculating component scores
- generating signals
- calculating the overall result
- ranking candidates
- explaining why a candidate passed or failed

## Layer 4 — Candidate Gate / Node 1

Responsible for:

- selecting candidates for deep analysis
- constructing the Screener context
- handing the selected candidates to CRSM / Node 1

Node 1 JSON must be designed from the V2 evaluation result, not from the old parser structure.

---

# 4. Phase 1 — Freeze and Validate Data Ingestion

Before changing the evaluation method, freeze the current data contract.

### Tasks

- [ ] Keep the four-line TradingView parser as the primary parser.
- [ ] Keep the Mapping visual verification tool during development.
- [ ] Keep the raw clipboard inspector during validation.
- [ ] Verify all 46 fields against raw TradingView data.
- [ ] Verify ticker/company separation.
- [ ] Verify K/M/B/T decoding.
- [ ] Verify percentage fields remain percentage points.
- [ ] Verify ratios remain ratios.
- [ ] Verify missing values are not converted to zero.

### Acceptance

The reconstructed Mapping table must match the raw TradingView sheet by ticker and field position.

Only after this is confirmed should Screener V2 evaluation work begin.

---

# 5. Phase 2 — Audit the Legacy Screener

The legacy Screener is reference material only.

Read the existing implementation and create an explicit inventory of:

- filters
- formulas
- thresholds
- weights
- score ranges
- classification rules
- ranking rules
- missing-data behavior
- hard exclusions
- legacy aliases
- fields sent to Node 1

For every legacy rule, classify it:

| Decision | Meaning |
|---|---|
| Keep | Still valid with current data and strategy |
| Adapt | Concept useful, implementation must change |
| Replace | Old method no longer appropriate |
| Remove | No longer useful |
| Review | Needs evidence before deciding |

Do **not** preserve a formula simply because it already exists.

### Deliverable

A rule audit:

```text
Legacy rule
    ↓
Current field(s)
    ↓
Keep / Adapt / Replace / Remove / Review
    ↓
Reason
```

---

# 6. Phase 3 — Audit the Current Dataset

Before defining formulas, determine what each current field can and cannot tell us.

## 6.1 Analytical groups

### Market / Momentum

- Chg %
- Perf 1W / 1M / 3M / 6M / 1Y / YTD
- High 52W / Low 52W

### Liquidity

- Vol
- Rel Vol
- Avg Vol 10D / 30D / 60D

### Business / Profitability

- ROE
- ROA
- Gross Margin
- Operating Margin
- Net Margin

### Growth

- Revenue Growth Quarterly YoY
- Revenue Growth Annual YoY
- EPS Growth TTM YoY
- FCF Growth TTM YoY

### Scale

- Market Cap
- Revenue FQ / FY / TTM
- FCF TTM

### Financial Strength

- Debt/Equity FQ / FY
- Current Ratio FQ / FY
- Quick Ratio FQ / FY

### Valuation

- P/E
- PEG TTM
- PEG
- P/B
- P/S
- EV/EBITDA
- EV/Revenue

### Shareholder Return

- Dividend Yield TTM

## 6.2 Field-role decision

For every field decide whether it is:

- hard-filter input
- score input
- signal/anomaly input
- contextual evidence
- unused

The existence of a field does not require its inclusion in scoring.

## 6.3 Period handling

FQ, FY and TTM fields are intentionally retained separately.

Do not merge them prematurely.

The evaluation design must explicitly decide whether each period is:

- independently useful
- used together as a consistency check
- used to derive a trend
- contextual only
- unused

---

# 7. Phase 4 — Define the V2 Screener Philosophy

The Screener's job is to reduce a broad universe to a smaller set of **high-quality candidates for deeper analysis**.

It is not intended to:

- perform full company research
- make the final investment decision
- replace CRSM
- explain every market event

The evaluation should seek a balanced picture across several dimensions.

Potential dimensions to evaluate:

```text
Business Quality
Growth
Financial Strength
Cash Flow
Valuation
Market / Momentum
Liquidity
```

The final set of dimensions is not fixed until Phase 3 is complete.

### Core principle

A stock should not rank highly merely because it has one extreme metric.

Likewise, a stock should not be rejected merely because one metric is temporarily weak when the broader evidence is strong.

---

# 8. Phase 5 — Design Hard Filters

Hard filters should eliminate candidates that are clearly unsuitable for the intended analysis universe.

They should be conservative.

Possible areas to evaluate:

- insufficient liquidity
- unusable financial data
- structurally weak balance sheet
- extreme data anomalies
- other clearly disqualifying conditions discovered during the audit

Exact thresholds are intentionally **not defined in this document**.

Do not automatically reuse legacy thresholds such as a fixed minimum volume simply because they existed before.

---

# 9. Phase 6 — Design the New Scoring Model

This is the main V2 redesign.

## 9.1 No formula is pre-approved

The old formulas are not the starting point.

The final formulas must be derived from:

- the current fields
- their financial meaning
- their distribution in the actual dataset
- intended candidate behavior

## 9.2 Component scoring

Each selected evaluation dimension should have its own score before contributing to the total.

Conceptually:

```text
Quality Score
Growth Score
Financial Strength Score
Cash Flow Score
Valuation Score
Market Score
Liquidity Score
        ↓
Overall Screener Score
```

The final groups and weights are to be decided during implementation.

## 9.3 Comparable scoring ranges

Metrics with different units must be transformed into comparable scoring ranges where appropriate.

The implementation must prevent a metric with a large raw numeric range from dominating the score merely because of its scale.

## 9.4 Directionality

The model must explicitly define whether higher or lower values are favorable.

Examples:

Higher generally favorable:

- ROE
- ROA
- margins
- revenue growth
- EPS growth
- FCF growth

Lower generally favorable:

- Debt/Equity
- P/E
- P/B
- P/S
- EV/EBITDA
- EV/Revenue

Context-dependent:

- PEG
- dividend yield
- relative volume
- momentum
- FCF

These are examples of analytical direction, not final scoring formulas.

## 9.5 Avoid double counting

The model must inspect correlated metrics before assigning weights.

Examples:

- ROE and ROA
- Revenue FQ / FY / TTM
- Current Ratio and Quick Ratio
- PEG TTM and PEG
- multiple overlapping momentum periods

Related fields may still be useful, but their contribution must be intentional.

## 9.6 Missing data

Missing data must not automatically become zero or a severe penalty.

The model must distinguish:

```text
missing
zero
negative
not applicable
```

The final approach may include data-coverage/confidence information, but data quality must remain conceptually separate from business quality.

---

# 10. Phase 7 — Signals and Explainability

The Screener should generate explicit signals alongside scores.

Examples of possible signals:

- strong profitability
- strong growth
- improving/weak cash flow
- attractive valuation
- expensive valuation
- strong momentum
- market underperformance
- high leverage
- liquidity concern
- growth/value divergence
- missing critical data

Signals are **explanatory evidence**, not automatically score penalties.

A high-quality but underperforming stock should remain discoverable if that pattern is strategically useful for deeper CRSM analysis.

The output should answer:

> Why did this stock rank highly?

and:

> What needs to be verified by Node 1?

---

# 11. Phase 8 — Ranking and Classification

After hard filtering and scoring:

1. Calculate component scores.
2. Calculate overall score.
3. Rank eligible candidates.
4. Generate signals and warnings.
5. Classify candidates.
6. Apply the candidate gate for deeper analysis.

The final classification scheme must be derived from the new evaluation model rather than copied from legacy logic.

Possible concepts such as:

- high-quality candidate
- undervalued / underperforming candidate
- watch / secondary candidate
- not selected

may be retained or redesigned after evaluation.

---

# 12. Phase 9 — Screener Result Contract

The Screener result must contain enough information for both the UI and Node 1.

Conceptual structure:

```text
Stock identity
├── ticker
├── company
├── sector
└── industry

Evaluation
├── component scores
├── overall score
├── rank
└── classification

Signals
├── positive
├── negative
└── anomalies

Data quality
├── missing fields
├── warnings
└── coverage/confidence if adopted

Evidence
└── relevant current metrics

Conclusion
└── why this candidate passed

Node 1 priorities
└── what CRSM should verify
```

The Screener should not pass a meaningless score without context.

---

# 13. Phase 10 — Node 1 JSON Redesign

Node 1 JSON must be redesigned **after** the V2 evaluation model is finalized.

The new contract should carry the result of the Screener, not merely repeat the raw TradingView row.

Conceptually:

```json
{
  "schema_version": "screener_v2",
  "symbol": "KDC",
  "company": "KIDO Group Corporation",
  "sector": "...",
  "industry": "...",
  "screen": {
    "total_score": 0,
    "classification": "...",
    "component_scores": {},
    "signals": [],
    "warnings": []
  },
  "metrics": {},
  "node1_priorities": []
}
```

This is a shape example only. Final fields must be determined from the actual V2 output.

## Node 1 responsibilities in SCREENED mode

Node 1 should:

- verify important Screener conclusions
- investigate anomalies
- verify missing/uncertain information
- retrieve information unavailable from the TradingView dataset
- investigate the reasons behind unusual price/valuation behavior
- provide deeper analysis

Node 1 should **not unnecessarily repeat quantitative research already available and current in the Screener context**.

## DIRECT mode

Manual ticker analysis remains supported.

Without Screener context, Node 1 may collect the required information itself.

---

# 14. Phase 11 — Candidate Gate / CRSM Handoff

The automatic handoff must be based on the V2 ranking/classification.

The gate should control how many candidates enter the expensive deep-analysis pipeline.

Goals:

- reduce unnecessary CRSM calls
- prioritize the strongest candidates
- retain enough context for Node 1
- preserve manual analysis as a fallback

The candidate count and threshold are to be determined after ranking validation.

---

# 15. Phase 12 — Validation

Validation must happen before production integration.

## 15.1 Data validation

Compare raw TradingView data with reconstructed Stock Mind data.

Requirement:

```text
field position = correct
value meaning = preserved
```

## 15.2 Formula validation

Use representative examples:

- strong quality / strong growth
- strong quality / weak momentum
- high growth / expensive valuation
- cheap / weak business
- high leverage
- negative FCF
- missing financial data
- extreme growth values
- unusual market performance

## 15.3 Ranking validation

Run the complete dataset and inspect:

- top-ranked stocks
- bottom-ranked stocks
- sector concentration
- industry concentration
- score distribution
- sensitivity to individual metrics
- effect of missing data

## 15.4 Regression validation

Compare V2 with legacy only as a diagnostic.

The purpose is **not** to reproduce legacy rankings.

If rankings differ substantially, investigate whether the difference is logically explained by the new model.

## 15.5 End-to-end validation

Test:

```text
TradingView
 → Import
 → Internal dataset
 → Screener V2
 → Ranking
 → Candidate Gate
 → Node 1 JSON
 → SCREENED analysis
```

DIRECT mode must continue to work independently.

---

# 16. Phase 13 — UI / Developer Tools

During implementation, retain:

- Mapping tab
- Raw Clipboard Inspector
- Parser Debug
- reconstructed table

These are validation tools, not part of the analytical model.

After the data and Screener are stable, they may be moved to a developer/debug area or hidden behind a debug setting.

The visual Mapping table is particularly valuable because parser correctness cannot be established from ticker correctness alone.

---

# 17. Expected Implementation Areas

Exact files must be confirmed from the current repository before coding.

Expected areas include:

```text
Parser / ingestion
        ↓
Internal data contract
        ↓
Screener filters
        ↓
Evaluation / scoring
        ↓
Signals / ranking / classification
        ↓
Dashboard
        ↓
Screener context builder
        ↓
Node 1
```

Do not modify unrelated CRSM components unless a direct dependency is identified.

---

# 18. Implementation Order

The implementation order is fixed:

```text
1. Validate ingestion
        ↓
2. Audit legacy Screener
        ↓
3. Audit current dataset
        ↓
4. Define evaluation philosophy
        ↓
5. Define hard filters
        ↓
6. Design component scoring
        ↓
7. Design signals / classification
        ↓
8. Validate ranking
        ↓
9. Implement final evaluation engine
        ↓
10. Redesign Screener result contract
        ↓
11. Redesign Node 1 JSON
        ↓
12. Integrate candidate gate
        ↓
13. End-to-end validation
        ↓
14. UI cleanup
```

Do not jump directly from the new dataset to formulas.

---

# 19. Explicit Non-Goals

This phase does not include:

- SSI / future native market-data integration
- replacing TradingView as the current source
- rewriting CRSM architecture
- changing CRSM provider/model routing
- redesigning unrelated CRSM nodes
- reproducing legacy scoring for compatibility
- adding arbitrary metrics solely because they exist in old code

`legacy/` remains **reference material**, not an implementation specification.

---

# 20. Definition of Done

## Data layer

- [ ] TradingView four-line format remains correctly parsed.
- [ ] Ticker/company separation is correct.
- [ ] All 46 fields are mapped correctly.
- [ ] Percentage semantics are preserved as percentage points.
- [ ] Ratios are not converted into percentages.
- [ ] K/M/B/T display suffixes are decoded where numeric quantity is required.
- [ ] Missing values are explicit.
- [ ] Mapping has been validated against raw TradingView data.

## Evaluation layer

- [ ] Legacy rules audited.
- [ ] Every current field has an explicit role or is intentionally unused.
- [ ] Hard filters defined.
- [ ] Component scores defined.
- [ ] Weighting defined and justified.
- [ ] Double counting reviewed.
- [ ] Missing-data behavior defined.
- [ ] Signals defined.
- [ ] Classification defined.
- [ ] Ranking validated on real data.

## Node 1 / CRSM

- [ ] Screener result contract defined.
- [ ] Node 1 JSON schema versioned.
- [ ] Node 1 receives relevant Screener context.
- [ ] Node 1 verification priorities are explicit.
- [ ] SCREENED mode does not unnecessarily duplicate Screener research.
- [ ] DIRECT mode remains functional.
- [ ] Candidate gate tested end-to-end.

---

# 21. Current Status

| Area | Status |
|---|---|
| TradingView clipboard format | ✅ Identified |
| Four-line parser | ✅ Implemented |
| Symbol / Company separation | ✅ Implemented |
| 46-field mapping | ✅ Validated visually and against raw data |
| Mapping debug tools | ✅ Available |
| Raw-data convention | ✅ Established |
| K/M/B/T decoding | ✅ Implemented |
| Legacy Screener audit | ⏳ Next |
| Current dataset audit | ⏳ Next |
| V2 evaluation philosophy | ⏳ To define |
| Hard filters | ⏳ Not decided |
| Scoring formulas | ⏳ Not decided |
| Signals | ⏳ Not decided |
| Ranking/classification | ⏳ Not decided |
| Node 1 JSON | ⏳ After evaluation design |
| Candidate gate | ⏳ After ranking design |
| SSI | ⏸ Future |

---

# 22. Golden Rules

1. **Map first, evaluate second, code third.**
2. **The raw ingestion layer does not contain investment judgment.**
3. **Do not silently change the meaning of TradingView data.**
4. **Percentages are percentage points; ratios remain ratios.**
5. **K/M/B/T decoding restores quantity; it is not a scoring transformation.**
6. **Do not merge FQ/FY/TTM fields before deciding why they should be combined.**
7. **Do not reuse legacy formulas merely because they already exist.**
8. **Do not let one extreme metric determine the whole candidate ranking.**
9. **Missing data is not zero.**
10. **Data quality is separate from business quality.**
11. **Signals explain the score; they do not automatically penalize it.**
12. **The Screener selects candidates; CRSM performs deep analysis.**
13. **Node 1 JSON is designed from the V2 Screener result, not the other way around.**
14. **Do not modify Node 1 until the Screener evaluation model is stable.**
15. **Keep the Mapping/debug layer until the new Screener has passed real-data validation.**
