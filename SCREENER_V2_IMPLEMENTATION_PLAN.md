# Screener V2 — Implementation Plan

> **Status: THEORY FOUNDATION CLOSED / SANDBOX VERTICAL SLICE READY**
>
> This document is the source of truth for the Screener V2 redesign. It records the decisions reached during design/review so the work does not drift between sessions.
>
> **Important boundary:** the Evaluation Model V2 architecture and semantic contracts are closed. Production numeric calibration is still open. A versioned **SANDBOX registry** may therefore be used for the D1 → D2 → D3 vertical slice, but no sandbox value may silently become a production rule.

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
     ┌──┴──────────────┐
     ↓                 ↓
 Dashboard          Ranking
     │
     ↓
 User selects stock
     ↓
 Explicit Analyze action
     ↓
 CRSM / Node 1
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

Validated source fields include:

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
- Structural, statistical, economic and contribution redundancy analysis before official scoring.
- Provenance / as-of metadata.
- Audit lineage.
- `UNKNOWN` must never silently become `FALSE` or zero.
- Raw data is never overwritten by scoring transformations.
- A signal is not automatically a penalty.
- A trigger is not automatically a veto.
- No new abstraction should be added unless a concrete implementation/test problem requires it.

---

# 4. Dashboard / Ranking / CRSM Boundary

After evaluation, Dashboard has **four primary investment tables**:

1. **Core Performers**
2. **Quality Underperformers**
3. **High Reward / High Risk**
4. **Avoid / Value Trap**

The existing **Ranking tab remains**.

`WATCH_NEUTRAL` is a first-class evaluation/classification state for incomplete, mixed or unresolved cases, but it is **not a fifth primary investment table**. It may be surfaced as a separate non-investment view/state in the Dashboard.

Dashboard and Ranking consume the **same Screener Result Set**. They must not calculate separate scores.

A stock normally has one primary classification and may carry multiple signal tags.

### CRSM

There is **no automatic candidate gate and no automatic handoff**.

Only when the user explicitly selects a stock and clicks Analyze:

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

A negative economic value is not automatically invalid data.

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
snapshot_id
data_as_of
reported_as_of
available_as_of
period_end
fiscal_period
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

Original mapped source meaning. Preserve it exactly after display-format decoding.

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
INCONSISTENT_REFERENCE
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

For structurally related derived families, `Used by Factor(s)` remains `TBD` until representative selection is complete.

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

Factor/Axis objects must expose both score and coverage. Partial coverage must not be converted into a fake lower score.

---

# 10. Foundation Contract F — Criticality

Each input is classified for evaluation purposes as:

```text
Critical-for-Factor
Optional
```

Criticality determines whether missing evidence can make a factor/gate insufficiently evidenced. It does not mean the field is inherently important to the business.

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

This does not prohibit reuse. It makes reuse explicit and subject to cross-factor redundancy analysis.

---

# 12. Foundation Contract H — Redundancy / Double-counting

Redundancy is evaluated at four levels:

1. **Structural redundancy** — known mathematical relationship.
2. **Statistical redundancy** — observed correlation.
3. **Economic redundancy** — same economic concept despite different formulas.
4. **Contribution redundancy** — different paths creating the same factor/axis/classification effect.

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

One economic observation must not create unlimited independent influence simply because it appears in multiple paths.

Example:

```text
NEGATIVE_FCF
FCF_YIELD_WEAK
FCF_PROFIT_DIVERGENCE
```

may be different metrics/signals but can share the same `source_concept_id` where they represent the same economic evidence.

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

`UNKNOWN` is never silently coerced to `FALSE`, zero, low, pass, last rank, or another convenient state.

Every rule must define `unknown_policy`.

---

# 15. Foundation Contract K — Data Gate / Eligibility

At minimum:

```text
SCOREABLE
PARTIALLY_SCOREABLE
UNSCOREABLE
```

`UNKNOWN / INSUFFICIENT_DATA` is a data/evaluation state, not a fifth investment table.

Factor-level status may include:

```text
FULL
LIMITED
UNAVAILABLE
```

A critical missing field can restrict a factor without automatically excluding the stock from the entire Screener.

---

# 16. Foundation Contract L — Anchored Factor Scores

The model does **not** use a single `overall_score` as the central decision variable.

Core evaluation factors are represented independently:

```text
QUALITY
GROWTH
MOMENTUM
VALUATION
SAFETY
```

Primary axes are:

```text
QUALITY AXIS
OPPORTUNITY AXIS
```

Risk is handled through a separate Risk Gate rather than subtracting a Risk Score from other scores.

Supporting composites such as `CORE SCORE` or `HIGH REWARD SCORE` may exist only where explicitly defined by the factor/axis contract; they are not a replacement for the two axes.

Official metric scoring uses Anchored Scores:

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

---

# 17. Factor Matrix + Contribution Budget V1 — CLOSED SEMANTIC CONTRACT

The Factor Matrix establishes ownership before numeric scoring.

## 17.1 Ownership rule

Each metric has one canonical `PRIMARY_FACTOR_OWNER`.

Secondary use is allowed only when explicitly declared with:

```text
consumer_rule
incremental_information
impact_cap
```

## 17.2 Economic impact groups

Metrics are grouped by `impact_group` / `source_concept_id` so that multiple formulas describing the same economic evidence share a bounded influence budget.

Representative selection is based on:

1. semantic coverage;
2. robustness;
3. applicability;
4. interpretability;
5. data quality;
6. redundancy;
7. empirical validation where available.

Correlation is evidence for the decision, not an automatic deletion rule.

## 17.3 Initial representative hypotheses

These are hypotheses, not production hard-code:

```text
RETURN_EFFICIENCY              → ROE representative; ROA supporting
MARGIN_ECONOMICS               → Operating Margin representative
EARNINGS_GROWTH                → Revenue Growth + EPS Growth shared
CASH_FLOW_ECONOMICS            → consumer-specific FCF representation
BALANCE_LIQUIDITY              → Current Ratio + Quick Ratio shared
LEVERAGE                       → Debt/Equity primary
PRICE_MOMENTUM                 → Trend + Persistence representation
MOMENTUM_TRANSITION            → Acceleration bounded/context
VOLUME_CONFIRMATION             → Price–Volume confirmation
EARNINGS_VALUATION             → P/E representative; PEG bounded support
ASSET_VALUATION                → P/B primary; ROE remains Quality-owned
REVENUE_VALUATION              → P/S + EV/Revenue shared
ENTERPRISE_OPERATING_VALUATION → EV/EBITDA primary
CASH_VALUATION                 → FCF Yield primary
DISTRIBUTION_CONTEXT           → Dividend Yield context
PRICE_DISLOCATION              → context/profile only in V1
```

Representative hypotheses must remain versioned and replaceable by the redundancy/validation process.

## 17.4 Contribution classes

```text
FULL_PRIMARY_ONE_GROUP
SHARED_PRIMARY_CAPPED
CONTEXT_BOUNDED
DIAGNOSTIC_ONLY
GATE_ONLY
```

A group with multiple metrics must not gain influence simply because it contains more fields.

---

# 18. Factor Formula V1 — CLOSED SEMANTICS / SANDBOX NUMERIC REGISTRY

Factor aggregation is group-first, not metric-count-first.

Conceptually:

```text
Metric Score
      ↓
Metric Contribution
      ↓
Impact Group
      ↓
Group Contribution
      ↓
Factor Budget
      ↓
Factor Score 0–100
```

Generic factor formula:

```text
Factor Score =
Σ(Group Score × Eligible Group Budget)
/
Σ(Eligible Group Budget)
```

Rules:

- Eligible groups only; missing optional evidence does not become zero.
- Coverage is metadata, not a score penalty multiplier.
- `NOT_MEANINGFUL` is ineligible, not a bearish score.
- Diagnostic signals do not create independent contribution.
- Supporting metrics cannot open a second full budget.
- Cross-factor reuse is bounded by lineage and source-concept rules.
- Factor scores are batch-invariant.

### Sandbox numeric policy

Numeric production values are not yet calibrated. For the vertical slice, any temporary numeric value must live in an explicitly versioned registry with:

```text
calibration_status = SANDBOX
registry_version = ...
```

No module may hard-code sandbox values as permanent policy.

---

# 19. Axis Mapping V1 — CLOSED

The two principal axes are:

```text
QUALITY AXIS
├── QUALITY
└── SAFETY

OPPORTUNITY AXIS
├── GROWTH
├── MOMENTUM
└── VALUATION
```

Axis score is normalized across eligible factor budgets:

```text
Axis Score =
Σ(Factor Score × Eligible Factor Budget)
/
Σ(Eligible Factor Budget)
```

Axis objects must preserve:

```text
score
coverage
status
profile
weak-member metadata
lineage
```

Risk is **not subtracted** from an Axis score.

### Axis profiles

Profiles are explanatory, not replacements for scores. Examples:

```text
QUALITY_STRONG
QUALITY_BALANCED
PROFITABILITY_LED
SAFETY_LED
QUALITY_WITH_SAFETY_CONCERN
WEAK_FOUNDATION

BALANCED_OPPORTUNITY
GROWTH_LED
MOMENTUM_LED
VALUATION_LED
GROWTH_MOMENTUM_LED
WEAK_OPPORTUNITY
INCOMPLETE
```

A strong blended axis cannot hide a materially weak constituent when the profile contract flags that weakness.

---

# 20. Risk Model V1 — CLOSED SEMANTICS / THRESHOLDS SANDBOX-OPEN

Risk is split into:

```text
HARD_RISK
SOFT_RISK
RISK_CONTEXT
```

## Hard Risk

Hard Risk is based on catastrophic or combined distress evidence, not one arbitrary high-risk metric.

Candidate archetypes include:

```text
EXTREME_LEVERAGE + SEVERE_LIQUIDITY_STRESS
PERSISTENT_NEGATIVE_FCF + EXTREME_LEVERAGE
SEVERE_LIQUIDITY_STRESS + PERSISTENT_NEGATIVE_FCF + WEAK_PROFITABILITY
```

A single elevated D/E or one negative FCF period is not automatically Hard Risk.

## Soft Risk

Examples:

```text
ELEVATED_LEVERAGE
WEAK_LIQUIDITY
NEGATIVE_FCF
EARNINGS_UNCERTAINTY
SEVERE_DRAWDOWN
```

Soft Risk may affect ranking/context but does not automatically block Core.

## Gate output

```text
PASS
FAIL
UNKNOWN
```

The Gate Object must preserve:

```text
gate_status
tri_state_conditions
triggered_rules
unresolved_conditions
failed_reason
coverage
lineage
soft_risk_profile
```

Hard Risk failure does not rewrite Axis scores. It affects classification eligibility.

Numeric materiality thresholds remain registry-controlled and sandbox-open.

---

# 21. Classification Decision Tree V1 — CLOSED SEMANTICS / BAND NUMBERS SANDBOX-OPEN

Primary precedence is fixed:

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
6. WATCH / NEUTRAL
```

The second branch is explicitly **Hard Avoid / Value Trap**, not `Risk high = Avoid`.

## Primary outcomes

```text
CORE
QUALITY_UNDERPERFORMER
HIGH_REWARD_HIGH_RISK
AVOID_VALUE_TRAP
WATCH_NEUTRAL
```

Only the first four are primary investment Dashboard tables. `WATCH_NEUTRAL` is the unresolved/non-decisive state.

## Core semantic requirement

Core requires strong foundation and opportunity evidence, a passing Hard Risk Gate, and no material Soft Risk condition that the Classification Registry defines as incompatible with Core.

## Quality Underperformer

Strong foundation + weak current opportunity, without a Hard Risk failure. Medium Opportunity does not enter this table in V1 unless a later registry version explicitly permits it.

## High Reward / High Risk

Strong opportunity/foundation, Hard Risk `PASS`, and explicit **material Soft Risk**. A deep drawdown alone is not sufficient.

## Avoid / Value Trap

Requires structured negative/distress/trap evidence. Low valuation, deep drawdown, or a single warning alone does not establish Value Trap.

## Watch / Neutral

Used for incomplete, mixed, unresolved, medium-band, or otherwise non-decisive cases. Unknown Gate conditions remain unresolved.

---

# 22. Classification Threshold / Band Registry V1

Classification uses anchored score bands, not batch percentiles.

Band vocabulary is:

```text
LOW
MEDIUM
HIGH
INSUFFICIENT_DATA
```

The band registry must be versioned:

```text
registry_id
registry_version
calibration_status
scope
lower_boundary
upper_boundary
endpoint_policy
effective_date
```

Production `LOW/HIGH` boundaries remain open until calibrated. Sandbox comparison may use explicit temporary boundaries, but these must be marked `SANDBOX` and must never be hard-coded into Classification code.

Batch changes must not alter the band of an unchanged anchored score.

`UNKNOWN` and `NOT_MEANINGFUL` remain unresolved/ineligible rather than being mapped to `LOW`.

---

# 23. Ranking Tab V1 — CLOSED SEMANTICS

Ranking is deliberately separate from Classification.

```text
Screener Result Set
       ├── Classification → anchored/batch-invariant
       └── Ranking        → current displayed-universe percentile
```

Ranking may expose:

```text
Opportunity Ranking
Quality Ranking
Growth Ranking
Momentum Ranking
Valuation Ranking
Safety Ranking
```

A pre-existing composite may remain only if its semantic is explicitly retained and labeled `COMPOSITE_RANKING`; do not create a new investment Overall Score.

Each ranking row should preserve:

```text
raw_score
percentile
rank_position
rank_total
rankable_denominator
coverage
partial_status
displayed_universe_id
tie_policy
```

Rules:

- Unknown scores are `UNRANKABLE`, not last place.
- Ranking percentile may change when the displayed universe changes.
- Factor/Axis scores and Classification must not change because ranking changes.
- Equal scores share the same rank according to the versioned tie policy; do not use symbol order as an artificial tie-breaker.
- Filters affecting rankability must disclose displayed-universe and rankable-universe sizes.

Final production percentile/tie conventions remain registry-controlled.

---

# 24. Dashboard Contract V1 — CLOSED

Dashboard is a **view and navigation boundary**, not a second scoring engine.

```text
Screener Dataset
      ├── Classification Engine → four primary tables + WATCH_NEUTRAL state
      └── Ranking Engine → Ranking Tab

User selects a security
      ↓
User clicks Analyze
      ↓
CRSM / Node 1
```

The UI must not recompute metrics, apply hidden thresholds, override Risk Gate results, or automatically hand a security to downstream analysis.

## 24.1 Required primary tables

```text
CORE
QUALITY_UNDERPERFORMER
HIGH_REWARD_HIGH_RISK
AVOID_VALUE_TRAP
```

`WATCH_NEUTRAL` may be surfaced as a separate non-investment state/view.

## 24.2 Shared row data

Every row must retain or expose inspectable access to:

```text
Security identifier
Classification label
Quality Axis score/band/coverage/status/profile
Opportunity Axis score/band/coverage/status/profile
Hard Risk status
Gate failed reason
Soft Risk profile
Factor highlights
Registry versions
Lineage reference
```

The UI may use compact columns, but the full Classification Object must remain inspectable.

## 24.3 User action

Selecting a security opens evidence detail. CRSM/Node 1 begins only after the user explicitly clicks **Analyze**.

## 24.4 Empty/unresolved states

The UI must distinguish:

```text
No matches
GATE_UNKNOWN
UNSCOREABLE
UNRANKABLE
PARTIAL
STALE / MISMATCHED PROVENANCE
```

No unresolved state may be silently converted into a negative investment classification.

---

# 25. Implementation Contract V1 — Theory to Module Specification

The implementation is a typed DAG of modules. No module may invent an unstated fallback rule.

```text
Source Adapter / Snapshot Validator
              ↓
        Data Gate + Applicability
              ↓
        Derived Metric Engine
              ↓
        Signal / Anomaly Engine
              ↓
        Anchored Metric Scoring Engine
              ↓
        Factor Engine
              ↓
        Axis Engine
              ├──────────────→ Risk Gate Engine
              ↓                       ↓
        Band Registry            Classification Engine
              └──────────────→ Ranking Engine
                                      ↓
                              Dashboard Adapter
                                      ↓
                              User-triggered CRSM / Node 1
```

## 25.1 Module responsibilities

### Contract Validator / Snapshot Validator

Validate schema, period/source consistency, provenance, applicability, and tri-valued gate readiness. Distinguish `UNKNOWN`, invalid, mismatched, and `NOT_MEANINGFUL`.

### Derived Metric Engine

Compute only metrics declared in the Derived Metric Registry. Preserve raw parents, formula/policy version, state propagation, source concept and lineage. Never invent an unregistered ratio or unsafe denominator.

### Signal / Anomaly Engine

Produce declared signals such as reversal candidates, margin gaps, volume confirmation, divergence, financial stress candidates and price context. Diagnostic signals do not become scores unless an explicit downstream contract permits bounded context.

### Anchored Metric Scoring Engine

Map eligible metric observations to `0–100` scores using the versioned Transform Registry. Preserve raw value, anchor, transform version, state, applicability and continuity behavior. Unknown/not-meaningful values are not mapped to low scores.

### Factor Engine

Consume scored metric objects and Contribution Budget Registry. Aggregate at impact-group level, apply representative/supporting rules, use eligible budgets only, and emit score, coverage, status, state and lineage.

Must enforce:

- no simple metric-count average;
- no diagnostic contribution;
- no coverage multiplier;
- no missing-as-zero behavior;
- no double contribution across representative/supporting evidence;
- batch invariance.

### Axis Engine

Consume Factor Objects only. Create Quality Axis and Opportunity Axis with score, coverage, status, profile, weak-member metadata and lineage. Do not subtract Risk and do not re-read raw metrics.

### Risk Gate Engine

Consume declared upstream signals, factor states and axis states. Use TRUE/FALSE/UNKNOWN. Emit PASS/FAIL/UNKNOWN with rules, unresolved conditions, soft-risk profile, failed reason, coverage and lineage. Do not create a Risk Score.

### Band Registry

Map valid Factor/Axis scores to versioned semantic bands. Preserve unknown, ineligible and partial states. Boundaries are anchored and batch-invariant.

### Classification Engine

Consume Axis Objects, Risk Gate Object, Soft Risk Profile, Band Objects and coverage. Output one primary classification state. It must not access arbitrary raw metrics or infer a label from ranking.

### Ranking Engine

Consume valid Factor/Axis scores plus the current displayed universe. Emit score, percentile, rank position, denominator, tie policy, rankability, partial status and universe metadata. Unknown scores are unrankable.

### Dashboard Adapter

Render Classification Objects and Ranking Records. It must not compute scores, thresholds, risk, classification or ranks. It must expose registry versions/lineage and require explicit user action before CRSM/Node 1.

---

# 26. Common Evaluation Object Contract

Every major output object must preserve:

```text
object_id
schema_version
calculation_version
snapshot_id
available_as_of
state
coverage
eligibility
source_concept_id
lineage
```

Score-bearing objects additionally preserve:

```text
score
score_status
score_domain
transform_registry_version
```

Gate-bearing objects additionally preserve:

```text
gate_status
tri_state_conditions
triggered_rules
unresolved_conditions
failed_reason
```

Classification objects additionally preserve:

```text
classification
classification_version
quality_axis
opportunity_axis
risk_state
band_versions
factor_highlights
```

Ranking records additionally preserve:

```text
raw_score
percentile
rank_position
rank_total
rankable_denominator
universe_id
tie_policy_version
```

---

# 27. Registry Architecture

Policy must live in versioned registries rather than hard-coded module branches.

Required registries:

| Registry | Controls |
|---|---|
| Metric Role Registry | Primary, Secondary, Context, Diagnostic, Gate roles |
| Derived Metric Registry | Formula, parent lineage, state propagation |
| Applicability Registry | Applicable, low relevance, not meaningful, unknown rules |
| Transform Registry | Anchors, curves, bounds, continuity |
| Contribution Budget Registry | Impact groups, representatives, supporting caps |
| Factor Formula Registry | Group budgets, aggregation modes, factor criticality |
| Axis Mapping Registry | Factor membership, axis budgets, profile rules |
| Risk Signal/Rule Registry | Signals, tri-valued combinations, hard/soft semantics |
| Band Registry | Score bands and boundary policy |
| Classification Registry | Table eligibility rules and precedence |
| Ranking Registry | Rankability, percentile, tie policy |

Every registry must expose at least:

```text
registry_id
registry_version
calibration_status
scope
effective_date
```

---

# 28. Sandbox vs Production Calibration Boundary

This is the key implementation clarification added after the theory freeze.

## 28.1 Production

Production implementation requires explicitly versioned/calibrated values for:

- production metric anchors/transforms;
- production factor group weights/caps;
- cross-factor influence caps;
- axis budgets;
- classification band boundaries;
- material Soft Risk thresholds;
- final percentile/tie conventions.

## 28.2 Sandbox vertical slice

D1 → D2 → D3 may run with explicit sandbox registries before production calibration is complete.

Sandbox values must:

```text
be versioned;
carry calibration_status = SANDBOX;
never be hidden in module code;
never be presented as production investment thresholds;
be replaceable without changing engine architecture.
```

The vertical slice is a **test boundary**, not permission to bypass unresolved production calibration.

---

# 29. Price Dislocation Family — First Vertical Slice

Price Dislocation is **not** the first factor used to rank stocks. It is the first vertical slice for validating the evaluation engine.

## 29.1 Drawdown_52W

```text
Formula: (Price / High_52W) - 1
Inputs: Price, High_52W
Output: percentage
Direction: Context initially
Used by Factor(s): TBD until representative selection
```

Coverage requires both Critical inputs.

Invalid:

```text
Price <= 0
High_52W <= 0
Price > High_52W
```

Candidate signal:

```text
SEVERE_DRAWDOWN
```

A deep drawdown alone does not imply High Reward, Value Trap, cheapness or turnaround.

## 29.2 Upside_to_52W_High

```text
Formula: (High_52W / Price) - 1
Inputs: Price, High_52W
Output: percentage
Direction: Context initially
Used by Factor(s): TBD
```

Structural relationship with Drawdown:

```text
D = P/H - 1
Upside = H/P - 1 = -D / (1 + D)
```

The two metrics contain the same core P/H information through a nonlinear monotonic transformation. They must not automatically become independent scoring evidence.

## 29.3 Position_52W_Range

```text
Formula: (Price - Low_52W) / (High_52W - Low_52W)
Inputs: Price, High_52W, Low_52W
Output: ratio, normally 0–1
Direction: Context initially
Used by Factor(s): TBD
```

Invalid:

```text
High_52W <= Low_52W
Low_52W <= 0
```

If `High_52W - Low_52W` is near zero:

```text
LOW_BASE_UNRELIABLE
```

Unlike Drawdown/Upside, Position adds Low_52W and may contain partially independent information.

## 29.4 Price > High_52W

Never clamp the raw value.

```text
Price = 110
High_52W = 100
```

must remain:

```text
Price = 110
```

and emit:

```text
PRICE_ABOVE_STORED_52W_HIGH
INCONSISTENT_REFERENCE
```

Potential causes are investigated outside the formula layer:

- stale source field;
- adjustment mismatch;
- snapshot mismatch;
- parser issue;
- source semantics.

## 29.5 Output boundary

The Price Dislocation evaluator produces:

```text
Dislocation Profile
```

and states such as:

```text
PROFILE_ONLY
UNKNOWN
PARTIALLY_SCOREABLE
UNSCOREABLE
```

It does not create a High Reward investment thesis.

---

# 30. Vertical Slice MVP — D1 / D2 / D3

These are the **first implementation deliverables** after the semantic theory freeze.

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

No production investment scoring.

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
computability/state
quality flags
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

The vertical slice must prove state propagation, provenance, lineage, contract validation and the Price Dislocation family before the next family is opened.

---

# 31. Remaining Evaluation Work After D1/D2/D3

Once the vertical slice passes, continue family-by-family.

## 31.1 Momentum / Volume Family

Resolve:

- short/medium/long momentum representation;
- overlap among performance periods;
- raw Rel Vol semantics and baseline;
- Volume Trend definitions;
- price + volume confirmation;
- Reversal definition;
- low-base behavior;
- redundancy;
- representative/supplementary roles;
- factor usage.

Raw Volume/Rel Vol have `Context` direction initially. Volume becomes directional only through derived price-volume signals.

## 31.2 Growth Family

Candidate inputs:

```text
Revenue Growth Quarterly YoY
Revenue Growth Annual YoY
EPS Dil Growth TTM YoY
FCF Growth TTM YoY
```

Resolve:

- growth acceleration;
- consistency;
- low-base handling;
- extreme-growth signals;
- Revenue vs EPS redundancy;
- FCF Growth role;
- scoring vs signal-only behavior.

## 31.3 Cash Flow Family

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
FCF quality/divergence
```

FCF negative is valid data, not invalid data.

## 31.4 Balance Sheet / Safety Family

Candidate inputs:

```text
Debt/Equity FQ/FY
Current Ratio FQ/FY
Quick Ratio FQ/FY
```

Resolve:

- FQ vs FY usage;
- leverage trend/change;
- liquidity trend/change;
- optimal-range treatment for Current/Quick Ratio;
- Hard vs Soft Risk evidence.

## 31.5 Earnings Quality Family

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

Anomaly signals do not automatically become score penalties.

---

# 32. Correlation / Redundancy Workflow

Before official factor weights:

```text
Derived metrics
      ↓
Structural relationship check
      ↓
Correlation / redundancy matrix
      ↓
Economic concept clustering
      ↓
Representative / supplementary / context roles
      ↓
Factor Matrix confirmation
```

Known candidates:

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
Drawdown ↔ Upside_to_52W_High
Drawdown ↔ Position_52W_Range
```

Structural redundancy is known before the 76-stock sample. Empirical correlation is still useful for validating practical redundancy and representative selection.

The current ~76-stock set is a **validation sandbox**, not a training set.

---

# 33. Required Invariants / QA

The implementation must enforce:

1. One canonical primary factor owner per metric.
2. Shared source concepts require explicit incremental information and caps.
3. Score, coverage, state and eligibility are separate fields.
4. Risk never subtracts from Factor or Axis scores.
5. Hard Risk blocks classification but does not rewrite Axis scores.
6. UNKNOWN is never coerced to false, zero, low, pass or last rank.
7. NOT_MEANINGFUL is not a bearish score.
8. Diagnostics do not become independent contributions.
9. Factor and Axis scores are batch-invariant.
10. Ranking may change with batch composition but cannot alter source scores or classification.
11. Dashboard presentation cannot recalculate policy.
12. No downstream module may create unregistered evidence.
13. Raw values are never clamped to make formulas convenient.
14. Percentage fields are not divided by 100 during ingestion.
15. Quantity suffixes K/M/B/T are decoded to full numbers during ingestion.
16. Raw values remain available alongside all derived/scored representations.
17. Negative economic values remain valid observations unless a specific metric applicability rule says otherwise.

---

# 34. Test Architecture

Before production rollout, tests must cover:

| Test family | Required coverage |
|---|---|
| Schema/provenance | Missing, mismatched, stale, conflicting snapshots |
| State propagation | Valid, missing, invalid, N/A, unknown, not meaningful, sign change, low base |
| Parsing | Percentage, ratio, quantity suffix, text, missing, invalid |
| Lineage | Raw → derived → signal → score → factor → axis → classification |
| Double counting | Shared groups, representative/supporting, cross-factor FCF, Safety/Risk boundary |
| Continuity | Small input changes and declared state boundaries |
| Batch invariance | Factor, Axis, Band and Classification stability across universe changes |
| Tri-valued gates | TRUE/FALSE/UNKNOWN combinations and precedence |
| Coverage | No coverage penalty multiplier and criticality overrides |
| Applicability | Negative denominators and inapplicable valuation metrics |
| Price Dislocation | Structural Drawdown/Upside relation and invalid reference behavior |
| Ranking | Unknown exclusion, partial state, ties, percentile changes |
| Dashboard | View-only behavior, field visibility, version audit, explicit handoff |

---

# 35. Developer / QA Tools

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

# 36. Implementation Order

## Phase A — Vertical Slice Now

```text
A1. Freeze current semantic contracts
A2. Add/load sandbox registry mechanism
A3. Implement D1 Contract Validator
A4. Implement D2 Price Dislocation Evaluator
A5. Implement D3 Diagnostic / Decision Runner
A6. Run required scenario tests
A7. Inspect lineage/state/provenance outputs
```

**Stop condition:** D1/D2/D3 must pass before Momentum/Volume implementation begins.

## Phase B — Evaluation Families

```text
B1. Momentum / Volume
B2. Growth
B3. Cash Flow
B4. Balance Sheet / Safety
B5. Earnings Quality
B6. Valuation completion
```

Each family follows:

```text
Contract
→ Derived
→ Signal
→ Redundancy
→ Representative selection
→ Anchored scoring
→ Tests
```

## Phase C — Full Evaluation Engine

```text
C1. Anchored Metric Scoring Engine
C2. Factor Engine
C3. Axis Engine
C4. Risk Gate Engine
C5. Band Registry
C6. Classification Engine
C7. Ranking Engine
C8. Dashboard Adapter
```

## Phase D — Production Calibration / Validation

```text
D1. Calibrate production transforms
D2. Calibrate factor budgets/caps
D3. Calibrate cross-factor caps
D4. Calibrate axis budgets
D5. Calibrate classification bands
D6. Calibrate material Soft Risk thresholds
D7. Freeze production registry versions
D8. Validate against expanded real-data snapshots
```

Do not use the 76-stock sandbox to pretend that production thresholds have statistical predictive validation.

---

# 37. Historical / Forward-return Validation — FUTURE

The current ~76-stock dataset is sufficient for:

- parser/evaluation debugging;
- distribution inspection;
- redundancy discovery;
- anomaly inspection;
- classification logic inspection;
- bias/coverage inspection.

It is not sufficient to prove predictive power or optimize thresholds statistically.

Forward-return validation is deferred until historical Screener snapshots exist:

```text
snapshot date
→ score/classification
→ forward 1M / 3M return
```

Use `available_as_of` to prevent look-ahead when this framework is introduced.

---

# 38. Required Review Artifacts

Create/update these artifacts as the model evolves:

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

These documents capture decisions and contracts; they must not duplicate implementation code.

---

# 39. Final Definition of Done

## Theory foundation

- [x] TradingView mapping contract established.
- [x] Percentage/ratio/quantity parsing semantics established.
- [x] Dashboard/Ranking/CRSM boundary established.
- [x] No automatic CRSM handoff; explicit user Analyze action only.
- [x] Overall Score removed as the central architecture.
- [x] Quality / Opportunity axis architecture established.
- [x] Typed DAG architecture established.
- [x] Data state / UNKNOWN concept established.
- [x] Coverage / Criticality established.
- [x] Provenance established.
- [x] Contribution lineage / impact budget established.
- [x] Structural/statistical/economic/contribution redundancy principle established.
- [x] Factor Matrix ownership established.
- [x] Contribution Budget semantics established.
- [x] Factor Formula semantics established.
- [x] Axis Mapping established.
- [x] Hard/Soft Risk semantics established.
- [x] Classification precedence established.
- [x] Ranking separation established.
- [x] Dashboard contract established.
- [x] Implementation module boundaries established.

## Open production calibration

- [ ] Production metric anchors/transforms.
- [ ] Production factor group weights/caps.
- [ ] Cross-factor influence caps.
- [ ] Production axis budgets.
- [ ] Production classification band boundaries.
- [ ] Material Soft Risk thresholds.
- [ ] Final production percentile/tie conventions.

## Immediate implementation

- [ ] Versioned sandbox registry mechanism.
- [ ] D1 Contract Validator.
- [ ] D2 Price Dislocation Evaluator.
- [ ] D3 Diagnostic / Decision Runner.
- [ ] Required scenario tests.
- [ ] Lineage/state/provenance inspection.

## Later

- [ ] Momentum / Volume family.
- [ ] Growth family.
- [ ] Cash Flow family.
- [ ] Balance Sheet / Safety family.
- [ ] Earnings Quality family.
- [ ] Full Factor/Axis/Risk/Classification/Ranking engine.
- [ ] Dashboard integration.
- [ ] Historical/forward-return validation.

**The architecture is now frozen enough to implement the sandbox vertical slice. Production scoring/classification policy remains registry-controlled until numeric calibration is explicitly versioned and approved.**
