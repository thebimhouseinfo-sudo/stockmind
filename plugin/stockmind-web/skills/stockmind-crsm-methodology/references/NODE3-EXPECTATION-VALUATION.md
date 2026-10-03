# Node 3 Sector Economics, Valuation & Expectation Provenance

Node 3 converts Node 1 evidence into business economics and valuation. It does not reward completing a generic checklist. The selected methods must fit the business model and available evidence.

## Sector method selection

Start from `node1.sector_profile` and the valuation classes in `SECTOR-PROFILES.md`.

Canonical machine methods:

| Sector profile | Economically suitable method classes |
|---|---|
| BANK | `PB_ROE`, `RESIDUAL_INCOME`, `DIVIDEND_DISCOUNT`, `PE_SUPPLEMENTARY` |
| INSURANCE | `PB`, `PE`, `EMBEDDED_VALUE` |
| SECURITIES | `PB`, `NORMALIZED_PE` |
| REAL_ESTATE | `RNAV`, `NAV`, `PB`, `NORMALIZED_PE` |
| UTILITIES_POWER | `DCF`, `EV_EBITDA`, `PE` |
| COMMODITY_CYCLICAL | `MID_CYCLE_EV_EBITDA`, `MID_CYCLE_PB`, `SCENARIO_DCF` |
| INDUSTRIAL_LOGISTICS | `EV_EBITDA`, `PE`, `DCF` |
| TECHNOLOGY_SERVICES | `PE`, `EV_EBITDA`, `DCF`, `GROWTH_MULTIPLE` |
| CONSUMER | `PE`, `EV_EBITDA`, `DCF` |
| GENERIC | `PE`, `NORMALIZED_PE`, `PB`, `EV_EBITDA`, `DCF` |

A listed method is allowed, not mandatory. Select the smallest set that explains the economics. Mark a method `CONDITIONAL` when the business is suitable but evidence is incomplete. Use `NOT_USED` only when explaining why an otherwise tempting method would be misleading.

Piotroski F-Score is not suitable for BANK/INSURANCE and should be null there. Beneish M-Score is trigger-only. Full DCF is conditional on economically meaningful cash-flow forecasts and defensible discount-rate inputs; do not back-solve precision merely to populate it.

## Business economics

New analytical-quality Node 3 may add:

```json
{
  "sector_economics": {
    "sector_profile": "BANK",
    "earnings_bridge": [],
    "normalized_earnings": null,
    "capital_allocation": [],
    "balance_sheet_capacity": null,
    "valuation_method_selection": [
      {
        "method": "PB_ROE",
        "status": "SELECTED",
        "reason": "ROE và chất lượng tài sản là động lực định giá chính.",
        "evidence_refs": ["company-filing-Q2"]
      }
    ]
  }
}
```

The analytical sequence is:
1. identify the 2–5 variables that explain the current earnings change;
2. separate structural, cyclical, one-off and low-base effects;
3. normalize earnings only when adjustments are evidenced;
4. assess capital allocation and balance-sheet capacity from actual events/constraints;
5. choose valuation methods from business economics, not from template habit.

## Expectation provenance

Every claim about “what is priced”, “consensus”, “guidance”, “market expectation” or a variant view must carry typed provenance.

Canonical `expectation_basis` values:
- `OBSERVED_CONSENSUS`: externally observed analyst consensus. Requires dated sources.
- `COMPANY_GUIDANCE`: explicit company guidance. Requires dated company/filing/IR source.
- `VALUATION_IMPLIED`: expectation inferred from current price/valuation. Must be labelled `INFERENCE`.
- `PRICE_ACTION_INFERENCE`: expectation inferred from price/volume/relative-strength behavior. Must be labelled `INFERENCE`.

Use:

```json
{
  "expectation_basis": [
    {
      "topic": "Tăng trưởng lợi nhuận FY2027",
      "statement": "Đồng thuận quan sát được kỳ vọng tăng trưởng 15%.",
      "expectation_basis": "OBSERVED_CONSENSUS",
      "expected_value": 15,
      "expected_unit": "%",
      "analyst_view": "18%",
      "gap_direction": "ABOVE",
      "source_refs": ["broker-consensus-2026-10-02"],
      "as_of": "2026-10-02",
      "inference_label": null,
      "investment_implication": "Nếu biên lãi phục hồi nhanh hơn, dư địa bất ngờ tích cực tăng."
    }
  ]
}
```

Rules:
- `OBSERVED_CONSENSUS` and `COMPANY_GUIDANCE`: source_refs must be non-empty and `as_of` dated; `inference_label` must be null.
- `VALUATION_IMPLIED` and `PRICE_ACTION_INFERENCE`: `inference_label` must equal `INFERENCE`; source_refs and `as_of` still identify the price/valuation/technical evidence used.
- Do not phrase an inference as observed consensus. Say “định giá hiện tại hàm ý…” or “diễn biến giá cho thấy khả năng…” rather than asserting “thị trường kỳ vọng…” as a sourced fact.
- If there is no credible expectation basis, use an empty array and state uncertainty in the thesis; never manufacture a consensus estimate.

## Variant view

A variant view is the difference between an evidence-based reference expectation and the analyst view. It is not simply “bullish/bearish”.

For each material gap:
- identify the reference expectation and typed basis;
- state the analyst view and why it differs;
- trace the difference to revenue, margin, cash flow, balance sheet or valuation;
- state what evidence would close the gap or prove the view wrong.

Node 5 may later synthesize conviction, but Node 3 owns the expectation evidence and valuation economics.
