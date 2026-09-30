---
name: stockmind-crsm-methodology
description: Mandatory CRSM analytical methodology for each actionable Stockmind ticker. Replaces legacy provider/runLLM wrappers with direct ChatGPT Web research and reasoning while preserving Node1-6 contracts and current architecture.
---

# Stockmind CRSM Methodology

This skill is mandatory after `stockmind-worker-loop` selects/claims one canonical item and before `stockmind-result-contract` writes its result.

Before analyzing a ticker, read all three mandatory references:
- `references/CRSM-METHODOLOGY.md` — current analytical contract and architecture overrides.
- `references/NODE6A-LOCKED-TEMPLATE.md` — locked Visual Report DOM/CSS/template. Node 6A must populate this template; it must not invent a replacement layout.
- `references/NODE6B-FULL-REPORT.md` — full Word-ready detailed report contract. Node 6B must satisfy its detailed section/table requirements; an executive-summary substitute is invalid.

When a legacy report reference conflicts with `CRSM-METHODOLOGY.md` (for example legacy `screen_vs_crsm` comparison text), the current methodology wins semantically, but the locked visual layout remains the rendering baseline.

## Core architecture

The old browser implementation called provider APIs through `runLLM()`. Do **not** reproduce that layer.

In Stockmind Web:
- ChatGPT itself performs research/reasoning.
- Use web research for current public information required by the CRSM node.
- Use the GitHub connector only for canonical request/evidence/result state.
- Do not call a custom Stockmind MCP server.
- Do not use browser model-provider API keys.

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
  -> Node 6A Visual HTML
  -> Node 6B Detail Markdown
  -> immutable crsm-result.v1 + decision_record
```

Node 2 and Node 3 are dependency-safe siblings after Node 1. Node 6A and Node 6B are dependency-safe siblings after Node 5. They may be reasoned in parallel only when the execution surface safely supports it; sequential execution is always acceptable. Never parallelize different tickers.

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

## Result construction

After Node 6A and Node 6B are complete, build exactly one result:

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
    "node6a": "<raw HTML>",
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

Before calling the GitHub write flow:
- all `node1..node6b` outputs exist and are non-null;
- Node 2 explicitly declares technical coverage (`FULL` or `DEGRADED`) and, when degraded, names each missing mandatory capability (for example ~300-session OHLCV/SMA200 or quantified sector-vs-VNINDEX benchmark) and lowers technical confirmation/confidence rather than silently treating it as complete;
- Node 5 follows the exact current schema: fixed decision enum, scalar six-factor scores with key `flow`, structured `catalyst_horizon`, complete `conflict_detector`, complete `strategy` including allocation/position sizing fields;
- Node 6A preserves the locked template structure/visual classes and contains the required visual sections; a short free-form `<article>` is invalid;
- Node 6B contains the full detailed report sections and real peer/sensitivity/source tables; a short summary is invalid;
- node6a is raw HTML string;
- node6b is Markdown string;
- decision_record contains all 11 canonical fields;
- ticker/item/run/source identity matches request;
- no unresolved report placeholder tokens remain;
- no source-mode violation occurred;
- completed result path does not already contain different content.

If validation fails, do not fabricate/fill silently. Mark the item FAILED through the worker-loop failure policy.
