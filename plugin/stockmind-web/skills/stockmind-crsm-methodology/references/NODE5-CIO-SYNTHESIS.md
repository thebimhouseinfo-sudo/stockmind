# Node 5 CIO Synthesis — Confidence, Conviction, Regime Overlay & Residual Risk

Node 5 turns Node 2–4 evidence into one auditable investment decision. It must preserve the existing six-factor AI Score formula exactly while keeping **evidence confidence**, **thesis conviction**, **market-regime overlay**, and **risk attribution** structurally separate.

## Fixed AI Score — never modify in this profile

The six factor scores remain 0–20:

- Fundamental: 30%
- Valuation: 20%
- Technical: 15%
- Flow: 15%
- Sector/Macro: 10%
- Risk: 10%

```text
AI Score =
Fundamental/20×30
+ Valuation/20×20
+ Technical/20×15
+ Flow/20×15
+ Sector_Macro/20×10
+ Risk/20×10
```

Market Regime, conviction, confidence and overlay effects are **not** score factors. They cannot change weights or silently add/subtract points.

For adaptive CIO synthesis, the stored `ai_score.value` must equal the fixed formula whenever all six factors are numeric.

## Evidence confidence — EVIDENCE_QUALITY_V1

Confidence answers: **“How trustworthy and complete is the evidence/method?”** It does not answer whether the thesis is bullish.

Use these fixed component weights:

- `data_completeness`: 25%
- `source_quality`: 20%
- `freshness`: 15%
- `cross_source_consistency`: 15%
- `method_suitability`: 15%
- `key_uncertainty_coverage`: 10%

`confidence.value` is the weighted result when all components are numeric. Legacy confidence remains readable.

## Thesis conviction

Conviction answers: **“How strongly should the CIO believe the investment thesis?”** It is distinct from confidence.

```json
{
  "thesis_conviction": {
    "level": "LOW | MEDIUM | HIGH",
    "rationale": "…",
    "expectation_basis_refs": [0],
    "supporting_evidence_refs": ["source-or-node-ref"],
    "contradictory_evidence_refs": ["source-or-node-ref"],
    "catalyst_visibility": "LOW | MEDIUM | HIGH | UNKNOWN",
    "payoff_asymmetry": "NEGATIVE | BALANCED | POSITIVE | UNCERTAIN"
  }
}
```

`expectation_basis_refs[]` are zero-based references into Node 3 `expectation_basis[]`. An empty array is allowed when no credible expectation basis exists; do not invent one merely to support conviction.

High conviction should come from coherent evidence, visible catalysts and favorable/understood asymmetry — not from confidence score magnitude alone.

## Market-regime decision overlay

Market Regime may change **timing, sizing, or final decision wording**, but never AI Score.

```json
{
  "decision_overlay": {
    "market_regime": {
      "regime_state": "RISK_ON | NEUTRAL | RISK_OFF | MIXED | UNKNOWN",
      "evidence_refs": ["NODE2.market_context:breadth", "NODE4.what_changed:0"]
    },
    "timing_effect": "NONE | ACCELERATE | DELAY | WAIT_FOR_ENTRY",
    "sizing_effect": "NONE | INCREASE | REDUCE | CAP",
    "decision_effect": "NONE | WORDING_ONLY | OVERRIDE",
    "pre_overlay_decision": "BUY",
    "post_overlay_decision": "BUY ON DIP",
    "override_rationale": "Risk-off breadth and liquidity argue for waiting for a better entry.",
    "ai_score_effect": "NONE",
    "ai_score_reference": 78
  }
}
```

Rules:
- `post_overlay_decision` must equal canonical Node 5 `decision`.
- `ai_score_effect` is always `NONE`; `ai_score_reference` must equal Node 5 `ai_score.value`.
- `NONE` / `WORDING_ONLY` decision effects do not change the decision enum.
- `OVERRIDE` means pre/post decision differ and requires explicit evidence plus rationale.
- Any non-NONE timing/sizing/decision effect needs evidence refs and rationale.
- `UNKNOWN` regime may have no evidence refs only when no overlay effect is applied.

## Residual-risk attribution

Avoid double-penalizing the same adverse driver in multiple score factors. Every adverse driver has exactly one **primary scoring owner**.

Canonical owners:
- `FUNDAMENTAL`
- `VALUATION`
- `TECHNICAL`
- `FLOW`
- `SECTOR_MACRO`
- `RISK`

Use:

```json
{
  "risk_attribution": [
    {
      "driver": "Refinancing wall in 2027",
      "primary_owner": "FUNDAMENTAL",
      "residual_risk_effect": "HIGH",
      "risk_score_treatment": "RESIDUAL_TAIL_PENALTY",
      "rationale": "Leverage is already reflected in Fundamental; Risk captures only the tail outcome if refinancing access closes.",
      "evidence_refs": ["debt-maturity-note"]
    }
  ]
}
```

Treatment rules:
- `NO_ADDITIONAL_PENALTY`: adverse driver already belongs to another factor and has no distinct tail fragility left for Risk.
- `RESIDUAL_TAIL_PENALTY`: another factor owns the expected-case penalty; Risk captures only an additional tail/downside fragility.
- `PRIMARY_RISK_PENALTY`: Risk is the primary owner because the driver is genuinely a tail-fragility/risk-resilience issue rather than an expected-case fundamental/valuation/macro penalty.

Do not score the same expected-case weakness twice.

## CIO monitoring outputs

Adaptive CIO synthesis also adds:

```json
{
  "investment_horizon": {
    "bucket": "0-3M | 3-12M | 12M+",
    "rationale": "…"
  },
  "anti_thesis": "Strongest plausible reason the thesis may be wrong.",
  "variant_view": {
    "summary": "…",
    "expectation_basis_refs": [0],
    "why_different": "…",
    "payoff_if_right": "…",
    "what_proves_wrong": "…"
  },
  "monitoring_kpis": [
    {
      "kpi": "NIM",
      "current_state": "… or null",
      "watch_condition": "Falls below 3.0%",
      "thesis_link": "Would invalidate the margin-recovery thesis.",
      "source_refs": ["Q3 filing"]
    }
  ],
  "what_would_change_my_mind": [
    "Credit cost rises above …",
    "Legal approval slips beyond …"
  ]
}
```

Rules:
- keep **3–5 monitoring KPIs**;
- use measurable watch conditions rather than generic “monitor closely” wording;
- every KPI keeps source provenance;
- anti-thesis must be the strongest credible opposing case, not a token disclaimer;
- “what would change my mind” should be observable and decision-relevant.

## Compatibility

All CP5 fields are additive v1. Legacy results without them remain readable.

However, once any CP5 adaptive field is emitted, the full adaptive CIO set should be emitted together so confidence/conviction/overlay/risk ownership cannot be partially represented.
