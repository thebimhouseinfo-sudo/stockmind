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

Canonical working files:
- `memo/current.json`
- `memo/runs/<run_id>/request.json`
- `memo/runs/<run_id>/status.json`
- `memo/runs/<run_id>/evidence/<TICKER>/<document_id>.json`
- `memo/runs/<run_id>/results/<TICKER>.json`

Canonical rendered files:
- `memo/render/index.json`
- `memo/render/runs/<run_id>.json`

Rendered retention is daily in `Asia/Ho_Chi_Minh`: append all completed runs from the same Vietnam calendar date; when the first completed run of a new date is published, expire the previous date's rendered run files and replace the render index with the new date.

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

## PROCESSING recovery before analysis

A PROCESSING item may already have an immutable result file if a previous invocation stopped after creating the result but before updating status.

Before rerunning CRSM for any PROCESSING item:

1. Resolve its canonical path `memo/runs/<run_id>/results/<TICKER>.json`.
2. Check whether that result file already exists.
3. If it does not exist, resume normal analysis.
4. If it exists, validate only **hard recovery invariants** against `crsm-result.v1` and the canonical request item:
   - same `run_id`;
   - same `item_id`;
   - same `ticker`;
   - same `analysis_source`;
   - expected pipeline/result versions;
   - required node outputs and decision_record present;
   - Node 5 and decision_record satisfy their machine contracts;
   - no evidence/source ownership violation.
5. Presentation drift is **not** a recovery conflict. A duplicated AI score/decision/confidence rendered differently inside Node 6A/6B, prose variation, missing optional display value, or extra renderer wrapper text must not turn an otherwise valid analysis into FAILED. Node 5 + decision_record are canonical for decision fields; the web renderer may normalize the presentation deterministically.
6. If hard invariants are valid, treat the existing immutable result as authoritative. **Do not rerun CRSM and do not regenerate the result.** Complete only the missing status/current/index transitions using the latest exact SHAs.
7. Use `RESULT_RECOVERY_CONFLICT` only when a hard invariant is broken (identity/source/version/schema corruption, missing required analytical node, invalid canonical decision record, or unsafe evidence ownership). Never use it for ordinary analytical disagreement or presentation-only drift.

This recovery rule closes the intentional write-order crash window:
`PROCESSING -> immutable result file -> status COMPLETED`.

## Write behavior

READY -> PROCESSING:
- update only the target item in `status.json`;
- derive the run state;
- update `memo/current.json` to the same run state.

Completion:
- create the working `results/<TICKER>.json` only if absent;
- then update the target status item to COMPLETED with its result_ref;
- update current state;
- when every item is COMPLETED, publish one immutable daily render snapshot at `memo/render/runs/<run_id>.json`;
- append that run to today's `memo/render/index.json`;
- reset `memo/current.json` to EMPTY;
- delete the completed run's request/status/evidence/working-result files.
- if the Vietnam calendar date changed, expire the previous date's rendered snapshots before adding the new day's first snapshot.

Failure:
- update only the target PROCESSING item to FAILED with structured error data;
- update current state;
- keep the working payload so a later invocation can retry/resume;
- do not publish a render snapshot until the run is fully COMPLETED.

Completed result files are immutable. A valid pre-existing canonical result for a PROCESSING item is recovered as described above; it must never be replaced by a newly generated analysis.
