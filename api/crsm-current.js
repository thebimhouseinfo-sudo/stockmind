import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, sendError, sendJson } from './_http.js';
import { getCurrentRun } from './_memo-service.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const data = await getCurrentRun(createGitHubRuntimeClient());
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
