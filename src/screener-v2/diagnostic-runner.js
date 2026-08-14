import { validateScreenerContract } from './contract-validator.js';
import { evaluatePriceDislocation } from './price-dislocation.js';
import { evaluateMomentumVolume } from './momentum-volume.js';
import { buildCompositeScore, buildRanking, evaluateFullScreener } from './full-evaluation.js';
import { getSandboxRegistry } from './registry.js';

export function runScreenerV2Sandbox(rawRows, options = {}) {
  const registry = options.registry || getSandboxRegistry();
  const evaluated = rawRows.map((rawRow, index) => {
    const contract = validateScreenerContract(rawRow, { registry });
    const priceDislocation = evaluatePriceDislocation(contract, { registry });
    const momentumVolume = evaluateMomentumVolume(contract, { registry });
    const full = evaluateFullScreener(contract, {
      price_dislocation: priceDislocation,
      momentum_volume: momentumVolume
    });
    return buildResult(rawRow, index, contract, priceDislocation, momentumVolume, full, registry);
  });

  return buildRanking(evaluated);
}

function buildResult(rawRow, index, contract, priceDislocation, momentumVolume, full, registry) {
  const result = {
    ...rawRow,
    TICKER: rawRow.TICKER ?? rawRow.ticker ?? contract.input.ticker ?? null,
    COMPANY_NAME: rawRow.COMPANY_NAME ?? rawRow.company_name ?? contract.input.company_name ?? null,
    SECTOR: rawRow.SECTOR ?? rawRow.sector ?? contract.input.sector ?? null,
    INDUSTRY: rawRow.INDUSTRY ?? rawRow.industry ?? contract.input.industry ?? 'Unknown',
    PRICE: rawRow.PRICE ?? rawRow.price ?? contract.input.price ?? null,
    HIGH_52W: rawRow.HIGH_52W ?? rawRow.high_52w ?? contract.input.high_52w ?? null,
    LOW_52W: rawRow.LOW_52W ?? rawRow.low_52w ?? contract.input.low_52w ?? null,
    RET1W: rawRow.RET1W ?? rawRow.perf_1w ?? contract.input.perf_1w ?? null,
    RET1M: rawRow.RET1M ?? rawRow.perf_1m ?? contract.input.perf_1m ?? null,
    RET3M: rawRow.RET3M ?? rawRow.perf_3m ?? contract.input.perf_3m ?? null,
    RET6M: rawRow.RET6M ?? rawRow.perf_6m ?? contract.input.perf_6m ?? null,
    RET12M: rawRow.RET12M ?? rawRow.perf_1y ?? contract.input.perf_1y ?? null,
    RETYTD: rawRow.RETYTD ?? rawRow.perf_ytd ?? contract.input.perf_ytd ?? null,
    VOL: rawRow.VOL ?? rawRow.volume ?? contract.input.volume ?? null,
    RELATIVE_VOLUME: rawRow.RELATIVE_VOLUME ?? rawRow.relative_volume ?? contract.input.relative_volume ?? null,
    AVGVOL: rawRow.AVGVOL ?? rawRow.avg_volume_30d ?? contract.input.avg_volume_30d ?? null,
    PE: rawRow.PE ?? rawRow.pe ?? contract.input.pe ?? null,
    PEG: rawRow.PEG ?? rawRow.peg ?? contract.input.peg ?? null,
    PB: rawRow.PB ?? rawRow.pb ?? contract.input.pb ?? null,
    PS: rawRow.PS ?? rawRow.ps ?? contract.input.ps ?? null,
    ROE: rawRow.ROE ?? rawRow.roe_ttm ?? contract.input.roe_ttm ?? null,
    ROA: rawRow.ROA ?? rawRow.roa_ttm ?? contract.input.roa_ttm ?? null,
    REVGROWTH: rawRow.REVGROWTH ?? rawRow.revenue_growth_annual_yoy ?? contract.input.revenue_growth_annual_yoy ?? null,
    EPSGROWTH: rawRow.EPSGROWTH ?? rawRow.eps_dil_growth_ttm_yoy ?? contract.input.eps_dil_growth_ttm_yoy ?? null,
    DEBT: rawRow.DEBT ?? rawRow.debt_equity_fq ?? contract.input.debt_equity_fq ?? null,
    FCF: rawRow.FCF ?? rawRow.fcf_ttm ?? contract.input.fcf_ttm ?? null
  };

  const flags = [
    ...contract.issues.map(issue => issue.code),
    ...priceDislocation.signals,
    ...priceDislocation.quality_flags,
    ...momentumVolume.signals,
    ...momentumVolume.quality_flags,
    ...full.signals
  ];

  result.SCREENER_V2 = {
    source: 'StockMind Screener V2 Sandbox',
    source_row: rawRow.sourceRow ?? index + 1,
    registry,
    contract,
    price_dislocation: priceDislocation,
    momentum_volume: momentumVolume,
    factors: full.factors,
    axes: full.axes,
    risk_gate: full.risk_gate,
    classification: full.classification,
    signals: full.signals
  };

  result.DATA_NOTES = [...new Set(flags)];
  result.DATA_FLAGS = result.DATA_NOTES.filter(isImportantFlag);
  result.DATA_COVERAGE = combinedCoveragePercent(contract);
  result.DATA_INTEGRITY = dataIntegrity(result.DATA_COVERAGE);
  result.SCREENING_GROUP = full.classification.classification;
  result.FINALSCORE = buildCompositeScore(full);
  result.GRADE = grade(result.FINALSCORE);
  result.RANK = null;
  result.QUALITY_SCORE = full.factors.QUALITY.score;
  result.GROWTH_SCORE = full.factors.GROWTH.score;
  result.VALUATION_SCORE = full.factors.VALUATION.score;
  result.MARKET_SCORE = full.factors.MOMENTUM.score;
  result.MOMENTUM = full.factors.MOMENTUM.score;
  result.MISPRICING = full.axes.OPPORTUNITY_AXIS.score;
  result.MICRO = full.factors.SAFETY.score;

  return result;
}

function isImportantFlag(flag) {
  return [
    'CRITICAL_INPUT_INVALID_FOR_USAGE',
    'PRICE_ABOVE_STORED_52W_HIGH',
    'INCONSISTENT_REFERENCE',
    'PRICE_HIGH_52W_MISMATCH',
    'INVALID_52W_RANGE',
    'VALUE_TRAP_WARNING',
    'HIGH_LEVERAGE',
    'NEGATIVE_FCF'
  ].includes(flag);
}

function combinedCoveragePercent(contract) {
  const coverageSets = Object.values(contract.family_coverage || { price_dislocation: contract.coverage });
  const intended = coverageSets.reduce((sum, coverage) => sum + coverage.intended_metric_ids.length, 0);
  if (!intended) return null;
  const available = coverageSets.reduce((sum, coverage) => sum + coverage.available_metric_ids.length, 0);
  return Math.round((100 * available / intended) * 100) / 100;
}

function dataIntegrity(coverage) {
  if (coverage == null) return 'DATA_UNKNOWN';
  if (coverage >= 80) return 'DATA_OK';
  if (coverage >= 50) return 'DATA_PARTIAL';
  return 'DATA_WARNING';
}

function grade(score) {
  if (!Number.isFinite(score)) return 'UNRANKED';
  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}
