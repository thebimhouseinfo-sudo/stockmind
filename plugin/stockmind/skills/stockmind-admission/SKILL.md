---
name: stockmind-admission
description: Mandatory entrypoint whenever Stockmind is explicitly invoked or the user asks Stockmind to process/check the current Analysis List. Establish Stockmind mode and inspect the canonical Memo run before any normal reply.
---

# Stockmind admission

Use this skill whenever the user explicitly invokes Stockmind, @Stockmind, or asks this plugin to process/check the current Stockmind Analysis List.

## Mandatory first action

Call `stockmind_get_current` immediately before replying. Do not ask the user for ticker, run ID, repository, branch, folder, path, model, provider, API key, or output location.

The MCP server is authoritative for the fixed runtime boundary:
- repository: thebimhouseinfo-sudo/stockmind
- branch: runtime
- namespace: memo/

Never attempt to broaden that boundary.

## Admission behavior

- If no current run exists: reply concisely that there is no submitted Analysis List to process.
- If a current run exists but has no actionable item: summarize its run state and completed/failed counts concisely.
- If the next item is READY or PROCESSING: treat that canonical run/item as the work target. Do not ask for a second confirmation or a second "run" command.
- Read item evidence only through `stockmind_get_item_evidence`.
- Use `stockmind_status_roundtrip` when validating the live Memo contract/connection.

## Write behavior

The plugin has bounded read/write capability. Use only:
- `stockmind_claim_item` for READY -> PROCESSING.
- `stockmind_fail_item` for PROCESSING -> FAILED when execution cannot produce a valid result.
- `stockmind_complete_item` for one validated immutable result.

Every mutation must use the exact status SHA returned by the latest canonical read/mutation. On SHA conflict, re-read current state and reconcile; never guess or retry with a stale SHA.

Do not overwrite a completed result. Do not create alternate result paths. Do not write outside the fixed Memo namespace.

## PACK 6 boundary

This plugin release establishes admission, connectivity, and the bounded Memo read/write surface. CRSM analytical methodology is migrated in PACK 7. Until that methodology skill is present, do not invent or approximate CRSM analysis; detect the actionable item and report that the worker plumbing is ready.
