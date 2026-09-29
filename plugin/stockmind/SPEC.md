# Stockmind Plugin / MCP SPEC

## Value Proposition

Stockmind uses ChatGPT Web as the CRSM reasoning engine while the webapp remains the deterministic Screener, Analysis List creator, status observer, and Results renderer.

The repository Memo is the only durable handoff surface between webapp and GPT. ChatGPT does not return analysis payloads for the user to copy anywhere. The plugin reads the current Memo run, processes it, writes canonical results back to the repository, and the webapp renders those repository results.

## Runtime UX

User runtime interaction is exactly:

```text
@Stockmind
```

After that invocation there is no second user command.

The plugin must continue autonomously inside the same ChatGPT turn/workflow:

```text
@Stockmind
  -> stockmind_get_current
  -> choose canonical next actionable item
  -> claim READY item
  -> read canonical request/evidence
  -> run CRSM methodology for that ticker
  -> stockmind_complete_item(result)
  -> re-read current Memo
  -> next ticker
  -> repeat until no actionable item remains
  -> return one concise completion/status summary
```

If an item cannot produce a contract-valid result, the plugin writes FAILED for that item and continues according to the pipeline failure policy. It never asks the user to choose the next ticker.

## Durable Output Ownership

The repository is authoritative.

For each completed ticker the plugin writes:

```text
runtime:memo/runs/<run_id>/results/<TICKER>.json
```

and updates:

```text
runtime:memo/runs/<run_id>/status.json
runtime:memo/current.json
runtime:memo/index.json
```

The webapp reads those records through the bounded bridge and renders:
- current ticker status
- Visual Report
- Detail Report
- canonical Decision Log
- history

The plugin does not own a separate result UI or separate result store.

## Fixed Boundary

The server hard-codes:
- owner: `thebimhouseinfo-sudo`
- repository: `stockmind`
- branch: `runtime`
- path prefix: `memo/`

No MCP tool accepts repository, branch, arbitrary path, Git command, shell input, URL, or generic GitHub operation.

## Tool Surface

Read-only:
- `stockmind_get_current`
- `stockmind_status_roundtrip`
- `stockmind_get_item_evidence`
- `stockmind_get_history`

Bounded writes:
- `stockmind_claim_item`: READY -> PROCESSING using exact status SHA
- `stockmind_fail_item`: PROCESSING -> FAILED using exact status SHA
- `stockmind_complete_item`: validate/create immutable result, then update status/current/history

Read/write is enabled by default. `STOCKMIND_MCP_WRITES_ENABLED=false` is an emergency server-side kill switch only.

## Contracts

Canonical schemas:
- `crsm-request.v1`
- `crsm-result.v1`
- `crsm-pipeline.v1`
- `stockmind-memo.v1`

Result ownership must match canonical `run_id`, `item_id`, `ticker`, and `analysis_source`.

Completed results are immutable. A repeated completion is idempotent only when the existing JSON is identical.

## Source Modes

The GPT worker must honor the request source exactly:

- `SCREENED_WEB`: use the frozen TradingView/Screener snapshot as trusted screening context plus web research.
- `EVIDENCE_WEB`: use only evidence bound to that item/ticker plus web research.
- `WEB_ONLY`: use web research without Screener snapshot or uploaded evidence.

No source mode may silently borrow another ticker's evidence or synthesize missing Screener data.

## Zero-step Admission

Whenever Stockmind is explicitly invoked:

1. Call `stockmind_get_current` before any normal reply.
2. Never ask the user to choose ticker/run/repository/branch/folder/path/provider/model/API key/output location.
3. READY item -> claim immediately using the latest status SHA.
4. PROCESSING item -> resume it.
5. After each completion/failure, re-read canonical Memo state and continue automatically.
6. Stop only when there is no actionable READY/PROCESSING item or a hard infrastructure/contract blocker prevents safe continuation.
7. Return only a concise final status summary to the user; repository results are for the webapp to render.

## Security

- GitHub token exists only in the Vercel server environment.
- Browser and plugin package contain no GitHub/model-provider secrets.
- MCP access remains hard-bounded to fixed `runtime:memo/`.
- Every mutation uses exact SHA concurrency.
- Evidence ownership and result ownership are server-validated.
- The GPT worker never receives generic GitHub write capability.
