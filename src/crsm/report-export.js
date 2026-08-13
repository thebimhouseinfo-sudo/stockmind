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
  try {
    const source = await prepareReportForImage(reportHtml, ticker);
    const width = Math.min(1800, Math.max(1100, source.width));
    const height = Math.min(40000, Math.max(600, source.height));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;margin:0;background:#fff;overflow:hidden">${source.body}</div></foreignObject></svg>`;
    const image = await blobToImage(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không tạo được canvas.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Không tạo được PNG.');
    downloadBlob(png, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
  } catch (error) {
    console.warn('[CRSM] Image export failed:', error);
    downloadReportImageFallback(reportHtml, ticker);
  }
}

async function prepareReportForImage(reportHtml, ticker) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed', left: '-100000px', top: '0', width: '1800px', height: '1200px',
    border: '0', visibility: 'hidden', pointerEvents: 'none'
  });
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = reject;
      iframe.srcdoc = normalizeHtmlDocument(reportHtml, ticker);
    });
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Không truy cập được report document.');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (doc.fonts?.ready) await doc.fonts.ready.catch(() => {});
    await waitForImages(doc);

    const body = doc.body;
    const width = Math.ceil(Math.max(body.scrollWidth, body.offsetWidth, 1100));
    const height = Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, 600));
    const clone = body.cloneNode(true);
    clone.removeAttribute('style');
    clone.style.cssText = `margin:0;background:#fff;width:${width}px;min-height:${height}px;overflow:hidden;font-family:Arial,sans-serif;`;

    // Inline computed styles so SVG foreignObject does not depend on external
    // stylesheets, Tailwind runtime, or cross-origin CSS at rasterization time.
    inlineComputedStyles(body, clone);
    stripUnsupportedNodes(clone);

    return { width, height, body: clone.innerHTML };
  } finally {
    iframe.remove();
  }
}

function inlineComputedStyles(sourceRoot, cloneRoot) {
  const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
  const cloneNodes = [cloneRoot, ...cloneRoot.querySelectorAll('*')];
  const count = Math.min(sourceNodes.length, cloneNodes.length);
  for (let i = 0; i < count; i++) {
    const source = sourceNodes[i];
    const clone = cloneNodes[i];
    if (!(source instanceof Element) || !(clone instanceof Element)) continue;
    const computed = source.ownerDocument.defaultView?.getComputedStyle(source);
    if (!computed) continue;
    const css = [
      'display','position','top','right','bottom','left','box-sizing','width','min-width','max-width',
      'height','min-height','max-height','margin','margin-top','margin-right','margin-bottom','margin-left',
      'padding','padding-top','padding-right','padding-bottom','padding-left','font-family','font-size',
      'font-weight','font-style','line-height','letter-spacing','text-align','text-transform','white-space',
      'color','background','background-color','background-image','background-size','background-position',
      'border','border-top','border-right','border-bottom','border-left','border-radius','box-shadow',
      'opacity','overflow','vertical-align','grid-template-columns','grid-template-rows','grid-column',
      'grid-row','gap','column-gap','row-gap','flex-direction','flex-wrap','justify-content','align-items',
      'align-self','flex','flex-grow','flex-shrink','flex-basis','object-fit'
    ];
    clone.style.cssText = css.map(name => `${name}:${computed.getPropertyValue(name)};`).join('');
  }
}

function stripUnsupportedNodes(root) {
  root.querySelectorAll('script,link,iframe,object,embed,noscript').forEach(node => node.remove());
  root.querySelectorAll('*').forEach(node => {
    node.removeAttribute('onclick');
    node.removeAttribute('onload');
    node.removeAttribute('onerror');
  });
}

async function waitForImages(doc) {
  const images = [...doc.images];
  if (!images.length) return;
  await Promise.all(images.map(image => {
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = error => { URL.revokeObjectURL(url); reject(error); };
    image.src = url;
  });
}

function downloadReportImageFallback(reportHtml, ticker) {
  const text = extractReportText(reportHtml), lines = wrapLines(text, 92), width = 1600, lineHeight = 30, top = 150, bottom = 70;
  const height = Math.max(520, top + lines.length * lineHeight + bottom);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#172033'; ctx.font = '700 36px Arial'; ctx.fillText(`CRSM — ${ticker}`, 70, 62);
  ctx.font = '18px Arial'; ctx.fillStyle = '#667085'; ctx.fillText(`Báo cáo phân tích · ${new Date().toLocaleDateString('vi-VN')}`, 70, 98);
  ctx.strokeStyle = '#dbe2ec'; ctx.beginPath(); ctx.moveTo(70, 120); ctx.lineTo(width - 70, 120); ctx.stroke();
  ctx.fillStyle = '#172033'; ctx.font = '18px Arial'; lines.forEach((line, i) => ctx.fillText(line, 70, top + i * lineHeight));
  canvas.toBlob(blob => { if (blob) downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.png`); }, 'image/png');
}

export function downloadWordReport(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = normalizeHtmlDocument(reportHtml, ticker);
  const { styles, body } = extractStylesAndBody(html);
  const word = `<!doctype html><html><head><meta charset="utf-8"><meta name="ProgId" content="Word.Document"><title>CRSM ${escapeHtml(ticker)}</title><style>${styles}\n@page{size:A4;margin:18mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{max-width:none!important;margin:0!important}</style></head><body>${body}</body></html>`;
  downloadBlob(new Blob([word], { type: 'application/msword' }), `CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

function extractStylesAndBody(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return { styles: [...doc.querySelectorAll('style')].map(s => s.textContent || '').join('\n'), body: doc.body?.innerHTML || '' };
}
function extractReportText(html) {
  const doc = new DOMParser().parseFromString(normalizeHtmlDocument(html, 'CRSM'), 'text/html');
  return (doc.body?.innerText || '').replace(/\s+/g, ' ').trim();
}
function wrapLines(text, maxChars) {
  const lines = []; let current = '';
  for (const word of String(text || '').split(' ')) {
    const candidate = `${current} ${word}`.trim();
    if (candidate.length > maxChars) { if (current) lines.push(current); current = word; } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}
function normalizeHtmlDocument(reportHtml, ticker) {
  const source = String(reportHtml || '').trim();
  return /^<!doctype\s+html/i.test(source) || /<html[\s>]/i.test(source)
    ? source
    : `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title></head><body>${source}</body></html>`;
}
function safeName(value) { return String(value || 'report').replace(/[^a-zA-Z0-9_-]/g, '_'); }
function dateStamp() { return new Date().toISOString().slice(0, 10); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
