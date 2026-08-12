# Stock Mind

Stock Mind is a browser-first Vietnamese stock analysis system with two layers:

1. **Deterministic Screening** — parse TradingView data, calculate scores, rank stocks.
2. **CRSM (Capital Research & Strategy Machine)** — deep research and investment decision analysis for a selected ticker.

## Core flow

```text
TradingView paste
      ↓
Parser
      ↓
Deterministic Scoring
      ↓
Ranking / candidate selection
      ↓
┌───────────────────────────────┐
│ SCREENED → CRSM               │
│ automatic handoff from ranking│
└───────────────┬───────────────┘
                ↓
        Node 1 → Node 5
                ↓
       Local Node 6A/6B/7
```

CRSM also has a separate **DIRECT** entry point for a ticker that is not in the current screener dataset.

## SCREENED vs DIRECT

### SCREENED
Clicking a ranked stock automatically opens CRSM with:

- ticker
- screening score/rank/grade
- quality, growth, valuation, micro, momentum and mispricing scores
- source/industry metrics used by the screening layer

This lets CRSM compare its deep-research conclusion against the deterministic screening result.

### DIRECT
From the CRSM tab, enter any HOSE/HNX/UPCOM ticker manually. DIRECT analysis does not require a screening context.

Both modes use the **same CRSM engine and nodes**.

## CRSM model routing

Settings are organized into four control-center tabs:

- **Models** — providers, API keys, model list, capabilities and token pricing.
- **Nodes** — provider/model assignment for Node 1–5.
- **Usage** — input/output/total tokens for the current run.
- **Cost** — current run, historical periods, average cost, cost by model, budget and warning threshold.

Node requirements are capability-aware. Web-grounded nodes are blocked if the assigned model does not declare the required capability.

## Cost accounting

Each LLM response records:

- provider
- model
- node
- ticker/mode
- input tokens
- output tokens
- duration
- estimated input/output token cost

Usage history is retained in browser storage for monitoring. The cost monitor supports Today, 7 days, 30 days and All-time views.

**Important:** token-based cost does not yet include provider-specific grounding/search charges. Those are tracked as a future accounting item and should not be assumed to be zero.

## Cache

Completed CRSM runs are cached by:

- SCREENED vs DIRECT mode
- ticker
- analysis date
- model assignment/capability/pricing configuration fingerprint
- cache version

Changing the relevant CRSM configuration therefore moves the run into a new cache namespace.

## Run locally

```bash
npm run check
npm run dev
```

Then open:

```text
http://localhost:4321
```

`npm run check` rebuilds generated prompts and runs the core parser/scoring regression tests.

## Project structure

```text
index.html
styles.css
settings.css
src/
  app.js
  parser.js
  scoring.js
  sample.js
  crsm/
    engine.js
    pipeline.js
    state.js
    context.js
    cache.js
    llm.js
    router.js
    usage.js
    settings.js
    nodes/
    providers/
    prompts/
    ui/
legacy/
  Appscript/       historical reference
  CRSM/            prompt source/history
 tests/
  core.test.mjs
.github/workflows/
  check.yml
```

## Development principles

- Keep parser and scoring deterministic.
- Keep CRSM isolated from the screener core.
- Nodes call the shared `runLLM()` layer instead of provider SDKs directly.
- Do not let CRSM silently replace an invalid model assignment with another model.
- Keep DIRECT analysis available even when no screening dataset is loaded.
- Treat `legacy/` as historical/reference material, not runtime dependencies.
