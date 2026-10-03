# Node 4 Exposure-First Causal Delta

Node 4 explains **why external conditions matter to this company now**. Node 2 measures Vietnam market internals; Node 4 consumes those measurements and researches external causal drivers.

## Ownership boundary

Node 2 owns measurement of:
- VN-Index / secondary benchmark returns and trend;
- breadth;
- market turnover/liquidity;
- leadership/rotation;
- volatility;
- broad-market foreign flow;
- stock relative strength.

Node 4 must not re-fetch or recompute those measurements merely to produce a macro paragraph.

When Node 4 uses market context, record:

```json
{
  "market_context_use": {
    "source": "NODE2.market_context",
    "measurement_policy": "CONSUME_ONLY",
    "consumed_capabilities": ["market_foreign_flow", "stock_relative_strength"],
    "interpretation": "Khối ngoại bán ròng tạo lực cản định giá ngắn hạn nhưng cổ phiếu vẫn mạnh hơn VN-Index."
  }
}
```

Only capabilities actually available in Node 2 may be consumed.

## Exposure-first research

Do not start with a fixed macro checklist. Start with the company exposure map, then search only variables with a plausible material transmission channel.

Canonical external driver types:
- `MACRO`
- `POLICY`
- `RATES`
- `FX`
- `COMMODITY`
- `REGULATORY`
- `COMPANY_EXTERNAL`

Examples:
- BANK: policy rates, credit growth policy, deposit/funding competition, FX if material.
- REAL_ESTATE: legal approvals, mortgage/credit conditions, funding/refinancing, project infrastructure.
- COMMODITY_CYCLICAL: selling-price spread, feedstock, supply additions, freight/FX.
- TECHNOLOGY_SERVICES: client IT budgets, major-market growth, FX, wage/talent pressure.
- UTILITIES_POWER: tariff/PPA, fuel/hydrology, regulation and payment/receivable conditions.

Fed/DXY/oil/GDP/public investment are researched only when they materially connect to the company.

## what_changed causal delta

For each material external change, add a `what_changed[]` record:

```json
{
  "driver": "USD/VND",
  "driver_type": "FX",
  "exposure": "Doanh thu USD lớn hơn chi phí USD.",
  "prior_state": "25,000",
  "current_state": "25,400",
  "direction": "UP",
  "materiality": "MEDIUM",
  "transmission_lag": "1-2 quý",
  "source_refs": ["sbv-fx-2026-10-03"],
  "as_of": "2026-10-03",
  "transmission_targets": ["REVENUE", "MARGIN", "VALUATION"],
  "fact": "USD/VND tăng so với mốc so sánh.",
  "inference": "Nếu cơ cấu doanh thu/chi phí không đổi, VND yếu hơn hỗ trợ doanh thu quy đổi nhưng có thể làm tăng chi phí nhập khẩu.",
  "assumption": "Cơ cấu tiền tệ và hedging không thay đổi đáng kể.",
  "inference_confidence": 72
}
```

Canonical directions: `UP | DOWN | UNCHANGED | MIXED | UNKNOWN`.

Canonical materiality: `LOW | MEDIUM | HIGH`.

Canonical transmission targets:
- `REVENUE`
- `MARGIN`
- `CASH_FLOW`
- `BALANCE_SHEET`
- `VALUATION`

Rules:
- retain FACT / INFERENCE / ASSUMPTION separation;
- every record needs dated source provenance;
- if prior/current evidence is incomplete, direction must be `UNKNOWN` rather than guessed;
- at least one transmission target must be named;
- explain lag in business terms (“ngay”, “1–2 quý”, “khi tái ký hợp đồng”, etc.);
- `inference_confidence` measures confidence in the causal inference, not investment confidence.

## No generic macro filler

A macro fact with no material exposure path should be omitted. A useful causal chain reaches at least one of revenue, margin, cash flow, balance sheet or valuation.

The output may still retain the legacy Node 4 fields for compatibility, but new analytical-quality work should use `what_changed` and `market_context_use` as the auditable causal layer.
