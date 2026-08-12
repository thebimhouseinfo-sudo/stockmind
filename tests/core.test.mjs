import assert from 'node:assert/strict';
import { parseTradingViewPaste, cleanNumber } from '../src/parser.js';
import { scoreStocks, buildStats } from '../src/scoring.js';

const input = [
  'Ticker\tIndustry\tPrice\tP/E\tROE\tROIC\tRevenue Growth\tEPS Growth\tDebt Ratio\tReturn 1M\tReturn 3M\tReturn 6M\tReturn 12M',
  'VCB\tBanks\t100\t12\t0.20\t0.18\t0.10\t0.12\t0.5\t0.03\t0.08\t0.12\t0.20',
  'HPG\tSteel\t25\t8\t0.15\t0.12\t0.08\t0.10\t1.2\t-0.05\t0.02\t0.06\t0.15'
].join('\n');

const parsed = parseTradingViewPaste(input);
assert.equal(parsed.errors.length, 0);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].TICKER, 'VCB');
assert.equal(parsed.rows[1].PE, 8);
assert.equal(cleanNumber('1.5B'), 1_500_000_000);
assert.equal(cleanNumber('12.5%'), 0.125);

const scored = scoreStocks(parsed.rows);
assert.equal(scored.length, 2);
assert.deepEqual(scored.map(row => row.RANK).sort((a, b) => a - b), [1, 2]);
assert.ok(scored.every(row => Number.isFinite(row.FINALSCORE)));
assert.ok(scored.every(row => ['A+', 'A', 'B', 'C', 'D'].includes(row.GRADE)));
assert.ok(scored.every(row => Number.isFinite(row.QUALITY_SCORE)));
assert.ok(scored.every(row => Number.isFinite(row.MOMENTUM)));

const stats = buildStats(scored);
assert.equal(stats.total, 2);
assert.equal(stats.top10.length, 2);
assert.equal(stats.industryCount.Banks, 1);

// Regression: non-positive P/E must not be treated as cheap.
const negativePeRows = scoreStocks([
  { TICKER: 'AAA', INDUSTRY: 'Energy', PRICE: 10, PE: -4, ROE: 0.10, ROIC: 0.08, REVGROWTH: 0.05, EPSGROWTH: -0.02, DEBT: 1, RET1M: 0, RET3M: 0, RET6M: 0, RET12M: 0 },
  { TICKER: 'BBB', INDUSTRY: 'Energy', PRICE: 10, PE: 8, ROE: 0.12, ROIC: 0.10, REVGROWTH: 0.06, EPSGROWTH: 0.07, DEBT: 0.8, RET1M: 0.01, RET3M: 0.02, RET6M: 0.03, RET12M: 0.05 }
]);
const negativePe = negativePeRows.find(row => row.TICKER === 'AAA');
assert.equal(negativePe.VALUATION_SCORE, 50);

// Regression: a very large EPS/revenue disconnect should not increase Growth Score.
const growthRows = scoreStocks([
  { TICKER: 'GOOD', INDUSTRY: 'Retail', PRICE: 10, PE: 10, ROE: 0.18, ROIC: 0.15, REVGROWTH: 0.25, EPSGROWTH: 0.30, DEBT: 0.5, RET1M: 0.02, RET3M: 0.05, RET6M: 0.10, RET12M: 0.15 },
  { TICKER: 'GAP', INDUSTRY: 'Retail', PRICE: 10, PE: 10, ROE: 0.18, ROIC: 0.15, REVGROWTH: 0.05, EPSGROWTH: 1.00, DEBT: 0.5, RET1M: 0.02, RET3M: 0.05, RET6M: 0.10, RET12M: 0.15 },
  { TICKER: 'MID', INDUSTRY: 'Retail', PRICE: 10, PE: 12, ROE: 0.15, ROIC: 0.12, REVGROWTH: 0.10, EPSGROWTH: 0.12, DEBT: 1.0, RET1M: 0.00, RET3M: 0.02, RET6M: 0.04, RET12M: 0.08 },
  { TICKER: 'LOW', INDUSTRY: 'Retail', PRICE: 10, PE: 15, ROE: 0.10, ROIC: 0.08, REVGROWTH: 0.03, EPSGROWTH: 0.04, DEBT: 1.5, RET1M: -0.02, RET3M: -0.01, RET6M: 0.00, RET12M: 0.02 }
]);
const good = growthRows.find(row => row.TICKER === 'GOOD');
const gap = growthRows.find(row => row.TICKER === 'GAP');
assert.ok(good.GROWTH_SCORE >= gap.GROWTH_SCORE);

console.log('Core tests passed.');
