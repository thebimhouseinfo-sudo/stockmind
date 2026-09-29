import { createMcpHandler } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';

import { buildStockmindMcpServer } from './_mcp-server.js';

const webHandler = createMcpHandler(
  () => buildStockmindMcpServer(),
  {
    legacy: 'stateless',
    responseMode: 'json',
    maxRequestBodySize: 2 * 1024 * 1024
  }
);

const nodeHandler = toNodeHandler(webHandler, {
  maxRequestBodySize: 2 * 1024 * 1024
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return nodeHandler(req, res, req.body);
}
