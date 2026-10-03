# Node 2 Vietnam Market Context

This reference defines the measurement boundary for CRSM Node 2. Node 2 measures market internals and relative strength. Node 4 may later interpret macro/policy/external causes, but must not recompute these market measurements.

## Benchmark policy

Always attempt a VN-Index baseline.

Then choose the most relevant comparison set:
- `VN30` for large-cap/blue-chip context when it is materially representative;
- `HNXINDEX` for HNX-listed names;
- `UPCOMINDEX` for UPCoM-listed names;
- a reliable official sector index when available;
- otherwise a named 3–5 stock peer basket with explicit constituents and source.

Do not invent a proprietary benchmark. Public VNDIRECT/SSI or similar research/data may be used as a source when accessible, but the benchmark identity must remain the actual index/sector/peer basket being measured.

Use the same stated period when comparing stock, VN-Index and the selected secondary benchmark.

## Canonical market capabilities

`market_context.coverage` accounts for exactly these capabilities:
- `vnindex_baseline`
- `secondary_benchmark`
- `breadth`
- `turnover_liquidity`
- `leadership_rotation`
- `volatility`
- `market_foreign_flow`
- `stock_relative_strength`

`available_capabilities[]` and `missing_capabilities[]` form a complete non-overlapping partition of this list.

Coverage semantics:
- `FULL`: all canonical market capabilities are available and evidenced.
- `DEGRADED`: one or more canonical capabilities are unavailable; name every missing capability.
- Missing public data is a valid analytical state. Use null/missing capability; never fabricate a breadth count, foreign-flow figure, volatility statistic or benchmark return.

Every available capability must have at least one provenance record:
```json
{
  "capability": "breadth",
  "source": "HOSE/VNDIRECT public market data",
  "as_of": "2026-10-03"
}
```

## Canonical market_context shape

```json
{
  "as_of": "YYYY-MM-DD or period",
  "benchmarks": {
    "vnindex": {
      "name": "VNINDEX",
      "period": "20D",
      "performance_pct": null,
      "trend": null,
      "source": null,
      "freshness": null
    },
    "secondary": [
      {
        "name": "VN30",
        "kind": "INDEX | SECTOR | PEER_BASKET",
        "period": "20D",
        "performance_pct": null,
        "source": null,
        "freshness": null,
        "constituents": []
      }
    ]
  },
  "breadth": {
    "advancers": null,
    "decliners": null,
    "unchanged": null,
    "advance_decline_ratio": null,
    "source": null,
    "freshness": null
  },
  "turnover_liquidity": {
    "market_turnover_value": null,
    "unit": "Bn VND",
    "change_vs_20d_pct": null,
    "source": null,
    "freshness": null
  },
  "leadership_rotation": {
    "leaders": [],
    "laggards": [],
    "note": null,
    "source_refs": [],
    "freshness": null
  },
  "volatility": {
    "measure": null,
    "value": null,
    "period": null,
    "source": null,
    "freshness": null
  },
  "market_foreign_flow": {
    "net_value": null,
    "unit": "Bn VND",
    "period": null,
    "source": null,
    "freshness": null
  },
  "stock_relative_strength": {
    "period": null,
    "stock_perf_pct": null,
    "vnindex_perf_pct": null,
    "secondary_benchmark_name": null,
    "secondary_benchmark_perf_pct": null,
    "vs_vnindex_pct": null,
    "vs_secondary_benchmark_pct": null,
    "source_refs": []
  },
  "coverage": {
    "status": "FULL | DEGRADED",
    "available_capabilities": [],
    "missing_capabilities": [],
    "provenance": [],
    "note": null
  }
}
```

The object may contain null measurement values only when the corresponding capability is in `missing_capabilities`. Do not claim an available capability without source provenance.

## Ownership boundary

Node 1 `market_data.foreign_net_flow_20d` is ticker-specific foreign flow.

Node 2 `market_context.market_foreign_flow` is broad-market foreign flow. They are different measurements and must never be copied into each other merely because one is available.

Node 2 measures:
- index/benchmark returns and trend;
- market breadth;
- turnover/liquidity;
- leadership/rotation;
- volatility;
- broad-market foreign flow;
- stock relative strength vs VN-Index and relevant benchmark.

Node 4 interprets why those conditions exist and how macro/policy/rates/FX/commodity/geopolitical drivers transmit to the company.

## Technical evidence policy

Use `CAPABILITY_BASED_V1` for new analysis where possible:
- declare only the indicators actually needed;
- each indicator requirement states the verified history required;
- FULL cannot claim an indicator whose history is insufficient;
- `DEGRADED` explicitly names missing technical capabilities.

VSA/Wyckoff/smart-money labels are optional and evidence-gated. Volume alone does not prove institutional activity. If the required OHLCV/context is missing, leave the label null or use cautious candidate language and reduce technical coverage.
