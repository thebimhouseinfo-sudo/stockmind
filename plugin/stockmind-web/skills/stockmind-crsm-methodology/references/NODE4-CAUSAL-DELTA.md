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

For new adaptive Node 4 output, do not place VN-Index/VN30/HNX/UPCoM returns, breadth, market turnover, broad-market foreign flow, market volatility, leadership/rotation or relative-strength measurements inside `what_changed` or legacy `macro_indicators`. Those measurements enter Node 4 only through `market_context_use`.

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

Do not start with a fixed macro checklist. Use four explicit steps.

### Step A — build `external_exposure_map[]`

Use company evidence already established by Node 1/Node 3. Do not search the current macro value yet.

Each candidate:

```json
{
  "exposure_id": "fuel-cost",
  "driver": "Brent / jet fuel",
  "driver_type": "COMMODITY",
  "company_exposure": "Nhiên liệu là đầu vào chi phí trực tiếp của hoạt động vận tải.",
  "transmission_mechanism": "Giá nhiên liệu thay đổi chi phí khai thác và biên lợi nhuận nếu phụ phí không bù kịp.",
  "transmission_targets": ["MARGIN", "CASH_FLOW"],
  "materiality_hypothesis": "HIGH",
  "research_required": true,
  "selection_rationale": "Tỷ trọng nhiên liệu đủ lớn để thay đổi lợi nhuận."
}
```

Canonical external driver types:
- `MACRO`
- `POLICY`
- `RATES`
- `FX`
- `COMMODITY`
- `REGULATORY`
- `GEOPOLITICAL`
- `DEMAND`
- `LOGISTICS`
- `LEGAL_PROJECT`
- `COMPANY_EXTERNAL`

### Step B — select `research_targets[]`

Only material candidates with a plausible transmission mechanism are searched. A rejected/non-material candidate does not need current data.

Examples:
- international transport may select fuel/Brent, USD, funding rates and geopolitical route disruption when its actual costs, debt/currency profile and routes support those exposures;
- BANK may select policy/funding/FX variables that affect its economics;
- REAL_ESTATE may select legal approvals, mortgage/credit conditions, funding/refinancing and project infrastructure;
- COMMODITY_CYCLICAL may select selling-price spread, feedstock, supply additions and freight/FX;
- TECHNOLOGY_SERVICES may select client IT budgets, major-market growth, FX and wage/talent pressure;
- UTILITIES_POWER may select tariff/PPA, fuel/hydrology, regulation and payment conditions.

These are examples only. Do not turn them into sector checklists.

### Step C — research selected targets

Each selected target is auditable:

```json
{
  "target_id": "fuel-cost-current",
  "exposure_id": "fuel-cost",
  "driver": "Brent / jet fuel",
  "driver_type": "COMMODITY",
  "status": "RESEARCHED",
  "attempts": [
    {"source": "EIA", "status": "FOUND"}
  ],
  "source_refs": ["eia-brent-2026-10-06"],
  "as_of": "2026-10-06",
  "freshness": "latest published observation",
  "prior_state": 77.4,
  "current_state": 81.2,
  "direction": "UP",
  "failure_reason": null
}
```

Canonical target status: `RESEARCHED | UNAVAILABLE`.

A `RESEARCHED` target needs dated sources. An `UNAVAILABLE` target needs non-empty attempts and a non-empty `failure_reason`. Never silently substitute a different measure just to fill the field.

### Step D — promote verified changes into `what_changed[]`

Only a researched target with a credible company transmission path may become a causal delta. Link every new adaptive `what_changed[]` record back to its `exposure_id` and `target_id`.

Fed/DXY/oil/GDP/public investment are researched only when selected by this process.

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
