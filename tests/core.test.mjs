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

console.log('Core tests passed.');
