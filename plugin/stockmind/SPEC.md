# Stockmind Plugin / MCP SPEC

## Value Proposition

Stockmind uses ChatGPT Web as the reasoning surface for CRSM while the webapp remains the deterministic Screener, Analysis List creator, status observer and Results renderer.

The plugin removes the manual handoff between the webapp and ChatGPT. A bare Stockmind invocation immediately inspects the canonical Memo run and continues the current item without asking the user to retype tickers, choose repositories, or confirm a run command.

## Why ChatGPT

The webapp owns deterministic screening and durable workflow state. ChatGPT contributes reasoning and synthesis over the canonical request/evidence. The plugin supplies the missing bounded data/actions: inspect the current run, read canonical evidence, claim one item, and persist a validated immutable result.

## UX Flow

1. User creates/submits an Analysis List in the Stockmind webapp.
2. User invokes Stockmind in ChatGPT.
3. Admission immediately calls `stockmind_get_current`.
4. If no actionable item exists, return a concise current status.
5. If a READY/PROCESSING item exists, continue that item without a second user command.
6. PACK 6 stops at admission/connectivity. CRSM methodology execution is added in PACK 7.

No plugin UI view is required. The webapp is the visual surface; the plugin uses tools only.

## Fixed Boundary

The server hard-codes:
- owner: `thebimhouseinfo-sudo`
- repository: `stockmind`
- branch: `runtime`
- path prefix: `memo/`

No MCP tool accepts repository, branch, arbitrary path, Git command, shell input, URL, or generic GitHub operation.

## Tool Surface

Read-only tools:
- `stockmind_get_current`
- `stockmind_status_roundtrip`
- `stockmind_get_item_evidence`
- `stockmind_get_history`

Bounded write tools:
- `stockmind_claim_item`: READY -> PROCESSING with exact status SHA.
- `stockmind_fail_item`: PROCESSING -> FAILED with exact status SHA.
- `stockmind_complete_item`: create/verify one immutable result, then update status/current/history.

Write tools are implemented but disabled by default in PACK 6. They require the server-side `STOCKMIND_MCP_WRITES_ENABLED=true` gate after the private connection/auth checkpoint. The plugin package never contains GitHub credentials.

## Contracts

Canonical schemas remain:
- `crsm-request.v1`
- `crsm-result.v1`
- `crsm-pipeline.v1`
- `stockmind-memo.v1`

Result ownership must match the canonical request item's `run_id`, `item_id`, `ticker`, and `analysis_source`. Completed results are immutable. Duplicate completion is accepted only when the existing immutable JSON is identical.

## Zero-step Admission

Whenever Stockmind is explicitly invoked:
1. Call `stockmind_get_current` before responding.
2. Never ask the user to select a ticker/run when an actionable current item exists.
3. Never ask for repository, branch, folder, path, provider, model, API key or output location.
4. READY means claim next when write capability is enabled; PROCESSING means resume the same item.
5. With PACK 6 only, do not perform CRSM analysis yet. Report that the run/item is detected and ready for the CRSM worker migration in PACK 7.
6. No actionable work -> concise status only.

## Security

- GitHub token exists only in Vercel server environment.
- Browser and plugin package contain no GitHub/model-provider secrets.
- MCP writes are locked by default at PACK 6.
- Runtime client itself rejects repository/branch overrides and non-Memo paths.
- Every status mutation uses expected blob SHA.
- Evidence ownership and result ownership are validated server-side.
