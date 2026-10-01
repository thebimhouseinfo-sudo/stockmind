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
- Node 1–5 outputs required by the current CRSM pipeline, including explicit Node 2 technical coverage and canonical Node 5 machine identity
- Detail Report output following the canonical `plugin/stockmind-web/skills/stockmind-crsm-methodology/references/NODE6B-FULL-REPORT.md` quality standard when available
- exactly one canonical immutable `decision_record`

The Visual Report HTML is not model-owned result content. The webapp deterministically renders it from Node 1–5. Legacy results may still contain `outputs.node6a`, but it is compatibility data only.

Do not write a result that merely has the right top-level keys. Before completion, re-check the exact nested contract and renderer markers. If the result would be rejected by the repository validator, repair the in-memory result before attempting the canonical write; never weaken the hard identity/source/schema validator or omit report sections to make it pass.

## Hard vs soft consistency

CRSM is an evidence-driven analytical workflow, not a deterministic math proof.

**Hard invariants** must be exact:
- result/request identity and source ownership;
- schema/version shape;
- Node 1–5 existence;
- Node 2 FULL/DEGRADED disclosure semantics;
- Node 5 canonical field identity and fixed decision enum;
- decision_record as the canonical machine projection of Node 1 + Node 5;
- evidence isolation and immutable-result rules.

Missing analytical inputs are not hard failures by themselves. They may remain null when honestly unavailable and must reduce confidence, be disclosed, and if material may justify WATCH rather than fabricated precision.

**Soft analytical/presentation consistency** must not fail an otherwise valid ticker:
- prose wording or qualitative interpretation differs slightly between nodes;
- Node 6B repeats a score/decision/confidence differently from Node 5;
- optional display data is unavailable;
- Node 6B misses a heading/table or has imperfect formatting;
- a legacy Node 6A HTML payload is malformed or absent.

Node 5 + decision_record are canonical for final decision fields. Node 6B is narrative only. The deterministic web renderer owns the Visual Report and normalizes presentation from Node 1–5. Presentation defects should surface as warnings/fallback, not analytical failure.

Do not append a second browser-local decision log row.

## Chat response

After the worker loop ends, reply only with a concise summary such as:
- how many tickers completed
- how many failed
- whether the list is finished

Do not paste the full CRSM report unless the user explicitly asks to inspect it in chat.
