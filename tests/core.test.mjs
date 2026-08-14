import assert from 'node:assert/strict';
import { parseTradingViewPaste, cleanPercent, cleanQuantity, cleanRatio } from '../src/parser.js';
import { scoreStocks, buildStats } from '../src/scoring.js';
import { validateScreenerContract } from '../src/screener-v2/contract-validator.js';
import { evaluatePriceDislocation } from '../src/screener-v2/price-dislocation.js';
import { evaluateMomentumVolume } from '../src/screener-v2/momentum-volume.js';
import { encodeShareCode, decodeShareCode } from '../src/share-code.js';

assert.equal(cleanQuantity('1.5B'), 1_500_000_000);
assert.equal(cleanQuantity('41.000'), 41_000);
assert.equal(cleanPercent('12.5%'), 12.5);
assert.equal(cleanPercent('-37.12%'), -37.12);
assert.equal(cleanRatio('0.65'), 0.65);

const tableInput = [
  'Ticker\tIndustry\tPrice\tHigh 52W\tLow 52W\tPerf 1M\tP/E',
  'VCB\tBanks\t100\t120\t80\t4.86%\t12',
  'HPG\tSteel\t25\t50\t20\t-0.58%\t8'
].join('\n');

const parsed = parseTradingViewPaste(tableInput);
assert.equal(parsed.errors.length, 0);
assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].TICKER, 'VCB');
assert.equal(parsed.rows[0].HIGH_52W, 120);
assert.equal(parsed.rows[0].RET1M, 4.86);

const scored = scoreStocks(parsed.rows);
assert.equal(scored.length, 2);
assert.ok(scored.every(row => row.SCREENER_V2));
assert.ok(scored.every(row => row.SCREENER_V2.momentum_volume));
assert.ok(scored.every(row => ['CORE', 'QUALITY_UNDERPERFORMER', 'HIGH_REWARD_HIGH_RISK', 'AVOID_VALUE_TRAP', 'WATCH_NEUTRAL'].includes(row.SCREENING_GROUP)));
assert.ok(scored.every(row => ['A+', 'A', 'B', 'C', 'D', 'UNRANKED'].includes(row.GRADE)));
assert.ok(scored.every(row => Number.isFinite(row.FINALSCORE)));
assert.deepEqual(scored.map(row => row.RANK).sort((a, b) => a - b), [1, 2]);

const stats = buildStats(scored);
assert.equal(stats.total, 2);
assert.equal(stats.screenerV2.calibration_status, 'SANDBOX');
assert.equal(stats.screenerV2.production_ranking, false);

const shareCode = await encodeShareCode(scored, { source: 'test' });
assert.ok(/^SM[GJ]1\./.test(shareCode));
const shared = await decodeShareCode(shareCode);
assert.equal(shared.kind, 'stockmind-screener');
assert.equal(shared.rows.length, scored.length);
assert.equal(shared.rows[0].TICKER, scored[0].TICKER);

const scenarios = [
  {
    name: 'normal valid row',
    row: { TICKER: 'AAA', PRICE: 80, HIGH_52W: 100, LOW_52W: 50 },
    profile: 'PROFILE_ONLY',
    drawdown: -0.2,
    signal: null
  },
  {
    name: 'severe drawdown',
    row: { TICKER: 'DDD', PRICE: 60, HIGH_52W: 100, LOW_52W: 50 },
    profile: 'PROFILE_ONLY',
    drawdown: -0.4,
    signal: 'SEVERE_DRAWDOWN'
  },
  {
    name: 'price near 52w high',
    row: { TICKER: 'HIGH', PRICE: 97, HIGH_52W: 100, LOW_52W: 50 },
    profile: 'PROFILE_ONLY',
    drawdown: -0.03,
    signal: 'NEAR_52W_HIGH'
  },
  {
    name: 'narrow 52w range',
    row: { TICKER: 'NAR', PRICE: 99, HIGH_52W: 100, LOW_52W: 96 },
    profile: 'PROFILE_ONLY',
    flag: 'LOW_BASE_UNRELIABLE'
  },
  {
    name: 'missing high 52w',
    row: { TICKER: 'MISS', PRICE: 99, HIGH_52W: null, LOW_52W: 80 },
    profile: 'UNSCOREABLE',
    issue: 'CRITICAL_INPUT_MISSING'
  },
  {
    name: 'invalid non-positive price',
    row: { TICKER: 'BADP', PRICE: 0, HIGH_52W: 100, LOW_52W: 80 },
    profile: 'UNSCOREABLE',
    issue: 'CRITICAL_INPUT_INVALID_FOR_USAGE'
  },
  {
    name: 'price above high without clamping',
    row: { TICKER: 'ABV', PRICE: 110, HIGH_52W: 100, LOW_52W: 80 },
    profile: 'PROFILE_ONLY',
    signal: 'PRICE_ABOVE_STORED_52W_HIGH',
    pricePreserved: 110
  }
];

for (const scenario of scenarios) {
  const contract = validateScreenerContract(scenario.row);
  const result = evaluatePriceDislocation(contract);
  assert.equal(result.profile, scenario.profile, scenario.name);
  if (scenario.drawdown != null) assert.equal(result.derived.drawdown_52w.value, scenario.drawdown, scenario.name);
  if (scenario.signal) assert.ok(result.signals.includes(scenario.signal), scenario.name);
  if (scenario.flag) assert.ok(result.quality_flags.includes(scenario.flag), scenario.name);
  if (scenario.issue) assert.ok(contract.issues.some(issue => issue.code === scenario.issue), scenario.name);
  if (scenario.pricePreserved != null) assert.equal(contract.input.price, scenario.pricePreserved, scenario.name);
}

const missingCritical = validateScreenerContract({ TICKER: 'UNK', PRICE: 50, HIGH_52W: null, LOW_52W: 30 });
const unknownDecision = evaluatePriceDislocation(missingCritical);
assert.equal(unknownDecision.decision_inputs.severe_drawdown, 'UNKNOWN');
assert.equal(unknownDecision.profile, 'UNSCOREABLE');

const structural = evaluatePriceDislocation(validateScreenerContract({ TICKER: 'STR', PRICE: 75, HIGH_52W: 100, LOW_52W: 50 }));
assert.ok(structural.structural_relationships.some(item => item.metrics.includes('drawdown_52w') && item.metrics.includes('upside_to_52w_high')));

const ranked = scoreStocks([{ TICKER: 'RNK', PRICE: 75, HIGH_52W: 100, LOW_52W: 50, ROE: 20, REVGROWTH: 15, PE: 12, RET1M: 5, RET3M: 8, RET6M: 12 }])[0].RANKING_RECORD;
assert.equal(ranked.rankability, 'RANKABLE');
assert.equal(ranked.rank_position, 1);

const strongMomentum = evaluateMomentumVolume(validateScreenerContract({
  TICKER: 'MOM',
  PRICE: 80,
  HIGH_52W: 100,
  LOW_52W: 50,
  RET1M: 10,
  RET3M: 20,
  RET6M: 25,
  RELATIVE_VOLUME: 1.4
}));
assert.equal(strongMomentum.profile, 'PROFILE_ONLY');
assert.equal(strongMomentum.derived.medium_momentum.value, 20.25);
assert.ok(strongMomentum.signals.includes('STRONG_MEDIUM_MOMENTUM'));
assert.ok(strongMomentum.signals.includes('PRICE_VOLUME_CONFIRMATION'));
assert.equal(strongMomentum.decision_inputs.volume_confirmation, 'TRUE');

const weakMomentum = evaluateMomentumVolume(validateScreenerContract({
  TICKER: 'WEAK',
  PRICE: 80,
  HIGH_52W: 100,
  LOW_52W: 50,
  RET1M: -12,
  RET3M: -20,
  RET6M: -8,
  RELATIVE_VOLUME: 0.4
}));
assert.ok(weakMomentum.signals.includes('WEAK_MEDIUM_MOMENTUM'));
assert.ok(weakMomentum.quality_flags.includes('LOW_RELATIVE_VOLUME_CONTEXT'));
assert.equal(weakMomentum.decision_inputs.low_relative_volume, 'TRUE');

const partialMomentum = evaluateMomentumVolume(validateScreenerContract({
  TICKER: 'PART',
  PRICE: 80,
  HIGH_52W: 100,
  LOW_52W: 50,
  RET1M: 5,
  RET3M: null,
  RET6M: 7
}));
assert.equal(partialMomentum.profile, 'PARTIALLY_SCOREABLE');
assert.equal(partialMomentum.computability_state, 'PARTIAL_INPUT');
assert.equal(partialMomentum.decision_inputs.volume_confirmation, 'UNKNOWN');

const unknownMomentum = evaluateMomentumVolume(validateScreenerContract({
  TICKER: 'NOMOM',
  PRICE: 80,
  HIGH_52W: 100,
  LOW_52W: 50
}));
assert.equal(unknownMomentum.profile, 'UNKNOWN');
assert.equal(unknownMomentum.decision_inputs.strong_medium_momentum, 'UNKNOWN');

const fullRows = scoreStocks([
  { TICKER: 'COREX', PRICE: 90, HIGH_52W: 100, LOW_52W: 50, ROE: 24, ROA: 12, REVGROWTH: 22, EPSGROWTH: 25, PE: 12, PEG: 0.8, DEBT: 0.4, RET1M: 6, RET3M: 12, RET6M: 20, RELATIVE_VOLUME: 1.3, FCF: 1_000_000 },
  { TICKER: 'TRAPX', PRICE: 40, HIGH_52W: 100, LOW_52W: 35, ROE: 2, ROA: 1, REVGROWTH: -15, EPSGROWTH: -20, PE: 6, DEBT: 3.5, CURRENT_RATIO: 0.6, RET1M: -8, RET3M: -15, RET6M: -30, FCF: -1_000_000 }
]);
assert.ok(fullRows[0].FINALSCORE >= fullRows[1].FINALSCORE);
assert.ok(fullRows.some(row => row.SCREENING_GROUP === 'CORE' || row.SCREENING_GROUP === 'WATCH_NEUTRAL'));
assert.ok(fullRows.some(row => row.SCREENING_GROUP === 'AVOID_VALUE_TRAP'));
assert.ok(fullRows.every(row => row.SCREENER_V2.factors && row.SCREENER_V2.axes && row.SCREENER_V2.risk_gate));

console.log('Screener V2 sandbox tests passed.');
