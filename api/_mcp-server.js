import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import { createGitHubRuntimeClient } from './_github-runtime.js';
import {
  STOCKMIND_MCP_TOOL_NAMES,
  STOCKMIND_MCP_VERSION,
  stockmindMcpBoundary
} from './_mcp-config.js';
import {
  claimItem,
  completeItem,
  failItem,
  getWorkerHistory,
  inspectWorkerState,
  readItemEvidence,
  statusRoundtrip
} from './_worker-service.js';

export function buildStockmindMcpServer({
  runtime = createGitHubRuntimeClient(),
  writesEnabled = process.env.STOCKMIND_MCP_WRITES_ENABLED !== 'false'
} = {}) {
  const server = new McpServer(
    {
      name: 'stockmind',
      version: STOCKMIND_MCP_VERSION
    },
    {
      capabilities: { tools: {} },
      instructions:
        'Stockmind Memo worker. Repository, branch and paths are fixed server-side. '
        + 'Never ask the user to choose a repository, branch, run path or output path.'
    }
  );

  server.registerTool(
    'stockmind_get_current',
    {
      title: 'Get current Stockmind work',
      description:
        'Read the fixed Stockmind runtime Memo current run and identify the next READY/PROCESSING item. '
        + 'Call this immediately on Stockmind admission.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => toolSuccess(await inspectWorkerState(runtime))
  );

  server.registerTool(
    'stockmind_status_roundtrip',
    {
      title: 'Validate current Memo status',
      description:
        'Read and validate the fixed current/status records and return their exact SHA/status summary. '
        + 'This is a non-analytical connectivity and contract probe.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => toolSuccess(await statusRoundtrip(runtime))
  );

  server.registerTool(
    'stockmind_get_item_evidence',
    {
      title: 'Read canonical item evidence',
      description:
        'Read evidence only for one canonical item in the current Stockmind Memo run. '
        + 'The server resolves approved Memo paths; callers cannot provide a repository or path.',
      inputSchema: z.object({
        run_id: z.string().min(1),
        item_id: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async input => toolSuccess(await readItemEvidence(runtime, input))
  );

  server.registerTool(
    'stockmind_get_history',
    {
      title: 'Read Stockmind history index',
      description:'Read the fixed Memo history index.',
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async () => toolSuccess(await getWorkerHistory(runtime))
  );

  server.registerTool(
    'stockmind_claim_item',
    {
      title: 'Claim current Stockmind item',
      description:
        'Transition exactly one current-run item READY -> PROCESSING using the exact status SHA. '
        + 'No arbitrary repository/path input is accepted.',
      inputSchema: z.object({
        run_id: z.string().min(1),
        item_id: z.string().min(1),
        expected_status_sha: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async input => runWriteTool(writesEnabled, async () => claimItem(runtime, input))
  );

  server.registerTool(
    'stockmind_fail_item',
    {
      title: 'Mark current Stockmind item failed',
      description:
        'Transition exactly one current-run PROCESSING item to FAILED using exact-SHA concurrency.',
      inputSchema: z.object({
        run_id: z.string().min(1),
        item_id: z.string().min(1),
        expected_status_sha: z.string().min(1),
        error: z.object({
          message: z.string().min(1),
          code: z.string().nullable().optional()
        })
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async input => runWriteTool(writesEnabled, async () => failItem(runtime, input))
  );

  server.registerTool(
    'stockmind_complete_item',
    {
      title: 'Write immutable Stockmind result',
      description:
        'Validate and create the canonical immutable result for one PROCESSING current-run item, '
        + 'then update status/current/history with exact-SHA semantics.',
      inputSchema: z.object({
        result: z.record(z.string(), z.unknown()),
        expected_status_sha: z.string().min(1)
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async input => runWriteTool(writesEnabled, async () => completeItem(runtime, input))
  );

  return server;
}

export { stockmindMcpBoundary };

async function runWriteTool(enabled, operation) {
  if (!enabled) {
    return toolFailure(
      'STOCKMIND_WRITES_DISABLED',
      'Write tools are disabled by the emergency STOCKMIND_MCP_WRITES_ENABLED=false kill switch.'
    );
  }

  try {
    return toolSuccess(await operation());
  } catch (error) {
    return toolFailure(error?.code || 'STOCKMIND_WRITE_FAILED', error?.message || String(error), error?.details);
  }
}

function toolSuccess(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value
  };
}

function toolFailure(code, message, details = null) {
  const value = { ok: false, error: { code, message, details } };
  return {
    isError: true,
    content: [{ type: 'text', text: JSON.stringify(value) }],
    structuredContent: value
  };
}
