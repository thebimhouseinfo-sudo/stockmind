import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adaptMemoResult,
  decisionLogRows,
  normalizeMemoRun,
  normalizeRenderSnapshot,
  selectDefaultTicker,
  selectedRunItem,
  summarizeMemoRun
} from '../src/crsm/result-adapter.js';
import { createResultsPoller } from '../src/crsm/results-poller.js';
import { renderResultsPage } from '../src/crsm/ui/results.js';

const screened = JSON.parse(readFileSync(new URL('./fixtures/crsm/screened-web.json', import.meta.url), 'utf8'));
const evidence = JSON.parse(readFileSync(new URL('./fixtures/crsm/evidence-web.json', import.meta.url), 'utf8'));
const webOnly = JSON.parse(readFileSync(new URL('./fixtures/crsm/web-only.json', import.meta.url), 'utf8'));

for (const fixture of [screened, evidence, webOnly]) {
  const adapted = adaptMemoResult(fixture.result);
  assert.equal(adapted.ticker, fixture.result.ticker);
  assert.match(adapted.visualReport, /^<!DOCTYPE html>/);
  assert.match(adapted.visualReport, /BÁO CÁO PHÂN TÍCH CHUYÊN SÂU/);
  assert.match(adapted.visualReport, new RegExp(fixture.result.ticker));
  assert.match(adapted.visualReport, new RegExp(String(fixture.result.outputs.node5.ai_score.value)));
  assert.doesNotMatch(adapted.visualReport, /Senior Equity Analyst|Key Insight|Volume Ratio|BULL CASE|BASE CASE|BEAR CASE|Target Price|Position Sizing/);
  assert.equal(adapted.detailReport, fixture.result.outputs.node6b);
  assert.equal(adapted.decisionRecord.ticker, fixture.result.ticker);
}

const newProfileResult = structuredClone(screened.result);
newProfileResult.methodology_revision = 'crsm-methodology.quality-v1';
newProfileResult.outputs.node2.technical_coverage = {
  status: 'FULL',
  coverage_model: 'CAPABILITY_BASED_V1',
  sessions_used: 80,
  missing_capabilities: [],
  indicator_requirements: [
    { capability: 'sma50', required_sessions: 50, satisfied: true },
    { capability: 'volume_trend', required_sessions: 20, satisfied: true }
  ],
  note: 'Verified history supports the requested indicators.'
};
newProfileResult.outputs.node2.ohlcv_source = {
  source: 'public OHLCV',
  sessions_used: 80,
  date_range: 'latest 80 verified sessions'
};
newProfileResult.outputs.node2.sma_200_rel = null;
newProfileResult.outputs.node5.confidence = {
  value: 75.5,
  method: 'EVIDENCE_QUALITY_V1',
  components: {
    data_completeness: 72,
    source_quality: 82,
    freshness: 78,
    cross_source_consistency: 76,
    method_suitability: 80,
    key_uncertainty_coverage: 60
  }
};
const adaptedNewProfile = adaptMemoResult(newProfileResult);
assert.equal(adaptedNewProfile.ticker, screened.result.ticker);
assert.match(adaptedNewProfile.visualReport, /^<!DOCTYPE html>/);
assert.match(adaptedNewProfile.visualReport, /BÁO CÁO PHÂN TÍCH CHUYÊN SÂU/);
assert.equal(adaptedNewProfile.detailReport, newProfileResult.outputs.node6b);
assert.equal(adaptedNewProfile.outputs.node2.technical_coverage.coverage_model, 'CAPABILITY_BASED_V1');
assert.equal(adaptedNewProfile.outputs.node5.confidence.method, 'EVIDENCE_QUALITY_V1');

const adaptiveCioResult = structuredClone(newProfileResult);
adaptiveCioResult.outputs.node3.expectation_basis = [{
  topic: 'Tăng trưởng lợi nhuận',
  statement: 'Định giá hiện tại hàm ý tăng trưởng lợi nhuận khoảng 12%.',
  expectation_basis: 'VALUATION_IMPLIED',
  expected_value: 12,
  expected_unit: '%',
  analyst_view: 16,
  gap_direction: 'ABOVE',
  source_refs: ['valuation-implied-ref'],
  as_of: '2026-10-04',
  inference_label: 'INFERENCE',
  investment_implication: 'Nếu tăng trưởng đạt 16%, dư địa định giá có thể mở rộng.'
}];
adaptiveCioResult.outputs.node5.ai_score.value = 70;
adaptiveCioResult.outputs.node5.confidence = {
  value: 76.25,
  method: 'EVIDENCE_QUALITY_V1',
  components: {
    data_completeness:80, source_quality:85, freshness:75,
    cross_source_consistency:70, method_suitability:80, key_uncertainty_coverage:55
  }
};
adaptiveCioResult.outputs.node5.thesis_conviction = {
  level:'MEDIUM', rationale:'Có upside nhưng còn bất định.',
  expectation_basis_refs:[0], supporting_evidence_refs:['node3'],
  contradictory_evidence_refs:['node2'], catalyst_visibility:'MEDIUM', payoff_asymmetry:'POSITIVE'
};
adaptiveCioResult.outputs.node5.decision_overlay = {
  market_regime:{regime_state:'RISK_OFF',evidence_refs:['market-regime-public-evidence']},
  timing_effect:'WAIT_FOR_ENTRY', sizing_effect:'REDUCE', decision_effect:'OVERRIDE',
  pre_overlay_decision:'BUY', post_overlay_decision:'HOLD',
  override_rationale:'Risk-off làm giảm chất lượng điểm vào.',
  ai_score_effect:'NONE', ai_score_reference:70
};
adaptiveCioResult.outputs.node5.risk_attribution = [{
  driver:'Thanh khoản', primary_owner:'RISK', residual_risk_effect:'MEDIUM',
  risk_score_treatment:'PRIMARY_RISK_PENALTY', rationale:'Fragility thoát vị thế.', evidence_refs:['liquidity-ref']
}];
adaptiveCioResult.outputs.node5.investment_horizon = {bucket:'3-12M',rationale:'Catalyst cần vài quý.'};
adaptiveCioResult.outputs.node5.anti_thesis = 'Lợi nhuận không phục hồi như kỳ vọng.';
adaptiveCioResult.outputs.node5.variant_view = {
  summary:'Lợi nhuận có thể cao hơn mức hàm ý.', expectation_basis_refs:[0],
  why_different:'Biên lợi nhuận phục hồi nhanh hơn.', payoff_if_right:'Định giá mở rộng.',
  what_proves_wrong:'Biên lợi nhuận tiếp tục giảm.'
};
adaptiveCioResult.outputs.node5.monitoring_kpis = [
  {kpi:'KPI1',current_state:1,watch_condition:'<0',thesis_link:'Invalidates A',source_refs:['s1']},
  {kpi:'KPI2',current_state:2,watch_condition:'<1',thesis_link:'Invalidates B',source_refs:['s2']},
  {kpi:'KPI3',current_state:3,watch_condition:'<2',thesis_link:'Invalidates C',source_refs:['s3']}
];
adaptiveCioResult.outputs.node5.what_would_change_my_mind = ['KPI1 phá ngưỡng'];
adaptiveCioResult.decision_record.ai_score = 70;
adaptiveCioResult.decision_record.confidence = 76.25;
adaptiveCioResult.decision_record.thesis_conviction = 'MEDIUM';
adaptiveCioResult.decision_record.market_regime = 'RISK_OFF';
adaptiveCioResult.decision_record.investment_horizon = '3-12M';

const adaptedAdaptiveCio = adaptMemoResult(adaptiveCioResult);
assert.equal(adaptedAdaptiveCio.thesisConviction.level, 'MEDIUM');
assert.equal(adaptedAdaptiveCio.marketRegime.regime_state, 'RISK_OFF');
assert.equal(adaptedAdaptiveCio.investmentHorizon.bucket, '3-12M');
assert.equal(adaptedAdaptiveCio.riskAttribution.length, 1);
assert.equal(adaptedAdaptiveCio.monitoringKpis.length, 3);



const run = normalizeMemoRun({
  request: {
    ...screened.request,
    created_at: '2026-09-29T15:00:00.000Z'
  },
  status: {
    schema_version: 'stockmind-memo.v1',
    run_id: screened.request.run_id,
    state: 'COMPLETED',
    created_at: '2026-09-29T15:00:00.000Z',
    updated_at: '2026-09-29T15:10:00.000Z',
    items: [{
      item_id: screened.request.items[0].item_id,
      ticker: 'VCB',
      analysis_source: 'SCREENED_WEB',
      state: 'COMPLETED',
      error: null,
      result_ref: 'memo/runs/run-screened-001/results/VCB.json',
      started_at: '2026-09-29T15:01:00.000Z',
      completed_at: '2026-09-29T15:10:00.000Z',
      updated_at: '2026-09-29T15:10:00.000Z'
    }]
  },
  status_sha: 'status-sha',
  request_sha: 'request-sha',
  results: {
    VCB: { value: screened.result, sha: 'result-sha' }
  }
});

assert.equal(run.run_id, 'run-screened-001');
assert.equal(run.items[0].result.ticker, 'VCB');
assert.deepEqual(summarizeMemoRun(run), {
  total: 1,
  completed: 1,
  failed: 0,
  processing: 0,
  ready: 0
});
assert.equal(selectDefaultTicker(run), 'VCB');
assert.equal(selectedRunItem(run, 'vcb').ticker, 'VCB');
assert.equal(decisionLogRows(run.items[0]).length, 1);
assert.equal(decisionLogRows(run.items[0])[0].decision, 'HOLD');

const renderSnapshot = normalizeRenderSnapshot({
  snapshot: {
    schema_version: 'stockmind-render.v1',
    date: '2026-09-30',
    run_id: screened.request.run_id,
    created_at: '2026-09-30T02:00:00.000Z',
    completed_at: '2026-09-30T02:10:00.000Z',
    state: 'COMPLETED',
    items: [{
      item_id: screened.request.items[0].item_id,
      ticker: screened.result.ticker,
      analysis_source: screened.result.analysis_source,
      completed_at: '2026-09-30T02:10:00.000Z',
      result: screened.result
    }]
  }
});
assert.equal(renderSnapshot.run_id, screened.request.run_id);
assert.equal(renderSnapshot.items[0].state, 'COMPLETED');
assert.equal(renderSnapshot.items[0].result.ticker, screened.result.ticker);

const missingDetail = structuredClone(screened.result);
delete missingDetail.outputs.node6b;
const adaptedMissingDetail = adaptMemoResult(missingDetail);
assert.match(adaptedMissingDetail.detailReport, /BÁO CÁO PHÂN TÍCH VCB/);
assert.match(adaptedMissingDetail.detailReport, /bản phục hồi deterministic/);
assert.ok(adaptedMissingDetail.validationWarnings.some(warning => warning.includes('node6b')));


const rendered = renderResultsPage({
  currentRun: run,
  history: [{
    run_id: run.run_id,
    created_at: run.created_at,
    state: run.state,
    tickers: ['VCB'],
    item_count: 1,
    completed_count: 1,
    failed_count: 0
  }],
  selectedRun: run,
  selectedTicker: 'VCB',
  reportTab: 'html',
  updatedAt: '2026-09-29T15:10:00.000Z'
});
assert.match(rendered, /Results/);
assert.match(rendered, /VCB/);
assert.match(rendered, /Visual Report/);
assert.match(rendered, /BÁO CÁO PHÂN TÍCH CHUYÊN SÂU/);

const detailRendered = renderResultsPage({
  currentRun: run,
  history: [],
  selectedRun: run,
  selectedTicker: 'VCB',
  reportTab: 'word'
});
assert.match(detailRendered, /crsm-word-preview/);
assert.match(detailRendered, /BÁO CÁO PHÂN TÍCH/);
assert.doesNotMatch(detailRendered, /crsm-report-frame/);

const secondItem = {
  ...run.items[0],
  item_id: 'item-hpg-001',
  ticker: 'HPG',
  result: {
    ...run.items[0].result,
    itemId: 'item-hpg-001',
    ticker: 'HPG',
    visualReport: '<section>HPG visual report fixture</section>',
    detailReport: '# HPG detail report fixture',
    decisionRecord: { ...run.items[0].result.decisionRecord, ticker: 'HPG' }
  }
};
const multiRun = { ...run, items: [run.items[0], secondItem] };
const multiRendered = renderResultsPage({
  currentRun: multiRun,
  history: [],
  selectedRun: multiRun,
  selectedTicker: 'VCB',
  reportTab: 'html'
});
assert.match(multiRendered, /data-results-ticker="VCB"/);
assert.match(multiRendered, /data-results-ticker="HPG"/);
assert.match(multiRendered, /BÁO CÁO PHÂN TÍCH CHUYÊN SÂU/);
assert.doesNotMatch(multiRendered, /HPG visual report fixture/);
assert.doesNotMatch(multiRendered, /results-ticker-list/);
assert.match(multiRendered, /memoResultsRunSelect/);

const appSource = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const crsmNavSource = readFileSync(new URL('../src/crsm-navigation-mobile.js', import.meta.url), 'utf8');
assert.doesNotMatch(appSource, /openSettings/);
assert.doesNotMatch(appSource, /renderSettings/);
assert.doesNotMatch(appSource, /settingsOpen/);
assert.doesNotMatch(crsmNavSource, /renderSettings|bindSettingsEvents|openInlineSettings/);
assert.doesNotMatch(crsmNavSource, /menuButton\(['"]Settings['"]/);
assert.match(crsmNavSource, /\.results-page/);

const failedRun = {
  ...run,
  state: 'PARTIAL',
  items: [{
    ...run.items[0],
    state: 'FAILED',
    result: null,
    result_ref: null,
    error: { message: 'fixture failure' }
  }]
};
const failedRendered = renderResultsPage({
  currentRun: failedRun,
  selectedRun: failedRun,
  selectedTicker: 'VCB',
  retryingItemId: null
});
assert.match(failedRendered, /data-results-retry-run="run-screened-001"/);
assert.doesNotMatch(failedRendered, /data-results-run="run-screened-001"[^>]*data-results-retry=/);

let intervalCalls = 0;
let clearCalls = 0;
let callback = null;
const poller = createResultsPoller({
  poll: async () => {},
  intervalMs: 1000,
  setIntervalImpl(fn) {
    intervalCalls += 1;
    callback = fn;
    return 42;
  },
  clearIntervalImpl(id) {
    assert.equal(id, 42);
    clearCalls += 1;
  }
});

assert.equal(poller.isActive(), false);
assert.equal(poller.start(), true);
assert.equal(poller.start(), false);
assert.equal(intervalCalls, 1);
assert.equal(poller.isActive(), true);
await callback();
assert.equal(poller.stop(), true);
assert.equal(poller.stop(), false);
assert.equal(clearCalls, 1);
assert.equal(poller.isActive(), false);

console.log('CRSM Results adapter/poller tests passed.');
