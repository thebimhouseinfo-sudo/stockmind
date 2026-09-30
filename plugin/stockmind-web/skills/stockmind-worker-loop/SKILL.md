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
4. For every PROCESSING item, run the **existing-result recovery check** from `stockmind-github-runtime` before any analysis:
   - if a valid canonical immutable result already exists, do not rerun CRSM; finish the missing COMPLETED/current/index transitions from that result;
   - if no result exists, continue normally;
   - if a conflicting/invalid result exists, never overwrite it and apply the recovery-conflict failure/blocker rule.
5. Load the item's canonical source inputs only when analysis is still required.
6. Load and execute `stockmind-crsm-methodology` for exactly that ticker.
7. Build a contract-valid immutable result using the methodology outputs and `stockmind-result-contract`.
8. Commit the working result/status/current through GitHub. When the full run completes, publish the current-day render snapshot/index and clean the completed working payload.
9. Re-read current/request/status.
10. Continue automatically to the next actionable item.

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
