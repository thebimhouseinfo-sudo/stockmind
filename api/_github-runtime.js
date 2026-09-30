import { assertExactSha } from '../src/memo/protocol.js';

export const STOCKMIND_RUNTIME = Object.freeze({
  owner: 'thebimhouseinfo-sudo',
  repo: 'stockmind',
  branch: 'runtime',
  memoPrefix: 'memo/'
});

export class GitHubRuntimeError extends Error {
  constructor(code, message, status = 500, details = null) {
    super(message);
    this.name = 'GitHubRuntimeError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function createGitHubRuntimeClient({
  fetchImpl = globalThis.fetch,
  token = process.env.STOCKMIND_GITHUB_TOKEN,
  owner = STOCKMIND_RUNTIME.owner,
  repo = STOCKMIND_RUNTIME.repo,
  branch = STOCKMIND_RUNTIME.branch
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new GitHubRuntimeError('GITHUB_FETCH_UNAVAILABLE', 'fetch is unavailable');
  }
  if (
    owner !== STOCKMIND_RUNTIME.owner
    || repo !== STOCKMIND_RUNTIME.repo
    || branch !== STOCKMIND_RUNTIME.branch
  ) {
    throw new GitHubRuntimeError(
      'GITHUB_RUNTIME_BOUNDARY',
      'Runtime repository/branch override is not allowed',
      403
    );
  }

  const base = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents';

  async function readJson(path) {
    const safe = assertMemoPath(path);
    const response = await request(
      'GET',
      base + '/' + encodeGitHubPath(safe) + '?ref=' + encodeURIComponent(branch)
    );
    const data = await response.json();
    if (Array.isArray(data)) {
      throw new GitHubRuntimeError('GITHUB_EXPECTED_FILE', 'Expected file at ' + safe, 500);
    }
    return {
      path: safe,
      sha: data.sha,
      value: JSON.parse(decodeBase64(data.content || ''))
    };
  }

  async function readJsonOrNull(path) {
    try {
      return await readJson(path);
    } catch (error) {
      if (error instanceof GitHubRuntimeError && error.status === 404) return null;
      throw error;
    }
  }

  async function list(path) {
    const safe = assertMemoPath(path, { allowDirectory: true });
    const response = await request(
      'GET',
      base + '/' + encodeGitHubPath(safe) + '?ref=' + encodeURIComponent(branch)
    );
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new GitHubRuntimeError(
        'GITHUB_EXPECTED_DIRECTORY',
        'Expected directory at ' + safe,
        500
      );
    }
    return data.map(entry => ({
      name: entry.name,
      path: entry.path,
      sha: entry.sha,
      type: entry.type
    }));
  }

  async function createJson(path, value, message) {
    const safe = assertMemoPath(path);
    const existing = await readJsonOrNull(safe);
    if (existing) {
      throw new GitHubRuntimeError(
        'GITHUB_CREATE_CONFLICT',
        safe + ' already exists',
        409,
        { sha: existing.sha }
      );
    }
    return write(safe, value, message, null);
  }

  async function updateJson(path, value, expectedSha, message) {
    const safe = assertMemoPath(path);
    const existing = await readJson(safe);
    try {
      assertExactSha(expectedSha, existing.sha);
    } catch (error) {
      throw new GitHubRuntimeError(
        error.code || 'MEMO_SHA_CONFLICT',
        error.message,
        409,
        error.details || null
      );
    }
    return write(safe, value, message, existing.sha);
  }

  async function deleteJson(path, expectedSha, message) {
    const safe = assertMemoPath(path);
    const existing = await readJson(safe);
    try {
      assertExactSha(expectedSha, existing.sha);
    } catch (error) {
      throw new GitHubRuntimeError(
        error.code || 'MEMO_SHA_CONFLICT',
        error.message,
        409,
        error.details || null
      );
    }
    if (!token) {
      throw new GitHubRuntimeError(
        'GITHUB_TOKEN_MISSING',
        'STOCKMIND_GITHUB_TOKEN is not configured',
        500
      );
    }
    const response = await request(
      'DELETE',
      base + '/' + encodeGitHubPath(safe),
      {
        message: message || 'Delete Stockmind Memo file',
        branch,
        sha: existing.sha
      }
    );
    const data = await response.json();
    return {
      path: safe,
      commit_sha: data.commit && data.commit.sha ? data.commit.sha : null
    };
  }

  async function write(path, value, message, sha) {
    if (!token) {
      throw new GitHubRuntimeError(
        'GITHUB_TOKEN_MISSING',
        'STOCKMIND_GITHUB_TOKEN is not configured',
        500
      );
    }
    const body = {
      message: message || 'Update Stockmind Memo',
      branch,
      content: encodeBase64(JSON.stringify(value, null, 2) + '\n')
    };
    if (sha) body.sha = sha;

    const response = await request('PUT', base + '/' + encodeGitHubPath(path), body);
    const data = await response.json();
    return {
      path,
      sha: data.content && data.content.sha ? data.content.sha : null,
      commit_sha: data.commit && data.commit.sha ? data.commit.sha : null
    };
  }

  async function request(method, url, body = null) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'stockmind-vercel-bridge'
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body != null) headers['Content-Type'] = 'application/json';

    const response = await fetchImpl(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body)
    });

    if (!response.ok) {
      let details = null;
      try {
        details = await response.json();
      } catch {}
      throw new GitHubRuntimeError(
        response.status === 404 ? 'GITHUB_NOT_FOUND' : 'GITHUB_REQUEST_FAILED',
        'GitHub ' + method + ' failed with HTTP ' + response.status,
        response.status,
        details
      );
    }
    return response;
  }

  return { readJson, readJsonOrNull, list, createJson, updateJson, deleteJson };
}

export function assertMemoPath(path, { allowDirectory = false } = {}) {
  if (typeof path !== 'string' || !path.startsWith(STOCKMIND_RUNTIME.memoPrefix)) {
    throw new GitHubRuntimeError(
      'GITHUB_RUNTIME_PATH_DENIED',
      'Only memo/ paths are allowed',
      403
    );
  }
  if (path.includes('..') || path.includes('\\') || path.includes('//')) {
    throw new GitHubRuntimeError(
      'GITHUB_RUNTIME_PATH_DENIED',
      'Unsafe Memo path',
      403
    );
  }

  const normalized = path.replace(/\/$/, '');
  const segment = '[A-Za-z0-9._-]+';

  const filePatterns = [
    /^memo\/current\.json$/,
    /^memo\/index\.json$/,
    /^memo\/render\/index\.json$/,
    new RegExp('^memo/render/runs/' + segment + '\\.json$'),
    new RegExp('^memo/runs/' + segment + '/(?:request|status)\\.json$'),
    new RegExp('^memo/runs/' + segment + '/results/' + segment + '\\.json$'),
    new RegExp(
      '^memo/runs/' + segment + '/evidence/' + segment + '/' + segment + '\\.json$'
    )
  ];

  const directoryPatterns = [
    /^memo\/runs$/,
    /^memo\/render$/,
    /^memo\/render\/runs$/,
    new RegExp('^memo/runs/' + segment + '$'),
    new RegExp('^memo/runs/' + segment + '/(?:evidence|results)$'),
    new RegExp('^memo/runs/' + segment + '/evidence/' + segment + '$')
  ];

  const allowed = (allowDirectory ? directoryPatterns : filePatterns)
    .some(pattern => pattern.test(normalized));

  if (!allowed) {
    throw new GitHubRuntimeError(
      'GITHUB_RUNTIME_PATH_DENIED',
      'Memo path is outside the approved runtime shape',
      403
    );
  }

  return normalized;
}

function encodeGitHubPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function encodeBase64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

function decodeBase64(text) {
  return Buffer.from(String(text).replace(/\n/g, ''), 'base64').toString('utf8');
}
