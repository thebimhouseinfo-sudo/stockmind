import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ANALYSIS_SOURCES,
  CRSM_PIPELINE_VERSION,
  CRSM_REQUEST_VERSION,
  CRSM_RESULT_VERSION,
  DECISION_RECORD_FIELDS,
  NODE1_SECTOR_PROFILES,
  NODE1_MATERIAL_QUESTION_STATES,
  NODE2_MARKET_CONTEXT_CAPABILITIES,
  REQUIRED_RENDER_OUTPUT_KEYS,
  validateAnalysisItem,
  validateAnalysisRequest,
  validateAnalysisResult,
  validateEvidencePayload
} from '../src/crsm/contracts.js';

function fixture(name) {
  return JSON.parse(fs.readFileSync(new URL(`./fixtures/crsm/${name}.json`, import.meta.url), 'utf8'));
}

const screened = fixture('screened-web');
const evidence = fixture('evidence-web');
const webOnly = fixture('web-only');
const mixed = fixture('mixed-run');

assert.equal(CRSM_REQUEST_VERSION, 'crsm-request.v1');
assert.equal(CRSM_RESULT_VERSION, 'crsm-result.v1');
assert.equal(CRSM_PIPELINE_VERSION, 'crsm-pipeline.v1');
assert.deepEqual(Object.values(ANALYSIS_SOURCES), ['SCREENED_WEB', 'EVIDENCE_WEB', 'WEB_ONLY']);

for (const sample of [screened, evidence, webOnly]) {
  const requestCheck = validateAnalysisRequest(sample.request);
  assert.equal(requestCheck.valid, true, requestCheck.errors.join('\n'));

  const resultCheck = validateAnalysisResult(sample.result);
  assert.equal(resultCheck.valid, true, resultCheck.errors.join('\n'));

  for (const key of REQUIRED_RENDER_OUTPUT_KEYS) {
    assert.ok(key in sample.result.outputs, `fixture must include renderer output ${key}`);
  }

  for (const field of DECISION_RECORD_FIELDS) {
    assert.ok(field in sample.result.decision_record, `fixture decision_record missing ${field}`);
  }
}

const evidencePayloadCheck = validateEvidencePayload(evidence.evidence_payload);
assert.equal(evidencePayloadCheck.valid, true, evidencePayloadCheck.errors.join('\n'));

const mixedCheck = validateAnalysisRequest(mixed);
assert.equal(mixedCheck.valid, true, mixedCheck.errors.join('\n'));
assert.deepEqual(mixed.items.map(item => item.analysis_source), [
  'SCREENED_WEB',
  'EVIDENCE_WEB',
  'WEB_ONLY'
]);

const invalidScreened = structuredClone(screened.request.items[0]);
invalidScreened.evidence_refs = [evidence.request.items[0].evidence_refs[0]];
assert.equal(validateAnalysisItem(invalidScreened).valid, false);

const invalidEvidence = structuredClone(evidence.request.items[0]);
invalidEvidence.screening_context = { source: 'should-not-exist' };
assert.equal(validateAnalysisItem(invalidEvidence).valid, false);

const invalidWebOnly = structuredClone(webOnly.request.items[0]);
invalidWebOnly.screening_context = { source: 'should-not-exist' };
assert.equal(validateAnalysisItem(invalidWebOnly).valid, false);

const wrongTickerEvidence = structuredClone(evidence.request.items[0]);
wrongTickerEvidence.evidence_refs[0].ticker = 'VCB';
const wrongTickerCheck = validateAnalysisItem(wrongTickerEvidence);
assert.equal(wrongTickerCheck.valid, false);
assert.ok(wrongTickerCheck.errors.some(error => error.includes('must match owner ticker')));

const wrongItemEvidence = structuredClone(evidence.request.items[0]);
wrongItemEvidence.evidence_refs[0].item_id = 'different-item';
const wrongItemCheck = validateAnalysisItem(wrongItemEvidence);
assert.equal(wrongItemCheck.valid, false);
assert.ok(wrongItemCheck.errors.some(error => error.includes('must match owner item_id')));

const duplicateTicker = structuredClone(mixed);
duplicateTicker.items[2].ticker = 'VCB';
assert.equal(validateAnalysisRequest(duplicateTicker).valid, false);

const missingDetailReport = structuredClone(webOnly.result);
delete missingDetailReport.outputs.node6b;
const missingDetailCheck = validateAnalysisResult(missingDetailReport);
assert.equal(missingDetailCheck.valid, true);
assert.ok(missingDetailCheck.warnings.some(warning => warning.includes('node6b')));

const missingAnalyticalNode = structuredClone(webOnly.result);
delete missingAnalyticalNode.outputs.node3;
assert.equal(validateAnalysisResult(missingAnalyticalNode).valid, false);

const mismatchedDecisionTicker = structuredClone(webOnly.result);
mismatchedDecisionTicker.decision_record.ticker = 'VCB';
assert.equal(validateAnalysisResult(mismatchedDecisionTicker).valid, false);

const driftedNode5 = structuredClone(screened.result);
driftedNode5.outputs.node5.scores.money_flow = driftedNode5.outputs.node5.scores.flow;
delete driftedNode5.outputs.node5.scores.flow;
driftedNode5.outputs.node5.decision = 'WAIT_FOR_ENTRY';
driftedNode5.outputs.node5.catalyst_horizon = '30-90d';
driftedNode5.outputs.node5.thesis_invalidation = ['array is not canonical'];
const driftedNode5Check = validateAnalysisResult(driftedNode5);
assert.equal(driftedNode5Check.valid, false);
assert.ok(driftedNode5Check.errors.some(error => error.includes('scores.flow')));
assert.ok(driftedNode5Check.errors.some(error => error.includes('decision must be')));
assert.ok(driftedNode5Check.errors.some(error => error.includes('catalyst_horizon must be an object')));
assert.ok(driftedNode5Check.errors.some(error => error.includes('thesis_invalidation must be')));

const degradedWithoutDisclosure = structuredClone(screened.result);
degradedWithoutDisclosure.outputs.node2.technical_coverage = {
  status: 'DEGRADED',
  required_sessions: 300,
  sessions_used: 42,
  missing_capabilities: [],
  note: 'missing OHLCV'
};
const degradedCheck = validateAnalysisResult(degradedWithoutDisclosure);
assert.equal(degradedCheck.valid, false);
assert.ok(degradedCheck.errors.some(error => error.includes('must name missing capabilities')));

const freeformVisual = structuredClone(screened.result);
freeformVisual.outputs.node6a = '<article><h1>Short report</h1></article>';
const freeformVisualCheck = validateAnalysisResult(freeformVisual);
assert.equal(freeformVisualCheck.valid, true);
assert.ok(freeformVisualCheck.warnings.some(warning => warning.includes('node6a')));

const shortDetail = structuredClone(screened.result);
shortDetail.outputs.node6b = '# NT2\nShort summary';
const shortDetailCheck = validateAnalysisResult(shortDetail);
assert.equal(shortDetailCheck.valid, true);
assert.ok(shortDetailCheck.warnings.some(warning => warning.includes('node6b')));

const degradedButHonest = structuredClone(screened.result);
degradedButHonest.outputs.node2.technical_coverage = {
  status: 'DEGRADED',
  required_sessions: 300,
  sessions_used: 42,
  missing_capabilities: ['verified 300-session OHLCV', 'quantified sector-vs-VNINDEX comparison'],
  note: 'Technical conclusions are limited by public data coverage.'
};
degradedButHonest.outputs.node2.ohlcv_source = { source: null, sessions_used: 42, date_range: null };
assert.equal(validateAnalysisResult(degradedButHonest).valid, true);

const uncertainButHonest = structuredClone(screened.result);
uncertainButHonest.outputs.node5.scores.technical = null;
uncertainButHonest.outputs.node5.confidence.components.technical_confirmation = null;
uncertainButHonest.outputs.node5.catalyst_horizon = { nearest_catalyst: null, bucket: null };
uncertainButHonest.outputs.node5.ai_score.value = null;
uncertainButHonest.outputs.node5.confidence.value = 48;
uncertainButHonest.outputs.node5.decision = 'WATCH';
assert.equal(validateAnalysisResult(uncertainButHonest).valid, true);


const capabilityBasedCoverage = structuredClone(screened.result);
capabilityBasedCoverage.methodology_revision = 'crsm-methodology.quality-v1';
capabilityBasedCoverage.outputs.node2.technical_coverage = {
  status: 'FULL',
  coverage_model: 'CAPABILITY_BASED_V1',
  sessions_used: 80,
  missing_capabilities: [],
  indicator_requirements: [
    { capability: 'sma50', required_sessions: 50, satisfied: true },
    { capability: 'volume_trend', required_sessions: 20, satisfied: true }
  ],
  note: 'Only indicators supported by verified history are used.'
};
capabilityBasedCoverage.outputs.node2.ohlcv_source = {
  source: 'public OHLCV',
  sessions_used: 80,
  date_range: 'latest 80 verified sessions'
};
capabilityBasedCoverage.outputs.node2.sma_200_rel = null;
assert.equal(validateAnalysisResult(capabilityBasedCoverage).valid, true);

const capabilityCoverageWithoutRequirements = structuredClone(capabilityBasedCoverage);
delete capabilityCoverageWithoutRequirements.outputs.node2.technical_coverage.indicator_requirements;
const missingRequirementsCheck = validateAnalysisResult(capabilityCoverageWithoutRequirements);
assert.equal(missingRequirementsCheck.valid, false);
assert.ok(missingRequirementsCheck.errors.some(error => error.includes('indicator_requirements')));

const evidenceQualityConfidence = structuredClone(screened.result);
evidenceQualityConfidence.outputs.node5.confidence = {
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
assert.equal(validateAnalysisResult(evidenceQualityConfidence).valid, true);

const incompleteEvidenceQualityConfidence = structuredClone(evidenceQualityConfidence);
delete incompleteEvidenceQualityConfidence.outputs.node5.confidence.components.freshness;
const incompleteEvidenceQualityCheck = validateAnalysisResult(incompleteEvidenceQualityConfidence);
assert.equal(incompleteEvidenceQualityCheck.valid, false);
assert.ok(incompleteEvidenceQualityCheck.errors.some(error => error.includes('confidence.components missing field: freshness')));

const unknownConfidenceMethod = structuredClone(evidenceQualityConfidence);
unknownConfidenceMethod.outputs.node5.confidence.method = 'MODEL_OPINION';
const unknownConfidenceCheck = validateAnalysisResult(unknownConfidenceMethod);
assert.equal(unknownConfidenceCheck.valid, false);
assert.ok(unknownConfidenceCheck.errors.some(error => error.includes('confidence.method')));

const emptyMethodologyRevision = structuredClone(screened.result);
emptyMethodologyRevision.methodology_revision = '';
const emptyMethodologyRevisionCheck = validateAnalysisResult(emptyMethodologyRevision);
assert.equal(emptyMethodologyRevisionCheck.valid, false);
assert.ok(emptyMethodologyRevisionCheck.errors.some(error => error.includes('methodology_revision')));

const unresolvedDetailPlaceholder = structuredClone(screened.result);
unresolvedDetailPlaceholder.methodology_revision = 'crsm-methodology.quality-v1';
unresolvedDetailPlaceholder.outputs.node6b = '# BÁO CÁO NT2\nAI Score: [AI_SCORE]';
const unresolvedDetailCheck = validateAnalysisResult(unresolvedDetailPlaceholder);
assert.equal(unresolvedDetailCheck.valid, false);
assert.ok(unresolvedDetailCheck.errors.some(error => error.includes('unresolved detail-report placeholder')));

const legacyDetailPlaceholder = structuredClone(screened.result);
legacyDetailPlaceholder.outputs.node6b = '# BÁO CÁO NT2\nAI Score: [AI_SCORE]';
const legacyDetailPlaceholderCheck = validateAnalysisResult(legacyDetailPlaceholder);
assert.equal(legacyDetailPlaceholderCheck.valid, true);
assert.ok(legacyDetailPlaceholderCheck.warnings.some(warning => warning.includes('unresolved detail-report placeholder')));

const impossibleSatisfiedHistory = structuredClone(capabilityBasedCoverage);
impossibleSatisfiedHistory.outputs.node2.technical_coverage.indicator_requirements = [
  { capability: 'sma200', required_sessions: 200, satisfied: true }
];
const impossibleHistoryCheck = validateAnalysisResult(impossibleSatisfiedHistory);
assert.equal(impossibleHistoryCheck.valid, false);
assert.ok(impossibleHistoryCheck.errors.some(error => error.includes('fewer verified sessions than required')));

const mismatchedSessionCounts = structuredClone(capabilityBasedCoverage);
mismatchedSessionCounts.outputs.node2.technical_coverage.sessions_used = 79;
const mismatchedSessionsCheck = validateAnalysisResult(mismatchedSessionCounts);
assert.equal(mismatchedSessionsCheck.valid, false);
assert.ok(mismatchedSessionsCheck.errors.some(error => error.includes('sessions_used must match')));

const legitimateBracketLabel = structuredClone(screened.result);
legitimateBracketLabel.outputs.node6b = '# BÁO CÁO NT2\nNguồn tham chiếu [HOSE] và [VNDIRECT].';
assert.equal(validateAnalysisResult(legitimateBracketLabel).valid, true);

const simpleCanonicalPlaceholder = structuredClone(screened.result);
simpleCanonicalPlaceholder.methodology_revision = 'crsm-methodology.quality-v1';
simpleCanonicalPlaceholder.outputs.node6b = '# BÁO CÁO NT2\nLợi thế cạnh tranh: [MOAT] · thành phần [X]';
const simpleCanonicalPlaceholderCheck = validateAnalysisResult(simpleCanonicalPlaceholder);
assert.equal(simpleCanonicalPlaceholderCheck.valid, false);
assert.ok(simpleCanonicalPlaceholderCheck.errors.some(error => error.includes('unresolved detail-report placeholder')));

const underscoredNonTemplateLabel = structuredClone(screened.result);
underscoredNonTemplateLabel.methodology_revision = 'crsm-methodology.quality-v1';
underscoredNonTemplateLabel.outputs.node6b = '# BÁO CÁO NT2\nNhãn nguồn nội bộ [VN_INDEX]';
assert.equal(validateAnalysisResult(underscoredNonTemplateLabel).valid, true);



assert.deepEqual(NODE1_SECTOR_PROFILES, [
  'BANK','INSURANCE','SECURITIES','REAL_ESTATE','UTILITIES_POWER',
  'COMMODITY_CYCLICAL','INDUSTRIAL_LOGISTICS','TECHNOLOGY_SERVICES','CONSUMER','GENERIC'
]);
assert.deepEqual(NODE1_MATERIAL_QUESTION_STATES, ['ANSWERED','PARTIAL','MISSING']);

const bankSectorRoute = structuredClone(screened.result);
bankSectorRoute.methodology_revision = 'crsm-methodology.quality-v1';
bankSectorRoute.outputs.node1.sector_profile = 'BANK';
bankSectorRoute.outputs.node1.material_questions = [{
  question: 'Chất lượng tài sản đang thay đổi theo hướng nào?',
  why_material: 'NPL và chi phí tín dụng quyết định ROE bền vững.',
  status: 'ANSWERED',
  answer: 'NPL cần theo dõi theo kỳ công bố mới nhất.',
  source_refs: ['company-filing'],
  freshness: 'Q2/2026'
}];
assert.equal(validateAnalysisResult(bankSectorRoute).valid, true);

const realEstateRoute = structuredClone(screened.result);
realEstateRoute.outputs.node1.sector_profile = 'REAL_ESTATE';
realEstateRoute.outputs.node1.material_questions = [{
  question: 'Pháp lý dự án trọng yếu đã đủ điều kiện triển khai chưa?',
  why_material: 'Tiến độ pháp lý chi phối presales, thu tiền và lịch ghi nhận.',
  status: 'PARTIAL',
  answer: 'Đã có một phần phê duyệt nhưng còn bước chưa xác minh.',
  source_refs: ['company-ir'],
  freshness: '2026-09-30'
}];
assert.equal(validateAnalysisResult(realEstateRoute).valid, true);

const genericMissingRoute = structuredClone(webOnly.result);
genericMissingRoute.outputs.node1.sector_profile = 'GENERIC';
genericMissingRoute.outputs.node1.material_questions = [{
  question: 'Có dữ liệu đủ tin cậy để phân loại sâu hơn không?',
  why_material: 'Phân loại sai có thể kéo theo KPI và phương pháp định giá không phù hợp.',
  status: 'MISSING',
  answer: null,
  source_refs: [],
  freshness: null
}];
assert.equal(validateAnalysisResult(genericMissingRoute).valid, true);

const invalidSectorProfile = structuredClone(bankSectorRoute);
invalidSectorProfile.outputs.node1.sector_profile = 'FINANCIALS';
const invalidSectorCheck = validateAnalysisResult(invalidSectorProfile);
assert.equal(invalidSectorCheck.valid, false);
assert.ok(invalidSectorCheck.errors.some(error => error.includes('sector_profile')));

const missingAnsweredSource = structuredClone(bankSectorRoute);
missingAnsweredSource.outputs.node1.material_questions[0].source_refs = [];
const missingAnsweredSourceCheck = validateAnalysisResult(missingAnsweredSource);
assert.equal(missingAnsweredSourceCheck.valid, false);
assert.ok(missingAnsweredSourceCheck.errors.some(error => error.includes('ANSWERED material question')));

const fabricatedMissingAnswer = structuredClone(genericMissingRoute);
fabricatedMissingAnswer.outputs.node1.material_questions[0].answer = 'Suy đoán không có nguồn';
const fabricatedMissingAnswerCheck = validateAnalysisResult(fabricatedMissingAnswer);
assert.equal(fabricatedMissingAnswerCheck.valid, false);
assert.ok(fabricatedMissingAnswerCheck.errors.some(error => error.includes('MISSING material question answer must be null')));

const partialWithoutEvidence = structuredClone(realEstateRoute);
partialWithoutEvidence.outputs.node1.material_questions[0].source_refs = [];
const partialWithoutEvidenceCheck = validateAnalysisResult(partialWithoutEvidence);
assert.equal(partialWithoutEvidenceCheck.valid, false);
assert.ok(partialWithoutEvidenceCheck.errors.some(error => error.includes('PARTIAL material question must cite')));

const answeredWithoutAnswer = structuredClone(bankSectorRoute);
answeredWithoutAnswer.outputs.node1.material_questions[0].answer = null;
const answeredWithoutAnswerCheck = validateAnalysisResult(answeredWithoutAnswer);
assert.equal(answeredWithoutAnswerCheck.valid, false);
assert.ok(answeredWithoutAnswerCheck.errors.some(error => error.includes('ANSWERED material question answer must be')));

const emptySourceRef = structuredClone(bankSectorRoute);
emptySourceRef.outputs.node1.material_questions[0].source_refs = [''];
const emptySourceRefCheck = validateAnalysisResult(emptySourceRef);
assert.equal(emptySourceRefCheck.valid, false);
assert.ok(emptySourceRefCheck.errors.some(error => error.includes('source_refs[0] must be a non-empty string')));


assert.deepEqual(NODE2_MARKET_CONTEXT_CAPABILITIES, [
  'vnindex_baseline','secondary_benchmark','breadth','turnover_liquidity',
  'leadership_rotation','volatility','market_foreign_flow','stock_relative_strength'
]);

function marketProvenance(capabilities) {
  return capabilities.map(capability => ({
    capability,
    source: capability === 'market_foreign_flow' ? 'VNDIRECT public market data' : 'HOSE public market data',
    as_of: '2026-10-03'
  }));
}

const fullMarketCapabilities = [...NODE2_MARKET_CONTEXT_CAPABILITIES];
const riskOnMarketContext = structuredClone(capabilityBasedCoverage);
riskOnMarketContext.outputs.node2.smart_money_phase = null;
riskOnMarketContext.outputs.node2.market_context = {
  as_of: '2026-10-03',
  benchmarks: {
    vnindex: { name: 'VNINDEX', period: '20D', performance_pct: 4.2, trend: 'UP', source: 'HOSE', freshness: '2026-10-03' },
    secondary: [{ name: 'VN30', kind: 'INDEX', period: '20D', performance_pct: 4.8, source: 'HOSE', freshness: '2026-10-03', constituents: [] }]
  },
  breadth: { advancers: 230, decliners: 92, unchanged: 41, advance_decline_ratio: 2.5, source: 'HOSE', freshness: '2026-10-03' },
  turnover_liquidity: { market_turnover_value: 22000, unit: 'Bn VND', change_vs_20d_pct: 15, source: 'HOSE', freshness: '2026-10-03' },
  leadership_rotation: { leaders: ['BANK','SECURITIES'], laggards: ['UTILITIES'], note: 'Độ rộng lan tỏa tích cực.', source_refs: ['HOSE'], freshness: '2026-10-03' },
  volatility: { measure: '20D realized volatility', value: 14.5, period: '20D', source: 'public OHLCV', freshness: '2026-10-03' },
  market_foreign_flow: { net_value: -850, unit: 'Bn VND', period: '5D', source: 'VNDIRECT public market data', freshness: '2026-10-03' },
  stock_relative_strength: { period: '20D', stock_perf_pct: 7.1, vnindex_perf_pct: 4.2, secondary_benchmark_name: 'VN30', secondary_benchmark_perf_pct: 4.8, vs_vnindex_pct: 2.9, vs_secondary_benchmark_pct: 2.3, source_refs: ['HOSE'] },
  coverage: { status: 'FULL', available_capabilities: fullMarketCapabilities, missing_capabilities: [], provenance: marketProvenance(fullMarketCapabilities), note: 'Đủ dữ liệu thị trường công khai cho bộ đo đã định nghĩa.' }
};
assert.equal(validateAnalysisResult(riskOnMarketContext).valid, true);

const riskOffMarketContext = structuredClone(riskOnMarketContext);
riskOffMarketContext.outputs.node2.market_context.benchmarks.vnindex.performance_pct = -5.4;
riskOffMarketContext.outputs.node2.market_context.breadth = { advancers: 61, decliners: 278, unchanged: 24, advance_decline_ratio: 0.22, source: 'HOSE', freshness: '2026-10-03' };
riskOffMarketContext.outputs.node2.market_context.turnover_liquidity.change_vs_20d_pct = 28;
riskOffMarketContext.outputs.node2.market_context.market_foreign_flow.net_value = -3200;
riskOffMarketContext.outputs.node2.market_context.stock_relative_strength.stock_perf_pct = -2.1;
riskOffMarketContext.outputs.node2.market_context.stock_relative_strength.vnindex_perf_pct = -5.4;
riskOffMarketContext.outputs.node2.market_context.stock_relative_strength.vs_vnindex_pct = 3.3;
assert.equal(validateAnalysisResult(riskOffMarketContext).valid, true);

const degradedMarketContext = structuredClone(riskOnMarketContext);
const missingMarketCapabilities = ['secondary_benchmark','breadth','leadership_rotation','market_foreign_flow'];
const availableMarketCapabilities = NODE2_MARKET_CONTEXT_CAPABILITIES.filter(capability => !missingMarketCapabilities.includes(capability));
degradedMarketContext.outputs.node2.market_context.benchmarks.secondary = [];
degradedMarketContext.outputs.node2.market_context.breadth = null;
degradedMarketContext.outputs.node2.market_context.leadership_rotation = null;
degradedMarketContext.outputs.node2.market_context.market_foreign_flow = null;
degradedMarketContext.outputs.node2.market_context.coverage = {
  status: 'DEGRADED',
  available_capabilities: availableMarketCapabilities,
  missing_capabilities: missingMarketCapabilities,
  provenance: marketProvenance(availableMarketCapabilities),
  note: 'Không xác minh được benchmark phụ, độ rộng, luân chuyển dẫn dắt và khối ngoại toàn thị trường từ nguồn công khai.'
};
assert.equal(validateAnalysisResult(degradedMarketContext).valid, true);

const fullMarketWithMissingCapability = structuredClone(riskOnMarketContext);
fullMarketWithMissingCapability.outputs.node2.market_context.coverage.missing_capabilities = ['breadth'];
fullMarketWithMissingCapability.outputs.node2.market_context.coverage.available_capabilities =
  fullMarketCapabilities.filter(capability => capability !== 'breadth');
fullMarketWithMissingCapability.outputs.node2.market_context.breadth = null;
const fullMarketWithMissingCheck = validateAnalysisResult(fullMarketWithMissingCapability);
assert.equal(fullMarketWithMissingCheck.valid, false);
assert.ok(fullMarketWithMissingCheck.errors.some(error => error.includes('FULL market_context coverage cannot declare missing capabilities')));

const missingMarketProvenance = structuredClone(riskOnMarketContext);
missingMarketProvenance.outputs.node2.market_context.coverage.provenance =
  marketProvenance(fullMarketCapabilities.filter(capability => capability !== 'market_foreign_flow'));
const missingMarketProvenanceCheck = validateAnalysisResult(missingMarketProvenance);
assert.equal(missingMarketProvenanceCheck.valid, false);
assert.ok(missingMarketProvenanceCheck.errors.some(error => error.includes('lacks provenance: market_foreign_flow')));

const leakedTickerFlowIntoMissingMarket = structuredClone(degradedMarketContext);
leakedTickerFlowIntoMissingMarket.outputs.node2.market_context.market_foreign_flow = {
  net_value: leakedTickerFlowIntoMissingMarket.outputs.node1.market_data.foreign_net_flow_20d?.value ?? 0,
  unit: 'Bn VND',
  period: '20D',
  source: 'ticker field copied incorrectly',
  freshness: '2026-10-03'
};
const leakedTickerFlowCheck = validateAnalysisResult(leakedTickerFlowIntoMissingMarket);
assert.equal(leakedTickerFlowCheck.valid, false);
assert.ok(leakedTickerFlowCheck.errors.some(error => error.includes('missing market_foreign_flow must use null')));

const availableButEmptyBreadth = structuredClone(riskOnMarketContext);
availableButEmptyBreadth.outputs.node2.market_context.breadth = {};
const availableButEmptyBreadthCheck = validateAnalysisResult(availableButEmptyBreadth);
assert.equal(availableButEmptyBreadthCheck.valid, false);
assert.ok(availableButEmptyBreadthCheck.errors.some(error => error.includes('available breadth requires numeric')));

const missingVnindexWithStaleMeasurement = structuredClone(degradedMarketContext);
missingVnindexWithStaleMeasurement.outputs.node2.market_context.coverage.available_capabilities =
  availableMarketCapabilities.filter(capability => capability !== 'vnindex_baseline');
missingVnindexWithStaleMeasurement.outputs.node2.market_context.coverage.missing_capabilities =
  [...missingMarketCapabilities, 'vnindex_baseline'];
missingVnindexWithStaleMeasurement.outputs.node2.market_context.coverage.provenance =
  marketProvenance(missingVnindexWithStaleMeasurement.outputs.node2.market_context.coverage.available_capabilities);
const missingVnindexStaleCheck = validateAnalysisResult(missingVnindexWithStaleMeasurement);
assert.equal(missingVnindexStaleCheck.valid, false);
assert.ok(missingVnindexStaleCheck.errors.some(error => error.includes('missing vnindex_baseline must use null')));

const badPeerBasket = structuredClone(riskOnMarketContext);
badPeerBasket.outputs.node2.market_context.benchmarks.secondary = [{
  name: 'Peer basket',
  kind: 'PEER_BASKET',
  period: '20D',
  performance_pct: 3.1,
  source: 'public OHLCV',
  freshness: '2026-10-03',
  constituents: ['AAA','BBB']
}];
const badPeerBasketCheck = validateAnalysisResult(badPeerBasket);
assert.equal(badPeerBasketCheck.valid, false);
assert.ok(badPeerBasketCheck.errors.some(error => error.includes('3-5 constituents')));

const missingContextFreshness = structuredClone(riskOnMarketContext);
missingContextFreshness.outputs.node2.market_context.as_of = null;
const missingContextFreshnessCheck = validateAnalysisResult(missingContextFreshness);
assert.equal(missingContextFreshnessCheck.valid, false);
assert.ok(missingContextFreshnessCheck.errors.some(error => error.includes('market_context.as_of')));

const staleProvenance = structuredClone(riskOnMarketContext);
staleProvenance.outputs.node2.market_context.coverage.provenance[0].as_of = null;
const staleProvenanceCheck = validateAnalysisResult(staleProvenance);
assert.equal(staleProvenanceCheck.valid, false);
assert.ok(staleProvenanceCheck.errors.some(error => error.includes('provenance[0].as_of')));

const provenanceForMissingCapability = structuredClone(degradedMarketContext);
provenanceForMissingCapability.outputs.node2.market_context.coverage.provenance.push({
  capability: 'breadth',
  source: 'stale breadth source',
  as_of: '2026-09-01'
});
const provenanceForMissingCheck = validateAnalysisResult(provenanceForMissingCapability);
assert.equal(provenanceForMissingCheck.valid, false);
assert.ok(provenanceForMissingCheck.errors.some(error => error.includes('must not declare provenance: breadth')));

const emptyRelativeStrengthSource = structuredClone(riskOnMarketContext);
emptyRelativeStrengthSource.outputs.node2.market_context.stock_relative_strength.source_refs = [''];
const emptyRelativeStrengthSourceCheck = validateAnalysisResult(emptyRelativeStrengthSource);
assert.equal(emptyRelativeStrengthSourceCheck.valid, false);
assert.ok(emptyRelativeStrengthSourceCheck.errors.some(error => error.includes('stock_relative_strength.source_refs[0]')));

const missingSecondaryRelative = structuredClone(riskOnMarketContext);
missingSecondaryRelative.outputs.node2.market_context.stock_relative_strength.secondary_benchmark_name = null;
missingSecondaryRelative.outputs.node2.market_context.stock_relative_strength.secondary_benchmark_perf_pct = null;
missingSecondaryRelative.outputs.node2.market_context.stock_relative_strength.vs_secondary_benchmark_pct = null;
const missingSecondaryRelativeCheck = validateAnalysisResult(missingSecondaryRelative);
assert.equal(missingSecondaryRelativeCheck.valid, false);
assert.ok(missingSecondaryRelativeCheck.errors.some(error => error.includes('secondary_benchmark_name')));

const mismatchedRelativePeriod = structuredClone(riskOnMarketContext);
mismatchedRelativePeriod.outputs.node2.market_context.stock_relative_strength.period = '60D';
const mismatchedRelativePeriodCheck = validateAnalysisResult(mismatchedRelativePeriod);
assert.equal(mismatchedRelativePeriodCheck.valid, false);
assert.ok(mismatchedRelativePeriodCheck.errors.some(error => error.includes('period must match VNINDEX')));

const unknownSecondaryRelative = structuredClone(riskOnMarketContext);
unknownSecondaryRelative.outputs.node2.market_context.stock_relative_strength.secondary_benchmark_name = 'VN100';
const unknownSecondaryRelativeCheck = validateAnalysisResult(unknownSecondaryRelative);
assert.equal(unknownSecondaryRelativeCheck.valid, false);
assert.ok(unknownSecondaryRelativeCheck.errors.some(error => error.includes('must match a declared secondary benchmark')));

const degradedTechnicalSma200 = structuredClone(capabilityBasedCoverage);
degradedTechnicalSma200.outputs.node2.technical_coverage = {
  status: 'DEGRADED',
  coverage_model: 'CAPABILITY_BASED_V1',
  sessions_used: 80,
  missing_capabilities: ['sma200'],
  indicator_requirements: [
    { capability: 'sma200', required_sessions: 200, satisfied: false },
    { capability: 'volume_trend', required_sessions: 20, satisfied: true }
  ],
  note: 'Chỉ có 80 phiên xác minh nên không tính SMA200.'
};
degradedTechnicalSma200.outputs.node2.ohlcv_source = {
  source: 'public OHLCV',
  sessions_used: 80,
  date_range: 'latest 80 verified sessions'
};
degradedTechnicalSma200.outputs.node2.sma_200_rel = null;
assert.equal(validateAnalysisResult(degradedTechnicalSma200).valid, true);

const degradedWithWrongMissingCapability = structuredClone(degradedTechnicalSma200);
degradedWithWrongMissingCapability.outputs.node2.technical_coverage.missing_capabilities = ['volume_trend'];
const degradedWrongMissingCheck = validateAnalysisResult(degradedWithWrongMissingCapability);
assert.equal(degradedWrongMissingCheck.valid, false);
assert.ok(degradedWrongMissingCheck.errors.some(error => error.includes('unsatisfied technical capability must be named')));

const degradedWithSessionMismatch = structuredClone(degradedTechnicalSma200);
degradedWithSessionMismatch.outputs.node2.technical_coverage.sessions_used = 79;
const degradedSessionMismatchCheck = validateAnalysisResult(degradedWithSessionMismatch);
assert.equal(degradedSessionMismatchCheck.valid, false);
assert.ok(degradedSessionMismatchCheck.errors.some(error => error.includes('sessions_used must match')));

const unsupportedSma200 = structuredClone(capabilityBasedCoverage);
unsupportedSma200.outputs.node2.sma_200_rel = 'ABOVE';
const unsupportedSma200Check = validateAnalysisResult(unsupportedSma200);
assert.equal(unsupportedSma200Check.valid, false);
assert.ok(unsupportedSma200Check.errors.some(error => error.includes('sma_200_rel requires a satisfied sma200')));

const unsupportedSmartMoney = structuredClone(riskOnMarketContext);
unsupportedSmartMoney.outputs.node2.smart_money_phase = 'accumulation';
const unsupportedSmartMoneyCheck = validateAnalysisResult(unsupportedSmartMoney);
assert.equal(unsupportedSmartMoneyCheck.valid, false);
assert.ok(unsupportedSmartMoneyCheck.errors.some(error => error.includes('smart_money_phase must be null or an evidence-gated object')));

const candidateSmartMoney = structuredClone(riskOnMarketContext);
candidateSmartMoney.outputs.node2.smart_money_phase = {
  label: 'possible accumulation',
  evidence_status: 'CANDIDATE',
  supporting_evidence: ['Giá giữ vùng cầu trong khi khối lượng co lại sau nhịp giảm.']
};
assert.equal(validateAnalysisResult(candidateSmartMoney).valid, true);

const unsupportedVsaSignal = structuredClone(riskOnMarketContext);
unsupportedVsaSignal.outputs.node2.volume_analysis.vsa_signal_candidate = 'stopping volume';
unsupportedVsaSignal.outputs.node2.volume_analysis.supporting_evidence = [];
const unsupportedVsaSignalCheck = validateAnalysisResult(unsupportedVsaSignal);
assert.equal(unsupportedVsaSignalCheck.valid, false);
assert.ok(unsupportedVsaSignalCheck.errors.some(error => error.includes('VSA signal candidate requires supporting_evidence')));

console.log('CRSM migration contract tests passed.');
