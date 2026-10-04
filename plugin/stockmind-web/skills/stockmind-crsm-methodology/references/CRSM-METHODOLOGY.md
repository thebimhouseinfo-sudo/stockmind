# CRSM Methodology — Current Stockmind Architecture

This document is the provider-independent analytical contract for Stockmind Web.
It is derived from the live Node 1–6 source contracts. Where legacy generated prompts conflict with current source behavior, the current source behavior in this document wins.

## Analytical operating principle

CRSM is a structured research process, not a form-filling exercise. The model must reason before it serializes.

For every ticker, first create an internal evidence map: strongest positive evidence, strongest negative evidence, unresolved conflicts, missing material facts, and the variables most capable of changing the investment thesis. Then construct both a thesis and an anti-thesis and actively test each against current evidence. Only after this synthesis should the model populate Node JSON.

The final analysis should answer four questions clearly:
1. **What is actually changing in this business now?**
2. **Why should that change affect earnings/cash flow/valuation?**
3. **What is the market likely already pricing in, and what could still surprise it?**
4. **What evidence would prove the thesis wrong?**

Reader-facing prose is Vietnamese-first. Use English only for proper nouns, source titles, tickers, fixed machine enums, formulas and standard finance abbreviations. Avoid bilingual duplicate headings and generic textbook commentary.

## Mandatory language-normalization stage

The model must not assume the renderer will translate analytical prose. After Node 5 and before Node 6B/result construction, perform a dedicated Vietnamese normalization pass over every reader-facing string in Node 1–5.

Rewrite complete English sentences and awkward code-switched prose into natural Vietnamese while preserving numbers, dates, units, tickers, proper nouns, source names, formulas and standard abbreviations. This includes, at minimum:
- Node 2: coverage notes, missing-capability descriptions, VSA/volume evidence, trend/zone commentary, screening-signal explanation and conclusion;
- Node 3: screening-flag observations/questions/answers, sustainability reasoning/classification, formula notes, red flags, valuation commentary, moat and conclusion;
- Node 4: risk regime, macro indicator descriptions, driver/evidence text, sensitivity directions, geopolitical relevance, causal facts/inferences/assumptions/summary, scenario conditions, macro/industry/company impact and conclusion;
- Node 5: conflict override, catalyst text, drivers, stop basis, liquidity note, strategy notes/steps, TP rationales, position-size note and full reasoning.

Prefer Vietnamese directly in canonical Node fields. `localized_upstream` is compatibility-only and must not be used to leave canonical prose in English.

A result can retain machine tokens such as FULL/DEGRADED/WATCH and abbreviations such as FCF/WACC/ROIC, but it must not contain reader-facing English sentences such as “Policy tailwind for AI is real…” or “Technical coverage is DEGRADED…” in fields displayed by the report.

---

## Stage 1 — Node 1: Financial Data Verification

Role: Financial Data Completion Engine + Materiality Router.

Purpose:
- collect and verify raw facts;
- determine which evidence is material for this business model before searching exhaustively;
- complete fields missing from the request context;
- preserve trusted SCREENED_WEB input unchanged;
- do **not** compute WACC, ROIC, DCF, fair value, target price, moat score, or final score.

Read `SECTOR-PROFILES.md` before Node 1 research.

### Sector/materiality routing

Use exactly one canonical `sector_profile`: `BANK | INSURANCE | SECURITIES | REAL_ESTATE | UTILITIES_POWER | COMMODITY_CYCLICAL | INDUSTRIAL_LOGISTICS | TECHNOLOGY_SERVICES | CONSUMER | GENERIC`.

Research in this order:
1. **Universal core** — price/liquidity, ticker-specific foreign flow, earnings/cash flow, leverage/working capital, ownership/events/capital allocation, meaningful valuation multiples and source provenance.
2. **Sector pack** — collect the KPI classes named for the selected profile; do not force generic industrial metrics onto banks/insurers/real estate or vice versa.
3. **Triggered evidence** — investigate only material anomalies/dependencies surfaced by the first two passes.

Create `material_questions[]` for thesis-changing issues. Each item has:
- `question`: concise Vietnamese question;
- `why_material`: causal reason it matters;
- `status: ANSWERED | PARTIAL | MISSING`;
- `answer`: evidence-based answer or null;
- `source_refs[]`;
- `freshness`: date/period/null.

`PARTIAL` and `MISSING` are valid outcomes. Missing evidence must reduce downstream confidence instead of being filled with inferred numbers.

### DIRECT behavior

For WEB_ONLY and EVIDENCE_WEB, Node 1 operates in DIRECT-style data collection:
- fetch/verify the raw evidence required by the universal core + selected sector pack + triggered material questions;
- no screening snapshot exists;
- `screening_metrics`, `screening_summary`, `trusted_screener_snapshot`, `data_integrity`, `screening_as_of` are null.

EVIDENCE_WEB evidence is available to downstream evidence-aware analysis, but it does not become a fake Screener snapshot.

### SCREENED behavior

For SCREENED_WEB:
- `screening_context` is immutable trusted user-provided screening input;
- carry it forward unchanged;
- use it only to identify missing data/anomalies/material questions;
- external conflicts are documented separately, never used to overwrite the snapshot.

### Node 1 research targets

Universal core where available:
- latest price, liquidity, 20d volume/trading value, **ticker-specific** foreign flow/room, market cap;
- revenue/NPAT/cash-flow trend, leverage and relevant working-capital evidence;
- ownership, insider/related-party events and material capital allocation: dividend, buyback, issuance, M&A/divestment, capex and refinancing;
- current valuation multiples that are economically meaningful for the selected profile;
- upcoming material events and anomaly investigation.

Sector pack:
- collect the material KPI classes from `SECTOR-PROFILES.md`;
- store raw values/provenance in existing raw objects when they map cleanly;
- where no canonical raw field exists yet, retain the evidence in `material_questions[].answer/source_refs` rather than inventing a new metric or forcing it into an unrelated field.

Source discipline:
- `TIER_1`: exchange/regulator/company filing/IR/audited report;
- `TIER_2`: trusted Vietnamese market data/research provider;
- `TIER_3`: reputable business press/secondary research;
- `USER_EVIDENCE`: user-provided evidence bound to the exact item.
- record source date/period/freshness when available;
- newer lower-tier evidence does not silently overwrite a more authoritative source measuring the same fact.

### Node 1 JSON contract

Legacy required keys remain unchanged. New analytical-quality results should additionally provide:
- `sector_profile`
- `material_questions`

These are additive-v1 fields: legacy results without them remain readable.

Required legacy top-level keys:
- `ticker`
- `sector_type`
- `timestamp`
- `data_period`
- `analysis_mode`
- `screening_metrics`
- `screening_summary`
- `trusted_screener_snapshot`
- `screening_as_of`
- `data_integrity`
- `market_data`
- `valuation_multiples`
- `financial_core_raw`
- `cost_of_capital_raw_inputs`
- `ownership_insider`
- `upcoming_events`
- `anomaly_investigation`
- `data_completion`
- `sources`

Additive shape:

```json
{
  "sector_profile": "BANK",
  "material_questions": [
    {
      "question": "Điều gì đang chi phối chất lượng tài sản?",
      "why_material": "Chi phí tín dụng và ROE bền vững phụ thuộc trực tiếp vào NPL mới hình thành.",
      "status": "ANSWERED",
      "answer": "…",
      "source_refs": ["company-filing-Q2"],
      "freshness": "Q2/2026"
    }
  ]
}
```

Existing raw shape remains valid:

```json
{
  "market_data": {
    "price": {"value": null, "date": null, "source": null},
    "volume_20d_avg": {"value": null, "date": null, "source": null},
    "avg_trading_value_20d": {"value": null, "unit": "Bn VND", "date": null, "source": null},
    "liquidity_flag": null,
    "foreign_net_flow_20d": {"value": null, "unit": "Bn VND", "date": null, "source": null},
    "foreign_room_remaining": {"value": null, "unit": "%", "date": null, "source": null},
    "market_cap": {"value": null, "unit": null, "date": null, "source": null}
  },
  "valuation_multiples": {
    "pe_ttm": null,
    "pb_current": null,
    "dividend_yield": null
  },
  "financial_core_raw": {
    "revenue": {"value": null, "period": null, "yoy": null, "source": null},
    "npat": {"value": null, "period": null, "yoy": null, "source": null},
    "ebit": {"value": null, "period": null, "source": null},
    "gross_margin": null,
    "debt_equity": null,
    "total_debt": null,
    "total_equity": null,
    "cash_and_equivalents": null,
    "effective_tax_rate": null,
    "cfo": {"value": null, "period": null, "source": null},
    "capex": {"value": null, "period": null, "source": null},
    "receivables": {"value": null, "period": null, "yoy": null, "source": null},
    "inventory": {"value": null, "period": null, "yoy": null, "source": null},
    "financial_income": {"value": null, "period": null, "yoy": null, "source": null},
    "financial_expense": {"value": null, "period": null, "yoy": null, "source": null},
    "other_income": {"value": null, "period": null, "yoy": null, "source": null},
    "other_expense": {"value": null, "period": null, "yoy": null, "source": null}
  },
  "cost_of_capital_raw_inputs": {
    "note": "raw inputs only; WACC is calculated downstream",
    "risk_free_rate_10y_vn_bond": null,
    "beta": null,
    "equity_risk_premium_vn": null,
    "avg_cost_of_debt": null
  },
  "ownership_insider": {
    "major_shareholders": [],
    "recent_insider_transactions": [],
    "related_party_flag": null
  },
  "upcoming_events": [],
  "anomaly_investigation": [],
  "data_completion": {
    "provided_by_screening": [],
    "new_data_collected": [],
    "still_missing": []
  },
  "sources": []
}
```

Hard rules:
- no long OHLCV fetch here;
- no industry-median substitution for missing stock-level values;
- searched but unverifiable = null;
- `market_data.foreign_net_flow_20d` is stock-specific, never market-wide flow;
- Node 1 records raw evidence/provenance only and does not choose the final valuation output.

---

## Stage 2A — Node 2: Technical + Vietnam Market Context

Role: Quant Technical Analyst + Market Internals Measurer.

Read `NODE2-MARKET-CONTEXT.md` before Node 2.

### Ownership

Node 2 measures:
- stock OHLCV/technical structure;
- VN-Index and relevant secondary benchmark performance;
- market breadth;
- turnover/liquidity;
- leadership/rotation;
- volatility;
- broad-market foreign flow;
- stock relative strength versus VN-Index and the selected secondary benchmark.

Node 4 may interpret the macro/policy/FX/rates/commodity causes behind these observations, but must not recompute Node 2 market internals.

Node 1 `market_data.foreign_net_flow_20d` is stock-specific. Node 2 `market_context.market_foreign_flow` is broad-market. Never substitute one for the other.

### Technical evidence

For new analysis prefer `technical_coverage.coverage_model: CAPABILITY_BASED_V1`.
- Declare only the indicators actually needed.
- Each `indicator_requirements[]` entry states the required verified history and whether it is satisfied.
- Use `FULL` only when every declared technical requirement is satisfied.
- Use `DEGRADED` and name missing capabilities when public OHLCV/history is insufficient.
- Legacy `required_sessions: 300` remains readable for historical results; do not force a fixed 300-session requirement onto every new analysis.

Compute only when evidence supports it:
- price trend/structure;
- current volume versus 20D average;
- SMA/other indicators whose declared history requirement is satisfied;
- demand/supply zones;
- VSA/Wyckoff candidate signals only with suitable OHLCV/context.

Never claim institutional activity from volume alone. `smart_money_phase` and VSA/Wyckoff labels are optional/evidence-gated; null/cautious candidate language is preferable to fabrication.

With `CAPABILITY_BASED_V1`, set `sma_200_rel` to null unless `indicator_requirements` contains a satisfied `sma200` requirement needing at least 200 verified sessions. For new `market_context` results, a non-null `smart_money_phase` must carry evidence status and supporting evidence; a non-empty VSA candidate likewise requires supporting evidence.

### Vietnam market context

Always attempt:
1. **VN-Index baseline** for the stated comparison period.
2. **Relevant secondary benchmark**:
   - VN30 for materially representative large-cap context;
   - HNXINDEX for HNX-listed names;
   - UPCOMINDEX for UPCoM-listed names;
   - reliable official sector index when available;
   - otherwise a named 3–5 stock peer basket.
3. **Market internals**: breadth, turnover/liquidity, leadership/rotation, volatility and broad-market foreign flow.
4. **Relative strength**: ticker versus VN-Index and the selected secondary benchmark over the same period.

Public VNDIRECT/SSI or similar sources may supply market data, but do not invent a proprietary benchmark name. Preserve the actual benchmark identity and source/freshness.

### market_context coverage

Use exactly these canonical capabilities:
- `vnindex_baseline`
- `secondary_benchmark`
- `breadth`
- `turnover_liquidity`
- `leadership_rotation`
- `volatility`
- `market_foreign_flow`
- `stock_relative_strength`

`available_capabilities[]` and `missing_capabilities[]` must partition all eight capabilities with no overlap.
- `FULL`: none missing.
- `DEGRADED`: at least one missing.
- Every available capability must have source provenance.
- Missing public data remains null/missing and lowers downstream confidence; never synthesize it.

### Node 2 output

Keep the existing technical fields for compatibility:
- `technical_coverage`
- `ohlcv_source`
- `trend_status`
- `sma_200_rel`
- `volume_analysis`
- `smart_money_phase`
- `zones`
- `sector_benchmark`
- `sector_vs_market`
- `screening_signal_analysis`
- `signal_strength`
- `conclusion`

New analytical-quality results should additionally include additive-v1 `market_context` as defined in `NODE2-MARKET-CONTEXT.md`.

For SCREENED_WEB, screening momentum remains a research trigger only. Record whether independently verified technical/market structure confirms, partially supports or contradicts the preliminary move. Never inherit Screener momentum score as Node 2 signal strength.

---

## Stage 2B — Node 3: Sector Economics, Valuation & Expectation Gap

Role: Senior Institutional Equity Analyst.

Read `NODE3-EXPECTATION-VALUATION.md` and use Node 1 raw verified evidence. For EVIDENCE_WEB, use only evidence bound to this exact item when relevant and preserve provenance/conflicts.

### Business economics first

Do not apply one universal corporate-finance checklist. Start from `node1.sector_profile`:
- identify the material earnings bridge and normalize earnings only when adjustments are evidenced;
- evaluate capital allocation and balance-sheet capacity using sector-appropriate economics;
- choose the smallest useful valuation method set from the sector profile;
- explain why each selected/conditional method fits the business.

Generic ROIC/WACC/FCF analysis is appropriate only where the business model and evidence make those measures economically meaningful. Do not force bank/insurance economics through an industrial-company template.

Piotroski F-Score is null for BANK/INSURANCE. Beneish M-Score is conditional/trigger-only. Full DCF is conditional on defensible cash-flow and discount-rate inputs. Reverse-valuation reasoning is useful only when the implied expectation can be stated without fabricated precision.

New analytical-quality Node 3 should add:
- `sector_economics {sector_profile,earnings_bridge,normalized_earnings,capital_allocation,balance_sheet_capacity,valuation_method_selection}`
- `expectation_basis[]`

Legacy Node 3 fields remain for compatibility.

### Expectation and variant-view provenance

Every material claim about consensus, company guidance, what the price/valuation implies, or what appears priced in must use:
- `OBSERVED_CONSENSUS`
- `COMPANY_GUIDANCE`
- `VALUATION_IMPLIED`
- `PRICE_ACTION_INFERENCE`

Observed consensus/company guidance require dated source refs. Valuation/price-action inference must be labelled `INFERENCE`, must cite the evidence used, and cannot be worded as if it were observed consensus.

A strong variant view states:
reference expectation + typed basis → analyst view → economic gap → investment implication → evidence that would close/invalidate the gap.

If credible expectation evidence is unavailable, `expectation_basis` may be empty; do not manufacture a market expectation.

### SCREENED research triggers

Screener fields remain triggers only. Keep `screening_metrics_used` separate from independently derived Node 3 analysis. No averaging/blending with Screener score.

Legacy output fields remain:
- `data_period`
- `screening_flags`
- `screening_metrics_used`
- `capital_efficiency`
- `earnings_quality`
- `earnings_sustainability`
- `f_score`
- `m_score`
- `m_score_note`
- `health_status`
- `valuation`
- `moat`
- `conclusion`

---

## Stage 3 — Node 4: Exposure-First External Drivers & Causal Delta

Role: External Driver Analyst + Causal Inference Expert.

Read `NODE4-CAUSAL-DELTA.md`.

### Start from exposure, not macro headlines

Build the company exposure map first. Research only external variables with a plausible material path to the company's economics:
- policy/regulation;
- rates/funding;
- FX;
- commodity/input prices;
- legal/project approvals;
- customer/end-market demand;
- supply/freight/logistics or other company-external variables.

Fed, DXY, oil, GDP, credit and public investment are conditional inputs, not mandatory sections.

### Consume Node 2; never duplicate it

Node 2 owns Vietnam market-internal measurement. Node 4 may interpret available Node 2 observations but must not re-fetch/recompute index return/trend, breadth, turnover, leadership/rotation, volatility, market foreign flow or stock relative strength.

In adaptive Node 4 output, the same Node2-owned measurements must not be duplicated into `what_changed` or `macro_indicators`; route them exclusively through `market_context_use`.

When material, add:
- `market_context_use {source:"NODE2.market_context",measurement_policy:"CONSUME_ONLY",consumed_capabilities,interpretation}`

Only capabilities actually available in Node 2 may be consumed.

### what_changed causal delta

New analytical-quality Node 4 should add `what_changed[]`. Each material driver records:
- driver + driver_type;
- exposure;
- prior_state + current_state;
- direction;
- materiality;
- transmission_lag;
- dated source_refs;
- transmission_targets to `REVENUE | MARGIN | CASH_FLOW | BALANCE_SHEET | VALUATION`;
- separate `fact`, `inference`, `assumption`;
- `inference_confidence` 0–100.

If prior/current evidence is incomplete, use direction `UNKNOWN`. A useful causal chain reaches company economics or valuation; omit generic macro facts with no material transmission path.

Legacy Node 4 fields remain:
- `risk_regime`
- `macro_indicators`
- `company_specific_drivers`
- `sensitivity_table`
- `geopolitical_events`
- `causal_chains`
- `risk_scenarios`
- `macro_view`
- `industry_impact`
- `company_impact`
- `conclusion`

---

## Stage 4 — Node 5: CIO Decision

Role: Hedge Fund CIO / final decision synthesis.

Read `NODE5-CIO-SYNTHESIS.md`.

All reader-facing prose generated by Node 5 must be natural Vietnamese. Keep fixed machine enums and standard finance abbreviations intact. Node 5 also triggers the mandatory language-normalization stage across Node 1–5 before result construction.

### Fixed six-factor AI Score

Each factor remains 0–20 with the existing weights:

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

Risk score is 0–20 where 20 = safest.

**Do not change this formula or weights.** Confidence, conviction and Market Regime are not score factors. For adaptive CIO synthesis, `ai_score.value` must remain traceable to the six stored factor scores.

### Evidence confidence

For new adaptive synthesis use `confidence.method: EVIDENCE_QUALITY_V1`:

- data completeness 25%
- source quality 20%
- freshness 15%
- cross-source consistency 15%
- method suitability 15%
- key-uncertainty coverage 10%

Confidence measures evidence/method quality, not bullishness.

Legacy confidence remains readable.

### Thesis conviction

Add `thesis_conviction` with:
- `level: LOW | MEDIUM | HIGH`
- rationale
- Node 3 `expectation_basis_refs[]`
- supporting and contradictory evidence refs
- catalyst visibility
- payoff asymmetry

Conviction is separate from confidence. A high-quality dataset may still support LOW conviction when evidence is balanced or payoff asymmetry is weak.

### Market-regime decision overlay

Add `decision_overlay`:
- `market_regime {regime_state,evidence_refs}`
- timing effect
- sizing effect
- decision effect
- pre/post overlay decision
- override rationale
- `ai_score_effect: NONE`
- AI Score reference

Market Regime can change timing/sizing/decision wording only through this auditable overlay. It never changes AI Score.

### Residual-risk ownership

Add `risk_attribution[]`.

Each adverse driver has exactly one `primary_owner` among Fundamental, Valuation, Technical, Flow, Sector/Macro or Risk.

If another score factor already penalizes the expected-case weakness, Risk may only capture a separately explained **residual tail fragility**. Do not double-penalize the same driver.

### CIO decision quality

Also add:
- `investment_horizon`
- strongest `anti_thesis`
- evidence-based `variant_view`
- 3–5 `monitoring_kpis`
- `what_would_change_my_mind[]`

Monitoring conditions must be observable and thesis-linked.

### Conflict Detector

Keep the existing Fundamental / Technical / Macro / Liquidity alignment. Conflict Detector is decision context, not another score factor.

### Catalyst, liquidity and trade strategy

Keep:
- nearest catalyst bucket;
- liquidity-aware tranche/slippage guidance;
- `trading_stop` distinct from `thesis_invalidation`;
- risk-per-trade, position sizing, max portfolio weight and Initial/Add-on planning.

### Current Screener role

For SCREENED_WEB, Screener remains candidate-selection/research context only. Never compare Screener score with CRSM AI Score and never create `screen_vs_crsm`.

### Compatibility

Legacy Node 5 fields remain canonical and readable. CP5 fields are additive v1.

Once an adaptive CIO field is emitted, emit the complete adaptive set defined in `NODE5-CIO-SYNTHESIS.md` so confidence/conviction/regime/risk ownership cannot become partially represented.

---

## Stage 5A — Visual Report: deterministic web renderer

Role: presentation owned by the webapp, not by the analytical model.

The model does **not** generate Visual HTML. The webapp renders the canonical visual report deterministically from Node 1–5 using `src/crsm/nodes/node6a-renderer.js` and its normalization layer. This removes duplicate HTML generation, prevents template drift, and preserves reasoning budget for analysis.

The renderer must treat Node 5 / `decision_record` as canonical for decision, AI score, confidence and trade levels; show SCREENED_WEB snapshots only as context; preserve source provenance; and render missing data explicitly without inventing values.

Legacy immutable results may still contain `outputs.node6a`; it is compatibility data only and is not the rendering source of truth.

---

## Stage 5B — Node 6B: Detail Markdown

Role: senior equity research writer who communicates the Node 1–5 synthesis, not a new scoring node.

### Depth and writing standard

The report must read like a serious buy-side research note, not a schema dump. Each major section should connect **evidence → interpretation → investment implication**. Prioritize materiality: explain which 3–5 variables actually matter to the stock and why. Surface contradictions rather than smoothing them away. Distinguish company alpha from market/sector beta. State what appears priced in, what is not obviously priced in, and what catalyst could close that gap.

Do not pad the report with generic macro definitions, boilerplate risk language, or duplicated bullet points. A strong report should contain differentiated reasoning that would still be useful to a knowledgeable investor who already knows the headline financial figures.

Language: natural Vietnamese throughout, except unavoidable proper nouns and standard finance abbreviations. Never emit alternating English/Vietnamese headings or untranslated template labels.

Mandatory report source: `references/NODE6B-FULL-REPORT.md`. Follow its detailed Word-ready structure and tables. A condensed executive summary is not a valid Node 6B output.

Input: same completed Node1–5 outputs.

Vietnamese structure:
1. Quyết định đầu tư
2. Screening Snapshot only for SCREENED_WEB, as contextual source—not score comparison
3. Tín hiệu tổng hợp
4. Vĩ mô & Ngành
5. Doanh nghiệp & Chất lượng lợi nhuận
6. Định giá & So sánh peer
7. Kỹ thuật & Dòng tiền
8. Rủi ro
9. Phân tích nhân quả FACT / INFERENCE / ASSUMPTION
10. Kịch bản
11. Chiến lược giao dịch & Quản trị vị thế
12. Nguồn dữ liệu

For non-screened modes, omit the Screening Snapshot section and renumber naturally.

Requirements:
- Markdown only;
- no unresolved placeholders;
- upstream null => `Chưa có dữ liệu`;
- real tables for peers, sensitivity and sources;
- every quantitative claim anchored in upstream data;
- one short personal-use disclaimer at end;
- do not compute new score/decision/comparison in Node 6B.

---

## Stage 6 — decision_record replaces legacy Node 7 side effect

Legacy Node7 appended a browser-local row. Stockmind Web must not do that.

Create exactly one immutable `decision_record` from Node1/Node5:

```json
{
  "date": "DD/MM/YYYY",
  "ticker": "",
  "price_at_analysis": null,
  "decision": null,
  "ai_score": null,
  "confidence": null,
  "entry_zone": null,
  "trading_stop": null,
  "tp1": null,
  "tp2": null,
  "thesis_invalidation": null
}
```

Use `strategy.tp1.price` and `strategy.tp2.price` when targets are objects.

---

## Final result validation

A ticker is COMPLETED when the hard contract is safe and the report is renderable.

### Hard completion checks

1. result schema/version identity matches canonical request.
2. `node1..node5` are JSON objects.
3. Node 2 explicitly declares FULL or DEGRADED technical coverage; DEGRADED names the missing capabilities instead of fabricating them.
4. Node 5 preserves the canonical decision/machine identity and contains a substantive `full_reasoning` synthesis.
5. decision_record has all 11 fields and is derived from Node 1 + Node 5.
6. result ticker/item/run/source match the request.
7. no evidence from another ticker was used.
8. SCREENED_WEB snapshot remains unchanged.
9. no Screener score was blended into CRSM score.
10. result file is create-only; an existing hard-identity conflict is never overwritten.

Node 6A HTML and Node 6B formatting/section completeness are presentation-quality concerns. They may produce warnings or deterministic fallback, but must not turn a sound analytical result into FAILED.

### Soft consistency checks

Presentation must prefer Node 5/decision_record whenever the same value appears in several places. A duplicated score, decision, confidence, target or narrative mismatch in Node 6A/6B is a renderer drift to normalize, not proof that the analysis itself is invalid. Missing optional facts lower confidence and are shown as unavailable; they do not create a fake precise answer.

If a locked-template placeholder remains before a **new** write, repair the presentation in memory. If an immutable existing result contains wrapper text or presentation drift but passes hard identity/schema/evidence checks, recover it and normalize only at the rendering boundary rather than failing the ticker.
