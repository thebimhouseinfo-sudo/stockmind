import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, readJsonBody, sendError, sendJson } from './_http.js';
import { retryFailedItem } from './_memo-service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const body = await readJsonBody(req);
    const data = await retryFailedItem(createGitHubRuntimeClient(), body);
    return sendJson(res, 200, { ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
