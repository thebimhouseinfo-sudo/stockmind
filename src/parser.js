const TRADINGVIEW_COLUMNS = [
  'sector','industry','market_cap','price','change_pct','perf_1w','perf_1m','perf_3m','perf_6m','perf_1y','perf_ytd',
  'high_52w','low_52w','volume','relative_volume','avg_volume_10d','avg_volume_30d','avg_volume_60d','roe_ttm','roa_ttm',
  'revenue_fq','revenue_fy','revenue_ttm','revenue_growth_quarterly_yoy','revenue_growth_annual_yoy','eps_dil_ttm',
  'eps_dil_growth_ttm_yoy','peg_ttm','gross_margin_ttm','operating_margin_ttm','net_margin_ttm','fcf_ttm','fcf_growth_ttm_yoy',
  'debt_equity_fq','debt_equity_fy','current_ratio_fq','current_ratio_fy','quick_ratio_fq','quick_ratio_fy','pe','peg','pb','ps',
  'ev_ebitda','ev_revenue','dividend_yield_ttm'
];

// TradingView's compact K/M/B/T notation is display formatting only.
// These fields are quantity fields, so Stock Mind decodes them to the full numeric quantity.
const QUANTITY_FIELDS = new Set([
  'market_cap',
  'price',
  'high_52w',
  'low_52w',
  'volume',
  'avg_volume_10d',
  'avg_volume_30d',
  'avg_volume_60d',
  'revenue_fq',
  'revenue_fy',
  'revenue_ttm',
  'fcf_ttm'
]);

const PERCENT_FIELDS = new Set([
  'change_pct',
  'perf_1w',
  'perf_1m',
  'perf_3m',
  'perf_6m',
  'perf_1y',
  'perf_ytd',
  'roe_ttm',
  'roa_ttm',
  'revenue_growth_quarterly_yoy',
  'revenue_growth_annual_yoy',
  'eps_dil_growth_ttm_yoy',
  'gross_margin_ttm',
  'operating_margin_ttm',
  'net_margin_ttm',
  'fcf_growth_ttm_yoy',
  'dividend_yield_ttm'
]);

const RATIO_FIELDS = new Set([
  'relative_volume',
  'peg_ttm',
  'debt_equity_fq',
  'debt_equity_fy',
  'current_ratio_fq',
  'current_ratio_fy',
  'quick_ratio_fq',
  'quick_ratio_fy',
  'pe',
  'peg',
  'pb',
  'ps',
  'ev_ebitda',
  'ev_revenue'
]);

const LEGACY_ALIASES = {
  TICKER:'ticker', COMPANY_NAME:'company_name', SECTOR:'sector', INDUSTRY:'industry', PRICE:'price', VOL:'volume', AVGVOL:'avg_volume_30d', ROE:'roe_ttm', ROIC:null,
  REVGROWTH:'revenue_growth_annual_yoy', EPSGROWTH:'eps_dil_growth_ttm_yoy', DEBT:'debt_equity_fq', PE:'pe', PEG:'peg',
  RET1W:'perf_1w', RET1M:'perf_1m', RET3M:'perf_3m', RET6M:'perf_6m', RET12M:'perf_1y', RETYTD:'perf_ytd',
  HIGH_52W:'high_52w', LOW_52W:'low_52w', RELATIVE_VOLUME:'relative_volume', AVGVOL10D:'avg_volume_10d', AVGVOL60D:'avg_volume_60d'
};

const HEADER_ALIASES = {
  ticker:['symbol','ticker','ma','ma ck'], company_name:['company','company name','name','ten cong ty'], sector:['sector'], industry:['industry','nganh'],
  market_cap:['mkt cap','market cap'], price:['price','last','close','gia'], change_pct:['chg','chg %','change','change %'],
  perf_1w:['perf 1w','performance 1w'], perf_1m:['perf 1m','performance 1m'], perf_3m:['perf 3m','performance 3m'], perf_6m:['perf 6m','performance 6m'], perf_1y:['perf 1y','performance 1y'], perf_ytd:['perf ytd','performance ytd'],
  high_52w:['high 52w','52w high'], low_52w:['low 52w','52w low'], volume:['vol','volume','last volume'], relative_volume:['rel vol','relative volume'],
  avg_volume_10d:['avg vol 10d','average volume 10d'], avg_volume_30d:['avg vol 30d','average volume 30d'], avg_volume_60d:['avg vol 60d','average volume 60d'],
  roe_ttm:['roe ttm','roe'], roa_ttm:['roa ttm','roa'], revenue_fq:['revenue fq'], revenue_fy:['revenue fy'], revenue_ttm:['revenue ttm'],
  revenue_growth_quarterly_yoy:['revenue growth quarterly yoy'], revenue_growth_annual_yoy:['revenue growth annual yoy','revenue growth yoy'], eps_dil_ttm:['eps dil ttm','eps ttm'],
  eps_dil_growth_ttm_yoy:['eps dil growth ttm yoy','eps growth ttm yoy'], peg_ttm:['peg ttm'], gross_margin_ttm:['gross margin % ttm','gross margin ttm'],
  operating_margin_ttm:['op margin % ttm','operating margin % ttm','operating margin ttm'], net_margin_ttm:['net margin % ttm','net margin ttm'], fcf_ttm:['fcf ttm','free cash flow ttm'],
  fcf_growth_ttm_yoy:['fcf growth ttm yoy'], debt_equity_fq:['debt/equity fq','debt equity fq'], debt_equity_fy:['debt/equity fy','debt equity fy'],
  current_ratio_fq:['current ratio fq'], current_ratio_fy:['current ratio fy'], quick_ratio_fq:['quick ratio fq'], quick_ratio_fy:['quick ratio fy'],
  pe:['p/e','pe','price to earnings'], peg:['peg'], pb:['p/b','pb'], ps:['p/s','ps'], ev_ebitda:['ev/ebitda','ev ebitda'], ev_revenue:['ev/revenue','ev revenue'],
  dividend_yield_ttm:['div yield % ttm','dividend yield % ttm','dividend yield ttm']
};

export function parseTradingViewPaste(text) {
  const rawLines=String(text||'').split(/\r?\n/).map(line=>line.replace(/\r$/,'')).filter(line=>line.trim());
  if(!rawLines.length)return{rows:[],errors:['Chua co du lieu de xu ly.'],columns:{}};
  const screener=parseTradingViewFourLine(rawLines); if(screener.rows.length)return screener;
  const table=rawLines.map(line=>splitLine(line,detectDelimiter(line))); const headerIndex=findHeaderIndex(table); const columns=mapColumns(table[headerIndex]||[]);
  if(columns.ticker!=null&&(columns.price!=null||columns.high_52w!=null||Object.keys(columns).length>=10)){
    const rows=table.slice(headerIndex+1).filter(cells=>!isSeparatorRow(cells)).map((cells,i)=>normalizeHeaderRow(cells,columns,i+headerIndex+2)).filter(row=>row.ticker);
    return{rows,errors:[],columns:{...columns,mode:'tradingview-table'},mode:'tradingview-table'};
  }
  return{rows:[],errors:['Khong nhan dien duoc bang TradingView.'],columns,mode:'unknown'};
}

function parseTradingViewFourLine(lines){
  const rows=[]; let recordsSeen=0; let malformed=0;
  for(let i=0;i<lines.length;i+=1){
    const ticker=extractPlainTicker(lines[i]); if(!ticker)continue;
    const companyLine=lines[i+1]||''; const markerLine=(lines[i+2]||'').trim(); const dataLine=lines[i+3]||'';
    if(!dataLine.includes('\t'))continue;
    const cells=dataLine.split('\t').map(cell=>cell.trim());
    if(cells.length<TRADINGVIEW_COLUMNS.length){malformed+=1;continue;}
    recordsSeen+=1;
    const row={sourceRow:i+1,ticker,company_name:cleanText(companyLine),ui_marker:markerLine==='D'?'D':markerLine||null};
    for(let index=0;index<TRADINGVIEW_COLUMNS.length;index+=1){
      const field=TRADINGVIEW_COLUMNS[index]; const value=cells[index]??null;
      row[field]=cleanFieldValue(field,value);
    }
    if(!row.industry)row.industry='Unknown'; applyLegacyAliases(row); rows.push(row); i+=3;
  }
  if(recordsSeen)return{rows,errors:malformed?[`Bo qua ${malformed} dong TradingView khong du 46 cot.`]:[],columns:buildScreenerColumns(),mode:'tradingview-four-line-tab'};
  return{rows:[],errors:[],columns:{},mode:null};
}

function buildScreenerColumns(){const columns={mode:'tradingview-four-line-tab',ticker:-1,company_name:-1};TRADINGVIEW_COLUMNS.forEach((field,index)=>{columns[field]=index;});return columns;}
function extractPlainTicker(line){const value=stripMarkdown(line).replace(/\s+D\s*$/i,'').trim();if(/^[A-Z0-9]{2,8}$/.test(value)&&!['VN','HOSE','HNX','UPCOM'].includes(value))return value;return null;}
function normalizeHeaderRow(cells,columns,sourceRow){const row={sourceRow};for(const field of Object.keys(HEADER_ALIASES)){const index=columns[field];const raw=index==null?null:cells[index];if(field==='ticker')row.ticker=extractPlainTicker(raw)||cleanText(raw);else row[field]=cleanFieldValue(field,raw);}if(!row.industry)row.industry='Unknown';applyLegacyAliases(row);return row;}
function applyLegacyAliases(row){for(const [legacy,source] of Object.entries(LEGACY_ALIASES))row[legacy]=source?row[source]??null:null;return row;}
function mapColumns(headers){const normalized=headers.map(normalizeHeader);const result={};for(const [field,aliases] of Object.entries(HEADER_ALIASES)){const index=normalized.findIndex(header=>aliases.includes(header));if(index>=0)result[field]=index;}if(result.ticker==null&&result.company_name!=null)result.ticker=result.company_name;return result;}
function findHeaderIndex(table){let bestIndex=0,bestScore=-1;table.slice(0,12).forEach((cells,index)=>{const score=Object.keys(mapColumns(cells)).length;if(score>bestScore){bestScore=score;bestIndex=index;}});return bestIndex;}
function normalizeHeader(value){return String(value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[|%()]/g,'').replace(/\s+/g,' ').trim();}
function detectDelimiter(line){if(line.includes('\t'))return'\t';if(line.includes(';'))return';';if(line.split(',').length>4)return',';if(line.includes('|'))return'|';return/\s{2,}/;}
function splitLine(line,delimiter){return delimiter instanceof RegExp?line.split(delimiter).map(v=>v.trim()):line.split(delimiter).map(v=>v.trim());}
function isSeparatorRow(cells){return cells.length>0&&cells.every(cell=>/^\s*:?-{1,}:?\s*$/.test(cell)||cell==='');}
function stripMarkdown(value){return String(value||'').replace(/\[\*\*([^\]]+)\*\*\]\([^)]+\)/g,'$1').replace(/\[([^\]]+)\]\([^)]+\)/g,'$1').replace(/\*\*/g,'');}
function cleanText(value){const text=stripMarkdown(value).trim();return isMissing(text)?null:text||null;}

function cleanFieldValue(field,value){
  if(field==='company_name'||field==='sector'||field==='industry')return cleanText(value);
  if(QUANTITY_FIELDS.has(field))return cleanQuantity(value);
  if(PERCENT_FIELDS.has(field))return cleanPercent(value);
  if(RATIO_FIELDS.has(field))return cleanRatio(value);
  return cleanText(value);
}

export function cleanPercent(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  let text=stripMarkdown(value).trim();
  if(!text||isMissing(text))return null;
  text=text.replace(/\u2212/g,'-').replace(/âˆ’/g,'-').replace(/\u202f/g,'').replace(/\u00a0/g,'').replace(/\s/g,'').replace(/^\+/,'').replace('%','').replace(/,/g,'');
  const number=Number.parseFloat(text);
  return Number.isFinite(number)?number:null;
}

export function cleanRatio(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  let text=stripMarkdown(value).trim();
  if(!text||isMissing(text))return null;
  text=text.replace(/\u2212/g,'-').replace(/âˆ’/g,'-').replace(/\u202f/g,'').replace(/\u00a0/g,'').replace(/\s/g,'').replace(/^\+/,'').replace(/,/g,'');
  const number=Number.parseFloat(text);
  return Number.isFinite(number)?number:null;
}

export function cleanQuantity(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  let text=stripMarkdown(value).trim();
  if(!text||isMissing(text))return null;
  const multiplier=suffixMultiplier(text);
  const hasSuffix=/[KMBT]\s*$/i.test(text);
  text=text.replace(/\u2212/g,'-').replace(/−/g,'-').replace(/\u202f/g,'').replace(/\u00a0/g,'').replace(/\s/g,'').replace(/^\+/,'').replace(/[KMBT]$/i,'');
  if(!hasSuffix && /^[-+]?\d{1,3}([.,]\d{3})+$/.test(text)) text=text.replace(/[.,]/g,'');
  else if(hasSuffix && text.includes(',') && !text.includes('.')) text=text.replace(',', '.');
  else if(hasSuffix && text.includes(',') && text.includes('.')) text=text.replace(/,/g,'');
  else if(!hasSuffix && text.includes(',') && text.includes('.')) text=text.replace(/,/g,'');
  const number=Number.parseFloat(text);
  if(!Number.isFinite(number))return null;
  return number*multiplier;
}

function suffixMultiplier(value){const text=String(value||'').trim().toUpperCase();if(/[0-9][\d.,]*\s*K$/.test(text))return 1_000;if(/[0-9][\d.,]*\s*M$/.test(text))return 1_000_000;if(/[0-9][\d.,]*\s*B$/.test(text))return 1_000_000_000;if(/[0-9][\d.,]*\s*T$/.test(text))return 1_000_000_000_000;return 1;}
function isMissing(value){return['-','—','–','na','n/a','null','undefined','�','no rating'].includes(String(value||'').trim().toLowerCase());}
