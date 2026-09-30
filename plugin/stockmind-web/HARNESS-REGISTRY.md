# Stockmind Web Harness Registry

Canonical required layer order:

1. stockmind-admission
2. stockmind-github-runtime
3. stockmind-worker-loop
4. stockmind-crsm-methodology
5. stockmind-result-contract

The plugin is skill-only. It has no MCP server and no desktop dependency.
GitHub Memo I/O is performed through the connected GitHub plugin.

Current CRSM architecture:
- cross-ticker execution is strictly sequential;
- within one ticker, Node2/Node3 and Node6A/Node6B are dependency-safe sibling stages;
- Node7 browser-local side effect is not ported; one immutable decision_record is written inside crsm-result.v1;
- Screener V2 is candidate-selection/research context only and is never compared numerically with CRSM AI Score.
