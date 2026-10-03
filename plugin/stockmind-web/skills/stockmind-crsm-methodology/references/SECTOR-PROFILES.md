# CRSM Sector Profiles — Node 1 Materiality Router

This reference is the canonical sector-routing map for CRSM Node 1. It does **not** change the six-factor AI Score or make valuation decisions. Its purpose is to tell Node 1 which raw evidence is material enough to collect before downstream reasoning.

## Canonical profiles

Use exactly one:
- `BANK`
- `INSURANCE`
- `SECURITIES`
- `REAL_ESTATE`
- `UTILITIES_POWER`
- `COMMODITY_CYCLICAL`
- `INDUSTRIAL_LOGISTICS`
- `TECHNOLOGY_SERVICES`
- `CONSUMER`
- `GENERIC`

Use `GENERIC` only when the business model does not fit another profile or when available evidence is too weak to classify confidently. Record the reason in `material_questions`; never force a profile merely to unlock a preferred valuation method.

## Universal core — collect for every profile when available

- latest price, market cap, liquidity/trading value and **ticker-specific** foreign flow/room;
- revenue/earnings/cash-flow trend and balance-sheet leverage;
- working-capital stress signals relevant to the business;
- ownership, insider/related-party events, issuance/dividend/M&A and other capital-allocation events;
- current valuation multiples that are economically meaningful for the business;
- source provenance, `as_of`/period, freshness and unresolved conflicts.

`market_data.foreign_net_flow_20d` always refers to the **ticker**, never VN-Index/market-wide foreign flow. Broad-market foreign flow belongs to Node 2 `market_context` in a later checkpoint.

## Profile packs

| Profile | Material KPI classes | Valuation method classes for downstream Node 3 |
|---|---|---|
| BANK | NIM, loan/deposit growth, CASA/funding mix, NPL formation, NPL coverage, credit cost, CAR/capital, fee income | P/B anchored to sustainable ROE; residual-income/dividend methods when inputs are reliable; P/E supplementary |
| INSURANCE | premium/APE or GWP growth, combined ratio where relevant, investment yield, reserve adequacy, solvency/capital, product mix | P/B/P/E; embedded-value style methods only when credible EV/VNB inputs exist |
| SECURITIES | brokerage share, margin loan book/yield/funding cost, proprietary trading sensitivity, IB contribution, capital adequacy | P/B and normalized P/E/ROE; avoid valuing one-off trading gains as recurring |
| REAL_ESTATE | presales/bookings, backlog, legal approvals, land bank/project pipeline, cash collection, inventory/receivables, net debt | RNAV/NAV where project evidence supports it; P/B; normalized P/E only for delivered/recognized earnings |
| UTILITIES_POWER | capacity, utilization/output, tariff/PPA, fuel or hydrology exposure, receivables/collection, capex/debt | DCF/EV-EBITDA; P/E for stable operating assets |
| COMMODITY_CYCLICAL | realized selling price/spread, cash cost, utilization, inventory cycle, capex, net debt, supply additions | mid-cycle EV/EBITDA/P/B and scenario DCF; spot P/E is secondary |
| INDUSTRIAL_LOGISTICS | occupancy/throughput, lease/handling rate, capacity pipeline, utilization, customer concentration, capex/net debt | EV/EBITDA, P/E and DCF depending asset intensity/contract visibility |
| TECHNOLOGY_SERVICES | recurring revenue/backlog where disclosed, customer concentration, headcount/utilization, margin, cash conversion, capex intensity | P/E/EV-EBITDA/DCF; growth multiples only with durable recurring evidence |
| CONSUMER | volume-price mix, same-store/like-for-like where disclosed, gross margin, distribution footprint, inventory turns, working capital, FCF conversion | P/E/EV-EBITDA/DCF with margin and reinvestment discipline |
| GENERIC | revenue growth, operating margin, ROIC inputs, FCF conversion, leverage, working capital, capital allocation | choose P/E/P/B/EV-EBITDA/DCF only when economically appropriate and evidenced |

These are **method classes**, not mandatory calculations. Missing inputs stay missing; downstream nodes must not fabricate a valuation simply because a method appears in this table.

## Material-question router

Node 1 uses three passes:

1. **Universal core** — collect the common evidence above.
2. **Sector pack** — collect the KPI classes material to the selected profile.
3. **Triggered evidence** — deepen research only when an observed fact could change the thesis, for example:
   - abnormal receivables/inventory/cash conversion;
   - refinancing, rights issue, large acquisition/divestment or capex jump;
   - related-party/insider transactions;
   - legal/project approval or regulatory dependency;
   - unusual FX/commodity sensitivity;
   - concentration risk, capacity ramp, tariff/PPA or funding-cost shock.

Represent each unresolved or answered material issue in `material_questions[]`:

```json
{
  "question": "Điều gì đang chi phối chất lượng tài sản?",
  "why_material": "Chi phí tín dụng và ROE bền vững phụ thuộc trực tiếp vào NPL mới hình thành.",
  "status": "ANSWERED | PARTIAL | MISSING",
  "answer": "… hoặc null",
  "source_refs": ["source-id-or-url"],
  "freshness": "YYYY-MM-DD / period / null"
}
```

Rules:
- `ANSWERED`: enough evidence exists to support a factual answer.
- `PARTIAL`: some evidence exists but a material gap remains; say what is missing.
- `MISSING`: searched but unverifiable; `answer` is null.
- Do not turn a `PARTIAL`/`MISSING` question into a confident downstream claim.
- `source_refs` may be empty only when `status=MISSING`.

## Source tier and freshness

When Node 1 adds an external source, record tier/freshness when available:
- **TIER_1**: exchange/regulator/company filing/IR/audited report.
- **TIER_2**: trusted Vietnamese market-data/research provider.
- **TIER_3**: reputable business press/secondary research.
- **USER_EVIDENCE**: user-provided document tied to this exact run/item/ticker.

Prefer newer evidence only when it measures the same concept. Do not overwrite a more authoritative older filing with a lower-tier newer summary without documenting the conflict.

## Capital allocation

When material, Node 1 must collect raw evidence for dividends, buybacks, issuance, M&A/divestment, major capex, debt/refinancing and insider/related-party transactions. Node 1 records facts and provenance only; whether capital allocation creates/destroys value belongs downstream.
