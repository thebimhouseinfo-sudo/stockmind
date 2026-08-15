# Screener V2 — Scoring Theory

> **Status:** ARCHITECTURE + SEMANTIC THEORY CLOSED, NUMERIC PRODUCTION CALIBRATION OPEN
>
> This document is the high-level **theory source of truth** for Screener V2. A developer or AI that has never worked on Stock Mind should be able to read this file and understand how the Screener turns TradingView clipboard data into factors, axes, risk state, classification tables, and ranking.
>
> Detailed implementation sequencing remains in `SCREENER_V2_IMPLEMENTATION_PLAN.md`. Detailed family contracts may exist as companion files (for example `MOMENTUM_VOLUME_FAMILY_V1_THEORY_CONTRACT.md`). When a companion contract is more specific, it governs that family.

---

# 0. What the Screener is — and is not

Screener V2 is a **quantitative data/evaluation engine** built from a TradingView snapshot.

It is **not** an AI analyst and does not invent investment stories, catalysts, management narratives, macro explanations, project/legal claims, or qualitative facts that are not present in the source data.

The full boundary is:

```text
TradingView clipboard
        ↓
Parser / Ingestion
        ↓
Internal Dataset
        ↓
State + Provenance
        ↓
Derived Metrics
        ↓
Signals / Anomalies
        ↓
Coverage / Applicability
        ↓
Contribution DAG / Impact Budget
        ↓
Anchored Metric Scores
        ↓
Base Factors
        ↓
Quality Axis + Opportunity Axis
        ↓
Hard Risk / Soft Risk
        ↓
Classification
        ↓
Screener Result Set
      ┌───────────────┴───────────────┐
      ↓                               ↓
Dashboard                        Ranking Tab
      │
      ↓
User selects stock
      ↓
User explicitly clicks Analyze
      ↓
CRSM / Node 1
```

**There is no automatic handoff to CRSM.** The user is always the decision point before deep analysis.

---

# 1. Core design philosophy

Screener V2 deliberately avoids a single flat formula such as:

```text
Overall Score =
Quality + Growth + Momentum + Valuation + Safety - Risk
```

That design is rejected because it creates several structural problems:

- unrelated evidence becomes directly interchangeable;
- a high score in one dimension can hide a serious weakness in another;
- correlated metrics are easily counted multiple times;
- missing data often becomes an accidental penalty;
- Risk becomes a continuous subtraction even when some risks should act as a gate;
- classification changes when the current batch changes if percentile-based thresholds are used.

Instead, Screener V2 uses:

```text
QUALITY | GROWTH | MOMENTUM | VALUATION | SAFETY
                 ↓
        QUALITY AXIS
        OPPORTUNITY AXIS
                 ↓
          HARD / SOFT RISK
                 ↓
         CLASSIFICATION
```

Ranking is a **separate relative view** and does not drive classification.

---

# 2. TradingView raw data contract

The current TradingView clipboard record is interpreted as:

1. `Symbol` — contains ticker + company name and is split.
2. UI marker / metadata cell — normally ignored.
3. `Sector`.
4. `Industry`.
5. Analytical fields in the validated TradingView column order.

The source fields currently include:

```text
Symbol
Sector
Industry
Market Cap
Price
Change %
Performance 1W / 1M / 3M / 6M / 1Y / YTD
High 52W
Low 52W
Volume
Relative Volume
Average Volume 10D / 30D / 60D
ROE TTM
ROA TTM
Revenue FQ / FY / TTM
Revenue Growth Quarterly YoY
Revenue Growth Annual YoY
EPS Diluted TTM
EPS Diluted Growth TTM YoY
PEG TTM
Gross Margin TTM
Operating Margin TTM
Net Margin TTM
FCF TTM
FCF Growth TTM YoY
Debt/Equity FQ / FY
Current Ratio FQ / FY
Quick Ratio FQ / FY
P/E
PEG
P/B
P/S
EV/EBITDA
EV/Revenue
Dividend Yield TTM
```

FQ, FY and TTM values remain distinct. They are not silently merged.

---

# 3. Ingestion rules — restore source meaning, do not score

The ingestion layer only restores the meaning of TradingView's display format.

## 3.1 Percentages

Percentage fields remain in **percentage points**:

```text
-0.58%  → -0.58
+4.86%  → 4.86
8%      → 8
```

Never divide them by 100 during ingestion.

## 3.2 Ratios

True ratios remain ratios:

```text
P/E              29.82
PEG              0.06
Debt/Equity      0.65
Current Ratio    1.02
Relative Volume  0.46
```

Do not multiply these by 100.

## 3.3 Quantity decoding

Compact suffixes are only TradingView display compression. They are decoded into full numeric values for:

```text
Market Cap
Price
Volume
Average Volume
Revenue
FCF
```

Examples:

```text
148.69 T → 148,690,000,000,000
6.26 B   → 6,260,000,000
1.58 M   → 1,580,000
857.4 K  → 857,400
```

This is **not** a scoring transform.

## 3.4 Field-specific parsing

A single generic numeric parser is forbidden because the same text can mean different things by field.

```text
41.000 as Price → 41,000
41.000 as P/E   → 41.0
```

Missing data never becomes zero.

---

# 4. Evaluation architecture — typed DAG

The architecture is a **typed DAG**, not a mandatory straight pipeline:

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

A raw or derived observation may feed more than one downstream consumer, but reuse must be declared and bounded. A metric may feed a score, a signal, a coverage rule, or a gate without those effects becoming equivalent.

Locked principles:

- typed nodes and typed edges;
- tri-valued logic: `TRUE / FALSE / UNKNOWN`;
- impact budgets;
- explicit coverage and eligibility;
- structural/statistical/economic/contribution redundancy analysis;
- provenance and audit lineage;
- `UNKNOWN` is never silently converted to `FALSE`, zero, pass, low score, or last rank;
- raw values are never overwritten to make formulas convenient;
- a signal is not automatically a penalty;
- a trigger is not automatically a veto;
- policy belongs in registries, not hidden branches in code.

---

# 5. Data state contract

Data state is split into separate concepts.

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
RELVOL_RECONCILIATION_MISMATCH
```

## 5.3 Usage state

```text
ELIGIBLE
SUPPRESSED
INVALID_FOR_USAGE
UNAVAILABLE
```

A negative economic value can be valid data.

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

The engine must distinguish **bad economics** from **bad data**.

---

# 6. Provenance contract

Every evaluation must be traceable to a source snapshot.

Important metadata includes:

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

`available_as_of` and `reported_as_of` are intentionally separate so future historical validation can avoid look-ahead bias.

---

# 7. Raw, Derived, Signal

## Raw

Source meaning after display-format decoding. Raw values are preserved.

## Derived

Evaluation-only calculations, for example:

```text
FCF Yield
Drawdown_52W
Upside_to_52W_High
Position_52W_Range
VolumeTrend_10_30
VolumeTrend_30_60
Growth Acceleration
Margin Gap
FCF / Profit Divergence
price_state_1m_v1
```

## Signal / Anomaly

Machine-readable interpretations or warnings, for example:

```text
SEVERE_DRAWDOWN
EXTREME_GROWTH
EARNINGS_QUALITY_CONCERN
VALUE_TRAP_WARNING
ELEVATED_LEVERAGE
SEVERE_LIQUIDITY_STRESS
PRICE_ABOVE_STORED_52W_HIGH
INCONSISTENT_REFERENCE
RELVOL_RECONCILIATION_MISMATCH
```

A signal does not automatically change a score.

---

# 8. Derived Metric Contract

Every derived metric must be contract-defined before implementation:

```text
Name
Family
Formula
Input fields
Purpose
Output type
Direction
Used by Factor(s)
Coverage rule
Invalid condition
Low-base condition
Low-base behavior
Anomaly signal
Structural relationship
Graduation rule
metric_id
version
criticality
applicability_rule
source_concept_id
```

Derived outputs fall into three classes:

```text
SCORING_DERIVED
SIGNAL_DERIVED
CONTEXT_DERIVED
```

A calculation does not become a score merely because it can be computed.

For structurally related families, `Used by Factor(s)` remains unresolved until representative selection is complete.

---

# 9. Metric roles and criticality

Each field has a **Primary Role** and optional **Secondary Role**.

Possible roles:

```text
Factor Input
Derived Input
Anomaly Trigger
Context
Unused
```

Every field/metric also records:

```text
Counts toward Coverage: Y/N
Criticality: Critical-for-Factor / Optional
Used by Factor(s)
```

One metric may have several declared roles, but it may contribute only once to one factor. Secondary use does not create a second coverage count or a second full score contribution.

If a derived metric is used across multiple factors:

```text
CROSS_FACTOR_SHARED = true
```

Reuse is allowed, but must be lineage-aware and impact-bounded.

---

# 10. Coverage and applicability

Coverage is evidence metadata, not a penalty multiplier.

For raw fields:

> Only Primary Role = Factor Input counts toward factor coverage.

For derived metrics:

> Computability follows the highest-criticality required raw input.

If any Critical input is missing, the derived metric is unavailable. There is no automatic half-coverage.

Coverage objects should preserve:

```text
coverage_set_id
intended_metric_ids
applicable_metric_ids
available_metric_ids
critical_missing_metric_ids
coverage_formula_version
```

A factor or axis carries both:

```text
score
coverage
status
```

Do not do:

```text
score × coverage = adjusted_score
```

Missing optional evidence reduces certainty/coverage; it does not automatically produce bearish evidence.

Typical evaluation states are:

```text
SCOREABLE
PARTIALLY_SCOREABLE
UNSCOREABLE
```

Factor-level availability may also use:

```text
FULL
LIMITED
UNAVAILABLE
```

---

# 11. Redundancy and double-counting

Redundancy is evaluated at four levels:

1. **Structural redundancy** — formulas are mathematically dependent.
2. **Statistical redundancy** — observations are highly correlated.
3. **Economic redundancy** — different formulas describe the same economic concept.
4. **Contribution redundancy** — different paths produce the same downstream influence.

A correlated metric is not automatically deleted. Possible decisions are:

```text
representative
supplementary
context-only
anomaly-only
rejected-for-scoring
```

The reason must be recorded.

Examples:

- ROE and ROA share return-efficiency evidence.
- P/E and PEG share earnings-valuation evidence.
- P/S and EV/Revenue share revenue-valuation evidence.
- Drawdown and Upside-to-52W-High are monotonic transforms of the same P/High relationship.
- `VolumeTrend_10_60` is structurally determined by `VolumeTrend_10_30 × VolumeTrend_30_60`.

Official anchored scoring happens **after** redundancy analysis, not before.

---

# 12. Contribution DAG and Impact Budget

Every downstream effect must be traceable through a typed edge.

Contribution metadata may include:

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

Contribution types include:

```text
SCORE_DELTA
SIGNAL_TAG
GATE_TRIGGER
VETO
COVERAGE_EFFECT
```

A single economic observation cannot gain unlimited influence simply because it appears through several formulas.

Example:

```text
FCF
├── FCF Margin → Quality
├── FCF Growth → Growth
└── FCF Yield  → Valuation
```

The three consumers are allowed because they represent different interpretations, but they remain linked through the same economic lineage and cross-factor impact rules.

Similarly:

```text
NEGATIVE_FCF
FCF_YIELD_WEAK
FCF_PROFIT_DIVERGENCE
```

may be separate outputs while sharing the same underlying `source_concept_id` where appropriate.

Dependencies must remain acyclic.

---

# 13. Anchored metric scoring

The model does not use batch percentiles to create factor/classification scores.

Official scoring follows:

```text
Raw / Derived Metric
        ↓
Applicability / State
        ↓
Versioned Anchor
        ↓
Versioned Transform
        ↓
Anchored Metric Score 0–100
```

Transform families include concepts such as:

```text
HIGHER_SMOOTH
LOWER_SMOOTH
OPTIMAL_RANGE
```

Examples of semantic directions:

- ROE: higher-is-better with diminishing return.
- P/E: lower-is-better only when earnings make the multiple meaningful.
- P/B: lower-is-better as a valuation representation, but ROE remains separately owned by Quality.
- FCF Yield: higher-is-better; negative FCF yield is a valid negative observation, not missing.
- Current Ratio / Quick Ratio: optimal-range rather than indefinitely higher-is-better.

Anchors may be Industry/Sector aware where economically justified.

A score of 50 does **not** automatically mean market median, HOLD, or average company. The semantic band is defined separately by a versioned registry.

`UNKNOWN` or `NOT_MEANINGFUL` produces `score = null`, not 0.

---

# 14. Factor Matrix and ownership

The base factors are:

```text
QUALITY
GROWTH
MOMENTUM
VALUATION
SAFETY
```

Each metric has one canonical primary owner. Secondary consumers require declared incremental information and bounded impact.

Initial representative hypotheses are:

```text
RETURN_EFFICIENCY              → ROE representative, ROA supporting
MARGIN_ECONOMICS               → Operating Margin representative
EARNINGS_GROWTH                → Revenue Growth + EPS Growth shared
CASH_FLOW_ECONOMICS            → consumer-specific FCF representation
BALANCE_LIQUIDITY              → Current Ratio + Quick Ratio shared
LEVERAGE                       → Debt/Equity primary
PRICE_MOMENTUM                 → Trend + Persistence representation
MOMENTUM_TRANSITION            → Acceleration bounded/context
VOLUME_CONFIRMATION            → Price–Volume higher-order confirmation
EARNINGS_VALUATION             → P/E representative, PEG bounded support
ASSET_VALUATION                → P/B primary, ROE remains Quality-owned
REVENUE_VALUATION              → P/S + EV/Revenue shared
ENTERPRISE_OPERATING_VALUATION → EV/EBITDA primary
CASH_VALUATION                 → FCF Yield primary
DISTRIBUTION_CONTEXT           → Dividend Yield context
PRICE_DISLOCATION              → context/profile only in V1
```

Representative selection is versioned and may change after sandbox redundancy review.

Contribution classes are:

```text
FULL_PRIMARY_ONE_GROUP
SHARED_PRIMARY_CAPPED
CONTEXT_BOUNDED
DIAGNOSTIC_ONLY
GATE_ONLY
```

A group with more raw fields must not gain more influence simply because it contains more fields.

---

# 15. Factor Formula V1

Factor aggregation is **group-first**, not metric-count-first.

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
Factor Score
```

Generic formula:

```text
Factor Score =
Σ(Group Score × Eligible Group Budget)
/
Σ(Eligible Group Budget)
```

Rules:

- only eligible groups are in the denominator;
- missing optional evidence is not zero;
- `NOT_MEANINGFUL` is ineligible, not a bearish score;
- diagnostic metrics do not create independent contribution;
- supporting metrics cannot open a second full group budget;
- cross-factor reuse remains bounded by lineage;
- factor scores are batch-invariant;
- aggregation must be continuous except at genuine state boundaries.

Factor output must preserve at least:

```text
factor_score
factor_coverage
factor_status
lineage
```

## 15.1 Quality

```text
QUALITY
├── RETURN_EFFICIENCY
│   ├── ROE
│   └── ROA
├── MARGIN_ECONOMICS
│   ├── Operating Margin
│   ├── Gross Margin
│   └── Net Margin
└── CASH_FLOW_ECONOMICS
    └── FCF Margin
```

Diagnostics such as ROE/ROA spread, margin gap/compression and FCF-profit divergence do not automatically contribute.

## 15.2 Growth

```text
GROWTH
├── EARNINGS_GROWTH
│   ├── Revenue Growth
│   └── EPS Growth
└── CASH_FLOW_ECONOMICS
    └── FCF Growth
```

Low-base growth is flagged and bounded rather than silently accepted as huge positive evidence.

## 15.3 Momentum

```text
MOMENTUM
├── PRICE_MOMENTUM          ← primary scoring base
├── MOMENTUM_TRANSITION     ← bounded/context
└── VOLUME_CONFIRMATION     ← context-bounded confirmation
```

Reversal remains diagnostic unless a later contract promotes it.

The old flat pattern below is rejected:

```text
Trend 25
Persistence 25
Acceleration 25
Volume 25
```

Volume is important, but it must be used as market-participation evidence rather than a fourth co-equal independent score block. The complete current theory is in Section 16.

## 15.4 Valuation

```text
VALUATION
├── EARNINGS_VALUATION
├── ASSET_VALUATION
├── REVENUE_VALUATION
├── ENTERPRISE_OPERATING_VALUATION
└── CASH_VALUATION
```

If P/E or EV/EBITDA is not meaningful, the relevant subgroup becomes ineligible. It does not become a zero score.

## 15.5 Safety

```text
SAFETY
├── BALANCE_LIQUIDITY
└── LEVERAGE
```

Current/Quick Ratio share a liquidity budget. D/E is the leverage input. Extreme leverage may later become a Risk Gate signal, but must not be double-penalized in Safety and Risk.

---

# 16. Momentum / Volume Family V1 — market participation model

The original volume theory used only `relative_volume` as a simple confirmation signal. That was incomplete because the dataset already contains five volume-related fields:

```text
Volume
Relative Volume
Avg Volume 10D
Avg Volume 30D
Avg Volume 60D
```

Volume is therefore modeled as **market participation**, not merely one scalar confirmation.

The key economic distinction is:

```text
Price  → direction
Volume → participation intensity / participation regime
Price × Volume → market-behavior interpretation
```

Also:

```text
Liquidity ≠ Participation
```

A stock can have low absolute liquidity but rapidly expanding participation, or high liquidity but contracting participation.

## 16.1 Verified Relative Volume semantics

TradingView documentation defines:

```text
Relative Volume = current_volume / SMA(volume, 10)[1]
```

That means current volume relative to the prior 10-period average excluding the current open bar.

The exact snapshot convention of the separate Avg Volume 10D/30D/60D screener columns is not assumed to be identical until reconciled against actual data.

## 16.2 Volume Family architecture

```text
VOLUME FAMILY
│
├── A. CURRENT_ACTIVITY
│   └── Relative Volume
│       + Volume / AvgVol10D used only for reconciliation lineage
│
├── B. PARTICIPATION_REGIME
│   ├── VolumeTrend_10_30 = AvgVol10D / AvgVol30D
│   └── VolumeTrend_30_60 = AvgVol30D / AvgVol60D
│
├── C. ABSOLUTE_LIQUIDITY_CONTEXT
│   └── Volume / AvgVol30D / AvgVol60D
│       → CONTEXT_ONLY in V1
│
└── D. PRICE_VOLUME_INTERACTION
    ├── price_state_1m_v1
    ├── Participation_Regime
    └── RelVol activity qualifier
        ↓
    archetype + price_direction + activity_state
```

`PriceVolume_Interaction` is a higher-order interpretation and does **not** open a new full contribution budget.

## 16.3 Structural volume trend metrics

```text
VolumeTrend_10_30 = AvgVol10D / AvgVol30D
VolumeTrend_30_60 = AvgVol30D / AvgVol60D
```

A third ratio:

```text
VolumeTrend_10_60 = AvgVol10D / AvgVol60D
```

is structurally redundant because:

```text
VolumeTrend_10_60 = VolumeTrend_10_30 × VolumeTrend_30_60
```

Therefore `10_60` may be exposed only as diagnostic/summary, never as independent evidence.

## 16.4 Participation Regime

Canonical source concept:

```text
source_concept_id = VOLUME_PARTICIPATION
```

Semantic states:

```text
EXPANDING
CONTRACTING
STABLE
MIXED
UNKNOWN
```

Conceptual classification:

```text
R10_30 above neutral + R30_60 above neutral → EXPANDING
R10_30 below neutral + R30_60 below neutral → CONTRACTING
both near neutral                          → STABLE
one above / one below                      → MIXED
insufficient required input                → UNKNOWN
```

The neutral band is a versioned SANDBOX parameter until calibrated.

Any future Risk consumer must consume this canonical derived node and reuse `source_concept_id = VOLUME_PARTICIPATION`. It must **not** bypass lineage by recomputing AvgVol10D/30D/60D directly from raw data.

## 16.5 RelVol Current Activity and reconciliation

`relative_volume` is the representative for current activity, subject to diagnostic reconciliation:

```text
RelVol_Reconstructed = Volume / AvgVol10D
RelVol_Reconciliation = compare(TradingView_RelVol, RelVol_Reconstructed)
```

States:

```text
MATCHED
TOLERANCE_BREACH
UNKNOWN
```

`TOLERANCE_BREACH` means:

```text
quality_flag = RELVOL_RECONCILIATION_MISMATCH
RelVol usage_state = CONTEXT_ONLY / SUPPRESSED_FOR_CONFIRMATION
raw Relative Volume remains unchanged
```

The numeric tolerance is a registry parameter derived from sandbox error distribution; it must never be hard-coded in the module.

## 16.6 price_state_1m_v1

`perf_1m` is reused as the price-direction input for Price–Volume Interaction because no available price performance field exactly aligns with 10D/30D/60D volume windows.

```text
price_state_1m_v1:
POSITIVE
NEGATIVE
NEUTRAL_FLAT
UNKNOWN
```

Conceptual rule:

```text
POSITIVE     perf_1m >= +neutral_band
NEGATIVE     perf_1m <= -neutral_band
NEUTRAL_FLAT inside the neutral band
UNKNOWN      perf_1m unavailable / invalid for usage
```

The neutral band is SANDBOX-only and must be calibrated from the actual `perf_1m` distribution. Probe values such as 2, 5 and 8 percentage points may be compared, but none is a production default.

Important limitation:

```text
TIMEFRAME_MISMATCH_WITH_VOLUME_WINDOWS
```

`perf_1m` is roughly a monthly price window, not a mathematically exact 30-trading-day price series. This approximation is declared, not hidden.

Lineage:

```text
perf_1m ──────────────→ PRICE_MOMENTUM
         └────────────→ price_state_1m_v1
                         ↓
                  PriceVolume_Interaction
                         ↓
                   CONTEXT_BOUNDED
```

This reuse creates no second Momentum coverage or evidence budget.

## 16.7 Price–Volume Interaction

Inputs:

```text
price_state_1m_v1
Participation_Regime
Relative Volume activity qualifier
```

Outputs:

```text
archetype
price_direction = POSITIVE / NEGATIVE / NONE / UNKNOWN
activity_state  = ELEVATED / NORMAL / DEPRESSED / UNKNOWN
```

Archetype table:

| Price \ Participation | EXPANDING | CONTRACTING | STABLE | MIXED | UNKNOWN |
|---|---|---|---|---|---|
| **POSITIVE** | `CONFIRMED_PARTICIPATION` | `PARTICIPATION_DIVERGENCE` | `NO_CONFIRMATION` | `UNRESOLVED_PARTICIPATION` | `INSUFFICIENT_EVIDENCE` |
| **NEGATIVE** | `CONFIRMED_PARTICIPATION` | `PARTICIPATION_DIVERGENCE` | `NO_CONFIRMATION` | `UNRESOLVED_PARTICIPATION` | `INSUFFICIENT_EVIDENCE` |
| **NEUTRAL_FLAT** | `NO_CONFIRMATION` | `NO_CONFIRMATION` | `NO_CONFIRMATION` | `UNRESOLVED_PARTICIPATION` | `INSUFFICIENT_EVIDENCE` |
| **UNKNOWN** | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` | `INSUFFICIENT_EVIDENCE` |

`activity_state` is a qualifier only; it does not create a third archetype dimension.

Example:

```text
price_state = POSITIVE
participation = CONTRACTING
activity_state = ELEVATED

→ archetype = PARTICIPATION_DIVERGENCE
→ price_direction = POSITIVE
```

No extra enum such as `CURRENT_SPIKE_AGAINST_CONTRACTING_REGIME` is needed because the three canonical fields already preserve the evidence.

## 16.8 Absolute liquidity context

Absolute raw volume is **Context Only** in V1.

Do not create universal `THIN/NORMAL/VERY_THIN` states from one absolute threshold because raw share volume is strongly size-biased.

The TradingView universe filter may impose a user-selected liquidity floor, but that is a **universe policy**, not an economic score.

A candidate proxy such as:

```text
AvgVol60D × current Price / MarketCap
```

is explicitly deferred because using current price to approximate historical traded value creates systematic error correlated with recent momentum. No turnover proxy is part of V1 without suitable historical price/VWAP data.

## 16.9 Volume Family open clarifications

Two semantic details remain open before the Volume Family registry/code is fully closed:

### A. Missing one participation window

Proposed policy:

```text
Both R10_30 and R30_60 available → classify regime
Only one available              → Participation_Regime = UNKNOWN
Neither available               → Participation_Regime = UNKNOWN
```

Rationale: a single two-window ratio is not enough to infer the full three-window participation regime.

### B. RelVol reconciliation suppression propagation

Proposed policy:

```text
TOLERANCE_BREACH
→ activity_state = UNKNOWN
→ keep RELVOL_RECONCILIATION_MISMATCH quality flag visible
```

This prevents an unreliable RelVol from silently continuing to influence Price–Volume Interaction.

Until these two proposals are formally accepted, they remain explicit OPEN items rather than hidden implementation assumptions.

---

# 17. Price Dislocation Family

Price Dislocation is **not** a factor that automatically means cheap, turnaround, or High Reward. It is a profile family and the first vertical slice used to validate the engine.

## 17.1 Drawdown_52W

```text
Drawdown_52W = Price / High_52W - 1
```

## 17.2 Upside_to_52W_High

```text
Upside_to_52W_High = High_52W / Price - 1
```

Drawdown and Upside are nonlinear monotonic transformations of the same `Price / High` relationship, so they are structurally redundant as independent evidence.

## 17.3 Position_52W_Range

```text
Position_52W_Range =
(Price - Low_52W) / (High_52W - Low_52W)
```

This metric adds Low_52W and may contain partially independent information.

If the high-low range is nearly zero, the metric receives `LOW_BASE_UNRELIABLE` rather than pretending the result is precise.

## 17.4 Inconsistent reference data

If:

```text
Price > High_52W
```

never clamp Price to High.

Preserve raw values and emit:

```text
PRICE_ABOVE_STORED_52W_HIGH
INCONSISTENT_REFERENCE
```

The cause may be stale source data, adjustment mismatch, snapshot mismatch, parser error, or source semantics. The formula layer does not silently repair it.

## 17.5 Output boundary

Price Dislocation returns a **Dislocation Profile**, not an investment thesis.

A -60% drawdown does not automatically mean:

```text
HIGH_REWARD
CHEAP
TURNAROUND
VALUE_TRAP
```

Those interpretations require other evidence.

---

# 18. Axis Mapping

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

Conceptual formula:

```text
Axis Score =
Σ(Factor Score × Eligible Factor Budget)
/
Σ(Eligible Factor Budget)
```

Each Axis must expose:

```text
score
coverage
status
profile
weak-member metadata
lineage
```

Coverage is not multiplied into the score.

## 18.1 Quality Axis meaning

Quality Axis asks:

> Is the company's current business/fundamental foundation both economically strong and financially safe enough to trust?

Safety is not subtracted from Quality. It is a separate primary constituent of the same axis.

Example profile states may include:

```text
QUALITY_STRONG
QUALITY_BALANCED
PROFITABILITY_LED
SAFETY_LED
QUALITY_WITH_SAFETY_CONCERN
WEAK_FOUNDATION
INCOMPLETE
```

## 18.2 Opportunity Axis meaning

Opportunity Axis combines three independent opportunity lenses:

```text
Growth    → business growth evidence
Momentum  → market behavior / price confirmation evidence
Valuation → price relative to fundamentals
```

Profiles may include:

```text
BALANCED_OPPORTUNITY
GROWTH_LED
MOMENTUM_LED
VALUATION_LED
GROWTH_MOMENTUM_LED
GROWTH_VALUATION_LED
MOMENTUM_VALUATION_LED
WEAK_OPPORTUNITY
INCOMPLETE
```

A blended axis must not hide a materially weak constituent. The profile preserves that asymmetry.

Risk is never subtracted from Axis scores.

---

# 19. Risk Model

Risk is split into:

```text
HARD_RISK
SOFT_RISK
RISK_CONTEXT
```

There is **no single Risk Score** that gets subtracted from Quality or Opportunity.

## 19.1 Hard Risk

Hard Risk represents catastrophic or combined distress evidence.

Candidate archetypes include:

```text
EXTREME_LEVERAGE
+ SEVERE_LIQUIDITY_STRESS

PERSISTENT_NEGATIVE_FCF
+ EXTREME_LEVERAGE

SEVERE_LIQUIDITY_STRESS
+ PERSISTENT_NEGATIVE_FCF
+ WEAK_PROFITABILITY
```

One warning usually does not trigger Hard Risk.

Examples that are **not automatically Hard Risk**:

```text
one negative FCF period
one extreme D/E observation
one deep drawdown
one extreme EPS growth anomaly
```

## 19.2 Soft Risk

Examples:

```text
ELEVATED_LEVERAGE
WEAK_LIQUIDITY
NEGATIVE_FCF
EARNINGS_UNCERTAINTY
SEVERE_DRAWDOWN
```

Soft Risk is a profile/context layer. It does not automatically block Core.

Future use of volume participation as Soft Risk must reuse the canonical `VOLUME_PARTICIPATION` lineage, not create a second raw-derived path.

## 19.3 Risk Gate

Gate output:

```text
PASS
FAIL
UNKNOWN
```

Gate evaluation uses tri-valued logic.

Example:

```text
EXTREME_LEVERAGE = TRUE
LIQUIDITY_STRESS = UNKNOWN

TRUE AND UNKNOWN = UNKNOWN
```

Never silently interpret UNKNOWN as FALSE/PASS.

Gate Object retains:

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

A Hard Risk FAIL does not alter Quality/Opportunity Axis scores. It only changes classification eligibility.

Hard Risk is also **not synonymous with Value Trap**. Value Trap is a classification requiring structured negative/trap evidence.

---

# 20. Classification Decision Tree

Classification precedence is fixed:

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

Primary outcomes are:

```text
CORE
QUALITY_UNDERPERFORMER
HIGH_REWARD_HIGH_RISK
AVOID_VALUE_TRAP
WATCH_NEUTRAL
```

The first four map to primary Dashboard tables. `WATCH_NEUTRAL` is a first-class unresolved/non-decisive state, not a fifth investment table.

## 20.1 Core

Semantic requirement:

```text
Quality Axis = HIGH
Opportunity Axis = HIGH
Hard Risk = PASS
Soft Risk not materially incompatible with Core
```

A strong blended score cannot hide `QUALITY_WITH_SAFETY_CONCERN` or an incomplete Opportunity profile.

## 20.2 Quality Underperformer

```text
Quality Axis = HIGH
Opportunity Axis = LOW
Hard Risk = PASS
```

`MEDIUM` Opportunity is WATCH in V1 unless a future classification registry explicitly says otherwise.

## 20.3 High Reward / High Risk

Requires:

```text
strong foundation/opportunity
Hard Risk = PASS
material Soft Risk = TRUE
```

A deep drawdown alone is not enough.

## 20.4 Avoid / Value Trap

Requires structured negative/distress/trap evidence.

Never use these shortcuts:

```text
low valuation → Value Trap
deep drawdown → Value Trap
Hard Risk FAIL → Value Trap
```

Examples of valid semantic patterns include:

```text
Hard Risk FAIL
AND (Quality LOW OR Opportunity LOW)

or

Hard Risk PASS
AND Quality LOW
AND Opportunity LOW
AND explicit trap/distress evidence
```

If Quality and Opportunity are weak but trap evidence is insufficient, `WATCH_NEUTRAL` is preferred over inventing a stronger label.

## 20.5 Watch / Neutral

Used for:

```text
incomplete evidence
Gate UNKNOWN
conflicting axes
MEDIUM bands
unresolved risk profile
insufficient coverage
no decisive classification condition
```

The engine is not required to force every ticker into an investment bucket.

---

# 21. Classification bands

Classification uses anchored, batch-invariant bands:

```text
LOW
MEDIUM
HIGH
INSUFFICIENT_DATA
```

Conceptual registry:

```text
LOW    = [0, L)
MEDIUM = [L, H)
HIGH   = [H, 100]
```

`L` and `H` are calibration parameters, not constants embedded in the Classification Engine.

Production boundaries remain open. Sandbox values may be used only if explicitly versioned with:

```text
calibration_status = SANDBOX
```

Batch changes must never change the band of an unchanged anchored score.

---

# 22. Ranking — deliberately separate from classification

Classification answers:

> What state does this ticker's evidence support?

Ranking answers:

> Where does this ticker stand relative to the currently displayed universe?

Therefore:

```text
Classification → anchored / batch-invariant
Ranking        → batch percentile / batch-dependent
```

Possible ranking views:

```text
Quality Ranking
Opportunity Ranking
Growth Ranking
Momentum Ranking
Valuation Ranking
Safety Ranking
```

A pre-existing composite ranking may remain only if clearly labeled `COMPOSITE_RANKING`; do not create a new central Investment Score.

Each ranking row preserves:

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

- `UNKNOWN` scores are `UNRANKABLE`, not last place;
- rank denominator excludes unrankable records;
- equal scores share rank according to versioned tie policy;
- symbol order is never an artificial tie-breaker;
- ranking percentile may change as the displayed universe changes;
- factor/axis scores and classification must not change when the batch changes.

---

# 23. Dashboard contract

Dashboard is a **view/navigation layer**, not another scoring engine.

Primary tables:

```text
CORE
QUALITY_UNDERPERFORMER
HIGH_REWARD_HIGH_RISK
AVOID_VALUE_TRAP
```

`WATCH_NEUTRAL` may appear as a separate non-investment state/view.

Every row should expose or allow inspection of:

```text
Security identifier
Classification
Quality Axis score / band / coverage / status / profile
Opportunity Axis score / band / coverage / status / profile
Hard Risk status
Gate failed reason
Soft Risk profile
Factor highlights
Registry versions
Lineage reference
```

The UI must distinguish:

```text
No matches
GATE_UNKNOWN
UNSCOREABLE
UNRANKABLE
PARTIAL
STALE / MISMATCHED PROVENANCE
```

The UI must not:

- recompute scores;
- invent thresholds;
- override Risk Gate results;
- infer classification from rank;
- automatically send a ticker to CRSM.

User flow:

```text
Dashboard
   ↓
User selects ticker
   ↓
Evidence detail
   ↓
User clicks Analyze
   ↓
CRSM / Node 1
```

---

# 24. CRSM / Node 1 boundary

The Screener stops at quantitative evidence and structured classification.

CRSM / Node 1 may receive:

```text
raw evidence
factor scores
axis scores
coverage
classification
risk state
signals
profiles
lineage
```

Node 1 is responsible for deeper research and verification such as:

```text
catalysts
projects
capital actions
management actions
macro/industry context
legal/regulatory context
source verification
```

Screener must not pre-invent these narratives.

There is no automatic candidate queue or automatic handoff.

---

# 25. Registry architecture

Policy lives in versioned registries rather than hard-coded branches.

Required registries include:

| Registry | Controls |
|---|---|
| Metric Role Registry | primary/secondary/context/diagnostic/gate roles |
| Derived Metric Registry | formula, parents, state propagation, source concept |
| Applicability Registry | applicable / not meaningful / unknown behavior |
| Transform Registry | anchors, curves, bounds, continuity |
| Contribution Budget Registry | impact groups, representatives, supporting caps |
| Factor Formula Registry | group budgets, aggregation modes, criticality |
| Axis Mapping Registry | factor membership, axis budgets, profile rules |
| Risk Signal / Rule Registry | soft/hard signals, tri-valued combinations |
| Band Registry | LOW/MEDIUM/HIGH boundaries |
| Classification Registry | precedence and table eligibility |
| Ranking Registry | rankability, percentile, tie policy |

Every registry exposes at least:

```text
registry_id
registry_version
calibration_status
scope
effective_date
```

---

# 26. Sandbox vs Production

The architecture/semantics can be implemented before production calibration is finished, but temporary values must be explicit.

## Sandbox

Allowed for validation if:

```text
calibration_status = SANDBOX
values are versioned
values live in registries
values are replaceable without changing engine architecture
values are not presented as production investment thresholds
```

## Production

Production still requires calibration of:

```text
metric anchors / transforms
factor group weights / caps
cross-factor caps
axis budgets
classification band boundaries
material Soft Risk thresholds
ranking percentile / tie conventions
Volume Family neutral bands
RelVol reconciliation tolerance
```

The 76-stock dataset is a **validation sandbox**, not a statistically sufficient training set for claiming predictive power or optimal weights.

Future validation should use historical snapshots and forward returns. That is a future validation framework, not something the current static snapshot can prove.

---

# 27. Common output object contract

Major objects preserve:

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

Gate objects preserve:

```text
gate_status
tri_state_conditions
triggered_rules
unresolved_conditions
failed_reason
```

Classification objects preserve:

```text
classification
classification_version
quality_axis
opportunity_axis
risk_state
band_versions
factor_highlights
```

Ranking records preserve:

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

# 28. Required invariants / acceptance tests

These are architecture invariants, not optional implementation preferences.

## Data / state

- Missing never becomes zero.
- `UNKNOWN` never silently becomes `FALSE`, PASS, LOW or last rank.
- Negative economic values are not automatically invalid observations.
- Raw values are not clamped to make derived formulas look valid.

## Scoring

- Higher/Lower/Optimal transforms preserve intended direction.
- Small metric changes should not cause large discontinuous factor jumps except at real state boundaries.
- A group with more metrics cannot gain more influence simply because it has more fields.
- Supporting/diagnostic evidence cannot open a hidden second full contribution.
- Coverage is not multiplied into the score.

## Batch invariance

For unchanged raw input:

```text
Quality score
Growth score
Momentum score
Valuation score
Safety score
Quality Axis
Opportunity Axis
Classification
```

must remain unchanged when the displayed batch changes.

Only ranking percentile/position may change.

## Risk

- One warning is not automatically Hard Risk.
- Hard Risk FAIL does not rewrite Axis scores.
- Soft Risk does not automatically force Avoid.
- Deep drawdown alone is not High Reward or Value Trap.

## Volume

- `VolumeTrend_10_60` cannot contribute independently from 10/30 and 30/60.
- Participation Regime has one canonical `VOLUME_PARTICIPATION` lineage.
- Future modules must not bypass that lineage by recomputing raw AvgVol windows.
- RelVol must be reconcilable and suppressible when mismatched.
- Absolute liquidity does not become an uncalibrated size-biased score.
- PriceVolume Interaction is `CONTEXT_BOUNDED`, not a full standalone Momentum component.

## Dashboard / CRSM

- Dashboard does not calculate scores/classification.
- Ranking does not classify.
- No automatic CRSM handoff.

---

# 29. Current open items

Architecture is not being reopened. The remaining work is primarily calibration plus two explicit Volume Family semantic clarifications.

## 29.1 Production numeric calibration

Still open:

```text
anchors / transforms
factor budgets and caps
cross-factor influence caps
axis budgets
classification L / H
Soft Risk materiality
ranking tie / percentile policy
Volume neutral bands
RelVol reconciliation tolerance
```

## 29.2 Volume Family semantic clarifications

Pending explicit confirmation:

1. If only one of `VolumeTrend_10_30` or `VolumeTrend_30_60` is available, should `Participation_Regime` be `UNKNOWN`? Current proposed answer: **yes**.
2. If `RelVol_Reconciliation = TOLERANCE_BREACH`, should `activity_state` propagate to `UNKNOWN`? Current proposed answer: **yes**, while retaining the mismatch quality flag.

These are documented OPEN items so implementation must not silently choose an answer.

---

# 30. Implementation relationship

The implementation modules map directly to the theory:

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
              ├────────────→ Risk Gate Engine
              ↓                     ↓
        Band Registry        Classification Engine
              └────────────→ Ranking Engine
                                    ↓
                            Dashboard Adapter
                                    ↓
                            User-triggered CRSM / Node 1
```

No module may invent an unstated fallback rule.

Price Dislocation remains the first vertical slice for testing the engine architecture. Momentum/Volume is a major next family because the expanded theory now uses all provided volume windows as structured market-participation evidence.

---

# 31. One-paragraph mental model

If a new developer remembers only one thing, remember this:

> Screener V2 preserves TradingView raw meaning, derives only registered metrics, turns them into signals or anchored scores according to explicit applicability rules, prevents duplicated economic evidence through contribution lineage and impact budgets, builds five independent base factors, combines those into Quality and Opportunity axes, evaluates Hard/Soft Risk separately rather than subtracting a Risk Score, classifies each ticker into one of four primary Dashboard tables or WATCH_NEUTRAL, and computes batch-relative Ranking separately. Volume is not merely a scalar confirmation: it models current activity and multi-window participation regime, then combines that evidence with price direction through a context-bounded Price–Volume Interaction. The Dashboard only presents results; the user explicitly chooses whether to send a ticker to CRSM/Node 1 for deeper research.
