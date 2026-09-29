import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, readJsonBody, sendError, sendJson } from './_http.js';
import { writeEvidence } from './_memo-service.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const body = await readJsonBody(req);
    const data = await writeEvidence(createGitHubRuntimeClient(), body);
    return sendJson(res, 201, { ok: true, data });
  } catch (error) {
    return sendError(res, error);
  }
}
