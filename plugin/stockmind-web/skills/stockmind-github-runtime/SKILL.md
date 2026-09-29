---
name: stockmind-github-runtime
description: Mandatory Stockmind GitHub I/O boundary. Read and write only the canonical Stockmind runtime Memo through the connected GitHub plugin; never use a custom MCP server or arbitrary repository/path access.
---

# Stockmind GitHub Runtime

## Required connector

Use the connected **GitHub plugin** for all durable Stockmind Memo reads and writes.

Do not use:
- a Stockmind MCP server
- browser localStorage as canonical state
- Vercel as the plugin's durable job store
- arbitrary web fetches to mutate GitHub
- unrelated repositories

If the GitHub plugin is unavailable, stop and state that Stockmind cannot access its canonical Memo.

## Fixed repository boundary

Repository:
`thebimhouseinfo-sudo/stockmind`

Branch:
`runtime`

Allowed namespace:
`memo/`

Canonical files:
- `memo/current.json`
- `memo/index.json`
- `memo/runs/<run_id>/request.json`
- `memo/runs/<run_id>/status.json`
- `memo/runs/<run_id>/evidence/<TICKER>/<document_id>.json`
- `memo/runs/<run_id>/results/<TICKER>.json`

Never read/write Stockmind runtime state from another branch or namespace.

## Concurrency

Before every mutation, read the exact current target blob SHA from GitHub.

Use exact-SHA update semantics. On conflict:
1. re-read canonical files;
2. reconcile state;
3. continue only if the requested transition is still valid.

Never blindly retry a stale write.

## Read behavior

On admission:
1. read `memo/current.json`;
2. if there is a run, read that run's `request.json` and `status.json`;
3. identify the first PROCESSING item, otherwise the first READY item;
4. load evidence only from that item's canonical evidence refs.

## Write behavior

READY -> PROCESSING:
- update only the target item in `status.json`;
- derive the run state;
- update `memo/current.json` to the same run state.

Completion:
- create `results/<TICKER>.json` only if absent;
- then update the target status item to COMPLETED with its result_ref;
- update current state;
- if the run is terminal, upsert one terminal summary into `memo/index.json`.

Failure:
- update only the target PROCESSING item to FAILED with structured error data;
- update current state;
- if the run becomes terminal, update history.

Completed result files are immutable. A pre-existing result may be accepted only if byte/JSON-equivalent to the result being committed.
