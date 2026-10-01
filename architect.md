# Stock Mind Architecture

This file describes the current implemented architecture.

## 1. Product shape

Stock Mind has two independent layers:

1. **Screener V2** — deterministic TradingView import, normalization, scoring, ranking and candidate selection.
2. **CRSM** — ChatGPT-driven deep research executed outside the browser against a durable GitHub Memo contract.

The browser is the job producer and result renderer. It is not an LLM runtime.

## 2. Main flow

```text
TradingView
  -> parser
  -> Screener V2
  -> Dashboard / Ranking
  -> Analysis List
  -> Vercel Memo bridge
  -> GitHub runtime:memo/

Stockmind Web plugin
  -> admission
  -> connected GitHub app
  -> claim current item
  -> CRSM methodology
  -> immutable result + decision_record
  -> next ticker
  -> daily render

Results
  -> one selected run
  -> one selected ticker
  -> Visual Report / Detail Report / Decision Log
```

Manual tickers enter Analysis List as `WEB_ONLY`. Screener-origin tickers enter as `SCREENED_WEB`. A ticker with user evidence uses `EVIDENCE_WEB`.

## 3. Core runtime files

### Browser

- `src/app.js` — top-level UI, Screener handoff, Analysis List and Results orchestration.
- `src/parser.js` — TradingView paste parser and normalization.
- `src/scoring.js` — deterministic Screener V2 entrypoint.
- `src/share-code.js` — screener-only local export/import.
- `src/crsm/context.js` — trusted SCREENED_WEB snapshot builder.
- `src/crsm/contracts.js` — CRSM request/result/source contracts.
- `src/crsm/draft-list.js` — versioned Analysis List draft.
- `src/crsm/memo-client.js` — browser client for Vercel Memo APIs.
- `src/crsm/result-adapter.js` — immutable result -> renderer adapter.
- `src/crsm/results-poller.js` — Results-visible polling lifecycle.
- `src/crsm/report-export.js` — client-side export transforms for returned reports.
- `src/crsm/user-evidence.js` — local document extraction for ticker-bound evidence.
- `src/crsm/ui/analysis-list.js` — Analysis List UI.
- `src/crsm/ui/results.js` — Results UI.

### Memo / server bridge

- `src/memo/protocol.js` — Memo paths, states, transition rules and validators.
- `api/_github-runtime.js` — server-only GitHub runtime client and allowlist.
- `api/_memo-service.js` — submit/read/retry/repair operations.
- `api/_worker-service.js` — protocol-level worker operations and deterministic tests.
- `api/crsm-*.js` — bounded Vercel endpoints consumed by the webapp.

`STOCKMIND_GITHUB_TOKEN` is server-only. No browser module may import or expose it.

### Stockmind Web plugin

Active plugin source is `plugin/stockmind-web/`.

It is **skill-only**:
- no `mcp.json`;
- no Stockmind MCP server;
- no desktop dependency;
- GitHub is accessed through the connected GitHub app;
- repository/branch/Memo boundaries are fixed by the harness.

The canonical CRSM methodology and report contracts live under:

```text
plugin/stockmind-web/skills/stockmind-crsm-methodology/
```

The repository copy on `master` is canonical for each new analysis.

## 4. Screener rules

Screener V2 is deterministic and must never depend on CRSM.

Responsibilities:
- parse TradingView data;
- validate critical inputs;
- calculate deterministic factors/axes/risk/classification/ranking;
- expose complete ranking and Dashboard groups;
- build a trusted CRSM snapshot.

User actions no longer run CRSM in-browser:
- single ticker action -> add to Analysis List;
- Dashboard multi-select -> add selected tickers to Analysis List.

CRSM must not overwrite Screener V2 score, rank, grade or classification.

## 5. CRSM source contracts

Exactly three source modes exist:

| Source | Inputs |
|---|---|
| `SCREENED_WEB` | trusted Screener snapshot + web |
| `EVIDENCE_WEB` | evidence for exactly that ticker/item + web |
| `WEB_ONLY` | web only |

Evidence ownership is `document_id + item_id + ticker`. A mismatch is invalid.

## 6. Memo contract

Canonical runtime location:

```text
branch: runtime
memo/
  current.json
  index.json
  runs/<run_id>/
    request.json
    status.json
    evidence/<ticker>/<document_id>.json
    results/<ticker>.json
  render/
    index.json
    runs/<run_id>.json
```

Item lifecycle:

```text
READY -> PROCESSING -> COMPLETED
                    -> FAILED
FAILED -> READY
```

Rules:
- one active submitted run;
- exact-SHA state transitions;
- result files are create-only/immutable;
- completed siblings are never rerun;
- interruption resumes the first unfinished item;
- failed work remains resumable;
- completed working payload is cleaned after render publication.

## 7. CRSM methodology

For each ticker the Stockmind Web plugin executes the current Node 1–6 methodology in dependency order and produces:
- canonical Node outputs;
- Node 6A locked Visual HTML report;
- Node 6B full detailed Word-ready Markdown report;
- exactly one canonical `decision_record`.

Node 2 must expose explicit `technical_coverage`; unavailable required market-history capability is reported as `DEGRADED`, not silently treated as complete.

Node 5 uses the canonical six-factor contract and approved decision enum defined by `src/crsm/contracts.js` and the plugin methodology.

The old browser `runLLM/router/provider` runtime is not part of the active architecture.

## 8. Result retention

Daily render is keyed to `Asia/Ho_Chi_Minh`:
- completed runs on the same day append to the current render set;
- the first completed run on a new day replaces the prior-day rendered set;
- Results suppresses stale prior-day render data.

Historical immutable result artifacts are not rewritten retroactively.

## 9. Share / import boundary

`.stockmind` share files contain screener rows/scores only.

They must never contain:
- GitHub credentials;
- private CRSM reports;
- Memo runtime state;
- uploaded evidence.

## 10. Development rules

1. Keep Screener V2 deterministic.
2. Keep browser code free of provider API keys and model-provider routing.
3. Keep privileged GitHub access server-side for webapp Memo APIs.
4. Keep the Stockmind Web plugin skill-only and GitHub-connector based.
5. Preserve exactly two CRSM browser pages: Analysis List and Results.
6. Preserve `SCREENED_WEB`, `EVIDENCE_WEB`, and `WEB_ONLY`.
7. Preserve ticker-bound evidence ownership.
8. Preserve exact-SHA Memo transitions and immutable completed results.
9. Preserve sequential ticker execution and resume semantics.
10. Treat the repository plugin methodology/report references as canonical.
11. Do not revive local Decision Log ownership; render the canonical `decision_record`.
12. Run `npm run check` before promotion.

## 11. Quick orientation

For future work start with:

```text
architect.md
src/app.js
src/parser.js
src/scoring.js
src/screener-v2/
src/crsm/contracts.js
src/crsm/draft-list.js
src/crsm/memo-client.js
src/crsm/result-adapter.js
src/memo/protocol.js
api/_github-runtime.js
api/_memo-service.js
plugin/stockmind-web/
```

Only expand into the exact module required by the task.
