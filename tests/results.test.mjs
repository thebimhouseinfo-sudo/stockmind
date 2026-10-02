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
newProfileResult.outputs.node5.confidence = {
  value: 74,
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
