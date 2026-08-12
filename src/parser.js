const FIELD_ALIASES = {
  TICKER: ['ticker', 'symbol', 'ma', 'ma ck'],
  INDUSTRY: ['industry', 'sector', 'nganh'],
  AVGVOL: ['avg vol', 'average volume', 'vol avg', 'avg volume', 'avg vol 10d'],
  PRICE: ['price', 'last', 'close', 'gia'],
  VOL: ['vol', 'volume', 'last volume'],
  ROE: ['roe', 'return on equity'],
  ROIC: ['roic', 'return on invested capital'],
  REVGROWTH: ['revenue growth', 'revenue_growth', 'sales growth', 'rev growth'],
  EPSGROWTH: ['eps growth', 'eps_growth'],
  DEBT: ['debt ratio', 'debt/equity', 'd/e', 'debt', 'debt to equity'],
  PE: ['p/e', 'pe', 'price to earnings'],
  PEG: ['peg'],
  RET1M: ['return 1m', '1m perf', 'performance 1m', 'ret1m'],
  RET3M: ['return 3m', '3m perf', 'performance 3m', 'ret3m'],
  RET6M: ['return 6m', '6m perf', 'performance 6m', 'ret6m'],
  RET12M: ['return 12m', 'return 1y', '1y perf', 'performance 1y', 'ret12m']
};

const REQUIRED = ['TICKER', 'INDUSTRY', 'PRICE', 'PE', 'ROE', 'ROIC', 'REVGROWTH', 'EPSGROWTH', 'DEBT', 'RET1M', 'RET3M', 'RET6M', 'RET12M'];

export function parseTradingViewPaste(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { rows: [], errors: ['Chua co du lieu de xu ly.'], columns: {} };
  }

  const watchlistRows = parseTradingViewWatchlist(lines);
  if (watchlistRows.length) {
    return { rows: watchlistRows, errors: [], columns: { mode: 'tradingview-watchlist' } };
  }

  const delimiter = detectDelimiter(lines[0]);
  const table = lines.map(line => splitLine(line, delimiter));
  const headerIndex = findHeaderIndex(table);
  const headers = table[headerIndex] || [];
  const columns = mapColumns(headers);
  const missing = REQUIRED.filter(field => columns[field] == null);
  const errors = missing.length ? [`Thieu cot bat buoc: ${missing.join(', ')}`] : [];

  const rows = table
    .slice(headerIndex + 1)
    .map((cells, rowIndex) => normalizeRow(cells, columns, rowIndex + headerIndex + 2))
    .filter(row => row.TICKER);

  return { rows, errors, columns };
}

function parseTradingViewWatchlist(lines) {
  const rows = [];

  for (let index = 0; index < lines.length; index += 1) {
    const ticker = extractTicker(lines[index]);
    if (!ticker) continue;

    const dataLine = findWatchlistDataLine(lines, index + 1);
    if (!dataLine) continue;

    const cells = splitWatchlistDataLine(dataLine);
    if (cells.length < 15) continue;

    rows.push({
      sourceRow: index + 1,
      TICKER: ticker,
      AVGVOL: cleanNumber(cells[0]),
      PRICE: cleanNumber(cells[1]),
      VOL: cleanNumber(cells[2]),
      INDUSTRY: cleanIndustry(cells[3]),
      ROE: cleanNumber(cells[4]),
      ROIC: cleanNumber(cells[5]),
      REVGROWTH: cleanNumber(cells[6]),
      EPSGROWTH: cleanNumber(cells[7]),
      DEBT: cleanNumber(cells[8]),
      PE: cleanNumber(cells[9]),
      PEG: cleanNumber(cells[10]),
      RET1M: cleanNumber(cells[11]),
      RET3M: cleanNumber(cells[12]),
      RET6M: cleanNumber(cells[13]),
      RET12M: cleanNumber(cells[14])
    });
  }

  return rows;
}

function extractTicker(line) {
  const markdownMatch = line.match(/\[\*\*([A-Z0-9]{2,8})\*\*\]\(/);
  if (markdownMatch) return markdownMatch[1];

  const clean = stripMarkdown(line).replace(/\*/g, '').trim();
  if (/^[A-Z0-9]{2,8}$/.test(clean) && !['VN', 'HOSE', 'HNX', 'UPCOM'].includes(clean)) return clean;
  return null;
}

function findWatchlistDataLine(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = lines[index];
    const normalized = stripMarkdown(line);
    const numericHits = (normalized.match(/[+\-−]?\d[\d,.]*\s*[KMB]?|[+\-−]?\d[\d,.]*%/gi) || []).length;
    if (numericHits >= 10 && normalized.includes('%')) return line;
  }
  return null;
}

function splitWatchlistDataLine(line) {
  const stripped = stripMarkdown(line).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  if (stripped.includes('\t')) return stripped.split('\t').map(cell => cell.trim()).filter(Boolean);
  return stripped.split(/\s{2,}/).map(cell => cell.trim()).filter(Boolean);
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/\[\*\*([^\]]+)\*\*\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*/g, '');
}

function detectDelimiter(line) {
  if (line.includes('\t')) return '\t';
  if (line.includes(';')) return ';';
  if (line.split(',').length > 4) return ',';
  return /\s{2,}/;
}

function splitLine(line, delimiter) {
  if (delimiter instanceof RegExp) return line.split(delimiter).map(cell => cell.trim());
  return line.split(delimiter).map(cell => cell.trim());
}

function findHeaderIndex(table) {
  let bestIndex = 0;
  let bestScore = -1;

  table.slice(0, 12).forEach((cells, index) => {
    const columns = mapColumns(cells);
    const score = Object.keys(columns).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function mapColumns(headers) {
  const normalized = headers.map(normalizeHeader);
  const result = {};

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = normalized.findIndex(header => aliases.includes(header));
    if (index >= 0) result[field] = index;
  }

  return result;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[%()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRow(cells, columns, sourceRow) {
  const row = { sourceRow };

  for (const field of Object.keys(FIELD_ALIASES)) {
    const raw = columns[field] == null ? null : cells[columns[field]];
    row[field] = field === 'TICKER' || field === 'INDUSTRY' ? cleanText(raw) : cleanNumber(raw);
  }

  if (row.TICKER) row.TICKER = row.TICKER.toUpperCase();
  if (!row.INDUSTRY) row.INDUSTRY = 'Unknown';

  return row;
}

function cleanText(value) {
  const text = stripMarkdown(value).trim();
  if (!text || isMissing(text)) return null;
  return text;
}

function cleanIndustry(value) {
  return cleanText(value) || 'Unknown';
}

export function cleanNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  let text = stripMarkdown(value).trim();
  if (!text || isMissing(text)) return null;

  const multiplier = suffixMultiplier(text);
  text = text
    .replace(/\u2212/g, '-')
    .replace(/−/g, '-')
    .replace(/\u202f/g, '')
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(/^\+/, '')
    .replace(/[KMB]$/i, '')
    .replace(/,/g, '');

  const isPercent = text.includes('%');
  text = text.replace('%', '');

  const number = Number.parseFloat(text);
  if (!Number.isFinite(number)) return null;

  const scaled = number * multiplier;
  return isPercent ? scaled / 100 : scaled;
}

function suffixMultiplier(value) {
  const text = String(value || '').trim().toUpperCase();
  if (/[0-9]\s*K$/.test(text)) return 1_000;
  if (/[0-9]\s*M$/.test(text)) return 1_000_000;
  if (/[0-9]\s*B$/.test(text)) return 1_000_000_000;
  return 1;
}

function isMissing(value) {
  return ['-', '—', '–', 'na', 'n/a', 'null', 'undefined', '�', 'no rating'].includes(String(value).trim().toLowerCase());
}
