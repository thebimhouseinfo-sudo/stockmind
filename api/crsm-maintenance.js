import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, readJsonBody, sendError, sendJson } from './_http.js';
import { inspectMaintenance, rebuildHistoryIndex } from './_memo-service.js';

export default async function handler(req, res) {
  const runtime = createGitHubRuntimeClient();

  if (req.method === 'GET') {
    try {
      const data = await inspectMaintenance(runtime);
      return sendJson(res, 200, { ok: true, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  if (req.method !== 'POST') return methodNotAllowed(res, ['GET', 'POST']);

  try {
    const body = await readJsonBody(req);
    if (body.action !== 'rebuild-index') {
      return sendJson(res, 400, {
        ok: false,
        error: {
          code: 'MAINTENANCE_ACTION_INVALID',
          message: 'Only rebuild-index is supported'
        }
      });
    }
    const data = await rebuildHistoryIndex(runtime, body);
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
