import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, queryParam, sendError, sendJson } from './_http.js';
import { getRun } from './_memo-service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const runId = queryParam(req, 'run_id');
  if (!runId) {
    return sendJson(res, 400, {
      ok: false,
      error: { code: 'RUN_ID_REQUIRED', message: 'run_id is required' }
    });
  }
  try {
    const data = await getRun(createGitHubRuntimeClient(), runId);
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
