# Stockmind Web Harness Registry

Canonical required layer order for plugin version 0.1.0:

1. stockmind-admission
2. stockmind-github-runtime
3. stockmind-worker-loop
4. stockmind-result-contract

PACK 7 adds the CRSM methodology layer between worker-loop and result-contract.

The plugin is skill-only. It has no MCP server and no desktop dependency.
GitHub Memo I/O is performed through the connected GitHub plugin.
