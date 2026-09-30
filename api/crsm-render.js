import { createGitHubRuntimeClient } from './_github-runtime.js';
import { methodNotAllowed, ok, sendError } from './_http.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const runtime = createGitHubRuntimeClient();
    const file = await runtime.readJsonOrNull('memo/render/index.json');
    const today = vietnamDate(new Date());
    if (!file || file.value?.date !== today) {
      return ok(res, {
        index: {
          schema_version: 'stockmind-render-index.v1',
          date: today,
          updated_at: null,
          runs: []
        },
        index_sha: file?.sha || null
      });
    }
    return ok(res, { index: file.value, index_sha: file.sha });
  } catch (error) {
    return sendError(res, error);
  }
}

function vietnamDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);
  const pick = type => parts.find(part => part.type === type)?.value;
  return pick('year') + '-' + pick('month') + '-' + pick('day');
}
