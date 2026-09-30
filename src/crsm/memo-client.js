const DEFAULT_HEADERS = Object.freeze({
  Accept: 'application/json'
});

export async function fetchMemoCurrent(fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-current', { method: 'GET' });
}

export async function submitMemoRun(payload, fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchMemoHistory(fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-history', { method: 'GET' });
}

export async function fetchDailyRenderIndex(fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-render', { method: 'GET' });
}

export async function fetchDailyRenderRun(runId, fetchImpl = globalThis.fetch) {
  return requestJson(
    fetchImpl,
    '/api/crsm-render-run?run_id=' + encodeURIComponent(runId),
    { method: 'GET' }
  );
}

export async function fetchMemoRun(runId, fetchImpl = globalThis.fetch) {
  return requestJson(
    fetchImpl,
    '/api/crsm-run?run_id=' + encodeURIComponent(runId),
    { method: 'GET' }
  );
}

export async function retryMemoItem(payload, fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function fetchMemoMaintenance(fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-maintenance', { method: 'GET' });
}

export async function repairMemoHistory(fetchImpl = globalThis.fetch) {
  return requestJson(fetchImpl, '/api/crsm-maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'rebuild-index' })
  });
}

export function isActiveMemoRun(current) {
  return Boolean(
    current?.run_id
    && (current.state === 'READY' || current.state === 'PROCESSING')
  );
}

async function requestJson(fetchImpl, url, options) {
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable.');
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      ...DEFAULT_HEADERS,
      ...(options?.headers || {})
    }
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    const error = new Error(
      payload?.error?.message || ('Request failed with HTTP ' + response.status)
    );
    error.code = payload?.error?.code || 'MEMO_REQUEST_FAILED';
    error.status = response.status;
    error.details = payload?.error?.details ?? null;
    throw error;
  }

  return payload.data;
}
