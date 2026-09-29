import { STOCKMIND_RUNTIME } from './_github-runtime.js';

export const STOCKMIND_MCP_VERSION = '0.1.0';

export const STOCKMIND_MCP_TOOL_NAMES = Object.freeze([
  'stockmind_get_current',
  'stockmind_status_roundtrip',
  'stockmind_get_item_evidence',
  'stockmind_get_history',
  'stockmind_claim_item',
  'stockmind_fail_item',
  'stockmind_complete_item'
]);

export function stockmindMcpBoundary() {
  return {
    owner: STOCKMIND_RUNTIME.owner,
    repo: STOCKMIND_RUNTIME.repo,
    branch: STOCKMIND_RUNTIME.branch,
    path_prefix: STOCKMIND_RUNTIME.memoPrefix,
    writes_enabled_by_default: true,
    write_kill_switch: 'STOCKMIND_MCP_WRITES_ENABLED=false',
    tools: [...STOCKMIND_MCP_TOOL_NAMES]
  };
}
