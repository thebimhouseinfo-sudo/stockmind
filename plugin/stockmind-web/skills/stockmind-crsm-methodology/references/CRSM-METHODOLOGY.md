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

## Stage 2A — Node 2: Technical & VSA

Role: Quant Technical Analyst + VSA Specialist.

Mandatory research:
- obtain about 300 daily OHLCV sessions, enough for a real SMA200;
- do not infer technical structure from Node 1 single-volume snapshots.

Compute/analyze:
- current volume / 20D average;
- price spread + close location + volume + prior trend context;
- Wyckoff/VSA candidate signals;
- accumulation / markup / distribution / markdown only with evidence;
- fresh demand/supply zones;
- official sector benchmark when reliable, otherwise 3–5 ticker peer basket;
- benchmark vs VNINDEX over a stated period.

Never claim institutional activity from volume alone. Use "candidate" language unless direct evidence exists.

Node 2 output must include:
- `technical_coverage {status,required_sessions,sessions_used,missing_capabilities,note}` where `status` is `FULL` or `DEGRADED`; `required_sessions` is 300; if fewer than ~300 daily sessions are verified or a quantified sector-vs-VNINDEX comparison is unavailable, status must be `DEGRADED` and the missing capability must be named explicitly.
- `ohlcv_source {source,sessions_used,date_range}`
- `trend_status`
- `sma_200_rel`
- `volume_analysis {ratio,classification,vsa_signal_candidate,supporting_evidence}`
- `smart_money_phase`
- `zones {demand,supply,is_fresh}`
- `sector_benchmark {method,name,constituents_if_peer_basket,source,date}`
- `sector_vs_market {period,sector_perf_pct,vnindex_perf_pct,sector_strength_label}`
- `screening_signal_analysis`
- `signal_strength`
- `conclusion`

For SCREENED_WEB, screening momentum is a research trigger only. Record whether independently verified technical structure confirms/partially supports/contradicts the preliminary move. Do not inherit the screener momentum score as Node 2 signal strength.

---

## Stage 2B — Node 3: Deep Fundamentals & Valuation

Role: Senior Institutional Equity Analyst.

Use Node 1 raw verified data. For EVIDENCE_WEB, use only evidence bound to this item when relevant, preserving provenance and identifying conflicts.

### Capital efficiency

Calculate:
- Cost of Equity = risk_free_rate + beta × equity_risk_premium
- WACC = E/V × Cost of Equity + D/V × Cost of Debt × (1 − tax rate)
- NOPAT from EBIT and tax
- ROIC = NOPAT / Invested Capital
- Economic Spread = ROIC − WACC

Show inputs/formulas. If inputs are insufficient, return null rather than back-solving.

### Earnings quality

Calculate where possible:
- CFO / NPAT
- FCF / NPAT where FCF = CFO − Capex
- Accrual Ratio = (NPAT − CFO) / Total Assets
- receivables growth vs revenue growth
- inventory growth vs revenue growth
- debt growth vs NPAT growth

High headline profit with weak/negative cash conversion must be explicitly flagged.

### Sustainability

Classify current earnings growth:
- Structural
- Cyclical
- One-off
- Low-base effect

### Health scores

- Piotroski F-Score 0–9; null for BANK/INSURANCE where unsuitable.
- Beneish M-Score only when sector/coverage/governance conditions make it meaningful; otherwise null with reason.

### Valuation

- forward DCF using Node 3 WACC;
- mandatory reverse DCF: implied FCF CAGR embedded in current market price;
- named 3–5 peer comparison with peer-selection reason;
- relative P/E and P/B.

### SCREENED research triggers

Use Screener values only as triggers:
- EPS vs revenue disconnect;
- valuation gap;
- profitability vs leverage;
- momentum vs fundamentals.

Keep `screening_metrics_used` separate from independently calculated Node 3 metrics. No averaging/blending.

Node 3 output must include:
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

## Stage 3 — Node 4: Macro Intelligence & Causal Inference

Role: Global Macro Intelligence Collector + Causal Inference Expert.

Freshness:
- search current macro/company-driver information mainly from the last 7–30 days relative to the run date;
- older facts may be used only as historical context and should be labelled.

Research:
- Fed/current USD/DXY/rate backdrop;
- USD/VND, oil Brent and relevant global variables;
- Vietnam GDP/credit/public-investment conditions;
- geopolitical/logistics events relevant to the ticker;
- 1–3 **company-specific** input prices/drivers that actually move earnings.

Do not use Screener score/rank/grade as macro evidence.

Build a sensitivity table before causal conclusions.

Every causal chain separates:
- FACT: sourced/dateable observation;
- INFERENCE: reasoning from facts;
- ASSUMPTION: condition required for inference;
- inference confidence.

Node 4 output must include:
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

All reader-facing prose generated by Node 5 must be natural Vietnamese. Keep fixed machine enums and standard finance abbreviations intact. Node 5 is also responsible for triggering the mandatory language-normalization stage across Node 1–5 before result construction.

### Fixed six-factor score

Each factor: 0–20.

Weights:
- Fundamental: 30%
- Valuation: 20%
- Technical: 15%
- Money Flow: 15%
- Sector/Macro: 10%
- Risk: 10%

Formula:

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

The numeric result must be traceable to these six factor values. Never adjust weights from Screener data.

### Confidence

0–100 weighted average:
- data completeness 25%
- source quality 20%
- cross-source agreement 20%
- fundamental consistency 15%
- technical confirmation 10%
- macro clarity 10%

Store all component subscores.

### Conflict Detector

Rate:
- Fundamental 🟢/🟡/🔴
- Technical 🟢/🟡/🔴
- Macro 🟢/🟡/🔴
- Liquidity 🟢/🟡/🔴

State signal alignment X/4.

Rules:
- fundamental green + technical red => wait-for-entry style decision such as BUY ON DIP/weakness rather than immediate buy;
- 3+ red signals => cannot be BUY.

### Catalyst and liquidity

- classify nearest upcoming catalyst: 0–30d / 30–90d / 90–180d / >180d;
- low liquidity => tranche entries and slippage caution.

### Current Screener role — mandatory override

For SCREENED_WEB:
- Screener V2 is candidate-selection/research context only;
- do not compare Screener score to CRSM AI Score;
- do not calculate score difference;
- do not output CONFIRMED/PARTIAL/DIVERGENT;
- do not output `screen_vs_crsm`.

### Trade strategy

Keep distinct:
- `trading_stop`: technical price stop/reassessment threshold;
- `thesis_invalidation`: fundamental/business condition proving the thesis wrong.

Position sizing:
- state risk-per-trade assumption;
- derive size from risk budget / distance to Trading Stop when possible;
- max portfolio weight;
- Initial/Add-on type.

Top 3 drivers should tie to actual upstream evidence/numbers.

### Node 5 output contract

The following shape is the canonical machine serialization. It must not force fabricated precision. Keep the decision enum and field identities exact, but a genuinely unavailable analytical subscore may be `null`; explain the gap in `full_reasoning` and reduce confidence. When evidence is materially insufficient, prefer `WATCH` over manufacturing a precise score.

Do not rename `flow` to `money_flow`, do not wrap score scalars in `{value,max}`, do not emit an out-of-enum decision such as `WAIT_FOR_ENTRY`, and do not collapse structured objects into strings.

```json
{
  "ticker": "",
  "data_period": "",
  "scores": {
    "fundamental": null,
    "valuation": null,
    "technical": null,
    "flow": null,
    "sector_macro": null,
    "risk": null
  },
  "ai_score": {"value": null, "formula_shown": ""},
  "confidence": {
    "value": null,
    "components": {
      "data_completeness": null,
      "source_quality": null,
      "cross_source_agreement": null,
      "fundamental_consistency": null,
      "technical_confirmation": null,
      "macro_clarity": null
    }
  },
  "conflict_detector": {
    "fundamental": "🟢/🟡/🔴",
    "technical": "🟢/🟡/🔴",
    "macro": "🟢/🟡/🔴",
    "liquidity": "🟢/🟡/🔴",
    "signal_alignment": "X/4",
    "alignment": "X/4",
    "override_applied": ""
  },
  "catalyst_horizon": {
    "nearest_catalyst": "",
    "bucket": "0-30d / 30-90d / 90-180d / >180d"
  },
  "decision": "BUY / HOLD / SELL / BUY ON DIP / WATCH",
  "drivers": [],
  "thesis_invalidation": "",
  "trading_stop": {"price": null, "basis": ""},
  "liquidity_note": "",
  "strategy": {
    "entry_zone": "",
    "allocation_plan": {
      "note": "",
      "steps": []
    },
    "tp1": {"price": null, "rationale": ""},
    "tp2": {"price": null, "rationale": ""},
    "risk_per_trade_pct_nav": null,
    "position_size_note": "",
    "max_portfolio_weight_pct": null,
    "position_type": "Initial / Add-on"
  },
  "localized_upstream": {},
  "full_reasoning": ""
}
```

`localized_upstream` is presentation-only and never changes scores. It is not the primary localization mechanism. Canonical Node 1–4 reader-facing prose should already be Vietnamese after the normalization stage; use `localized_upstream` only when a source/machine value cannot safely be rewritten in place.

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
