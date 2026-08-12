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

export function downloadWordReport(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#172033}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dbe2ec;padding:8px;text-align:left}img{max-width:100%}</style></head><body>${reportHtml}</body></html>`;
  downloadBlob(new Blob([html], { type: 'application/msword' }), `CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

export async function downloadReportImage(reportHtml, ticker) {
  if (!reportHtml) return;

  const text = extractReportText(reportHtml);
  const lines = wrapLines(text, 58).slice(0, 28);
  const width = 1400;
  const lineHeight = 38;
  const height = Math.max(420, 170 + lines.length * lineHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#172033';
  ctx.font = '700 34px Arial';
  ctx.fillText(`CRSM — ${ticker}`, 60, 62);
  ctx.font = '16px Arial';
  ctx.fillStyle = '#667085';
  ctx.fillText(`Báo cáo phân tích · ${new Date().toLocaleDateString('vi-VN')}`, 60, 94);
  ctx.strokeStyle = '#dbe2ec';
  ctx.beginPath(); ctx.moveTo(60, 120); ctx.lineTo(width - 60, 120); ctx.stroke();

  ctx.fillStyle = '#172033';
  ctx.font = '18px Arial';
  lines.forEach((line, index) => ctx.fillText(line, 60, 165 + index * lineHeight));

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (blob) downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
}

export async function downloadReportBundle(reportHtml, ticker) {
  if (!reportHtml) return;
  downloadWordReport(reportHtml, ticker);
  await new Promise(resolve => setTimeout(resolve, 150));
  await downloadReportImage(reportHtml, ticker);
}

function extractReportText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body?.innerText || doc.documentElement?.innerText || html)
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);
  return lines;
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
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
