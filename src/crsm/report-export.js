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

export async function downloadReportImage(reportHtml, ticker) {
  if (!reportHtml) return;

  const text = extractReportText(reportHtml);
  const lines = wrapLines(text, 92);
  const width = 1600;
  const lineHeight = 30;
  const top = 150;
  const bottom = 70;
  const height = Math.max(520, top + lines.length * lineHeight + bottom);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#172033';
  ctx.font = '700 36px Arial';
  ctx.fillText(`CRSM — ${ticker}`, 70, 62);
  ctx.font = '18px Arial';
  ctx.fillStyle = '#667085';
  ctx.fillText(`Báo cáo phân tích · ${new Date().toLocaleDateString('vi-VN')}`, 70, 98);
  ctx.strokeStyle = '#dbe2ec';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(70, 120);
  ctx.lineTo(width - 70, 120);
  ctx.stroke();

  ctx.fillStyle = '#172033';
  ctx.font = '18px Arial';
  lines.forEach((line, index) => ctx.fillText(line, 70, top + index * lineHeight));

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (blob) downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
}

export function downloadWordReport(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = normalizeHtmlDocument(reportHtml, ticker);
  const word = `<!doctype html><html><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033;line-height:1.55}h1,h2,h3{page-break-after:avoid}table{border-collapse:collapse;width:100%;margin:12px 0 18px}td,th{border:1px solid #dbe2ec;padding:8px;text-align:left;vertical-align:top}th{background:#f5f8fc}img{max-width:100%}</style></head><body>${extractBody(html)}</body></html>`;
  downloadBlob(new Blob([word], { type: 'application/msword' }), `CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

export async function downloadReportBundle(reportHtml, ticker) {
  if (!reportHtml) return;
  await downloadReportImage(reportHtml, ticker);
  await new Promise(resolve => setTimeout(resolve, 150));
  downloadWordReport(reportHtml, ticker);
}

function extractReportText(html) {
  const doc = new DOMParser().parseFromString(normalizeHtmlDocument(html, 'CRSM'), 'text/html');
  return (doc.body?.innerText || doc.documentElement?.innerText || html)
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(text, maxChars) {
  const words = String(text || '').split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = `${current} ${word}`.trim();
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
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
