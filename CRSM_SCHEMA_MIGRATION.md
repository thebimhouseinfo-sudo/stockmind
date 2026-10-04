# CRSM v1 Schema Migration Matrix

Status: CP1 compatibility gate for the CRSM analytical-quality upgrade.

The durable identity remains `crsm-request.v1`, `crsm-result.v1`, and `crsm-pipeline.v1` while the changes below remain dual-readable. Immutable historical results are never rewritten.

| Surface | Classification | Legacy v1 | New v1 profile | Compatibility rule |
|---|---|---|---|---|
| Result identity/version fields | Fixed v1 | Existing required fields | Unchanged | Any incompatible identity change requires Human review and a v2 plan. |
| `methodology_revision` | Additive v1 | Absent | Optional non-empty string | Absence remains valid for legacy results. |
| Node 2 `technical_coverage` | Dual-compatible v1 | No `coverage_model`; `required_sessions: 300` | `coverage_model: CAPABILITY_BASED_V1` plus non-empty `indicator_requirements[]` | Legacy shape stays valid. New shape validates only capabilities actually requested. |
| Node 5 `confidence` | Dual-compatible v1 | No method or `method: LEGACY_V1`; legacy component keys | `method: EVIDENCE_QUALITY_V1` with data completeness, source quality, freshness, cross-source consistency, method suitability, key-uncertainty coverage | `confidence.value` remains 0–100. Legacy components remain readable. |
| Node 6B headings/tables | Deprecated-compatible presentation rule | Fixed recommended structure | Adaptive modules | Missing/reordered headings or fewer tables are warnings, not ticker failure. |
| Node 6B unresolved placeholders | Dual-compatible v1 | Legacy reader: warning/fallback | New result with `methodology_revision`: hard invalid | Historical immutable v1 remains readable; new-profile writes must never publish template tokens such as `[AI_SCORE]`. Ordinary bracketed source labels are not rejected. |
| `sector_profile`, `material_questions` | Additive v1 | Absent | Optional; validated when present | Legacy absence remains valid. |
| `market_context` | Additive v1 | Absent | Optional object; when present its eight canonical capabilities, coverage partition and provenance are validated | Legacy absence remains valid; missing public market data is represented by DEGRADED coverage, not fabricated values. |
| Node 3 `sector_economics`, `expectation_basis` | Additive v1 | Absent | Optional; validated when present | Legacy absence remains valid. Selected valuation methods must fit the sector profile; expectation provenance cannot masquerade inference as observed consensus. |
| Node 4 `market_context_use`, `what_changed` | Additive v1 | Absent | Optional; validated when present | Legacy absence remains valid. Node 4 consumes Node 2 market internals and owns only external-driver interpretation/deltas. |
| Node 5 `thesis_conviction`, `decision_overlay`, `risk_attribution`, `investment_horizon`, `anti_thesis`, `variant_view`, `monitoring_kpis`, `what_would_change_my_mind` | Additive v1 | Absent | Legacy absence valid; if any adaptive CIO field is present the complete CP5 set is validated together | AI Score formula remains fixed; overlay is score-neutral; Risk uses residual-risk ownership. |
| `report_modules` | Additive v1 | Absent | Optional until the owning report checkpoint defines shape/validation | Legacy absence remains valid. |
| Existing 11-field `decision_record` | Fixed v1 core | Required | Required | Additive decision context must not remove or reinterpret the current fields. |
| Six-factor AI Score formula/weights | Fixed methodology invariant | Current formula | Unchanged | Any change requires separate Human-approved versioned work. |

## Capability-based technical coverage

New Node 2 outputs may use:

```json
{
  "status": "FULL",
  "coverage_model": "CAPABILITY_BASED_V1",
  "sessions_used": 80,
  "missing_capabilities": [],
  "indicator_requirements": [
    { "capability": "sma50", "required_sessions": 50, "satisfied": true }
  ]
}
```

A FULL capability-based result cannot contain an unsatisfied indicator requirement or declared missing capability. A requirement marked `satisfied: true` cannot demand more sessions than the verified `ohlcv_source.sessions_used`, and the coverage/ohlcv session counts must agree when both are present. DEGRADED still names missing capabilities explicitly. Missing data lowers analytical coverage/confidence; it does not justify fabrication.

## Node 2 market-context coverage

New Node 2 outputs may add `market_context` without changing `crsm-result.v1`. Its coverage partitions these capabilities: `vnindex_baseline`, `secondary_benchmark`, `breadth`, `turnover_liquidity`, `leadership_rotation`, `volatility`, `market_foreign_flow`, `stock_relative_strength`.

`FULL` means all eight are available with provenance. `DEGRADED` names every missing capability. Node 1 ticker foreign flow and Node 2 broad-market foreign flow remain separate measurements.

## Node 3 expectation provenance and Node 4 causal delta

New Node 3 results may add `sector_economics` and `expectation_basis[]`. Observed consensus/company guidance require dated source evidence; valuation/price-action inference requires an explicit `INFERENCE` label. Sector method selection is validated against the canonical sector profile while legacy Node 3 remains readable.

New Node 4 results may add `market_context_use` and `what_changed[]`. `market_context_use` is consume-only and may reference only capabilities available in Node 2. `what_changed` stores dated external-driver deltas plus FACT/INFERENCE/ASSUMPTION separation and company-economics transmission targets.

## Evidence-quality confidence

New Node 5 outputs may use `method: EVIDENCE_QUALITY_V1` with fixed weights:
- `data_completeness`: 25%
- `source_quality`: 20%
- `freshness`: 15%
- `cross_source_consistency`: 15%
- `method_suitability`: 15%
- `key_uncertainty_coverage`: 10%

The legacy confidence shape remains valid for historical results. Confidence measures evidence quality; thesis conviction remains a separate field.

## CP5 CIO synthesis compatibility

The fixed six-factor AI Score remains unchanged. Adaptive CP5 output adds conviction, score-neutral market-regime overlay, residual-risk attribution, horizon, anti-thesis, variant view, monitoring KPIs and change-my-mind conditions.

Legacy results may omit all CP5 fields. If any adaptive CP5 field is present, the validator requires the complete CP5 set so a result cannot persist an overlay without conviction/risk ownership or vice versa.

Existing 11-field `decision_record` remains valid. Optional additive conviction/regime/horizon fields may be persisted and, when present, must agree with Node 5.

## v2 escalation gate

Stop for explicit Human review before changing any of the following incompatibly: result/request/pipeline identity, source ownership, required Node 1–5 presence, decision enum, existing decision-record semantics, or six-factor AI Score weights/formula. A v2 migration must include validator, fixtures, renderer compatibility, and historical-read strategy together.
