# Screener V2.1 — Implementation Plan

## Purpose

Redesign the StockMind Screener around the **current TradingView dataset**, rather than adapting the old scoring formulas to new fields.

Target architecture:

```text
TradingView
    ↓
Import / Parser
    ↓
Data Mapping & Normalization
    ↓
Screener Evaluation
    ↓
Ranking / Classification
    ↓
Dashboard / Candidate Gate
    ↓
CRSM SCREENED
    ↓
Node 1
```

The Screener remains a **preliminary evaluation and candidate-selection layer**. It does not replace CRSM deep research.

> **This document is a plan only. No Screener implementation should begin until the current TradingView export, data mapping, evaluation model and Node 1 JSON contract have been reviewed and approved.**

---

## 1. Scope of This Refactor

The current TradingView dataset has changed enough that the existing Screener formulas and field assumptions are no longer considered authoritative.

This phase therefore includes three linked redesigns:

1. **Data mapping** — map the current TradingView export into a clean internal schema.
2. **Evaluation method** — redesign the way stocks are filtered, evaluated, scored and classified.
3. **Screener → Node 1 contract** — redesign the JSON context sent to CRSM/Node 1 so it reflects the new Screener logic.

The existing parser/scoring implementation is reference material only and must not be treated as the target design.

---

## 2. Phase A — TradingView Data Contract

### A1. Audit current export

Identify the actual fields available in the current TradingView Screener table.

### A2. Field classification

Classify each field as:

- Raw data
- Normalized data
- Evaluation input
- Context/evidence only
- Unused

### A3. Mapping

Define:

**TradingView field → internal field → type → unit → intended use → notes**

Validate names, periods, units, signs and missing-value behavior.

### A4. Normalization

Create a deterministic normalized representation that:

- preserves source evidence
- distinguishes missing from zero
- preserves negative values
- preserves period/as-of information
- does not invent unavailable data

### A5. Data quality contract

Define how missing, invalid, stale or ambiguous fields are represented and exposed to later stages.

**STOP CONDITION:** Do not design final scoring formulas until the real dataset and mapping are approved.

---

## 3. Phase B — Screener Evaluation Redesign

The old scoring model is not assumed to remain valid.

### B1. Define evaluation dimensions

Design the new evaluation framework from the meaning of the available data, rather than from the old field names.

Potential dimensions include:

- Business quality
- Growth quality
- Financial strength
- Valuation
- Market expression
- Data quality / confidence

The final dimensions must be determined from the actual dataset.

### B2. Define metric roles

For each available metric, decide whether it is:

- a hard filter
- a scoring input
- a signal/anomaly detector
- contextual evidence
- unused

A metric must not be included merely because the old Screener used it.

### B3. Redesign filtering

Filtering should remove clearly unsuitable or insufficiently liquid candidates, not aggressively select winners.

Current Volume must not automatically become a strong hard filter merely because a previous configuration used a threshold such as 30K.

Price performance and volume behavior should normally remain evaluation/evidence rather than hard filters unless the validated strategy explicitly requires otherwise.

### B4. Redesign scoring

Define:

- normalization method
- industry-relative treatment where appropriate
- component scores
- missing-data handling
- weighting
- final score
- confidence/data-coverage treatment

Do not preserve the existing `50% / 25% / 25%` weighting unless the redesigned evaluation proves it remains appropriate.

### B5. Redesign signals

Create explicit screening signals for meaningful patterns, for example:

- strong business
- attractive valuation
- market underperformance
- growth divergence
- leverage concern
- abnormal valuation
- insufficient data

Signals are explanatory evidence and verification prompts, not automatically score penalties.

### B6. Redesign classification

Define the conditions for the main Dashboard groups, including the concept of:

- Good / View Now / Potential Buy
- Good / Undervalued / Underperform
- Other / Not selected

Classification must follow the new evaluation model.

### B7. Ranking validation

Validate the new evaluation against the real dataset:

- distribution of scores
- top candidates
- sector/industry concentration
- missing-data effects
- sensitivity to individual metrics
- behavior of underperforming but high-quality stocks

**STOP CONDITION:** Do not implement the final scoring engine until the evaluation framework and ranking behavior are approved.

---

## 4. Phase C — Screener Result Contract

The Screener result must contain more than a single final score.

Conceptual result structure:

```text
Stock
├── normalized/raw evidence
├── evaluation
│   ├── business
│   ├── growth / financial strength (if adopted)
│   ├── valuation
│   ├── market
│   └── overall
├── signals
├── data quality
├── industry context
└── screening conclusion
```

The result must remain explainable: downstream CRSM should be able to understand **why the stock was selected and what remains uncertain**.

---

## 5. Phase D — Screener → CRSM / Node 1 JSON Redesign

The existing Screening Context contract is based on the previous Screener model and must be redesigned together with the Screener.

The new contract should conceptually contain:

```text
source / version / as-of
stock identity
raw or normalized TradingView evidence
evaluation results
component scores
final score / rank / grade
classification
signals
data quality / missing fields / warnings
industry context
screening conclusion
Node 1 verification priorities
```

### Node 1 purpose for SCREENED mode

Node 1 should use the Screener context to:

- verify important data
- investigate anomalies and signals
- investigate missing information
- retrieve information unavailable from TradingView
- obtain newer or authoritative information where necessary
- explain market behavior or valuation anomalies

Node 1 should **not unnecessarily re-search quantitative data already supplied and current in the Screener context**.

### Node 1 verification priorities

The Screener should be able to explicitly pass questions such as:

- Why is a high-quality stock underperforming?
- Is the valuation justified?
- Is the reported growth sustainable?
- What explains an important anomaly?
- Which missing fields must be verified?

### DIRECT mode

Manual ticker analysis remains supported. Without a Screener context, Node 1 may collect the required information itself.

**STOP CONDITION:** The new JSON contract must be approved before changing the Node 1 implementation/prompt.

---

## 6. Phase E — Dashboard / Candidate Gate

After the evaluation model is stable:

1. Update Dashboard classification/output.
2. Preserve relevant signals and data-quality warnings.
3. Keep the Dashboard concise; do not expose the entire raw dataset by default.
4. Define the candidate gate for automatic CRSM handoff.
5. Allow only selected/high-quality candidates to enter CRSM automatically when the gate is enabled.

Candidate-gate design is downstream of the new ranking model and should not influence the core Screener formulas prematurely.

---

## 7. Phase F — Implementation

Only after Phases A–E are approved:

1. Update parser/data mapping.
2. Update normalization.
3. Implement the new filter layer.
4. Implement the new evaluation engine.
5. Implement signals and data-quality handling.
6. Implement ranking and classification.
7. Update Dashboard output.
8. Redesign Screener → CRSM context construction.
9. Update Node 1 input handling/prompt as required.
10. Add regression tests for Screener and SCREENED handoff.

No code changes should be made during the planning/validation phases.

---

## 8. Validation / Acceptance

Before considering the refactor complete:

- [ ] Current TradingView export is fully mapped.
- [ ] No unavailable TradingView field is assumed.
- [ ] Missing values are handled explicitly.
- [ ] Liquidity filtering does not unnecessarily destroy the candidate universe.
- [ ] New evaluation dimensions are defined and justified.
- [ ] New scoring/normalization behavior is validated on real data.
- [ ] Ranking produces sensible candidates.
- [ ] Underperforming high-quality candidates remain discoverable.
- [ ] Signals explain important screening conditions.
- [ ] Data quality is separate from business quality.
- [ ] Dashboard classifications match the new evaluation model.
- [ ] Screener result contract is complete and explainable.
- [ ] Node 1 JSON contract matches the new Screener model.
- [ ] SCREENED Node 1 does not unnecessarily duplicate Screener quantitative research.
- [ ] DIRECT mode remains functional.
- [ ] Existing CRSM functionality remains stable.

---

## 9. Explicit Non-Goals

This Screener refactor does not include:

- SSI / native market-data integration
- rewriting CRSM architecture
- changing CRSM provider/model routing
- replacing TradingView in this phase
- restoring legacy AppScript scoring compatibility
- adding arbitrary metrics merely because they exist in older code

`legacy/` remains reference material only.

---

## Guiding Principles

- **Redesign for the current data, do not retrofit the old formula.**
- **Map first, evaluate second, code third.**
- **Filter less, evaluate better.**
- Missing data is visible, never silently invented.
- Data quality is separate from investment quality.
- Scores must remain explainable.
- Signals should tell CRSM what needs verification.
- The Screener selects candidates; CRSM performs deep research and investment analysis.
- The Screener → Node 1 JSON contract is part of the redesign, not an afterthought.
