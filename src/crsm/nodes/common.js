import { todayISODate } from '../context.js';

export function currentDateDDMMYYYY() {
  const [y, m, d] = todayISODate().split('-');
  return `${d}/${m}/${y}`;
}

export function detectSectorType(industry) {
  const text = String(industry || '').toLowerCase();
  if (/(bank|ngân hàng|banks|ngan hang)/.test(text)) return 'BANK';
  if (/(insurance|bảo hiểm|bao hiem)/.test(text)) return 'INSURANCE';
  if (/(real estate|bất động sản|bat dong san|property)/.test(text)) return 'REAL_ESTATE';
  if (/(tech|technology|software|semiconductor|công nghệ|cong nghe|it services|internet)/.test(text)) return 'TECH';
  if (/(consumer|retail|food|beverage|tiêu dùng|ban le|thực phẩm|thuc pham|apparel)/.test(text)) return 'CONSUMER';
  if (/(utility|electric|power|water|điện|dien luc|dien khi|gas distribution|Điện nước)/.test(text)) return 'UTILITY';
  return 'INDUSTRIAL';
}

export function buildBaseUserPrompt(ctx) {
  const mode = ctx.screeningContext ? 'SCREENED' : 'DIRECT';
  return {
    TICKER: ctx.ticker,
    CURRENT_DATE: currentDateDDMMYYYY(),
    ISO_DATE: todayISODate(),
    SECTOR_TYPE: ctx.sectorType,
    ANALYSIS_MODE: mode,
    SCREENING_CONTEXT: ctx.screeningContext
      ? JSON.stringify(ctx.screeningContext, null, 2)
      : 'null'
  };
}

export function fillPromptTemplate(template, values) {
  let out = String(template);
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`{${key}}`).join(String(value));
  }
  return out;
}