const FIELD_ALIASES = {
  ticker: ['symbol', 'ticker', 'ma', 'ma ck'],
  company_name: ['symbol', 'company', 'company name', 'name', 'ten cong ty'],
  sector: ['sector'],
  industry: ['industry', 'nganh'],
  market_cap: ['mkt cap', 'market cap'],
  price: ['price', 'last', 'close', 'gia'],
  change_pct: ['chg', 'chg %', 'change', 'change %'],
  perf_1w: ['perf 1w', 'performance 1w'],
  perf_1m: ['perf 1m', 'performance 1m'],
  perf_3m: ['perf 3m', 'performance 3m'],
  perf_6m: ['perf 6m', 'performance 6m'],
  perf_1y: ['perf 1y', 'performance 1y'],
  perf_ytd: ['perf ytd', 'performance ytd'],
  high_52w: ['high 52w', '52w high'],
  low_52w: ['low 52w', '52w low'],
  volume: ['vol', 'volume', 'last volume'],
  relative_volume: ['rel vol', 'relative volume'],
  avg_volume_10d: ['avg vol 10d', 'average volume 10d'],
  avg_volume_30d: ['avg vol 30d', 'average volume 30d'],
  avg_volume_60d: ['avg vol 60d', 'average volume 60d'],
  roe_ttm: ['roe ttm', 'roe'],
  roa_ttm: ['roa ttm', 'roa'],
  revenue_fq: ['revenue fq'],
  revenue_fy: ['revenue fy'],
  revenue_ttm: ['revenue ttm'],
  revenue_growth_quarterly_yoy: ['revenue growth quarterly yoy'],
  revenue_growth_annual_yoy: ['revenue growth annual yoy', 'revenue growth yoy'],
  eps_dil_ttm: ['eps dil ttm', 'eps ttm'],
  eps_dil_growth_ttm_yoy: ['eps dil growth ttm yoy', 'eps growth ttm yoy'],
  peg_ttm: ['peg ttm'],
  gross_margin_ttm: ['gross margin % ttm', 'gross margin ttm'],
  operating_margin_ttm: ['op margin % ttm', 'operating margin % ttm', 'operating margin ttm'],
  net_margin_ttm: ['net margin % ttm', 'net margin ttm'],
  fcf_ttm: ['fcf ttm', 'free cash flow ttm'],
  fcf_growth_ttm_yoy: ['fcf growth ttm yoy'],
  debt_equity_fq: ['debt/equity fq', 'debt equity fq'],
  debt_equity_fy: ['debt/equity fy', 'debt equity fy'],
  current_ratio_fq: ['current ratio fq'],
  current_ratio_fy: ['current ratio fy'],
  quick_ratio_fq: ['quick ratio fq'],
  quick_ratio_fy: ['quick ratio fy'],
  pe: ['p/e', 'pe', 'price to earnings'],
  peg: ['peg'],
  pb: ['p/b', 'pb'],
  ps: ['p/s', 'ps'],
  ev_ebitda: ['ev/ebitda', 'ev ebitda'],
  ev_revenue: ['ev/revenue', 'ev revenue'],
  dividend_yield_ttm: ['div yield % ttm', 'dividend yield % ttm', 'dividend yield ttm']
};

const LEGACY_ALIASES = {
  TICKER: 'ticker',
  COMPANY_NAME: 'company_name',
  SECTOR: 'sector',
  INDUSTRY: 'industry',
  PRICE: 'price',
  VOL: 'volume',
  AVGVOL: 'avg_volume_30d',
  ROE: 'roe_ttm',
  ROIC: null,
  REVGROWTH: 'revenue_growth_annual_yoy',
  EPSGROWTH: 'eps_dil_growth_ttm_yoy',
  DEBT: 'debt_equity_fq',
  PE: 'pe',
  PEG: 'peg',
  RET1M: 'perf_1m',
  RET3M: 'perf_3m',
  RET6M: 'perf_6m',
  RET12M: 'perf_1y'
};

export function parseTradingViewPaste(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return { rows: [], errors: ['Chua co du lieu de xu ly.'], columns: {} };
  }

  // Prefer the full TradingView table whenever its header is present.
  // The legacy watchlist format has a very different row layout and must
  // never be allowed to reinterpret a full screener export.
  const delimiter = detectDelimiter(lines[0]);
  const table = lines.map(line => splitLine(line, delimiter));
  const headerIndex = findHeaderIndex(table);
  const headers = table[headerIndex] || [];
  const columns = mapColumns(headers);
  const headerFieldCount = Object.keys(columns).length;
  const hasFullTableHeader = headerFieldCount >= 10 && columns.ticker != null && columns.industry != null;

  if (hasFullTableHeader) {
    const missing = ['ticker', 'sector', 'industry', 'price'].filter(field => columns[field] == null);
    const errors = missing.length ? [`Thieu cot bat buoc: ${missing.join(', ')}`] : [];
    const rows = table
      .slice(headerIndex + 1)
      .filter(cells => !isSeparatorRow(cells))
      .map((cells, rowIndex) => normalizeRow(cells, columns, rowIndex + headerIndex + 2))
      .filter(row => row.ticker);

    return { rows, errors, columns: { ...columns, mode: 'tradingview-table' } };
  }

  const watchlistRows = parseTradingViewWatchlist(lines);
  if (watchlistRows.length) {
    return { rows: watchlistRows, errors: [], columns: { mode: 'tradingview-watchlist' } };
  }

  return { rows: [], errors: ['Khong nhan dien duoc bang TradingView.'], columns };
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
      ticker,
      company_name: extractCompanyName(lines[index]),
      sector: null,
      industry: cleanIndustry(cells[3]),
      avg_volume_10d: null,
      avg_volume_30d: cleanNumber(cells[0]),
      avg_volume_60d: null,
      price: cleanNumber(cells[1]),
      volume: cleanNumber(cells[2]),
      relative_volume: null,
      roe_ttm: cleanNumber(cells[4]),
      roa_ttm: null,
      revenue_fq: null,
      revenue_fy: null,
      revenue_ttm: null,
      revenue_growth_quarterly_yoy: null,
      revenue_growth_annual_yoy: cleanNumber(cells[6]),
      eps_dil_ttm: null,
      eps_dil_growth_ttm_yoy: cleanNumber(cells[7]),
      peg_ttm: null,
      gross_margin_ttm: null,
      operating_margin_ttm: null,
      net_margin_ttm: null,
      fcf_ttm: null,
      fcf_growth_ttm_yoy: null,
      debt_equity_fq: cleanNumber(cells[8]),
      debt_equity_fy: null,
      current_ratio_fq: null,
      current_ratio_fy: null,
      quick_ratio_fq: null,
      quick_ratio_fy: null,
      pe: cleanNumber(cells[9]),
      peg: cleanNumber(cells[10]),
      pb: null,
      ps: null,
      ev_ebitda: null,
      ev_revenue: null,
      dividend_yield_ttm: null,
      change_pct: null,
      perf_1w: null,
      perf_1m: cleanNumber(cells[11]),
      perf_3m: cleanNumber(cells[12]),
      perf_6m: cleanNumber(cells[13]),
      perf_1y: cleanNumber(cells[14]),
      perf_ytd: null,
      high_52w: null,
      low_52w: null
    });
  }

  return rows.map(withLegacyAliases);
}

function extractTicker(line) {
  const markdownMatch = line.match(/\[\*\*([A-Z0-9]{2,8})\*\*\]\(/);
  if (markdownMatch) return markdownMatch[1];

  const clean = stripMarkdown(line).replace(/\*/g, '').trim();
  const ticker = clean.split(/\s+/)[0];
  if (/^[A-Z0-9]{2,8}$/.test(ticker) && !['VN', 'HOSE', 'HNX', 'UPCOM'].includes(ticker)) return ticker;
  return null;
}

function extractCompanyName(line) {
  const markdown = String(line || '').match(/\]\((?:[^)]*)\)\s*([^\[]+?)(?:\s*D)?$/);
  if (markdown) return cleanText(markdown[1]);
  const clean = stripMarkdown(line).replace(/\s+D\s*$/i, '').trim();
  const ticker = extractTicker(line);
  return ticker ? clean.replace(new RegExp(`^${ticker}\\s*`, 'i'), '').trim() || null : null;
}

function findWatchlistDataLine(lines, startIndex) {
  for (let index = startIndex; index < Math.min(lines.length, startIndex + 8); index += 1) {
    const line = lines[index];
    const normalized = stripMarkdown(line);
    const numericHits = (normalized.match(/[+\-−]?\d[\d,.]*\s*[KMBT]?|[+\-−]?\d[\d,.]*%/gi) || []).length;
    if (numericHits >= 10 && normalized.includes('%')) return line;
  }
  return null;
}

function splitWatchlistDataLine(line) {
  const stripped = stripMarkdown(line).replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ');
  if (stripped.includes('\t')) return stripped.split('\t').map(cell => cell.trim());
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
  if (line.includes('|')) return '|';
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

  if (result.ticker == null) result.ticker = result.company_name;
  if (result.company_name == null) result.company_name = result.ticker;

  return result;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[|%()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRow(cells, columns, sourceRow) {
  const row = { sourceRow };

  for (const field of Object.keys(FIELD_ALIASES)) {
    const raw = columns[field] == null ? null : cells[columns[field]];
    if (field === 'ticker') {
      row.ticker = extractTickerFromSymbolCell(raw);
    } else if (field === 'company_name') {
      row.company_name = extractCompanyNameFromSymbolCell(raw);
    } else if (field === 'sector' || field === 'industry') {
      row[field] = cleanText(raw);
    } else {
      row[field] = cleanNumber(raw);
    }
  }

  if (!row.ticker) row.ticker = null;
  if (!row.company_name) row.company_name = null;
  if (!row.industry) row.industry = 'Unknown';

  return withLegacyAliases(row);
}

function extractTickerFromSymbolCell(value) {
  const text = stripMarkdown(value).replace(/\s+D\s*$/i, '').trim();
  const match = text.match(/^([A-Z0-9]{2,8})(?:\s+|$)/);
  return match ? match[1].toUpperCase() : null;
}

function extractCompanyNameFromSymbolCell(value) {
  const text = stripMarkdown(value).replace(/\s+D\s*$/i, '').trim();
  const ticker = extractTickerFromSymbolCell(text);
  return ticker ? text.slice(ticker.length).trim() || null : null;
}

function withLegacyAliases(row) {
  for (const [legacyField, sourceField] of Object.entries(LEGACY_ALIASES)) {
    row[legacyField] = sourceField ? row[sourceField] ?? null : null;
  }
  return row;
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every(cell => /^\s*:?-{1,}:?\s*$/.test(cell) || cell === '');
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
    .replace(/[KMBT]$/i, '')
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
  if (/[0-9]\s*T$/.test(text)) return 1_000_000_000_000;
  return 1;
}

function isMissing(value) {
  return ['-', '—', '–', 'na', 'n/a', 'null', 'undefined', '�', 'no rating'].includes(String(value).trim().toLowerCase());
}
