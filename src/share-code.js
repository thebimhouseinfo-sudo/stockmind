const GZIP_PREFIX = 'SMG1.';
const JSON_PREFIX = 'SMJ1.';

export async function encodeShareCode(rows, meta = {}) {
  const payload = {
    v: 1,
    kind: 'stockmind-screener',
    createdAt: new Date().toISOString(),
    meta,
    rows: Array.isArray(rows) ? rows : []
  };
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    const compressed = await streamBytes(bytes, stream => stream.pipeThrough(new CompressionStream('gzip')));
    return GZIP_PREFIX + bytesToBase64Url(compressed);
  }
  return JSON_PREFIX + bytesToBase64Url(bytes);
}

export async function decodeShareCode(code) {
  const text = String(code || '').trim().replace(/\s+/g, '');
  if (!text) throw new Error('Mã share đang trống.');
  const isGzip = text.startsWith(GZIP_PREFIX);
  const isJson = text.startsWith(JSON_PREFIX);
  if (!isGzip && !isJson) throw new Error('Mã share không đúng định dạng Stock Mind.');
  const raw = base64UrlToBytes(text.slice((isGzip ? GZIP_PREFIX : JSON_PREFIX).length));
  const bytes = isGzip
    ? await streamBytes(raw, stream => stream.pipeThrough(new DecompressionStream('gzip')))
    : raw;
  const payload = JSON.parse(new TextDecoder().decode(bytes));
  if (payload?.kind !== 'stockmind-screener' || !Array.isArray(payload.rows)) {
    throw new Error('Mã share không chứa dữ liệu screener hợp lệ.');
  }
  return payload;
}

async function streamBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream();
  const out = transform(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
