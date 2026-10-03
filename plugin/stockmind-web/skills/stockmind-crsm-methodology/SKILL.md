---
name: stockmind-crsm-methodology
description: Mandatory CRSM analytical methodology for each actionable Stockmind ticker. Replaces legacy provider/runLLM wrappers with direct ChatGPT Web research and reasoning while preserving Node1-6 contracts and current architecture.
---

# Stockmind CRSM Methodology

This skill is mandatory after `stockmind-worker-loop` selects/claims one canonical item and before `stockmind-result-contract` writes its result.

Before analyzing a ticker, read the canonical references from the Stockmind repository `thebimhouseinfo-sudo/stockmind` on `master` via the connected GitHub app:
- `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/CRSM-METHODOLOGY.md` — current analytical contract and architecture overrides.
- `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/SECTOR-PROFILES.md` — canonical Node 1 sector/materiality router and KPI/valuation method classes.
- `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE2-MARKET-CONTEXT.md` — canonical Vietnam market-internals/benchmark/coverage contract for Node 2.
- `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE3-EXPECTATION-VALUATION.md` — sector-adaptive economics/valuation and typed expectation provenance for Node 3.
- `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE4-CAUSAL-DELTA.md` — exposure-first external-driver delta and Node 2 consumption boundary for Node 4.
- `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE6B-FULL-REPORT.md` — Word-ready detailed report contract and depth standard.

The webapp owns the visual Node 6A HTML through its deterministic renderer. The model must not spend reasoning budget reproducing template HTML. Legacy `outputs.node6a` may exist in old results, but new analysis does not need to generate it.

The repository copy is canonical. Do not rely on an older packaged reference if it differs from `master`.

When a legacy report reference conflicts with `CRSM-METHODOLOGY.md`, the current methodology wins. Visual layout is a web-renderer concern, not an analytical-model task.

## Core architecture

The old browser implementation called provider APIs through `runLLM()`. Do **not** reproduce that layer.

In Stockmind Web:
- ChatGPT itself performs research/reasoning.
- Use web research for current public information required by the CRSM node.
- Use the GitHub connector only for canonical request/evidence/result state.
- Do not call a custom Stockmind MCP server.
- Do not use browser model-provider API keys.

## Frontier analyst mode — reason first, serialize second

The schema is a storage contract, not the reasoning process. For every ticker:
1. Build an evidence ledger first: what is known, what is uncertain, what conflicts, and which facts materially move the thesis.
2. Form a provisional investment thesis and an explicit anti-thesis. Actively search for evidence that could invalidate the provisional view.
3. Trace the business mechanism: driver → revenue/margin/cash flow/balance sheet → valuation → price implication. Do not stop at generic macro commentary.
4. Distinguish what is company-specific from what is merely sector/market beta.
5. Quantify whenever the evidence supports it, but never invent a number to satisfy a field.
6. Only after the analytical synthesis is complete, serialize the result into Node contracts.

A strong model is expected to add judgment, prioritization and causal synthesis — not merely restate source facts. Prefer a smaller number of material insights with evidence and implications over a long checklist of generic observations.

### Reader-language rule

All reader-facing prose must be natural Vietnamese. English is allowed only for unavoidable proper nouns, source titles, tickers, fixed machine enums, formulas and standard finance abbreviations such as EBITDA, DCF, WACC, ROIC, FCF, VSA, SMA200. Do not alternate English/Vietnamese headings or repeat the same point in both languages.

### Mandatory Vietnamese normalization pass

After Node 5 is complete and **before** Node 6B/result construction, scan every reader-facing string leaf in `node1..node5`. Rewrite any English sentence or mixed English-Vietnamese prose into natural Vietnamese while preserving:
- all numeric values, percentages, dates, prices and units;
- tickers, company/product names and source titles;
- machine enums such as `FULL`, `DEGRADED`, `BUY`, `HOLD`, `SELL`, `BUY ON DIP`, `WATCH`;
- standard finance/technical abbreviations and formulas.

This is a semantic rewrite, not a literal word-replacement pass. A field such as `macro_view`, `industry_impact`, `company_impact`, `risk_regime`, `catalyst_horizon.nearest_catalyst`, `trading_stop.basis`, TP rationales, scenario conditions, technical notes, VSA notes, risk notes or causal-chain text must not remain as a full English sentence merely because the renderer can display it.

Do not rely on `localized_upstream` as an escape hatch. Prefer storing Vietnamese directly in the canonical Node fields. Use `localized_upstream` only for compatibility when an upstream machine/source value cannot be rewritten safely.

Before write, re-read Node 2–5 prose once specifically for language consistency. If a reader-facing sentence is still English or awkwardly code-switched, repair it in memory before creating the immutable result.

## Per-ticker dependency graph

Strict cross-ticker rule: finish or fail the current ticker before selecting another ticker.

Within one ticker:

```text
canonical request/evidence
  -> Node 1 Financial Data Verification
  -> Node 2 Technical & VSA
  -> Node 3 Deep Fundamentals & Valuation
  -> Node 4 Macro & Causal
  -> Node 5 CIO Decision
  -> Vietnamese normalization pass across Node 1–5
  -> Node 6B Detail Markdown
  -> immutable crsm-result.v1 + decision_record
  -> deterministic web Visual Report from Node 1–5
```

Node 2 and Node 3 are dependency-safe siblings after Node 1. Node 6B is written only after Node 5 is complete. The webapp deterministically renders the visual report from Node 1–5. Never parallelize different tickers.

## Source isolation

### SCREENED_WEB
- Preserve `screening_context` exactly as the trusted user-provided Screener/TradingView snapshot.
- Do not recompute, correct, overwrite, or re-rank its score/rank/grade.
- Use it to direct missing-data/anomaly research only.
- Screener V2 is candidate-selection context, **not** a scoring benchmark for CRSM.
- Do not create `screen_vs_crsm`, score differences, CONFIRMED/PARTIAL/DIVERGENT labels, or mix Screener score into AI Score.

### EVIDENCE_WEB
- No screening context.
- Read only evidence refs belonging to this exact `run_id/item_id/ticker`.
- Treat uploaded evidence as user-supplied evidence, preserve provenance, and reconcile conflicts explicitly.
- Still use web research where CRSM requires current/external facts.

### WEB_ONLY
- No screening context and no uploaded evidence.
- Perform full CRSM web research.
- Never synthesize a missing Screener snapshot.

## Node 1 sector/materiality routing

Before Node 1 searches broadly:
1. classify the ticker into one canonical `sector_profile` from `SECTOR-PROFILES.md`; use `GENERIC` only with an explicit reason;
2. collect the universal core;
3. collect only the sector-pack KPI evidence material to that profile;
4. create `material_questions[]` for thesis-changing uncertainties and triggered investigations;
5. record source tier/freshness and capital-allocation evidence when material.

This router controls **what evidence Node 1 seeks**. It does not score the company and does not force Node 3 to run every listed valuation method. `market_data.foreign_net_flow_20d` is ticker-specific; do not put broad-market foreign flow there.

## Node 2 Vietnam market-context routing

Node 2 measures **both the stock and the market around it**. Read `NODE2-MARKET-CONTEXT.md` before technical analysis.

Always attempt a VN-Index baseline and a relevant secondary comparison (VN30/HNXINDEX/UPCOMINDEX, reliable sector index, or named peer basket). Measure breadth, turnover/liquidity, leadership/rotation, volatility, broad-market foreign flow and stock relative strength when public evidence is available.

Keep ownership strict:
- Node 1 `foreign_net_flow_20d` = ticker-specific flow.
- Node 2 `market_context.market_foreign_flow` = broad-market flow.
- Node 2 measures market internals; Node 4 later interprets macro/policy causes.
- Missing public market data produces `DEGRADED` coverage, never invented values.
- VSA/Wyckoff/smart-money labels are optional and evidence-gated.

## Node 3 expectation/valuation routing

Read `NODE3-EXPECTATION-VALUATION.md`. Node 3 selects valuation methods from `node1.sector_profile` and actual business economics; Piotroski/Beneish/full DCF are conditional, not ritual requirements.

Any statement about consensus, guidance, what is priced, or a variant view must be recorded in `expectation_basis[]` with one of `OBSERVED_CONSENSUS | COMPANY_GUIDANCE | VALUATION_IMPLIED | PRICE_ACTION_INFERENCE`. Observed consensus/guidance need dated sources. Inferred bases must be explicitly labelled `INFERENCE` and must not masquerade as observed market consensus.

## Node 4 causal-delta routing

Read `NODE4-CAUSAL-DELTA.md`. Start from the company's material exposures, not a fixed Fed/DXY/oil/GDP checklist. Add `what_changed[]` only for drivers with a credible company transmission path and preserve FACT/INFERENCE/ASSUMPTION separation.

Node 4 may interpret available Node 2 `market_context` through `market_context_use`, but it must use `source: NODE2.market_context`, `measurement_policy: CONSUME_ONLY`, and must not remeasure breadth, turnover, leadership, volatility, market foreign flow, index returns or relative strength.

## Missing data

Never invent a number to satisfy a schema.
- JSON internal missing value: `null`
- Visual HTML missing display: `Data not available`
- Detail Markdown missing display: `Chưa có dữ liệu`

A searched-but-unverified field stays null and must be reflected in confidence/data completeness.

## Research discipline

Prefer:
1. HOSE/HNX/SSC/company filings and IR for company facts.
2. SSI/VNDirect/trusted Vietnamese market data providers.
3. Latest audited/quarterly financial reports.
4. Reuters/Bloomberg/reputable business press for current macro/corporate events.

Every externally collected fact should retain source/date when available. Current macro/event research must use the current run date and Node 4 freshness rules.

## Current architecture override

Legacy prompt text may still mention comparing Screener score to CRSM score. Ignore that legacy text.

The current source architecture explicitly requires:
- six-factor CRSM score only;
- Screener score/rank/grade never changes weights or decision;
- no `screen_vs_crsm` object.

## Strict output shape reminder

Node 2 must include `technical_coverage` with `status: FULL|DEGRADED`. New analysis should use `coverage_model: CAPABILITY_BASED_V1` and declare only the indicators actually required, with verified history per indicator; legacy `required_sessions: 300` remains readable. Node 2 should also include additive-v1 `market_context` using the canonical capabilities from `NODE2-MARKET-CONTEXT.md`. If breadth, benchmark, market foreign flow or another public-market capability cannot be verified, mark `market_context.coverage` as `DEGRADED` and name the gap instead of fabricating data.

Node 5 must use only decisions `BUY | HOLD | SELL | BUY ON DIP | WATCH`. Its six factor scores are scalar 0–20 fields named exactly `fundamental, valuation, technical, flow, sector_macro, risk`. `catalyst_horizon` is an object, `thesis_invalidation` is one non-empty string, and `strategy` must contain `entry_zone, allocation_plan, tp1, tp2, risk_per_trade_pct_nav, position_size_note, max_portfolio_weight_pct, position_type`.

## Result construction

After Node 5 and the detailed Node 6B report are complete, build exactly one result:

```json
{
  "result_version": "crsm-result.v1",
  "pipeline_version": "crsm-pipeline.v1",
  "run_id": "<canonical>",
  "item_id": "<canonical>",
  "ticker": "<canonical>",
  "analysis_source": "SCREENED_WEB | EVIDENCE_WEB | WEB_ONLY",
  "outputs": {
    "node1": {},
    "node2": {},
    "node3": {},
    "node4": {},
    "node5": {},
    "node6b": "<Markdown>"
  },
  "decision_record": {}
}
```

The result identity/source must match the canonical request item exactly.

Build `decision_record` from Node 1 + Node 5 only:
- date: current analysis date DD/MM/YYYY
- ticker
- price_at_analysis: `node1.market_data.price.value`
- decision: `node5.decision`
- ai_score: `node5.ai_score.value`
- confidence: `node5.confidence.value`
- entry_zone: `node5.strategy.entry_zone`
- trading_stop: `node5.trading_stop.price`
- tp1: price scalar from `node5.strategy.tp1.price` when object, otherwise its scalar value
- tp2: price scalar from `node5.strategy.tp2.price` when object, otherwise its scalar value
- thesis_invalidation: `node5.thesis_invalidation`

Do not run or emulate legacy Node7 localStorage append behavior.

## Validation gate before GitHub write

Use two validation levels.

### HARD — may fail the item

Before calling the GitHub write flow:
- `node1..node5` outputs exist and are non-null;
- Node 2 explicitly declares technical coverage (`FULL` or `DEGRADED`) and, when degraded, names each missing mandatory capability instead of silently treating it as complete;
- Node 5 preserves its canonical machine identity and decision enum. Missing analytical inputs may remain null and must lower confidence or route to WATCH rather than being fabricated;
- Node 1–5 reader-facing prose has completed the mandatory Vietnamese normalization pass; remaining English is limited to allowed proper nouns, source titles, enums, formulas and standard abbreviations;
- Node 6B should be a substantive Vietnamese Markdown report, but presentation defects are soft and recoverable;
- decision_record contains all 11 canonical fields and is derived from Node 1 + Node 5;
- ticker/item/run/source identity matches request;
- no source-mode/evidence ownership violation occurred;
- completed result path does not already contain content for another hard identity.

A hard failure must not be fabricated away. Mark that exact item FAILED and continue safely.

### SOFT — repair/normalize, do not fail the item

Analytical work is not expected to have one mathematically unique answer. Do **not** fail merely because:
- prose or qualitative interpretation differs slightly across nodes;
- Node 6B accidentally repeats an AI score, decision, confidence, target, or other headline differently from Node 5;
- optional display data is missing;
- a report heading/table is missing or imperfect.

Node 5 is the canonical final decision stage. `decision_record` is its deterministic machine projection. Node 6B is a narrative report only and must copy canonical decision fields from Node 5 rather than recomputing them. The webapp owns Node 6A presentation deterministically from Node 1–5.

The goal of validation is to prevent broken identity, unsafe evidence mixing, malformed machine contracts, or unusable reports — not to force subjective analytical prose to have a single exact answer.
