---
name: stockmind-result-contract
description: Mandatory Stockmind durable-output contract. CRSM analysis is complete only after a valid immutable result and matching status/current/history updates have been written to the canonical GitHub Memo.
---

# Stockmind Result Contract

## Durable destination

The analysis destination is GitHub, not the chat response.

For each completed ticker write:
`memo/runs/<run_id>/results/<TICKER>.json`

Then update the canonical status/current flow. When the full run reaches COMPLETED, the server publishes the current-day render snapshot/index and removes completed working payloads according to the current daily-retention contract.

The Stockmind webapp renders the published daily snapshot, not an ad-hoc chat summary.

## Identity

A result must match the canonical request item:
- `run_id`
- `item_id`
- `ticker`
- `analysis_source`
- request/result/pipeline schema versions

Never transplant a result between items or runs.

## Required result shape

Use the repository's canonical `crsm-result.v1` contract.

It must contain:
- Node outputs required by the current CRSM pipeline, including strict Node 2 technical coverage and exact Node 5 schema
- Visual Report output populated from `NODE6A-LOCKED-TEMPLATE.md`
- Detail Report output satisfying `NODE6B-FULL-REPORT.md`
- exactly one canonical immutable `decision_record`

Do not write a result that merely has the right top-level keys. Before completion, re-check the exact nested contract and renderer markers. If the result would be rejected by the repository validator, repair the in-memory result before attempting the canonical write; never weaken the validator or omit report sections to make it pass.

Do not append a second browser-local decision log row.

## Chat response

After the worker loop ends, reply only with a concise summary such as:
- how many tickers completed
- how many failed
- whether the list is finished

Do not paste the full CRSM report unless the user explicitly asks to inspect it in chat.
