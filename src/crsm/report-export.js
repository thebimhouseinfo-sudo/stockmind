function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadHtmlReport(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = normalizeHtmlDocument(reportHtml, ticker);
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `CRSM_${safeName(ticker)}_${dateStamp()}.html`);
}

export function downloadWordReport(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = normalizeHtmlDocument(reportHtml, ticker);
  const word = `<!doctype html><html><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033;line-height:1.55}h1,h2,h3{page-break-after:avoid}table{border-collapse:collapse;width:100%;margin:12px 0 18px}td,th{border:1px solid #dbe2ec;padding:8px;text-align:left;vertical-align:top}th{background:#f5f8fc}img{max-width:100%}</style></head><body>${extractBody(html)}</body></html>`;
  downloadBlob(new Blob([word], { type: 'application/msword' }), `CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

export async function downloadReportBundle(reportHtml, ticker) {
  if (!reportHtml) return;
  downloadHtmlReport(reportHtml, ticker);
  await new Promise(resolve => setTimeout(resolve, 150));
  downloadWordReport(reportHtml, ticker);
}

function normalizeHtmlDocument(reportHtml, ticker) {
  const source = String(reportHtml || '').trim();
  if (/^<!doctype\s+html/i.test(source) || /<html[\s>]/i.test(source)) return source;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CRSM ${escapeHtml(ticker)}</title></head><body>${source}</body></html>`;
}

function extractBody(html) {
  const match = String(html).match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

function safeName(value) {
  return String(value || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
