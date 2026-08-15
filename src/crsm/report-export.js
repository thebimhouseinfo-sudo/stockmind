export function markdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inList = false;
  let tableRows = null;

  const closeList = () => { if (inList) { html.push('</ul>'); inList = false; } };
  const inlineFormat = text => escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const flushTable = () => {
    if (!tableRows || !tableRows.length) { tableRows = null; return; }
    const [headerCells, , ...bodyRows] = tableRows;
    html.push('<table><thead><tr>' + headerCells.map(c => `<th>${inlineFormat(c)}</th>`).join('') + '</tr></thead><tbody>');
    bodyRows.forEach(row => { html.push('<tr>' + row.map(c => `<td>${inlineFormat(c)}</td>`).join('') + '</tr>'); });
    html.push('</tbody></table>');
    tableRows = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimStart().trimEnd();
    const isTableRow = /^\|.*\|$/.test(line);

    if (isTableRow) {
      closeList();
      const cells = line.slice(1, -1).split('|').map(c => c.trim());
      if (!tableRows) tableRows = [];
      tableRows.push(cells);
      continue;
    }
    if (tableRows) flushTable();

    if (!line) { closeList(); continue; }
    if (line === '---') { closeList(); html.push('<hr>'); continue; }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineFormat(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = line.match(/^-\s+(.*)$/);
    if (listItem) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inlineFormat(listItem[1])}</li>`);
      continue;
    }

    closeList();
    html.push(`<p>${inlineFormat(line)}</p>`);
  }
  closeList();
  if (tableRows) flushTable();
  return html.join('\n');
}

export function buildWordHtmlDocument(markdown, ticker) {
  const body = markdownToHtml(markdown);
  const styles = `@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.55;margin:0}
h1{color:#1e3a8a;font-size:22pt;border-bottom:1px solid #dbe2ec;padding-bottom:8pt}
h2{color:#1e3a8a;font-size:15pt;margin-top:18pt;page-break-after:avoid}h3{color:#334e7a;font-size:12pt;margin-top:14pt;page-break-after:avoid}
p{font-size:11pt;margin:6pt 0}ul{margin:6pt 0 10pt 18pt;padding-left:0}li{font-size:11pt;margin:3pt 0}
blockquote{margin:8pt 0;padding:7pt 10pt;border-left:3pt solid #3b82f6;background:#eff6ff}
table{border-collapse:collapse;width:100%;table-layout:fixed;margin:8pt 0;page-break-inside:auto}
tr{page-break-inside:avoid;page-break-after:auto}th,td{border:1px solid #cfd8e3;padding:5pt 6pt;font-size:9.5pt;text-align:left;vertical-align:top;word-break:break-word}
th{background:#edf3fb;font-weight:700}hr{border:none;border-top:1px solid #dbe2ec;margin:18pt 0}`;
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title><style>${styles}</style></head><body>${body}</body></html>`;
}

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
    const png = await withTimeout(renderReportToPng(reportHtml, ticker), 20000, 'Render ảnh quá lâu.');
    downloadBlob(png, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
  } catch (error) {
    console.warn('[CRSM] Image export failed:', error);
    downloadReportImageFallback(reportHtml, ticker);
  }
}

async function renderReportToPng(reportHtml, ticker) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: '1800px',
    height: '1200px',
    border: '0',
    opacity: '0',
    pointerEvents: 'none'
  });
  document.body.appendChild(iframe);

  try {
    await new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = reject;
      iframe.srcdoc = normalizeHtmlDocument(reportHtml, ticker);
    });

    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error('Không truy cập được report document.');

    await settleDocument(doc);
    const html2canvas = await ensureHtml2Canvas(win, doc);
    await settleDocument(doc);

    const report = doc.getElementById('report') || doc.body;
    const rect = report.getBoundingClientRect();
    const width = Math.ceil(Math.max(report.scrollWidth, report.offsetWidth, rect.width, 1100));
    const height = Math.ceil(Math.max(report.scrollHeight, report.offsetHeight, rect.height, 600));

    // Keep the PNG sharp without exceeding common browser canvas limits.
    const maxCanvasDimension = 30000;
    const maxScaleByHeight = maxCanvasDimension / Math.max(height, 1);
    const maxScaleByWidth = maxCanvasDimension / Math.max(width, 1);
    const scale = Math.max(1, Math.min(1.5, maxScaleByHeight, maxScaleByWidth));

    const canvas = await html2canvas(report, {
      backgroundColor: '#f5f7fb',
      scale,
      useCORS: true,
      allowTaint: false,
      logging: false,
      foreignObjectRendering: false,
      scrollX: 0,
      scrollY: 0,
      width,
      height,
      windowWidth: Math.max(1800, width),
      windowHeight: Math.max(1200, height),
      onclone: clonedDoc => {
        clonedDoc.querySelectorAll('script,iframe,object,embed,noscript').forEach(node => node.remove());
        const clonedReport = clonedDoc.getElementById('report') || clonedDoc.body;
        clonedReport.style.transform = 'none';
        clonedReport.style.filter = 'none';
        clonedReport.style.animation = 'none';
        clonedReport.style.transition = 'none';
      }
    });

    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Không tạo được PNG.');
    return png;
  } finally {
    iframe.remove();
  }
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function settleDocument(doc) {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (doc.fonts?.ready) await doc.fonts.ready.catch(() => {});
  await waitForImages(doc);
}

async function ensureHtml2Canvas(win, doc) {
  if (typeof win.html2canvas === 'function') return win.html2canvas;

  const existing = [...doc.scripts].find(script => /html2canvas/i.test(script.src || ''));
  if (existing) {
    await waitFor(() => typeof win.html2canvas === 'function', 3000).catch(() => {});
    if (typeof win.html2canvas === 'function') return win.html2canvas;
  }

  await new Promise((resolve, reject) => {
    const script = doc.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Không tải được html2canvas.'));
    doc.head.appendChild(script);
  });

  if (typeof win.html2canvas !== 'function') throw new Error('html2canvas không khả dụng.');
  return win.html2canvas;
}

function waitFor(predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error('Timeout.'));
      setTimeout(tick, 50);
    };
    tick();
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

function downloadReportImageFallback(reportHtml, ticker) {
  const text = extractReportText(reportHtml), lines = wrapLines(text, 92), width = 1600, lineHeight = 30, top = 150, bottom = 70;
  const visibleLines = lines.slice(0, 520);
  if (lines.length > 520) visibleLines.push('... Nội dung quá dài, ảnh snapshot đã được rút gọn.');
  const height = Math.max(520, top + visibleLines.length * lineHeight + bottom);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#172033'; ctx.font = '700 36px Arial'; ctx.fillText(`CRSM — ${ticker}`, 70, 62);
  ctx.font = '18px Arial'; ctx.fillStyle = '#667085'; ctx.fillText(`Báo cáo phân tích · ${new Date().toLocaleDateString('vi-VN')}`, 70, 98);
  ctx.strokeStyle = '#dbe2ec'; ctx.beginPath(); ctx.moveTo(70, 120); ctx.lineTo(width - 70, 120); ctx.stroke();
  ctx.fillStyle = '#172033'; ctx.font = '18px Arial'; visibleLines.forEach((line, i) => ctx.fillText(line, 70, top + i * lineHeight));
  canvas.toBlob(blob => {
    if (blob) {
      downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
    } else {
      downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `CRSM_${safeName(ticker)}_${dateStamp()}.txt`);
    }
  }, 'image/png');
}

export function downloadWordReport(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = normalizeHtmlDocument(reportHtml, ticker);
  const { styles, body } = extractStylesAndBody(html);
  const word = `<!doctype html><html><head><meta charset="utf-8"><meta name="ProgId" content="Word.Document"><title>CRSM ${escapeHtml(ticker)}</title><style>${styles}\n@page{size:A4;margin:18mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{max-width:none!important;margin:0!important}</style></head><body>${body}</body></html>`;
  downloadBlob(new Blob([word], { type: 'application/msword' }), `CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

// Node 6B is the locked, text-first Markdown report. This produces the actual
// downloadable "Word" document from it, instead of reusing the Node 6A HTML report.
export function downloadWordReportFromMarkdown(markdown, ticker) {
  if (!markdown) return;
  const word = buildWordHtmlDocument(markdown, ticker).replace(
    '<head>',
    '<head><meta name="ProgId" content="Word.Document">'
  );
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
  const lines = [];
  let current = '';
  for (const word of String(text || '').split(' ')) {
    const candidate = `${current} ${word}`.trim();
    if (candidate.length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else current = candidate;
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
