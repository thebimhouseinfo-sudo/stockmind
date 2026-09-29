---
name: stockmind-worker-loop
description: Mandatory Stockmind sequential worker loop. Process the canonical current Analysis List item-by-item from GitHub Memo without any user interaction between items.
---

# Stockmind Worker Loop

## Selection

Use canonical GitHub Memo state only.

Priority:
1. existing PROCESSING item
2. first READY item in request/status order

Never choose a different ticker because it appears easier or more interesting.

## Loop

Repeat until no actionable item remains:

1. Read current/request/status using `stockmind-github-runtime`.
2. If item is READY, atomically update it to PROCESSING.
3. Re-read status after the write and retain the new SHA.
4. Load the item's canonical source inputs.
5. Run the installed CRSM methodology for exactly that ticker.
6. Build a contract-valid immutable result.
7. Commit result/status/current/history through GitHub.
8. Re-read current/request/status.
9. Continue automatically to the next actionable item.

Do not ask for permission between items.

## Source modes

### SCREENED_WEB
Use:
- frozen Screener/TradingView snapshot from request
- web research required by CRSM methodology

Do not recompute or silently replace Screener score/rank/grade.

### EVIDENCE_WEB
Use:
- only evidence refs bound to this exact item/ticker
- web research required by CRSM methodology

Do not use another ticker's uploaded evidence.

### WEB_ONLY
Use:
- web research required by CRSM methodology
- no invented Screener snapshot
- no uploaded evidence unless the request explicitly contains it

## Failure

If a valid result cannot be produced:
- write FAILED for that exact item with a concise structured error;
- re-read canonical state;
- continue with the next eligible item if safe.

Do not fabricate a result just to keep the loop moving.
