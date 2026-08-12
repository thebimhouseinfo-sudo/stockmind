const MAX_TOTAL_CHARS = 120000;
const MAX_FILE_CHARS = 40000;
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
      const remaining = Math.max(0, MAX_TOTAL_CHARS - totalChars);
      if (!remaining) break;
      const finalText = String(extracted.text || '').slice(0, Math.min(MAX_FILE_CHARS, remaining));
      if (!finalText.trim()) throw new Error('Không trích xuất được nội dung.');

      documents.push({
        id: `${Date.now()}-${documents.length}`,
        name: file.name,
        type: file.type || guessType(file.name),
        bytes: file.size,
        source: 'USER_UPLOAD',
        kind: extracted.kind || classifyDocument(file.name, finalText),
        extractedChars: finalText.length,
        content: finalText,
        structure: extracted.structure || null,
        provenance: extracted.provenance || { file: file.name },
        routing: routeEvidence(extracted.kind, file.name, finalText)
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
    routing: summarizeRouting(documents)
  };
  return pendingEvidence;
}

async function extractFile(file) {
  const name = file.name.toLowerCase();
  if (/\.(xlsx|xls)$/.test(name) || /spreadsheet|excel/.test(file.type)) return extractSpreadsheet(file);
  if (/\.pdf$/.test(name) || file.type === 'application/pdf') return extractPdf(file);
  if (/\.(txt|md|csv|tsv|json|xml|html?)$/.test(name) || /text\//.test(file.type)) {
    const text = normalizeText(await file.text());
    return { text, kind: classifyDocument(file.name, text), provenance: { file: file.name } };
  }
  throw new Error('Định dạng chưa hỗ trợ. Dùng PDF, XLSX/XLS, CSV, TSV, TXT, MD hoặc JSON.');
}

async function extractSpreadsheet(file) {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true, cellNF: true });
  const sheets = [];
  const parts = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
    const ref = sheet['!ref'] || '';
    const rowCount = rows.length;
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const nonEmptyRows = rows.filter(row => row.some(value => value !== null && String(value).trim() !== ''));
    const preview = nonEmptyRows.slice(0, 8).map(row => row.map(value => value == null ? '' : String(value)).join('\t')).join('\n');
    const role = classifySheet(sheetName, preview);

    sheets.push({ name: sheetName, ref, rowCount, colCount, role, headerPreview: preview });
    parts.push(`## SHEET: ${sheetName}\n## ROLE: ${role}\n## RANGE: ${ref}\n${rows.map((row, rowIndex) => row.map((value, colIndex) => value == null ? '' : `${columnName(colIndex)}${rowIndex + 1}=${String(value)}`).join('\t')).join('\n')}`);
  }

  return {
    text: normalizeText(parts.join('\n\n')),
    kind: 'spreadsheet',
    structure: { workbook: file.name, sheets },
    provenance: { file: file.name, sheets: sheets.map(sheet => ({ sheet: sheet.name, range: sheet.ref, role: sheet.role })) }
  };
}

async function extractPdf(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str || '').join(' ');
    pages.push({ page: pageNumber, text: normalizeText(text) });
  }
  return {
    text: pages.map(page => `## PAGE ${page.page}\n${page.text}`).join('\n\n'),
    kind: 'financial_report',
    structure: { pageCount: pdf.numPages, pages: pages.map(page => ({ page: page.page, chars: page.text.length })) },
    provenance: { file: file.name, pages: pages.map(page => page.page) }
  };
}

function classifySheet(name, preview) {
  const value = `${name} ${preview}`.toLowerCase();
  if (/kqkd|income|doanh thu|lợi nhuận/.test(value)) return 'income_statement';
  if (/cdkt|balance|tài sản|nguồn vốn/.test(value)) return 'balance_sheet';
  if (/cstc|financial ratio|roe|roa|eps|p\/e/.test(value)) return 'financial_metrics';
  if (/cash flow|lưu chuyển tiền/.test(value)) return 'cash_flow';
  return 'user_analysis_table';
}

function classifyDocument(name, text) {
  const value = `${name} ${text.slice(0, 6000)}`.toLowerCase();
  if (/báo cáo tài chính|financial statements|kết quả kinh doanh|balance sheet/.test(value)) return 'financial_report';
  if (/giao dịch|khối lượng mua|khối lượng bán|volume/.test(value)) return 'trading_data';
  return 'user_analysis';
}

function routeEvidence(kind, name, text) {
  const value = `${kind || ''} ${name} ${text.slice(0, 8000)}`.toLowerCase();
  const nodes = new Set();
  if (/financial_report|income_statement|balance_sheet|financial_metrics|cash_flow|bctc|kqkd|cdkt|cstc/.test(value)) nodes.add('node3');
  if (/trading_data|volume|giao dịch|khối lượng/.test(value)) nodes.add('node1');
  if (/industry|ngành|macro|kinh tế|chính sách|policy/.test(value)) nodes.add('node4');
  if (!nodes.size) {
    nodes.add('node3');
    nodes.add('node4');
  }
  return [...nodes];
}

function summarizeRouting(documents) {
  return [...new Set(documents.flatMap(document => document.routing || []))];
}

function columnName(index) {
  let n = index + 1;
  let result = '';
  while (n) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function normalizeText(text) {
  return String(text || '').replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim();
}

function guessType(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  return ext ? `application/x-${ext}` : 'application/octet-stream';
}
