# Stock Mind — Architecture Reference

> This file is the **fast architectural briefing** for the project. Read this before inspecting individual source files.
>
> The `reference/` / historical material is **reference only**. It is not part of the runtime architecture and must not be treated as the current implementation unless explicitly stated.

## 1. Project purpose

Stock Mind is a browser-first Vietnamese stock analysis application with two deliberately separated layers:

1. **Screening layer** — deterministic processing of imported TradingView data. It calculates scores, ranks stocks and identifies candidates.
2. **CRSM layer** — deep research and investment decision analysis for a selected ticker.

The architectural goal is to avoid sending the entire screener dataset to an LLM. The screener performs cheap deterministic filtering first; CRSM spends LLM/web-research cost only on selected candidates.

## 2. High-level flow

```text
TradingView Screener
        │
        │ paste/import
        ▼
    Parser
        │
        ▼
Deterministic Scoring
        │
        ▼
 Ranking / Candidate Selection
        │
        ├─────────────── DIRECT ───────────────┐
        │                                       │
        ▼                                       ▼
 SCREENED → CRSM                         CRSM Direct Input
        │                                       │
        └───────────────┬───────────────────────┘
                        ▼
                  CRSM Engine
                        │
                  Pipeline / Router
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
     Research nodes               Local nodes
     Node 1 → Node 5              Node 6A / 6B / 7
          │                           │
          └─────────────┬─────────────┘
                        ▼
                 CRSM Report / Decision
```

## 3. Screening layer

### Responsibility

The screening layer is deterministic and must remain independent from CRSM.

Main responsibilities:

- Parse pasted TradingView screener data.
- Normalize the imported rows.
- Calculate screening metrics and composite scores.
- Rank candidates.
- Display the ranking and score breakdown.
- Provide the candidate context to CRSM when a ticker is selected.

Relevant current modules:

- `src/parser.js` — TradingView/import parsing.
- `src/scoring.js` — deterministic scoring, statistics and prompt-related helpers.
- `src/app.js` — application state, screen/ranking UI and CRSM handoff.

### Important rule

The screening result is an **input/snapshot for CRSM**, not something CRSM should silently recalculate or overwrite.

## 4. SCREENED and DIRECT CRSM modes

### SCREENED mode

Triggered when the user clicks a ticker from the ranking or selects one/multiple ranked tickers for CRSM.

The screener creates a `screeningContext` containing:

- ticker
- industry
- screening date
- final screening score
- rank
- grade
- quality score
- growth score
- valuation score
- micro score
- momentum score
- opportunity/mispricing score
- stock-level metrics actually present in the screener
- data coverage/integrity flags
- references and industry benchmarks
- a verification request for missing metrics

Node 1 must treat the screening scores as an immutable snapshot.

Missing stock-level metrics must be independently researched/verified where required. Industry benchmarks are references, not substitutes for missing stock data.

### DIRECT mode

Allows the user to enter any ticker manually from the CRSM interface.

DIRECT mode has no screening context and uses the same CRSM engine/pipeline as SCREENED mode.

**Both modes are first-class paths. Do not remove DIRECT when improving automatic SCREENED handoff.**

## 5. CRSM architecture

Current CRSM modules live under `src/crsm/`.

```text
src/crsm/
├── engine.js          # public run lifecycle / state / cache handling
├── pipeline.js        # node ordering and execution
├── state.js           # reactive CRSM runtime state
├── context.js         # screener → CRSM context adapter
├── cache.js           # completed-run cache
├── llm.js             # shared LLM execution + retry + usage recording
├── router.js          # node requirements + provider/model resolution
├── usage.js           # token/cost accounting and history
├── settings.js        # providers, models, assignments, pricing, budget
├── retry.js           # retry helpers
├── user-evidence.js   # optional user-supplied evidence
├── report-export.js   # report export
├── nodes/             # Node 1–7 implementations
├── providers/         # provider adapters
├── prompts/           # CRSM prompt sources
└── ui/                # CRSM UI and Settings UI
```

## 6. Node pipeline

Current pipeline order:

```text
userEvidence (when present)
        ↓
Node 1
        ↓
Node 2 ─────┐
            ├── parallel stage when enabled
Node 3 ─────┘
        ↓
Node 4
        ↓
Node 5
        ↓
Node 6A   → HTML report
Node 6B   → Word report
Node 7    → decision log
```

Node 6A, 6B and 7 are local pipeline operations; they are not LLM nodes.

### Execution policy

Default execution mode is sequential.

A parallel mode exists, but parallelism is dependency-aware and explicitly controlled by `pipeline.js`. The current parallel stage is Node 2 + Node 3. Do not assume that enabling Parallel means all nodes run concurrently.

## 7. LLM abstraction

All LLM nodes should call the shared `runLLM()` layer.

```text
Node
 ↓
runLLM()
 ↓
router.resolveProviderModel()
 ↓
provider adapter
 ↓
model API
```

Nodes must not directly depend on provider-specific SDK/API implementations.

This separation allows provider/model changes from Settings without rewriting node logic.

## 8. Model/provider architecture

The system separates:

### Provider/model registry

Configured in **Settings → Models**:

- API provider
- API key
- model ID
- display name
- capabilities
- token pricing
- built-in vs user-declared model

### Node assignment

Configured in **Settings → Nodes**:

- provider assigned to each node
- model assigned to each node
- enabled/disabled state

Therefore:

```text
Models = what models are available
Nodes  = which model each node uses
```

Do not mix these two responsibilities in UI or code.

## 9. Model capabilities

The router validates model capability before making an API call.

Current node requirements:

| Node | Web grounding | Structured output |
|---|---:|---:|
| Node 1 | Required | Required |
| Node 2 | Required | Required |
| Node 3 | Not required | Required |
| Node 4 | Required | Required |
| Node 5 | Not required | Required |

The capability requirement belongs to the node/router contract. A model that does not satisfy the requirement must be rejected rather than silently replaced by another model.

## 10. Gemini web-grounding rule

Gemini provider integration uses Google Search grounding when the resolved node/model requires web grounding.

When web grounding is enabled, the Gemini API request does not request `responseMimeType: application/json`, because the current Gemini API combination of JSON MIME mode and Google Search grounding is intentionally avoided.

The CRSM layer remains responsible for validating/parsing the returned structured content.

## 11. Cost and usage architecture

Every LLM request records:

- node
- provider
- model
- ticker
- SCREENED/DIRECT mode
- input tokens
- output tokens
- estimated input cost
- estimated output cost
- total cost
- duration
- timestamps

Usage is available at two levels:

```text
Current run
    ├── per request
    └── per node

Historical usage
    ├── per provider/model
    ├── period totals
    └── monthly budget monitoring
```

Current Settings tabs:

- **Models** — provider/model configuration.
- **Nodes** — node assignments.
- **Usage** — current-run token measurements.
- **Cost** — historical cost, budget and warning threshold.

### Important accounting limitation

Current cost calculation is token-based. Provider-specific search/grounding charges are not yet included automatically. Never assume the displayed token cost is the complete provider bill.

## 12. Cache

Completed CRSM runs are cached to avoid unnecessary repeat analysis.

Cache identity distinguishes at least:

- SCREENED vs DIRECT
- ticker
- analysis date
- relevant model/configuration fingerprint
- cache version

A run with user evidence bypasses the normal cache path.

When changing cache behavior, preserve the rule that stale analysis must not be presented as a fresh research result.

## 13. User evidence

CRSM can receive pending user-supplied evidence.

When user evidence is present:

- the pipeline can start from the evidence preparation stage;
- the evidence is attached to the CRSM context/output flow;
- normal cached results should not silently override the new evidence.

Treat user evidence as an explicit input, not as persistent global stock data.

## 14. UI architecture

The main application currently exposes:

```text
Screen
Dashboard
Ranking
CRSM
Reports
Settings
```

### Ranking → CRSM handoff

Clicking a ticker in Ranking launches SCREENED CRSM automatically.

Batch selection is also supported: select several ranked tickers and run CRSM sequentially for the selected queue.

### CRSM Direct

The CRSM screen retains a manual ticker input so the user can analyze a ticker that is not present in the imported screening dataset.

### Reports

After a successful CRSM run, the application can display/export the local Node 6A report and Node 6B Word output.

## 15. Settings design principle

Settings should remain compact and operational rather than becoming a second application.

The intended mental model is:

```text
Models
  ↓ available capabilities/pricing
Nodes
  ↓ assignments
Pipeline
  ↓ execution
Usage / Cost
  ↓ observability
```

Future UI changes should preserve this separation.

## 16. Data ownership rules

| Data | Owner | CRSM behavior |
|---|---|---|
| TradingView imported rows | Screening layer | Consume selected stock context only |
| Deterministic scores | Screening layer | Treat as snapshot |
| Screening rank/grade | Screening layer | Treat as snapshot |
| External research | CRSM research nodes | Search/verify |
| Reasoning/interpretation | CRSM reasoning nodes | Analyze |
| HTML/Word rendering | Local nodes | Render only |
| Decision log | Local Node 7 | Record final reasoning/decision state |
| Model configuration | Settings | Route, do not hard-code in nodes |
| Token/cost telemetry | Usage layer | Observe, never change analysis result |

## 17. Reference material

Historical source material may exist under `reference/` or other explicitly marked historical folders.

**Reference material means historical context, examples, old prompts, previous implementations or source data.**

It is useful when:

- recovering an old rule;
- comparing a previous implementation;
- understanding why a current design exists;
- migrating an old prompt/data format.

It is **not** automatically authoritative for the current architecture and must not be imported as a runtime dependency without an explicit decision.

## 18. Development rules

1. Keep screening deterministic and cheap.
2. Do not move screening calculations into CRSM merely because an LLM can perform them.
3. CRSM should receive the selected stock context, not the entire screener dataset.
4. Preserve both SCREENED and DIRECT modes.
5. Keep provider calls behind `runLLM()` and provider adapters.
6. Keep model availability separate from node assignment.
7. Enforce capability requirements in the router.
8. Never silently substitute an incompatible/unavailable model.
9. Treat missing stock metrics as a verification problem, not an invitation to invent/substitute values.
10. Keep local report rendering independent from LLM provider selection.
11. Preserve usage/cost observability when changing the pipeline.
12. Treat historical/reference material as reference, not current runtime truth.
13. Prefer small, isolated changes that preserve the current pipeline contracts.
14. Before changing a node, inspect its input/output contract and downstream consumers.

## 19. Current architectural priorities

When extending Stock Mind, prioritize in this order:

### P0 — Correctness

- Screening → CRSM handoff must preserve the screening snapshot.
- SCREENED and DIRECT must both work.
- Node dependencies and outputs must remain valid.
- Model capability validation must remain enforced.

### P1 — Research quality

- Clearly separate web research from reasoning.
- Avoid duplicate work between screener and CRSM.
- Verify missing data from external sources.
- Keep evidence provenance visible where appropriate.

### P2 — Cost efficiency

- Only deeply analyze selected candidates.
- Reuse valid cached analysis.
- Use parallel execution only where dependencies allow it.
- Measure tokens and cost per node.

### P3 — UX

- Keep Settings understandable.
- Make the Ranking → CRSM handoff obvious.
- Keep Direct analysis accessible.
- Make cost/usage information useful without overwhelming the main analysis UI.

## 20. Quick orientation for future development

Before modifying code, read only these files first:

```text
architect.md
src/app.js
src/scoring.js
src/crsm/engine.js
src/crsm/pipeline.js
src/crsm/context.js
src/crsm/settings.js
src/crsm/router.js
```

Then inspect the specific node/provider/UI file related to the requested change.

Do **not** start by reading the entire repository or historical/reference material unless the requested change specifically requires it.
