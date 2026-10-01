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
- Visual Report output populated from the canonical `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE6A-LOCKED-TEMPLATE.md` on `master`
- Detail Report output satisfying the canonical `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE6B-FULL-REPORT.md` on `master`
- exactly one canonical immutable `decision_record`

Do not write a result that merely has the right top-level keys. Before completion, re-check the exact nested contract and renderer markers. If the result would be rejected by the repository validator, repair the in-memory result before attempting the canonical write; never weaken the hard identity/source/schema validator or omit report sections to make it pass.

## Hard vs soft consistency

CRSM is an evidence-driven analytical workflow, not a deterministic math proof.

**Hard invariants** must be exact:
- result/request identity and source ownership;
- schema/version shape;
- required Node outputs;
- Node 5 machine contract and fixed decision enum;
- decision_record as the canonical machine projection of Node 1 + Node 5;
- evidence isolation and immutable-result rules.

**Soft analytical/presentation consistency** must not fail an otherwise valid ticker:
- prose wording or qualitative interpretation differs slightly between nodes;
- a duplicated score/decision/confidence displayed in Node 6A/6B drifts from Node 5;
- optional display data is unavailable;
- renderer output contains harmless wrapper/preamble/trailing text.

Node 5 + decision_record are canonical for the final decision fields. Node 6A/6B are presentation layers and must copy those canonical values rather than independently recomputing them. If presentation drift is detected before the write, normalize it in memory. If it is discovered in an already-created immutable result, recover the result and let the deterministic renderer normalize presentation; do not classify it as analytical corruption.

Do not append a second browser-local decision log row.

## Chat response

After the worker loop ends, reply only with a concise summary such as:
- how many tickers completed
- how many failed
- whether the list is finished

Do not paste the full CRSM report unless the user explicitly asks to inspect it in chat.
