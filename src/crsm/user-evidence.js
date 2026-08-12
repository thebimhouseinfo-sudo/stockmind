const MAX_TOTAL_CHARS = 60000;
const MAX_FILE_CHARS = 24000;
let pendingEvidence = null;

export function getPendingUserEvidence() {
  return pendingEvidence;
}

export function consumePendingUserEvidence() {
  const evidence = pendingEvidence;
  pendingEvidence = null;
  return evidence;
}

export function clearPendingUserEvidence() {
  pendingEvidence = null;
}

export async function ingestUserEvidence(files) {
  const list = Array.from(files || []);
  if (!list.length) throw new Error('Chưa chọn file dữ liệu.');

  const documents = [];
  const errors = [];
  let totalChars = 0;

  for (const file of list) {
    try {
      const extracted = await extractFile(file);
      const text = clampText(extracted.text || '');
      if (!text.trim()) throw new Error('Không trích xuất được nội dung.');
      const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
      if (!remaining) break;
      const finalText = text.slice(0, remaining);
      documents.push({
        name: file.name,
        type: file.type || guessType(file.name),
        bytes: file.size,
        extractedChars: finalText.length,
        content: finalText,
        source: 'USER_UPLOAD'
      });
      totalChars += finalText.length;
    } catch (error) {
      errors.push(`${file.name}: ${error?.message || error}`);
    }
  }

  if (!documents.length) throw new Error(errors.join('\n') || 'Không đọc được file.');

  pendingEvidence = {
    source: 'USER_UPLOAD',
    uploadedAt: new Date().toISOString(),
    documents,
    errors,
    totalChars,
    intendedUse: 'supplementary_evidence',
    primaryNodes: ['node3', 'node4']
  };
  return pendingEvidence;
}

async function extractFile(file) {
  const name = file.name.toLowerCase();
  if (/\.(txt|md|csv|tsv|json|xml|html?)$/.test(name) || /text\//.test(file.type)) {
    return { text: await file.text() };
  }
  if (/\.(xlsx|xls)$/.test(name) || /spreadsheet|excel/.test(file.type)) return extractSpreadsheet(file);
  if (/\.pdf$/.test(name) || file.type === 'application/pdf') return extractPdf(file);
  throw new Error('Định dạng chưa hỗ trợ. Dùng PDF, XLSX/XLS, CSV, TSV, TXT, MD hoặc JSON.');
}

async function extractSpreadsheet(file) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const parts = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
    parts.push(`## SHEET: ${sheetName}\n${rows.map(row => row.map(value => value == null ? '' : String(value)).join('\t')).join('\n')}`);
  }
  return { text: parts.join('\n\n') };
}

async function extractPdf(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str || '').join(' ');
    pages.push(`## PAGE ${pageNumber}\n${text}`);
  }
  return { text: pages.join('\n\n') };
}

function clampText(text) {
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
  return normalized.length > MAX_FILE_CHARS ? `${normalized.slice(0, MAX_FILE_CHARS)}\n[TRUNCATED BY EVIDENCE LAYER]` : normalized;
}

function guessType(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? `application/x-${ext}` : 'application/octet-stream';
}
