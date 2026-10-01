# Stock Mind

Stock Mind is a browser-first Vietnamese stock research workflow with two layers:

1. **Deterministic Screener V2** — parse TradingView data, score and rank stocks without an LLM.
2. **CRSM** — deeper ChatGPT-driven research for tickers submitted from the webapp.

## Current flow

```text
TradingView paste
  -> Parser
  -> Screener V2
  -> Dashboard / Ranking
  -> Analysis List
  -> Vercel Memo bridge
  -> GitHub runtime:memo/

@Stockmind
  -> stockmind-web skill harness
  -> connected GitHub app
  -> current Memo run
  -> sequential CRSM analysis per ticker
  -> immutable result + decision_record
  -> daily render snapshot

Results page
  -> Visual Report
  -> Detail Report
  -> Decision Log
```

The browser does **not** execute model-provider APIs. There is no browser provider/model Settings surface and no custom Stockmind MCP server in the active architecture.

## Analysis sources

Each Analysis List item has exactly one source mode:

- **SCREENED_WEB** — trusted Screener V2 snapshot + current web research.
- **EVIDENCE_WEB** — ticker-bound uploaded evidence + current web research.
- **WEB_ONLY** — current web research only.

Uploaded evidence is bound to one `item_id/ticker`; cross-ticker evidence reuse is rejected.

## Memo runtime

Runtime state lives on the dedicated GitHub `runtime` branch under `memo/`.

The webapp uses Vercel server functions to submit/read Memo state. Privileged GitHub credentials stay server-side through `STOCKMIND_GITHUB_TOKEN`; browser code never receives that token.

The Stockmind Web plugin is different: it is a **skill-only ChatGPT plugin**. On invocation it uses the connected GitHub app directly, reads the fixed Memo location, and processes actionable tickers sequentially without a second user command.

Completed result files are immutable. Failed items remain resumable. Completed working request/status/evidence payloads are cleaned after render publication.

## Result retention

Rendered reports are day-scoped using `Asia/Ho_Chi_Minh`:

- analyses completed on the same day are appended;
- the first completed run on a new day replaces the previous day's rendered set;
- the Results page only exposes the current-day render set.

## Screener boundary

Screener V2 remains deterministic and separate from CRSM. CRSM may consume a trusted screener snapshot but must not recalculate or overwrite screener score, rank, grade, or classification.

Dashboard/Ranking actions add tickers to **Analysis List**; they do not launch browser-side CRSM execution.

## Run locally

```bash
npm run check
npm run dev
```

Then open:

```text
http://localhost:4321
```

`npm run check` runs the Screener, CRSM contract, Memo protocol/bridge, Analysis List, Results, worker-service and plugin-harness regression suites plus syntax checks.

## Project structure

```text
index.html
styles.css
src/
  app.js
  parser.js
  scoring.js
  screener-v2/
  crsm/
    context.js
    contracts.js
    draft-list.js
    memo-client.js
    result-adapter.js
    results-poller.js
    report-export.js
    user-evidence.js
    ui/
      analysis-list.js
      results.js
  memo/
api/
  _github-runtime.js
  _memo-service.js
  _worker-service.js
  crsm-*.js
plugin/
  stockmind-web/
    HARNESS-REGISTRY.md
    skills/
legacy/
  Appscript/
  CRSM/
tests/
.github/workflows/
```

`legacy/` is historical/reference material only. It is not part of the active browser CRSM runtime.

## Development principles

- Keep parser and Screener V2 deterministic.
- Keep privileged GitHub credentials out of browser code.
- Keep the active CRSM UX to exactly **Analysis List** and **Results**.
- Preserve the three source-mode contracts and ticker-bound evidence ownership.
- Keep plugin execution sequential across tickers and resumable after failure/interruption.
- Treat repository CRSM methodology/report references as canonical for the Stockmind Web plugin.
- Do not reintroduce browser provider API keys, provider routing, model discovery, custom Stockmind MCP, or local Decision Log ownership.
