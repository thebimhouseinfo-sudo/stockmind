import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, ok, sendError } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const runtime = createGitHubRuntimeClient();
    const file = await runtime.readJsonOrNull('memo/render/index.json');
    return ok(res, file
      ? { index: file.value, index_sha: file.sha }
      : {
          index: {
            schema_version: 'stockmind-render-index.v1',
            date: null,
            updated_at: null,
            runs: []
          },
          index_sha: null
        });
  } catch (error) {
    return sendError(res, error);
  }
}
