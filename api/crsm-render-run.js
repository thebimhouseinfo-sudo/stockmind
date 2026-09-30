import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, ok, sendError } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const runId = String(req.query?.run_id || '').trim();
    if (!runId) {
      const error = new Error('run_id is required');
      error.code = 'RUN_ID_REQUIRED';
      error.status = 400;
      throw error;
    }
    const runtime = createGitHubRuntimeClient();
    const file = await runtime.readJson('memo/render/runs/' + runId + '.json');
    return ok(res, { snapshot: file.value, snapshot_sha: file.sha });
  } catch (error) {
    return sendError(res, error);
  }
}
