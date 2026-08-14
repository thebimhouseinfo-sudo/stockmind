import { crsmState } from './state.js';

const STYLE_ID = 'crsm-report-runtime-fixes';
let syncQueued = false;

ensureStyles();
installCaptureHandlers();
installObserver();
queueSync();

function installCaptureHandlers() {
  document.addEventListener('click', async event => {
    const wordButton = event.target.closest?.('#crsmDownloadWord');
    if (wordButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        downloadMarkdownWord(crsmState.nodeOutputs?.node6b || '', crsmState.ticker || 'CRSM');
      } catch (error) {
        console.warn('[CRSM] Word export fix failed:', error);
      }
      return;
    }

    const imageButton = event.target.closest?.('#crsmDownloadImage');
    if (imageButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        const visibleReport = activeReportElement();
        if (visibleReport) {
          try {
            await downloadVisibleReportImage(visibleReport, crsmState.ticker || 'CRSM');
            return;
          } catch (error) {
            console.warn('[CRSM] Visible report capture failed, retrying from report HTML:', error);
          }
        }
        await downloadHtmlImage(activeReportHtml(), crsmState.ticker || 'CRSM');
      } catch (error) {
        console.warn('[CRSM] Image export fix failed:', error);
        downloadImageFallback(activeReportHtml(), crsmState.ticker || 'CRSM');
      }
    }
  }, true);
}

function activeReportHtml() {
  const fromState = crsmState.finalReport || crsmState.nodeOutputs?.node6a || '';
  if (fromState) return fromState;
  const frame = document.querySelector('.crsm-report-frame');
  return frame?.getAttribute('srcdoc') || frame?.srcdoc || '';
}

function activeReportElement() {
  const htmlTab = document.querySelector('.report-tab.active[data-report-tab="html"]');
  if (!htmlTab) return null;
  return document.querySelector('.crsm-report-host #report') || document.querySelector('.crsm-report-host');
}

function installObserver() {
  const observer = new MutationObserver(() => queueSync());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  requestAnimationFrame(() => {
    syncQueued = false;
    syncWordTab();
  });
}

function syncWordTab() {
  const activeTab = document.querySelector('.report-tab.active[data-report-tab="word"]');
  const paper = document.querySelector('.reports-page .report-paper');
  if (!activeTab || !paper) return;
  const markdown = String(crsmState.nodeOutputs?.node6b || '').trim();
  if (!markdown) return;
  if (paper.dataset.crsmWordMounted === '1') return;

  paper.dataset.crsmWordMounted = '1';
  paper.innerHTML = `<article class="crsm-word-preview">${markdownToHtml(markdown)}</article>`;
}

function markdownToHtml(markdown) {
  const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listOpen = false;

  const closeList = () => {
    if (listOpen) { out.push('</ul>'); listOpen = false; }
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { closeList(); i += 1; continue; }
    const trimmed = line.trimStart();

    if (/^---+$/.test(trimmed.trim())) { closeList(); out.push('<hr>'); i += 1; continue; }
    if (/^###\s+/.test(trimmed)) { closeList(); out.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`); i += 1; continue; }
    if (/^##\s+/.test(trimmed)) { closeList(); out.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h2>`); i += 1; continue; }
    if (/^#\s+/.test(trimmed)) { closeList(); out.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''))}</h1>`); i += 1; continue; }
    if (/^>\s?/.test(trimmed)) { closeList(); out.push(`<blockquote>${inlineMarkdown(trimmed.replace(/^>\s?/, ''))}</blockquote>`); i += 1; continue; }

    if (/^\|/.test(trimmed) && i + 1 < lines.length && /^\|?\s*:?-+:?/.test(lines[i + 1].trimStart())) {
      closeList();
      const headers = parseTableRow(trimmed);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trimStart())) { rows.push(parseTableRow(lines[i].trimStart())); i += 1; }
      out.push(`<div class="crsm-word-table-wrap"><table><thead><tr>${headers.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${inlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (!listOpen) { out.push('<ul>'); listOpen = true; }
      out.push(`<li>${inlineMarkdown(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
      i += 1;
      continue;
    }

    closeList();
    out.push(`<p>${inlineMarkdown(trimmed)}</p>`);
    i += 1;
  }

  closeList();
  return out.join('');
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  return text;
}

function parseTableRow(line) {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

async function downloadMarkdownWord(markdown, ticker) {
  if (!markdown) return;
  const body = markdownToHtml(markdown);
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="ProgId" content="Word.Document"><title>CRSM ${escapeHtml(ticker)}</title><style>${wordStyles()}</style></head><body>${body}</body></html>`;
  const blob = new Blob([html], { type: 'application/msword' });
  downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

async function downloadHtmlImage(reportHtml, ticker) {
  if (!reportHtml) return;
  try {
    const source = await withTimeout(prepareReportForImage(reportHtml, ticker), 7000, 'Render ảnh quá lâu.');
    if (source.canvas) {
      const png = await new Promise(resolve => source.canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('Không tạo được PNG.');
      downloadBlob(png, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
      return;
    }

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
    console.warn('[CRSM] Image export fell back to text snapshot:', error);
    downloadImageFallback(reportHtml, ticker);
  }
}

async function downloadVisibleReportImage(reportElement, ticker) {
  const html2canvas = window.html2canvas;
  if (typeof html2canvas !== 'function') throw new Error('html2canvas chưa sẵn sàng.');

  await waitForVisibleImages(reportElement);
  if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const canvas = await withTimeout(html2canvas(reportElement, {
    backgroundColor: '#f5f7fb',
    scale: Math.min(2, window.devicePixelRatio || 1),
    useCORS: true,
    logging: false,
    windowWidth: Math.max(document.documentElement.scrollWidth, reportElement.scrollWidth, 1100),
    windowHeight: Math.max(document.documentElement.scrollHeight, reportElement.scrollHeight, 600)
  }), 12000, 'Chụp report đang hiển thị quá lâu.');

  const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!png) throw new Error('Không tạo được PNG từ report đang hiển thị.');
  downloadBlob(png, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function prepareReportForImage(reportHtml, ticker) {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', left: '-100000px', top: '0', width: '1800px', height: '1200px', border: '0', visibility: 'hidden', pointerEvents: 'none' });
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve, reject) => {
      iframe.onload = resolve;
      iframe.onerror = reject;
      iframe.srcdoc = normalizeHtmlDocument(reportHtml, ticker);
    });
    const doc = iframe.contentDocument;
    if (!doc?.body) throw new Error('Không truy cập được report document.');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (doc.fonts?.ready) await doc.fonts.ready.catch(() => {});
    await waitForImages(doc);

    const body = doc.body;
    const report = doc.getElementById('report') || body;
    const html2canvas = doc.defaultView?.html2canvas;
    if (typeof html2canvas === 'function') {
      const canvas = await html2canvas(report, {
        backgroundColor: '#f5f7fb',
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
        logging: false
      });
      return { canvas };
    }

    const width = Math.ceil(Math.max(body.scrollWidth, body.offsetWidth, 1100));
    const height = Math.ceil(Math.max(body.scrollHeight, body.offsetHeight, 600));
    const clone = body.cloneNode(true);
    clone.removeAttribute('style');
    clone.style.cssText = `margin:0;background:#fff;width:${width}px;min-height:${height}px;overflow:hidden;font-family:Arial,sans-serif;`;
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
  const properties = ['display','position','top','right','bottom','left','box-sizing','width','min-width','max-width','height','min-height','max-height','margin','margin-top','margin-right','margin-bottom','margin-left','padding','padding-top','padding-right','padding-bottom','padding-left','font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-align','text-transform','white-space','color','background','background-color','background-image','background-size','background-position','border','border-top','border-right','border-bottom','border-left','border-radius','box-shadow','opacity','overflow','vertical-align','grid-template-columns','grid-template-rows','grid-column','grid-row','gap','column-gap','row-gap','flex-direction','flex-wrap','justify-content','align-items','align-self','flex','flex-grow','flex-shrink','flex-basis','object-fit'];
  for (let i = 0; i < count; i += 1) {
    const source = sourceNodes[i];
    const clone = cloneNodes[i];
    if (!(source instanceof Element) || !(clone instanceof Element)) continue;
    const computed = source.ownerDocument.defaultView?.getComputedStyle(source);
    if (!computed) continue;
    clone.style.cssText = properties.map(name => `${name}:${computed.getPropertyValue(name)};`).join('');
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

function normalizeHtmlDocument(reportHtml, ticker) {
  const source = String(reportHtml || '').trim();
  return /^<!doctype\s+html/i.test(source) || /<html[\s>]/i.test(source)
    ? source
    : `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title></head><body>${source}</body></html>`;
}

function wordStyles() {
  return `@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#1f2937;line-height:1.55;margin:0}h1{color:#1e3a8a;font-size:22pt;border-bottom:1px solid #dbe2ec;padding-bottom:8pt}h2{color:#1e3a8a;font-size:15pt;margin-top:18pt;page-break-after:avoid}h3{color:#334e7a;font-size:12pt;margin-top:14pt;page-break-after:avoid}p{margin:6pt 0}ul{margin:6pt 0 10pt 18pt;padding-left:0}li{margin:3pt 0}blockquote{margin:8pt 0;padding:7pt 10pt;border-left:3pt solid #3b82f6;background:#eff6ff}.crsm-word-table-wrap{overflow:visible}table{width:100%;border-collapse:collapse;margin:8pt 0;table-layout:fixed;page-break-inside:auto}tr{page-break-inside:avoid;page-break-after:auto}th,td{border:1px solid #cfd8e3;padding:5pt 6pt;vertical-align:top;word-break:break-word}th{background:#edf3fb;font-weight:700}code{font-family:Consolas,monospace}`;
}

async function waitForVisibleImages(root) {
  const images = [...root.querySelectorAll('img')];
  if (!images.length) return;
  await Promise.all(images.map(image => {
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  }));
}

function downloadImageFallback(reportHtml, ticker) {
  const text = extractReportText(reportHtml);
  const lines = wrapLines(text, 92);
  const width = 1600;
  const lineHeight = 30;
  const top = 150;
  const maxLines = 520;
  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) visibleLines.push('... Nội dung quá dài, ảnh snapshot đã được rút gọn.');
  const height = Math.max(520, top + visibleLines.length * lineHeight + 70);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#172033';
  ctx.font = '700 36px Arial';
  ctx.fillText(`CRSM - ${ticker}`, 70, 62);
  ctx.font = '18px Arial';
  ctx.fillStyle = '#667085';
  ctx.fillText(`Báo cáo phân tích - ${new Date().toLocaleDateString('vi-VN')}`, 70, 98);
  ctx.strokeStyle = '#dbe2ec';
  ctx.beginPath();
  ctx.moveTo(70, 120);
  ctx.lineTo(width - 70, 120);
  ctx.stroke();
  ctx.fillStyle = '#172033';
  ctx.font = '18px Arial';
  visibleLines.forEach((line, i) => ctx.fillText(line, 70, top + i * lineHeight));
  canvas.toBlob(blob => {
    if (blob) {
      downloadBlob(blob, `CRSM_${safeName(ticker)}_${dateStamp()}.png`);
    } else {
      downloadTextFallback(text, ticker);
    }
  }, 'image/png');
}

function downloadTextFallback(text, ticker) {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `CRSM_${safeName(ticker)}_${dateStamp()}.txt`);
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
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.crsm-word-preview{background:#fff;max-width:900px;margin:0 auto;padding:38px 44px;box-shadow:0 8px 28px rgba(18,35,65,.08);font-family:Arial,sans-serif;color:#1f2937;line-height:1.6}.crsm-word-preview h1{color:#1e3a8a;font-size:28px;border-bottom:1px solid #dbe2ec;padding-bottom:10px}.crsm-word-preview h2{color:#1e3a8a;font-size:21px;margin:26px 0 10px}.crsm-word-preview h3{color:#334e7a;font-size:16px;margin:22px 0 8px}.crsm-word-preview p{margin:7px 0}.crsm-word-preview ul{margin:8px 0 12px 22px}.crsm-word-preview li{margin:4px 0}.crsm-word-preview blockquote{margin:10px 0;padding:9px 12px;border-left:3px solid #3b82f6;background:#eff6ff}.crsm-word-preview table{width:100%;border-collapse:collapse;margin:10px 0}.crsm-word-preview th,.crsm-word-preview td{border:1px solid #cfd8e3;padding:7px 8px;text-align:left;vertical-align:top}.crsm-word-preview th{background:#edf3fb}.crsm-word-preview hr{border:0;border-top:1px solid #dbe2ec;margin:20px 0}@media(max-width:760px){.crsm-word-preview{padding:22px 18px}.crsm-word-preview table{font-size:12px}}`;
  document.head.appendChild(style);
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

function safeName(value) { return String(value || 'report').replace(/[^a-zA-Z0-9_-]/g, '_'); }
function dateStamp() { return new Date().toISOString().slice(0, 10); }
function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = error => { URL.revokeObjectURL(url); reject(error); };
    image.src = url;
  });
}
