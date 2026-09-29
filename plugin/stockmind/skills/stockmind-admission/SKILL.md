---
name: stockmind-admission
description: Mandatory entrypoint whenever Stockmind is explicitly invoked. Starts the canonical Stockmind worker loop immediately and continues through the submitted Analysis List without another user command.
---

# Stockmind admission

Use this skill whenever the user invokes Stockmind, @Stockmind, or asks Stockmind to process/check the current Analysis List.

## Mandatory first action

Call `stockmind_get_current` immediately.

Do not ask the user for:
- ticker
- run ID
- repository
- branch
- folder/path
- provider/model/API key
- output location
- confirmation to start
- confirmation to continue to the next ticker

The MCP server is authoritative for:
- repository: `thebimhouseinfo-sudo/stockmind`
- branch: `runtime`
- namespace: `memo/`

## Worker loop

Once invoked, stay in the same workflow until there is no actionable item:

1. Read canonical current state with `stockmind_get_current`.
2. If no current run exists, return a concise "no submitted Analysis List" status.
3. If next item is READY:
   - call `stockmind_claim_item` with the exact latest status SHA;
   - use the returned SHA/state for all next operations.
4. If next item is PROCESSING:
   - resume that canonical item; do not choose a different item.
5. Read item evidence with `stockmind_get_item_evidence` when the source mode requires evidence.
6. Run the CRSM methodology for exactly that ticker/source mode.
7. Build one contract-valid immutable `crsm-result.v1` result.
8. Call `stockmind_complete_item` with the latest exact status SHA.
9. Re-read `stockmind_get_current`.
10. Continue with the next READY/PROCESSING item automatically.
11. If an item cannot safely produce a valid result, call `stockmind_fail_item`, re-read current state, and continue according to failure policy.
12. Stop when no actionable item remains.

## Durable result rule

Do not treat the chat response as the analysis destination.

Canonical output is written to the repository Memo:
- `memo/runs/<run_id>/results/<TICKER>.json`
- `memo/runs/<run_id>/status.json`
- `memo/current.json`
- `memo/index.json`

The Stockmind webapp reads those records and renders Results.

The final chat reply should therefore be only a concise operational summary such as how many tickers completed/failed. Do not dump the full CRSM report into chat unless the user explicitly asks to inspect it here.

## Read/write boundary

Use only:
- `stockmind_get_current`
- `stockmind_status_roundtrip`
- `stockmind_get_item_evidence`
- `stockmind_get_history`
- `stockmind_claim_item`
- `stockmind_fail_item`
- `stockmind_complete_item`

Never attempt generic GitHub operations or writes outside the fixed Memo namespace.

Every mutation must use the exact status SHA from the latest canonical read/mutation. On SHA conflict, re-read and reconcile; never guess.

## Source isolation

- `SCREENED_WEB`: frozen Screener snapshot + web.
- `EVIDENCE_WEB`: only this item's bound evidence + web.
- `WEB_ONLY`: web only.

Never borrow evidence or screening context across tickers.

## Implementation phase rule

PACK 6 establishes this zero-step worker orchestration and bounded read/write surface.
PACK 7 supplies the CRSM analytical methodology artifacts used in step 6.
Until PACK 7 is installed, do not invent substitute CRSM analysis.
