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
  const html = normalizeHtmlDocument(reportHtml, ticker);

  try {
    const source = await measureReportDocument(html);
    const width = Math.min(1600, Math.max(1100, source.width));
    const height = Math.min(30000, Math.max(600, source.height));
    const styles = source.styles;
    const body = source.body;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><xhtml:div xmlns:xhtml="http://www.w3.org/1999/xhtml" style="width:${width}px;min-height:${height}px;background:#fff;overflow:hidden"><xhtml:style><![CDATA[${styles}]]></xhtml:style><xhtml:div>${body}</xhtml:div></xhtml:div></foreignObject></svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const image = await blobToImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không tạo được canvas để xuất ảnh.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Không tạo được PNG.');
    downloadBlob(png, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
  } catch (error) {
    console.warn('[CRSM] High-fidelity image export failed, using text fallback.', error);
    downloadReportImageFallback(reportHtml, ticker);
  }
}

async function measureReportDocument(html) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-100000px';
  iframe.style.top = '0';
  iframe.style.width = '1600px';
  iframe.style.height = '1200px';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  try {
    await new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = reject;
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Không truy cập được report document.');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const body = doc.body;
    const width = Math.ceil(Math.max(body.scrollWidth, body.offsetWidth, 1100));
    const height = Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, 600));
    const styles = [...doc.querySelectorAll('style')].map(style => style.textContent || '').join('\n');
    return { width, height, body: body.innerHTML, styles };
  } finally {
    iframe.remove();
  }
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = error => {
      URL.revokeObjectURL(url);
      reject(error);
    };
    image.src = url;
  });
}

function downloadReportImageFallback(reportHtml, ticker) {
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
  ctx.beginPath();
  ctx.moveTo(70, 120);
  ctx.lineTo(width - 70, 120);
  ctx.stroke();
  ctx.fillStyle = '#172033';
  ctx.font = '18px Arial';
  lines.forEach((line, index) => ctx.fillText(line, 70, top + index * lineHeight));
  canvas.toBlob(blob => {
    if (blob) downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
  }, 'image/png');
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
