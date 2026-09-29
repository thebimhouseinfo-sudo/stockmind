import { GitHubRuntimeError } from './_github-runtime.js';

export async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.trim()) return JSON.parse(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  return sendJson(res, 405, {
    ok: false,
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: 'Allowed: ' + allowed.join(', ')
    }
  });
}

export function sendError(res, error) {
  const status = Number(error && error.status) || (error instanceof GitHubRuntimeError ? error.status : 500) || 500;
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  return sendJson(res, safeStatus, {
    ok: false,
    error: {
      code: error && error.code ? error.code : 'INTERNAL_ERROR',
      message: safeStatus >= 500 && !(error && error.code)
        ? 'Internal server error'
        : String(error && error.message ? error.message : error),
      details: error && error.details ? error.details : null
    }
  });
}

export function queryParam(req, name) {
  if (req.query && req.query[name] != null) {
    return Array.isArray(req.query[name]) ? req.query[name][0] : req.query[name];
  }
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get(name);
}
