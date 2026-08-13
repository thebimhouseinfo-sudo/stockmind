# Screener V2 — Implementation Plan

> **Status: THEORY / DESIGN PHASE — NOT READY FOR SCORING IMPLEMENTATION**
>
> This document is the source of truth for the Screener V2 redesign. It records the decisions reached during design/review so the work does not drift between sessions. **Do not code production scoring/classification until the theory sections marked as pending are completed and explicitly approved.**

---

# 0. Purpose and Boundary

Screener V2 redesigns Stock Mind around the current TradingView clipboard dataset. Legacy formulas, thresholds and classifications are **reference material only**.

The Screener is a quantitative **data/evaluation engine**, not an AI investment analyst.

```text
TradingView clipboard
        ↓
Parser / Ingestion
        ↓
Internal Dataset
        ↓
Evaluation Model V2
        ↓
Screener Result Set
     ┌──┴──────┐
     ↓         ↓
 Dashboard   Ranking
     │
     ↓
 User selects stock
     ↓
 Explicit CRSM action
     ↓
 Node 1
```

**No automatic CRSM handoff.** The user remains the decision point before deep analysis. Node 1 verifies and researches; it does not blindly treat Screener signals as facts.

---

# 1. Current TradingView Data Contract

## 1.1 Source record format

The TradingView clipboard record is currently interpreted as:

1. `Symbol` — contains ticker + company name and must be split.
2. UI marker / metadata line — typically `D`; ignored.
3. `Sector`.
4. `Industry`.
5. The analytical columns in the validated TradingView order.

The Mapping tab and reconstructed-table workflow exist because a correct ticker does **not** prove that all following columns are mapped correctly.

## 1.2 Current analytical fields

Validated source fields:

```text
Symbol
Sector
Industry
Mkt cap
Price
Chg %
Perf % 1W/1M/3M/6M/1Y/YTD
High 52W
Low 52W
Vol
Rel vol
Avg vol 10D/30D/60D
ROE TTM
ROA TTM
Revenue FQ/FY/TTM
Revenue growth Quarterly YoY
Revenue growth Annual YoY
EPS dil TTM
EPS dil growth TTM YoY
PEG TTM
Gross/Op/Net margin % TTM
FCF TTM
FCF growth TTM YoY
Debt/equity FQ/FY
Current ratio FQ/FY
Quick ratio FQ/FY
P/E
PEG
P/B
P/S
EV/EBITDA
EV/revenue
Div yield % TTM
```

FQ/FY/TTM fields remain separate intentionally. They are not silently merged.

---

# 2. Ingestion Rules — Preserve Meaning, Decode Display Formatting

The ingestion layer restores source meaning. It does **not** perform investment judgment or scoring transformation.

## 2.1 Percentage fields

TradingView percentage values remain **percentage points**.

```text
-0.58%  → -0.58
+4.86%  → 4.86
8%      → 8
-37.12% → -37.12
```

Never divide by 100 during ingestion.

## 2.2 Ratio fields

True ratios remain ratios:

```text
PEG              0.06
Current Ratio    1.02
Debt/Equity      0.65
Relative Volume  0.46
P/E              29.82
```

Do not multiply ratios by 100.

## 2.3 Quantity fields

TradingView uses compact suffixes for display. Stock Mind decodes them to full numeric quantities:

```text
Market Cap
Price
Volume
Avg Volume 10D / 30D / 60D
Revenue FQ / FY / TTM
FCF TTM
```

Examples:

```text
148.69 T → 148,690,000,000,000
6.26 B   → 6,260,000,000
1.58 M   → 1,580,000
857.4 K  → 857,400
```

This is display-format decoding, **not scoring**.

## 2.4 Field-specific parsing

Do not use one generic parser for every field. Parsing must distinguish:

- percentage
- ratio
- quantity
- text
- missing
- invalid/unparseable

Example:

```text
41.000 Price → 41,000
41.000 P/E   → 41.0
```

Missing never becomes zero.

---

# 3. Evaluation Model V2 — Closed Architecture Foundation

The final evaluation architecture is a **typed DAG**, not a mandatory linear pipeline.

```text
RAW
 ↓
State / Provenance
 ↓
Derived
 ↓
Signal
 ↓
Coverage / Applicability
 ↓
Contribution DAG
 ↓
Base Factor
 ↓
Axis
 ↓
Gate
 ↓
Classification
```

The implementation must support typed nodes/edges because a raw/derived metric may feed a score, signal, coverage calculation or gate without implying that all paths are equivalent.

Foundation principles are **closed**:

- Typed node/edge.
- Tri-valued logic: `TRUE / FALSE / UNKNOWN`.
- Impact budget.
- Coverage + eligibility.
- Redundancy analysis before official scoring.
- Provenance / as-of metadata.
- Audit lineage.
- `UNKNOWN` must never silently become `FALSE` or zero.
- Raw data is never overwritten by scoring transformations.
- A signal is not automatically a penalty.
- A trigger is not automatically a veto.

**No new abstraction should be added unless a concrete implementation/test problem requires it.**

---

# 4. Dashboard / Ranking / CRSM Boundary

After evaluation, Dashboard has exactly four primary investment tables:

1. **Core Performers**
2. **Quality Underperformers**
3. **High Reward / High Risk**
4. **Avoid / Value Trap**

The existing **Ranking tab remains**.

Dashboard and Ranking consume the **same Screener Result Set**. They must not calculate separate scores.

A stock normally has one primary classification and may carry multiple signal tags.

Insufficient evidence must not be forced into a positive/negative investment conclusion. It may remain `Watch / Neutral / Unclassified / UNKNOWN` at the evaluation layer without becoming a fifth primary Dashboard investment table.

### CRSM

There is **no automatic candidate gate and no automatic handoff**.

Only when the user explicitly selects a stock and starts CRSM:

```text
Selected stock
  ↓
Screener result
  ↓
Screener context builder
  ↓
Node 1
```

Node 1 performs deeper research, verification and catalyst investigation. Screener must not invent catalysts, legal/project stories, macro explanations or qualitative claims unavailable from its quantitative source data.

---

# 5. Foundation Contract A — Data State

Data state must not be a single overloaded enum.

## 5.1 Observation state

```text
VALID
MISSING
INVALID
NOT_APPLICABLE
```

## 5.2 Quality flags

Examples:

```text
LOW_BASE
STALE
EXTREME
UNIT_WARNING
PARTIAL_INPUT
```

## 5.3 Usage state

Usage can differ by field/factor:

```text
ELIGIBLE
SUPPRESSED
INVALID_FOR_USAGE
UNAVAILABLE
```

Example:

```text
P/E = -4

observation_state = VALID
usage_state.pe_valuation = INVALID_FOR_USAGE
reason = NEGATIVE_EARNINGS
```

But:

```text
FCF = -500B

observation_state = VALID
usage_state.cash_flow = ELIGIBLE
signal = NEGATIVE_FCF
```

A negative economic value is not automatically invalid data.

---

# 6. Foundation Contract B — Provenance

Every evaluation must be traceable to a source snapshot.

Required metadata should include:

```text
source_id
source_schema_version
retrieved_at
unit
currency
input_snapshot_id
data_as_of
reported_as_of
available_as_of
restatement_policy
raw_payload_hash
parser_version
mapping_version
evaluation_version
classification_version
```

`available_as_of` is distinct from `reported_as_of`. This is required for future historical validation and prevents look-ahead when historical snapshots are eventually introduced.

---

# 7. Foundation Contract C — Raw / Derived / Signal

## Raw

Original mapped source meaning. Preserve it.

## Derived

Evaluation-only calculations. Examples:

```text
FCF Yield
Drawdown_52W
Upside_to_52W_High
Position_52W_Range
Volume Trend
Momentum Reversal
Growth Acceleration
Margin Gap
FCF / Profit Divergence
```

## Signal / Anomaly

Machine-readable interpretation or warning:

```text
SEVERE_DRAWDOWN
EXTREME_GROWTH
EARNINGS_QUALITY_CONCERN
VALUE_TRAP_WARNING
HIGH_LEVERAGE
LOW_LIQUIDITY
DATA_GAP
PRICE_ABOVE_STORED_52W_HIGH
```

A signal does not automatically change a score.

---

# 8. Foundation Contract D — Derived Metric Contract

Every derived metric must be specified using:

```text
Name:
Family:
Formula:
Input fields (raw):
Purpose:
Output type:
Direction:
Used by Factor(s):
Coverage rule:
Invalid condition:
Low-base condition:
Low-base behavior:
Anomaly signal:
Structural relationship:
Graduation rule:
```

Additional contract fields:

```text
metric_id
version
relationship_type
criticality
applicability_rule
source_concept_id
```

### Derived categories

A derived metric may be:

```text
Scoring Derived
Signal Derived
Context Derived
```

Do not turn every calculation into a score.

### Direction graduation

`Context initially` is valid. A derived metric may graduate to scoring only when:

1. redundancy analysis shows it is not merely duplicate evidence;
2. its directional interpretation is reasonably consistent in the Factor Matrix;
3. the metric has an economically coherent role.

If those conditions are not met, it remains Context/Signal Derived. There is no requirement to force every metric into scoring.

---

# 9. Foundation Contract E — Coverage / Applicability

Coverage is explicit and traceable.

For raw fields:

> Only `Primary Role = Factor Input` is eligible to count toward factor coverage. Secondary role does not create additional coverage.

For derived metrics:

> Coverage/computability follows the highest-criticality raw input required by the formula.

If a Critical input is missing, the derived metric is unavailable; there is no half-coverage.

If an Optional input is missing, the derived metric may become `PARTIAL_INPUT` if the formula/policy permits; otherwise it is unavailable.

Coverage must expose its denominator/version:

```text
coverage_set_id
intended_metric_ids
applicable_metric_ids
available_metric_ids
critical_missing_metric_ids
coverage_formula_version
```

`NOT_APPLICABLE` may be removed from a denominator only when an explicit applicability rule says so. Missing is not automatically N/A.

Factor scores must expose both score and coverage, e.g.:

```text
Valuation Score       78
Valuation Coverage    4/6
Eligibility            LIMITED
```

Partial coverage must not be converted into a fake lower score.

---

# 10. Foundation Contract F — Criticality

Each input is classified for evaluation purposes as:

```text
Critical-for-Factor
Optional
```

Criticality does not mean the business is inherently important. It means the field is important for determining whether a particular factor/classification is sufficiently evidenced.

Missing an optional metric should not automatically make a stock unscoreable.

---

# 11. Foundation Contract G — Metric Roles

Use dual roles:

```text
Primary Role
Secondary Role
```

Possible roles:

```text
Factor Input
Derived Input
Anomaly Trigger
Context
Unused
```

Add:

```text
Counts toward Coverage: Y/N
Criticality: Critical / Optional
Used by Factor(s)
```

Principle:

> One metric may have multiple declared roles, but it may contribute only once to a given factor. Secondary role does not create an additional score contribution or coverage count.

### Cross-factor reuse

If a derived metric is used by two or more factors:

```text
CROSS_FACTOR_SHARED = true
```

This does **not** prohibit reuse. It makes reuse explicit and subject to cross-factor redundancy analysis.

For derived families with structural duplication, `Used by Factor(s)` remains `TBD` until the representative metric is selected.

---

# 12. Foundation Contract H — Redundancy / Double-counting

Redundancy is evaluated at four levels:

### 12.1 Structural redundancy

Known mathematical relationship, e.g.:

```text
Drawdown = P/H - 1
Upside = H/P - 1
```

### 12.2 Statistical redundancy

Observed correlation, preferably using robust/rank-based diagnostics where appropriate.

### 12.3 Economic redundancy

Different metrics may still measure substantially the same economic concept.

### 12.4 Contribution redundancy

Different paths may create the same factor/axis/classification effect.

A metric is not automatically deleted because it is correlated. Possible outcomes:

```text
representative
supplementary
context-only
anomaly-only
rejected-for-scoring
```

The reason must be recorded.

**Redundancy analysis occurs before official Anchored Scoring.**

A provisional diagnostic score may be used only for inspection and must be explicitly marked provisional.

---

# 13. Foundation Contract I — Contribution Lineage / Typed DAG

Every score/signal/gate effect must be traceable.

Contribution metadata should include:

```text
source
source_concept_id
target
target_type
contribution_type
condition
unknown_policy
transformation
bounded_effect
impact_group
aggregation_policy
max_effect_per_source_target
mutual_exclusion
priority
veto
```

Supported contribution concepts include:

```text
SCORE_DELTA
SIGNAL_TAG
GATE_TRIGGER
VETO
COVERAGE_EFFECT
```

### Impact budget

One economic observation must not create unlimited independent penalties simply because it appears in multiple paths.

Example:

```text
NEGATIVE_FCF
FCF_YIELD_WEAK
FCF_PROFIT_DIVERGENCE
```

may be different metrics/signals but can share the same `source_concept_id` where they represent the same economic evidence.

This is a second-level defense against double-counting beyond metric-level correlation.

### DAG rule

Dependencies must flow upstream → downstream. Cycles are invalid.

---

# 14. Foundation Contract J — Tri-valued Logic

Decision conditions use:

```text
TRUE
FALSE
UNKNOWN
```

Core logic:

| A | B | AND | OR |
|---|---|---|---|
| T | T | T | T |
| T | F | F | T |
| T | U | U | T |
| F | U | F | U |
| U | U | U | U |

Every rule must define `unknown_policy`.

Examples:

- A missing critical Risk input must not silently trigger a Hard Risk veto.
- A Core rule requiring unknown evidence does not qualify as TRUE.
- Data Gate may classify the row as `PARTIALLY_SCOREABLE` or `UNSCOREABLE`.

UNKNOWN is not FALSE.

---

# 15. Foundation Contract K — Data Gate / Eligibility

At minimum:

```text
SCOREABLE
PARTIALLY_SCOREABLE
UNSCOREABLE
```

`UNKNOWN / INSUFFICIENT_DATA` is a data/evaluation state, not a fifth investment table.

A stock with incomplete evidence should not be forced into Avoid merely because data is missing.

Factor-level states may include:

```text
FULL
LIMITED
UNAVAILABLE
```

A critical missing field can restrict a factor without automatically excluding the stock from the entire Screener.

---

# 16. Foundation Contract L — Anchored Factor Scores

The model does **not** use a single `overall_score` as the central decision variable.

Primary axes:

```text
QUALITY SCORE
OPPORTUNITY SCORE
RISK SCORE
```

Supporting composites:

```text
CORE SCORE
HIGH REWARD SCORE
```

Official metric scoring will use **Anchored Scores** rather than arbitrary batch-relative thresholds.

Conceptually:

```text
Raw Metric
   ↓
Absolute / anchored scoring function
   ↓
0–100 Anchored Metric Score
   ↓
Factor Score
```

Anchors may be Sector/Industry aware where economically justified.

No final anchor or weight is approved yet.

Anchor registry must eventually record:

```text
anchor_version
scope
effective_date
source
calibration_status
```

---

# 17. Foundation Contract M — Ranking vs Classification

These are deliberately separate.

### Classification

Uses anchored/fixed evaluation logic so classification does not change merely because the TradingView batch contains more or fewer stocks.

### Ranking tab

May use percentile/relative ranking inside the current batch.

Therefore:

```text
Classification ≠ Batch Percentile
Ranking       = Relative current-batch view
```

The current ~76-stock set is a validation sandbox, not a training set and not a basis for overfitting thresholds.

---

# 18. Price Dislocation Family — DEFINED, NOT IMPLEMENTED

Price Dislocation is the **first vertical slice for validating the evaluation engine**, not the first production investment factor.

Its output must describe a price-dislocation profile. A deep drawdown alone must **not** become `HIGH_REWARD`.

## 18.1 Drawdown_52W

```text
Name: Drawdown_52W
Formula: (Price / High_52W) - 1
Input fields: Price, High_52W
Output type: Percentage
Direction: Context initially
Used by Factor(s): TBD
Coverage: Price + High_52W; both Critical-for-Factor
Invalid: Price <= 0; High_52W <= 0; Price > High_52W
Low-base: N/A
Candidate anomaly: SEVERE_DRAWDOWN
```

Potential combined signal:

```text
Drawdown + poor Quality + negative FCF + high Debt/Equity
→ VALUE_TRAP_WARNING candidate
```

Do not assign the final factor(s) until redundancy analysis selects the representative metric.

## 18.2 Upside_to_52W_High

```text
Name: Upside_to_52W_High
Formula: (High_52W / Price) - 1
Input fields: Price, High_52W
Output type: Percentage
Direction: Context initially
Used by Factor(s): TBD
Coverage: Price + High_52W; both Critical-for-Factor
Invalid: Price <= 0; High_52W <= 0; Price > High_52W
Low-base: N/A
Structural relationship: direct monotonic transformation of Drawdown_52W
```

Drawdown and Upside contain the same core P/H information but use different nonlinear representations. They must not automatically become independent scoring evidence.

## 18.3 Position_52W_Range

```text
Name: Position_52W_Range
Formula: (Price - Low_52W) / (High_52W - Low_52W)
Input fields: Price, High_52W, Low_52W
Output type: Ratio, normally 0–1
Direction: Context initially
Used by Factor(s): TBD
Coverage: Price + High_52W + Low_52W; all Critical-for-Factor
Invalid: High_52W <= Low_52W; Low_52W <= 0
Low-base: High_52W - Low_52W near zero
Low-base behavior: LOW_BASE_UNRELIABLE; reduce/withhold scoring contribution according to final policy
```

Unlike Drawdown/Upside, Position adds Low_52W and may therefore contain partially independent information.

## 18.4 Structural relationship

For:

```text
D = Drawdown = P/H - 1
```

then:

```text
Upside = H/P - 1 = -D / (1 + D)
```

Therefore the relationship is known mathematically before empirical correlation is run.

Correlation is diagnostic, not an automatic deletion rule.

## 18.5 Price Dislocation output boundary

The vertical slice must produce:

```text
Dislocation Profile
```

not an investment thesis.

Possible evaluation states:

```text
PROFILE_ONLY
UNKNOWN
PARTIALLY_SCOREABLE
UNSCOREABLE
```

Example:

```text
Drawdown = -60%
Position = 0.14
```

means price is deeply below its stored 52W high and low in the range. It does **not** by itself mean cheap, good, turnaround or High Reward.

## 18.6 Inconsistent 52W reference

Never clamp:

```text
Price > High_52W
```

to `Price = High_52W`.

Preserve raw values and emit:

```text
PRICE_ABOVE_STORED_52W_HIGH
INCONSISTENT_REFERENCE
```

Potential causes to investigate:

- stale TradingView field
- adjustment mismatch
- snapshot mismatch
- parser issue
- source semantics

---

# 19. Vertical Slice MVP — D1 / D2 / D3

These are the first **implementation deliverables after the theory is fully approved**. They are not permission to start production scoring early.

## D1 — Contract Validator

Validate:

```text
Schema
State
Provenance
Input consistency
Applicability
Coverage
```

No investment scoring.

## D2 — Price Dislocation Evaluator

Inputs:

```text
Price
High_52W
Low_52W
```

Outputs:

```text
Drawdown_52W
Upside_to_52W_High
Position_52W_Range
computability
observation / quality flags
structural relationship
coverage
lineage
```

## D3 — Diagnostic / Decision Runner

Test:

```text
TRUE
FALSE
UNKNOWN
```

and:

```text
PROFILE_ONLY
UNKNOWN
PARTIALLY_SCOREABLE
UNSCOREABLE
```

No production classification.

### Required scenario tests

1. Normal valid row.
2. Severe drawdown.
3. Price near 52W high.
4. Narrow 52W range.
5. Missing High_52W.
6. Invalid/non-positive Price.
7. Price > High_52W without clamping.
8. UNKNOWN decision input.
9. Structural Drawdown/Upside redundancy.
10. Missing Optional vs Missing Critical input.

---

# 20. Remaining Evaluation Theory — PENDING

After the foundation and Price Dislocation contract, the following must be designed and explicitly approved **before production scoring code**.

## 20.1 Momentum / Volume Family

Candidate raw inputs:

```text
Perf 1W
Perf 1M
Perf 3M
Perf 6M
Perf 1Y
Perf YTD
Vol
Rel Vol
Avg Vol 10D
Avg Vol 30D
Avg Vol 60D
```

Must resolve:

- short/medium/long momentum representation
- overlap among performance periods
- raw Rel Vol semantics and baseline
- Volume Trend definitions
- price + volume confirmation
- Reversal definition
- low-base/near-zero behavior
- structural/statistical/economic redundancy
- representative vs supplementary metrics
- factor usage

Raw Volume/Rel Vol have `Context` direction initially. Volume becomes directional only through derived price-volume signals.

## 20.2 Growth Family

Candidate inputs:

```text
Revenue Growth Quarterly YoY
Revenue Growth Annual YoY
EPS Dil Growth TTM YoY
FCF Growth TTM YoY
```

Must resolve:

- growth acceleration
- growth consistency
- low-base conditions
- extreme-growth signals
- Revenue vs EPS growth redundancy
- FCF growth treatment
- scoring vs signal-only roles

## 20.3 Cash Flow Family

Candidate inputs:

```text
FCF TTM
Market Cap
Revenue TTM
```

Candidates:

```text
FCF Yield
FCF / Profit relationship
FCF quality / divergence
```

FCF negative is valid data, not invalid data.

FCF Yield may be semantically separated from absolute FCF:

```text
FCF → cash-flow evidence
FCF Yield → valuation / cash-generation efficiency
```

## 20.4 Balance Sheet / Safety Family

Candidate inputs:

```text
Debt/Equity FQ
Debt/Equity FY
Current Ratio FQ/FY
Quick Ratio FQ/FY
```

Must resolve:

- FQ vs FY usage
- leverage trend/change
- liquidity trend/change
- optimal-range treatment for Current/Quick Ratio
- Hard vs Soft Risk evidence

## 20.5 Earnings Quality Family

Candidate inputs:

```text
ROE
ROA
Gross Margin
Operating Margin
Net Margin
EPS
FCF
```

Candidates:

```text
NetOpMarginGap
Profit_vs_FCF_Divergence
```

Potential anomaly:

```text
Net Margin far above Operating Margin
→ EARNINGS_QUALITY_CONCERN
```

Do not automatically treat the anomaly as a score penalty.

---

# 21. Factor Model — PENDING THEORY

The architecture is fixed, but factor composition, anchors and weights are not.

Target axes:

```text
QUALITY SCORE
OPPORTUNITY SCORE
RISK SCORE
```

Supporting composites:

```text
CORE SCORE
HIGH REWARD SCORE
```

Candidate base factors:

```text
Quality
Growth
Financial Safety
Cash Flow
Valuation
Momentum
```

High Reward and Risk should be treated as overlays/composites where appropriate rather than flat copies of all underlying metrics.

For each factor we must eventually define:

```text
purpose
metric inputs
derived inputs
representative metrics
supplementary metrics
signals
coverage set
criticality
missing policy
direction
ranking universe
anchored transformation
contribution policy
cross-factor reuse
redundancy controls
```

### Double-counting rule

> One piece of evidence has one primary factor role. Reuse elsewhere must be explicit, traceable and bounded.

### Correlation cluster

Before official factor weights:

```text
Derived metrics
   ↓
Correlation / redundancy matrix
   ↓
Clusters
   ↓
Representative / supplementary / context roles
   ↓
Factor matrix
```

Known candidates to inspect include:

```text
ROE ↔ ROA
Revenue Growth ↔ EPS Growth
P/E ↔ PEG
P/B ↔ ROE
P/S ↔ Net Margin
EV/Revenue ↔ P/S
Operating Margin ↔ Net Margin
FCF ↔ FCF Yield
Performance-period overlaps
Volume-derived overlaps
Growth ↔ High Reward
Momentum ↔ High Reward
Safety ↔ Risk
```

---

# 22. Risk Model — PENDING THEORY

Risk is split into two layers:

```text
HARD RISK
→ catastrophic / combined evidence
→ may block classification

SOFT RISK
→ elevated but non-catastrophic
→ affects internal ranking / context
```

A single weak metric should not automatically become a Hard Risk veto.

Example concept:

```text
Negative FCF alone
→ NEGATIVE_FCF signal

Negative FCF
+ high leverage
+ liquidity stress
→ HARD_RISK / VALUE_TRAP candidate
```

The exact thresholds, combinations and veto semantics remain pending.

---

# 23. Classification Model — PENDING THEORY

The primary decision tree is:

```text
1. DATA GATE
       ↓
2. HARD RISK / VALUE TRAP GATE
       ↓
3. HIGH REWARD GATE
       ↓
4. CORE GATE
       ↓
5. UNDERPERFORM GATE
       ↓
6. WATCH / NEUTRAL / UNKNOWN
```

The second branch is explicitly **Hard Avoid / Value Trap**, not simply `Risk high = Avoid`.

Reason:

```text
High Risk + strong Quality/Growth + strong Momentum
→ potentially High Reward / High Risk
```

not automatically Avoid.

Decision rules must specify:

```text
precedence
veto
unknown policy
minimum coverage
eligibility
confidence
reason codes
```

No final thresholds are approved.

---

# 24. Classification Confidence — PENDING

Each primary classification should eventually expose:

```text
High
Medium
Low
Insufficient Data
```

Confidence must reflect evidence quality/coverage and rule clarity, not simply the magnitude of a score.

---

# 25. Ranking Tab — PENDING FINAL FACTOR MODEL

Ranking remains independent from classification.

Ranking may expose:

```text
batch percentile
factor rank
axis rank
signal tags
```

It must not alter the classification merely because the current batch size changes.

---

# 26. Historical / Forward-return Validation — FUTURE

The current ~76-stock dataset is a validation sandbox, not a training set.

It is sufficient for:

- parser/evaluation debugging
- distribution inspection
- redundancy discovery
- anomaly inspection
- classification logic inspection
- bias/coverage inspection

It is not sufficient to prove predictive power or optimize thresholds statistically.

Forward-return validation is deferred until historical Screener snapshots exist:

```text
snapshot date
→ score/classification
→ forward 1M / 3M return
```

Do not pretend to have statistical validation without historical snapshots.

---

# 27. Implementation Order — AFTER THEORY FREEZE

**Do not start this phase until all PENDING THEORY sections above are approved.**

```text
1. Finalize data/state/provenance contracts
2. Finalize all Derived Metric Families
3. Finalize redundancy / representative metrics
4. Finalize signal/anomaly rules
5. Finalize factor matrix
6. Finalize anchored scoring functions
7. Finalize Hard/Soft Risk model
8. Finalize classification decision tree
9. Finalize ranking model
10. Freeze implementation specification
11. Implement D1 Contract Validator
12. Implement D2 Price Dislocation Evaluator
13. Implement D3 Diagnostic Runner
14. Run scenario tests
15. Expand evaluator family-by-family
16. Replace legacy production scoring only after validation
17. Verify Dashboard + Ranking use one result set
18. Verify explicit-only CRSM handoff
```

---

# 28. Developer / QA Tools

Keep these tools during V2 development:

- Mapping tab
- Raw Clipboard Inspector
- Parser Debug
- reconstructed table
- full-table copy/export validation
- scenario/debug panel
- result/lineage inspection

They are QA/developer tools, not part of the investment model. Do not remove them until the new engine passes real-data validation.

---

# 29. Required Review Artifacts

Create/update these artifacts as the theory is finalized:

```text
screener_v2_data_dictionary.md
screener_v2_legacy_audit.md
screener_v2_field_role_mapping.md
screener_v2_derived_metrics.md
screener_v2_signals.md
screener_v2_factor_spec.md
screener_v2_classification_model.md
screener_v2_result_contract.md
screener_v2_decision_log.md
screener_v2_validation_plan.md
```

These documents should not duplicate implementation code. They capture the decisions that must survive across sessions.

---

# 30. Final Definition of Done

The Screener V2 theory phase is complete only when:

- [x] TradingView mapping contract is established.
- [x] Percentage/ratio/quantity parsing semantics are established.
- [x] Dashboard/Ranking/CRSM boundary is established.
- [x] Overall score is no longer the central architecture.
- [x] Quality / Opportunity / Risk axes are established.
- [x] Typed DAG architecture is established.
- [x] Data state / UNKNOWN concept is established.
- [x] Coverage / Criticality concept is established.
- [x] Provenance concept is established.
- [x] Contribution lineage / impact budget concept is established.
- [x] Redundancy-before-scoring principle is established.
- [x] Price Dislocation Family is defined as the first vertical slice.
- [ ] Momentum / Volume Family finalized.
- [ ] Growth Family finalized.
- [ ] Cash Flow Family finalized.
- [ ] Balance Sheet / Safety Family finalized.
- [ ] Earnings Quality Family finalized.
- [ ] Correlation/redundancy decisions finalized.
- [ ] Anchored metric scoring finalized.
- [ ] Factor Matrix finalized.
- [ ] Hard/Soft Risk rules finalized.
- [ ] Classification rules finalized.
- [ ] Ranking rules finalized.
- [ ] Final implementation specification frozen.

**Only after the final implementation specification is frozen should production Screener V2 code be changed.**
