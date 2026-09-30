# LEGACY — Stockmind MCP plugin

This package is superseded by `plugin/stockmind-web`.

Reason:
- Stockmind Memo already lives in GitHub.
- ChatGPT can use the connected GitHub plugin directly.
- A custom MCP integration unnecessarily makes the plugin desktop-only.

Do not use this package for the web/mobile Stockmind flow.
The custom MCP/worker server code may remain temporarily for comparison/rollback until the migration cutover cleanup gate, but it is not the target architecture.
