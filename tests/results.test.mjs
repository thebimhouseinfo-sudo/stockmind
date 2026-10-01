import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  adaptMemoResult,
  decisionLogRows,
  normalizeMemoRun,
  normalizeRenderSnapshot,
  normalizeVisualReportHtml,
  selectDefaultTicker,
  selectedRunItem,
  summarizeMemoRun
} from '../src/crsm/result-adapter.js';
import { createResultsPoller } from '../src/crsm/results-poller.js';
import { renderResultsPage } from '../src/crsm/ui/results.js';

const contaminatedVisual = `You are a renderer.\n<!DOCTYPE html><html><body><div id="report"><h2>Quyết định đầu tư</h2><div class="decision">BUY ON DIP</div><p>AI Score</p><p class="text-3xl Data not available">78.8<span>/100</span></p><p>Tin tưởng</p><p>69</p><span>CRSM Score</span><strong>78.8/100</strong><div style="width:Data not available"></div></div></body></html>\n--- trailing instructions`;
const normalizedVisual = normalizeVisualReportHtml(contaminatedVisual, {
  decision_record: { decision: 'BUY ON DIP', ai_score: 72.8, confidence: 72 },
  outputs: { node5: { decision: 'BUY ON DIP', ai_score: { value: 72.8 }, confidence: { value: 72 } } }
});
assert.match(normalizedVisual, /^<!DOCTYPE html>/);
assert.match(normalizedVisual, /MUA KHI ĐIỀU CHỈNH/);
assert.match(normalizedVisual, />72\.8<span>\/100<\/span>/);
assert.match(normalizedVisual, />72%<\/p>/);
assert.match(normalizedVisual, /CRSM Score<\/span><strong>72\.8\/100<\/strong>/);
assert.match(normalizedVisual, /style="width:0%"/);
assert.doesNotMatch(normalizedVisual, /Data not available/);
assert.doesNotMatch(normalizedVisual, /trailing instructions/);

const screened = JSON.parse(readFileSync(new URL('./fixtures/crsm/screened-web.json', import.meta.url), 'utf8'));
const evidence = JSON.parse(readFileSync(new URL('./fixtures/crsm/evidence-web.json', import.meta.url), 'utf8'));
const webOnly = JSON.parse(readFileSync(new URL('./fixtures/crsm/web-only.json', import.meta.url), 'utf8'));

for (const fixture of [screened, evidence, webOnly]) {
  const adapted = adaptMemoResult(fixture.result);
  assert.equal(adapted.ticker, fixture.result.ticker);
  assert.equal(adapted.visualReport, fixture.result.outputs.node6a);
  assert.equal(adapted.detailReport, fixture.result.outputs.node6b);
  assert.equal(adapted.decisionRecord.ticker, fixture.result.ticker);
}

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
