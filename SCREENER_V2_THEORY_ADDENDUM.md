# Screener V2 — Theory Addendum

> **Status:** SEMANTIC ADDENDUM CLOSED; PRODUCTION NUMERIC CALIBRATION OPEN
>
> This addendum records the implementation-relevant details from the consolidated Screener V2 theory review that are more explicit than the high-level `SCREEN_SCORING_THEORY.md`. It does **not** replace the canonical theory. If this file conflicts with a more specific family contract, the family contract governs that family.

---

# 1. Factor Formula — numeric semantics

Three numeric layers must remain separate:

1. **Metric transform** — raw/derived observation → anchored metric score.
2. **Impact cap** — maximum influence of an impact group or supporting metric.
3. **Factor weight/budget** — relative importance of eligible groups inside a factor.

Do not collapse these into one weight.

## 1.1 Group contribution

```text
Group Score =
Σ(metric_score × metric_share)
/
Σ(metric_share of eligible metrics)
```

Only eligible metrics enter the denominator. Missing optional evidence is not zero.

Example:

```text
ROE score = 80, share = 0.6
ROA score = 70, share = 0.4
→ RETURN_EFFICIENCY = 76

ROA missing
→ RETURN_EFFICIENCY = 80
→ coverage = PARTIAL
```

## 1.2 Representative vs supporting

`SHARED_PRIMARY_CAPPED` does not imply equal weighting.

Two allowed aggregation modes are:

```text
SHARED_WEIGHTED
REPRESENTATIVE_PLUS_CONFIRMATION
```

In the second mode, the representative supplies base evidence and supporting metrics may only create a bounded incremental adjustment.

The final mode is registry-controlled per impact group and may be selected after sandbox redundancy review.

## 1.3 Group cap and missing groups

Group caps prevent a family with many metrics from gaining excessive influence merely because it has more fields.

Illustrative structure only — **not production weights**:

```text
QUALITY budget = 100
RETURN_EFFICIENCY cap = 40
MARGIN_ECONOMICS cap = 40
CASH_FLOW_ECONOMICS cap = 20
```

If the optional FCF group is unavailable, do not compute:

```text
80×40% + 70×40% + 0×20%
```

Instead normalize across eligible group budgets:

```text
available budget = 40 + 40 = 80
Quality = (80×40 + 70×40) / 80
```

Missing optional evidence reduces coverage, not the economic score.

## 1.4 Coverage status

Sandbox status probes may use:

```text
coverage >= 80%          → SCOREABLE
50% <= coverage < 80%    → PARTIALLY_SCOREABLE
coverage < 50%           → UNSCOREABLE
```

These are **sandbox policy values**, not production defaults.

Criticality overrides percentage coverage. A factor can remain `UNSCOREABLE` despite high numeric coverage if a Critical-for-Factor input is missing.

The invariant remains:

```text
factor_score × factor_coverage
```

is forbidden as an adjusted score.

## 1.5 Cross-factor influence cap

Shared economic lineage must be auditable across factors.

Example:

```text
FCF
├── FCF Margin → QUALITY
├── FCF Growth → GROWTH
└── FCF Yield  → VALUATION
```

Every consuming edge should preserve:

```text
source_concept_id
consumer_factor
consumer_role
impact_cap
```

A future cross-factor cap is registry-controlled. It must not be hidden in factor code.

---

# 2. Axis Mapping — stronger contract

## 2.1 Criticality

V1 semantic roles:

```text
QUALITY AXIS
├── QUALITY → PRIMARY
└── SAFETY  → PRIMARY

OPPORTUNITY AXIS
├── GROWTH    → PRIMARY
├── MOMENTUM  → PRIMARY
└── VALUATION → PRIMARY
```

Numeric budgets remain open.

## 2.2 Weak-member preservation

A blended axis score must not erase material asymmetry.

Example:

```text
Growth = 95
Momentum = 90
Valuation = 20
```

The output may have a valid blended score, but must preserve weak-member metadata and an explanatory profile such as `GROWTH_MOMENTUM_LED` rather than presenting the axis as uniformly strong.

Similarly:

```text
Quality = 88
Safety = 42
```

must preserve a profile such as `QUALITY_WITH_SAFETY_CONCERN`.

## 2.3 Axis acceptance tests

Required tests include:

1. Same factor inputs across different batches → same axis score.
2. One missing primary factor → partial/unknown state according to registry, never missing-as-zero.
3. Extreme factor imbalance → weak constituent remains visible in profile/metadata.
4. Hard Risk TRUE → axis scores remain unchanged; Gate changes classification eligibility only.
5. Hard Risk UNKNOWN → never silently becomes PASS.

---

# 3. Risk Gate — explicit signal and archetype semantics

Risk is evaluated as:

```text
Evidence
→ Risk Signal
→ Risk Condition
→ Risk Combination
→ Hard Risk Gate
```

A single raw threshold is not itself the complete Hard Risk model.

## 3.1 Signal families

### Leverage

```text
ELEVATED_LEVERAGE → Soft Risk
EXTREME_LEVERAGE  → candidate Hard Risk condition, insufficient alone
```

### Liquidity

```text
WEAK_LIQUIDITY
SEVERE_LIQUIDITY_STRESS
```

Current Ratio and Quick Ratio should be interpreted as a shared liquidity family; contradictory evidence must remain visible rather than selecting one ratio arbitrarily.

### Cash-flow stress

```text
NEGATIVE_FCF
PERSISTENT_NEGATIVE_FCF
```

One negative observation is not automatically persistent stress.

### Earnings-quality/anomaly context

```text
NET_MARGIN_OPERATING_MARGIN_GAP
FCF_PROFIT_DIVERGENCE
EXTREME_EPS_GROWTH
LOW_BASE_UNRELIABLE
```

`EXTREME_EPS_GROWTH` is an anomaly first, not an automatic risk penalty.

### Price context

```text
SEVERE_DRAWDOWN
PRICE_NEAR_52W_LOW
```

Price dislocation alone is not Hard Risk.

## 3.2 Hard Risk archetypes V1

Candidate semantic combinations:

```text
A. FINANCIAL_DISTRESS
   EXTREME_LEVERAGE
   + SEVERE_LIQUIDITY_STRESS

B. PERSISTENT_CASH_STRESS
   PERSISTENT_NEGATIVE_FCF
   + EXTREME_LEVERAGE

C. MULTI_DIMENSIONAL_DISTRESS
   SEVERE_LIQUIDITY_STRESS
   + PERSISTENT_NEGATIVE_FCF
   + WEAK_PROFITABILITY
```

A single `EXTREME_LEVERAGE` condition remains Soft/High Risk unless a versioned rule explicitly says otherwise.

`WEAK_PROFITABILITY` should be consumed from the factor/axis evaluation state rather than recreated as an unrelated raw-market threshold inside Risk Engine.

## 3.3 Gate output

```text
{
  status: PASS | FAIL | UNKNOWN,
  hard_risk: true | false | unknown,
  triggered_rules: [...],
  supporting_signals: [...],
  unresolved_conditions: [...],
  failed_reason: ...,
  coverage: ...,
  lineage: [...]
}
```

`failed_reason` should be auditable, for example:

```text
HARD_FINANCIAL_DISTRESS
PERSISTENT_CASH_STRESS
```

not merely `Risk = High`.

## 3.4 Risk acceptance tests

Required scenarios:

1. Extreme D/E alone → Soft Risk TRUE; Hard Risk normally FALSE; Gate PASS.
2. Extreme leverage + severe liquidity stress → Hard Risk TRUE; Gate FAIL.
3. Extreme leverage TRUE + liquidity UNKNOWN → Gate UNKNOWN, not PASS.
4. Deep drawdown with strong Quality/Safety → no Hard Risk without distress evidence.
5. One-period negative FCF → not `PERSISTENT_NEGATIVE_FCF`.
6. Persistent FCF stress + extreme leverage → Hard Risk TRUE.

---

# 4. Classification — explicit decision semantics

Classification consumes Axis Objects, Risk Gate, Soft Risk Profile, Band Objects and coverage. It must not bypass lineage and rebuild rules from arbitrary raw metrics.

## 4.1 Core

```text
Quality Axis = HIGH
Opportunity Axis = HIGH
Hard Risk = PASS
Soft Risk = LOW / NOT MATERIAL
Quality profile != QUALITY_WITH_SAFETY_CONCERN
Opportunity profile != INCOMPLETE
```

## 4.2 Quality Underperformer

```text
Quality Axis = HIGH
Opportunity Axis = LOW
Hard Risk = PASS
```

`Opportunity = MEDIUM` remains `WATCH_NEUTRAL` in V1 unless a later registry explicitly expands eligibility.

## 4.3 High Reward / High Risk

```text
Quality Axis = HIGH
Opportunity Axis = HIGH
Hard Risk = PASS
Soft Risk = MATERIAL
```

`MATERIAL` must be defined in a versioned Risk Profile Registry. A warning is not automatically material.

## 4.4 Avoid / Value Trap

Valid semantic patterns include:

```text
Case A:
Hard Risk = FAIL
AND (Quality Axis = LOW OR Opportunity Axis = LOW)

Case B:
Hard Risk = PASS
AND Quality Axis = LOW
AND Opportunity Axis = LOW
AND explicit trap/distress evidence = TRUE
```

Forbidden shortcuts remain:

```text
low valuation → Value Trap
deep drawdown → Value Trap
Hard Risk FAIL → Value Trap automatically
```

If both axes are weak but explicit trap/distress evidence is insufficient, prefer `WATCH_NEUTRAL`.

## 4.5 Classification object

The output should retain at least:

```text
label
classification_state
quality_axis
opportunity_axis
quality_profile
opportunity_profile
risk_gate
soft_risk_profile
coverage
triggered_conditions
blocked_conditions
gate_failed_reason
lineage
```

---

# 5. Ranking — operational details

Ranking remains batch-relative and never changes the source Factor/Axis scores.

## 5.1 Source mapping

```text
Quality Ranking     → Quality Axis
Opportunity Ranking → Opportunity Axis
Growth Ranking      → Growth Factor
Momentum Ranking    → Momentum Factor
Valuation Ranking   → Valuation Factor
Safety Ranking      → Safety Factor
```

A pre-existing overall ranking may remain only as explicitly labeled `COMPOSITE_RANKING`.

## 5.2 Tie handling

A valid V1 sandbox policy is dense ranking:

```text
82, 82, 80 → ranks 1, 1, 2
```

The final production tie policy remains registry-controlled.

## 5.3 Unknown and partial evidence

```text
UNKNOWN → UNRANKABLE
```

Unrankable records are excluded from the ranking denominator, while the UI still discloses displayed-universe and rankable-universe counts.

A score may remain rankable under a partial-evidence policy, but must preserve:

```text
ranking_status = PARTIAL
coverage
```

so `82 @ 55% coverage` is not silently presented as equivalent to `82 @ 100% coverage`.

---

# 6. Sandbox Registry Pack

The sandbox vertical slice is allowed before production calibration, but every temporary value must live in an explicit versioned registry.

Recommended structure:

```text
/screener/registries/
├── metric_roles.v1
├── derived_metrics.v1
├── applicability.v1
├── transforms.sandbox.v1
├── contribution_budget.sandbox.v1
├── factor_formula.sandbox.v1
├── axis_mapping.v1
├── risk_rules.sandbox.v1
├── bands.sandbox.v1
├── classification.sandbox.v1
└── ranking.v1
```

Each registry should expose at least:

```text
registry_id
version
calibration_status
scope
effective_as_of
rules
lineage
```

Illustrative sandbox values such as `L=40`, `H=60` may be used for comparison only when explicitly marked `calibration_status = SANDBOX`. They are not production defaults.

---

# 7. Vertical Slice — required scenarios

The first implementation slice remains:

```text
TradingView Raw
→ D1 Contract Validator
→ D2 Price Dislocation Evaluator
→ D3 Diagnostic / Decision Runner
→ diagnostic output
```

Required scenarios:

```text
1. Normal: Price=80, High=100, Low=50
2. At high: Price=100, High=100, Low=50
3. At low: Price=50, High=100, Low=50
4. Deep drawdown: Price=40, High=100, Low=30
5. Price > High: Price=110, High=100, Low=50
6. Missing High → derived UNKNOWN, never zero
7. Narrow range: Price=100, High=100.01, Low=99.99
8. UNKNOWN decision input
9. Drawdown/Upside structural redundancy
10. Missing Optional vs Missing Critical input
```

For `Price > High_52W`, preserve raw values and emit:

```text
PRICE_ABOVE_STORED_52W_HIGH
INCONSISTENT_REFERENCE
```

Never clamp `Price` to `High_52W`.

---

# 8. Implementation order after the vertical slice

After D1/D2/D3 pass:

```text
Momentum / Volume
→ Growth
→ Cash Flow
→ Balance Sheet / Safety
→ Earnings Quality
→ Valuation completion
→ Anchored Metric Scoring Engine
→ Factor Engine
→ Axis Engine
→ Risk Gate Engine
→ Band Registry
→ Classification Engine
→ Ranking Engine
→ Dashboard Adapter
```

Each evaluation family follows:

```text
Contract
→ Derived
→ Signal
→ Redundancy
→ Representative selection
→ Anchored scoring
→ Tests
```

Do not code all families and classification simultaneously; the vertical slice exists to validate state propagation, provenance, lineage and registry boundaries first.

---

# 9. Production calibration still open

The following remain deliberately open:

```text
metric anchors / transforms
factor group weights / caps
cross-factor influence caps
axis budgets
classification L / H boundaries
material Soft Risk thresholds
ranking percentile / tie conventions
Volume neutral bands
RelVol reconciliation tolerance
```

The current ~76-stock dataset is a validation sandbox for parser/evaluation behavior, distributions, missingness, redundancy, anomalies and stability. It is **not** sufficient to claim predictive validation or optimize production weights.

Future predictive validation requires historical snapshots plus forward returns, using `available_as_of` to avoid look-ahead bias.

---

# 10. Consolidated acceptance invariants

- Missing never becomes zero.
- `UNKNOWN` never silently becomes FALSE, PASS, LOW, or last rank.
- Negative economics are not automatically invalid data.
- Coverage is metadata, not a score multiplier.
- Criticality may override numeric coverage.
- Group aggregation is normalized across eligible evidence only.
- Supporting evidence cannot open a second full contribution budget.
- Cross-factor reuse is lineage-aware and impact-bounded.
- Small input changes should produce continuous score changes except at genuine state boundaries.
- Factor/Axis/Classification outputs are batch-invariant.
- Ranking is batch-dependent and cannot classify.
- Hard Risk blocks eligibility but never rewrites Axis scores.
- Soft Risk does not automatically force Avoid.
- Deep drawdown alone is neither High Reward nor Value Trap.
- Price–Volume Interaction remains `CONTEXT_BOUNDED`.
- Dashboard is view/navigation only.
- CRSM/Node 1 handoff is always user-triggered.

---

# 11. Source-of-truth relationship

Use the documents in this order:

1. `SCREEN_SCORING_THEORY.md` — high-level architecture and semantic source of truth.
2. Specific family contracts — authoritative when more detailed for that family.
3. `SCREENER_V2_THEORY_ADDENDUM.md` — explicit numeric semantics, acceptance scenarios and implementation clarifications consolidated from the latest theory review.
4. `SCREENER_V2_IMPLEMENTATION_PLAN.md` — sequencing and implementation checklist.

This addendum closes documentation gaps without changing the frozen architecture.