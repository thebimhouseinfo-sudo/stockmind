# Stock Mind — Architecture Reference

> Fast architectural briefing. Read this before inspecting source files.
>
> `reference/` and other historical material are **reference only**. They describe old data, prompts, rules or implementations and are not runtime truth unless explicitly adopted.

## 1. Purpose

Stock Mind is a browser-first Vietnamese stock analysis system with two layers:

1. **Screening** — deterministic import, calculation, filtering and ranking.
2. **CRSM** — deep research and investment decision analysis for selected tickers.

Core principle: do cheap deterministic screening first; spend LLM/web-research cost only on selected candidates.

## 2. System flow

```text
TradingView data
      ↓
Parser
      ↓
Deterministic Screener
      ↓
Ranking / Candidate Selection
      ├──────────────→ CRSM SCREENED
      │
      └──────────────→ CRSM DIRECT (manual ticker)
                              ↓
                         CRSM Engine
                              ↓
                    Node 1 → Node 5
                              ↓
                    Node 6A / 6B / 7
                              ↓
                       Report / Decision
```

SCREENED and DIRECT use the same CRSM engine. Direct mode must remain available.

## 3. Screening architecture

The screener is deterministic and independent from CRSM.

Responsibilities:
- Parse/normalize TradingView data.
- Calculate screening metrics and composite scores.
- Rank candidates.
- Show score breakdown and data integrity.
- Build the `screeningContext` handed to CRSM.

Main files:
- `src/parser.js` — import/parser.
- `src/scoring.js` — deterministic scoring/statistics.
- `src/app.js` — application state, Ranking UI and CRSM handoff.

### Screening snapshot contract

CRSM receives the selected stock's screening result as a snapshot. CRSM must **not silently recalculate or overwrite deterministic screening scores**.

`screeningContext` includes ticker, industry, screening date, rank, grade, final score, Quality/Growth/Valuation/Micro/Momentum/Opportunity scores, available stock-level metrics, data-integrity flags, references/benchmarks and missing-field verification requests.

Missing stock metrics must be independently researched where required. Industry benchmarks are references, not substitutes for missing stock values.

## 4. Current improvement plan

### Phase A — Improve Screener **NOW**

The screener is currently an active development target. Improvements should make candidate selection more reliable and useful before deep CRSM analysis.

Focus areas:
- Improve screening data quality/integrity handling.
- Improve deterministic scoring/filtering and candidate ranking.
- Reduce ambiguity in what constitutes a high-quality CRSM candidate.
- Preserve the screening snapshot contract.
- Ensure the screener outputs the information Node 1 actually needs, avoiding duplicated research.
- Validate the full Screening → SCREENED CRSM handoff after changes.

### Phase B — Adjust Node 1 **NOW / coupled with Phase A**

Node 1 is directly coupled to the screener because it is the first CRSM research node and consumes `screeningContext`.

When improving the screener, Node 1 must be reviewed at the same time where its input contract, verification tasks, research scope or interpretation of screening results is affected.

Goal:
- Make Node 1 understand and exploit the improved screener output.
- Do not make Node 1 redo deterministic screening work.
- Use web research to verify missing/current stock facts and investigate discrepancies.
- Preserve clear separation between screening evidence and Node 1 research findings.

### Phase C — CRSM refinement

After the screener + Node 1 contract is stable:
- refine Node 2–5 research/reasoning boundaries;
- improve evidence flow and provenance;
- optimize execution/cost;
- refine reports and decision quality.

### Future — SSI phase

**SSI is future scope, not a current implementation phase.**

Do not design current work around SSI integration unless a specific change requires an explicit compatibility decision. SSI should be treated as a future data/source/integration phase and should not distract from improving the current TradingView-based screening pipeline.

## 5. CRSM pipeline

```text
userEvidence (when present)
        ↓
Node 1
        ↓
Node 2 ─────┐
            ├─ parallel stage when enabled
Node 3 ─────┘
        ↓
Node 4
        ↓
Node 5
        ↓
Node 6A → HTML report
Node 6B → Word report
Node 7  → decision log
```

Node 6A/6B/7 are local operations, not LLM nodes. Default execution is sequential; currently only Node 2 + Node 3 are explicitly parallelizable.

## 6. LLM/provider architecture

All LLM nodes use the shared abstraction:

```text
Node → runLLM() → router → provider adapter → model API
```

Nodes must not directly implement provider API calls.

Settings separates:

- **Models** — available providers, API keys, model IDs, capabilities and pricing.
- **Nodes** — provider/model assignment for each node.
- **Usage** — current-run token telemetry.
- **Cost** — historical cost, model breakdown, budget and warning threshold.

Mental model:

```text
Models = what is available
Nodes  = what each node uses
```

Current node capability requirements:

| Node | Web grounding | Structured output |
|---|---:|---:|
| 1 | required | required |
| 2 | required | required |
| 3 | not required | required |
| 4 | required | required |
| 5 | not required | required |

The router must reject incompatible models rather than silently substitute another model.

## 7. Cost / observability

Each LLM request records node, provider, model, ticker, mode, input/output tokens, estimated cost and duration.

Usage can be viewed per request, per node, per model/provider and by time period. Current cost accounting is token-based; provider-specific search/grounding charges are not automatically included.

## 8. Cache

Completed CRSM runs are cached. Cache identity distinguishes at least SCREENED/DIRECT, ticker, analysis date, relevant configuration/model fingerprint and cache version.

Runs containing new user evidence bypass the normal cache path.

Stale cached research must never be presented as fresh research.

## 9. UI / user flow

Main tabs:

```text
Screen | Dashboard | Ranking | CRSM | Reports | Settings
```

Ranking supports:
- click ticker → automatic SCREENED CRSM handoff;
- select multiple candidates → batch CRSM;
- manual search/filtering.

CRSM retains Direct mode for tickers outside the current screening dataset.

## 10. Data ownership

| Data | Owner | Rule |
|---|---|---|
| Imported TradingView rows | Screener | Source for deterministic screening |
| Screening scores/rank/grade | Screener | Immutable CRSM snapshot |
| External current research | CRSM nodes | Search/verify |
| Reasoning/interpretation | CRSM | Analyze, do not replace screener scores |
| Reports | Local nodes | Render/export |
| Model configuration | Settings | Route, not hard-code in nodes |
| Token/cost telemetry | Usage | Observability only |
| Historical/old material | `reference/` | Reference only |

## 11. Development rules

1. Keep screening deterministic, cheap and transparent.
2. Do not move deterministic screening calculations into CRSM just because an LLM can perform them.
3. CRSM receives selected stock context, not the whole screener dataset.
4. Preserve both SCREENED and DIRECT modes.
5. When screener fields change, review Node 1 because its input contract is coupled to the screener.
6. Keep provider calls behind `runLLM()` and router/provider adapters.
7. Keep model registry separate from node assignment.
8. Enforce model capabilities in the router.
9. Never silently substitute incompatible/unavailable models.
10. Treat missing stock data as a verification task, not an invitation to invent/substitute.
11. Preserve usage/cost telemetry when changing pipeline behavior.
12. Keep local report rendering independent from LLM provider selection.
13. Treat `reference/` as historical reference, not current runtime truth.
14. Prefer small changes with explicit input/output contracts.
15. Before modifying a node, inspect its upstream inputs and downstream consumers.

## 12. Quick orientation

For most future tasks, read only:

```text
architect.md
src/app.js
src/scoring.js
src/crsm/context.js
src/crsm/engine.js
src/crsm/pipeline.js
src/crsm/settings.js
src/crsm/router.js
```

Then inspect only the specific node/provider/UI files relevant to the requested change.

Do not read the entire repository or historical/reference material unless the task specifically requires it.
