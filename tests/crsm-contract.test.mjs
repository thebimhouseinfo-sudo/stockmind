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
  NODE3_EXPECTATION_BASES,
  NODE3_VALUATION_METHODS_BY_SECTOR,
  NODE4_DRIVER_TYPES,
  NODE4_TRANSMISSION_TARGETS,
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


assert.deepEqual(NODE3_EXPECTATION_BASES, [
  'OBSERVED_CONSENSUS','COMPANY_GUIDANCE','VALUATION_IMPLIED','PRICE_ACTION_INFERENCE'
]);
assert.ok(NODE3_VALUATION_METHODS_BY_SECTOR.BANK.includes('PB_ROE'));
assert.ok(NODE3_VALUATION_METHODS_BY_SECTOR.REAL_ESTATE.includes('RNAV'));
assert.ok(NODE3_VALUATION_METHODS_BY_SECTOR.TECHNOLOGY_SERVICES.includes('EV_EBITDA'));
assert.ok(NODE4_DRIVER_TYPES.includes('FX'));
assert.deepEqual(NODE4_TRANSMISSION_TARGETS, ['REVENUE','MARGIN','CASH_FLOW','BALANCE_SHEET','VALUATION']);

function addSectorEconomics(result, sectorProfile, method) {
  result.outputs.node1.sector_profile = sectorProfile;
  result.outputs.node3.sector_economics = {
    sector_profile: sectorProfile,
    earnings_bridge: [],
    normalized_earnings: null,
    capital_allocation: [],
    balance_sheet_capacity: null,
    valuation_method_selection: [{
      method,
      status: 'SELECTED',
      reason: 'Phương pháp phù hợp với kinh tế ngành và dữ liệu hiện có.',
      evidence_refs: ['node1-sector-evidence']
    }]
  };
  return result;
}

const bankEconomics = addSectorEconomics(structuredClone(screened.result), 'BANK', 'PB_ROE');
bankEconomics.outputs.node3.f_score = null;
bankEconomics.outputs.node3.expectation_basis = [{
  topic: 'Tăng trưởng lợi nhuận năm tới',
  statement: 'Đồng thuận quan sát được kỳ vọng tăng trưởng lợi nhuận 15%.',
  expectation_basis: 'OBSERVED_CONSENSUS',
  expected_value: 15,
  expected_unit: '%',
  analyst_view: 18,
  gap_direction: 'ABOVE',
  source_refs: ['broker-consensus-2026-10-02'],
  as_of: '2026-10-02',
  inference_label: null,
  investment_implication: 'Nếu NIM phục hồi nhanh hơn đồng thuận, ROE bền vững và mức P/B hợp lý có thể tăng.'
}];
assert.equal(validateAnalysisResult(bankEconomics).valid, true);

const realEstateEconomics = addSectorEconomics(structuredClone(screened.result), 'REAL_ESTATE', 'RNAV');
realEstateEconomics.outputs.node3.expectation_basis = [{
  topic: 'Giá trị dự án hàm ý trong thị giá',
  statement: 'Định giá hiện tại hàm ý thị trường đang chiết khấu đáng kể tiến độ pháp lý dự án.',
  expectation_basis: 'VALUATION_IMPLIED',
  expected_value: null,
  expected_unit: null,
  analyst_view: 'Mức chiết khấu có thể thu hẹp nếu pháp lý hoàn tất đúng tiến độ.',
  gap_direction: 'ABOVE',
  source_refs: ['current-price-2026-10-03','project-nav-evidence'],
  as_of: '2026-10-03',
  inference_label: 'INFERENCE',
  investment_implication: 'Catalyst pháp lý có thể thu hẹp discount-to-RNAV.'
}];
assert.equal(validateAnalysisResult(realEstateEconomics).valid, true);

const techEconomics = addSectorEconomics(structuredClone(screened.result), 'TECHNOLOGY_SERVICES', 'EV_EBITDA');
techEconomics.outputs.node3.expectation_basis = [{
  topic: 'Kỳ vọng tăng trưởng phản ánh qua giá',
  statement: 'Diễn biến giá và relative strength cho thấy khả năng nhà đầu tư đang định giá tăng trưởng cao hơn nền hiện tại.',
  expectation_basis: 'PRICE_ACTION_INFERENCE',
  expected_value: null,
  expected_unit: null,
  analyst_view: 'Cần backlog và biên lợi nhuận xác nhận trước khi nâng giả định.',
  gap_direction: 'UNCERTAIN',
  source_refs: ['node2-relative-strength'],
  as_of: '2026-10-03',
  inference_label: 'INFERENCE',
  investment_implication: 'Giá đã phản ánh một phần tăng trưởng nên upside phụ thuộc vào earnings surprise.'
}];
assert.equal(validateAnalysisResult(techEconomics).valid, true);

const bankWithIndustrialDcf = structuredClone(bankEconomics);
bankWithIndustrialDcf.outputs.node3.sector_economics.valuation_method_selection[0].method = 'DCF';
const bankDcfCheck = validateAnalysisResult(bankWithIndustrialDcf);
assert.equal(bankDcfCheck.valid, false);
assert.ok(bankDcfCheck.errors.some(error => error.includes('not suitable for sector_profile BANK')));

const bankWithFScore = structuredClone(bankEconomics);
bankWithFScore.outputs.node3.f_score = 7;
const bankFScoreCheck = validateAnalysisResult(bankWithFScore);
assert.equal(bankFScoreCheck.valid, false);
assert.ok(bankFScoreCheck.errors.some(error => error.includes('f_score must be null')));

const consensusWithoutSource = structuredClone(bankEconomics);
consensusWithoutSource.outputs.node3.expectation_basis[0].source_refs = [];
const consensusWithoutSourceCheck = validateAnalysisResult(consensusWithoutSource);
assert.equal(consensusWithoutSourceCheck.valid, false);
assert.ok(consensusWithoutSourceCheck.errors.some(error => error.includes('source_refs must be a non-empty array')));

const inferredWithoutLabel = structuredClone(realEstateEconomics);
inferredWithoutLabel.outputs.node3.expectation_basis[0].inference_label = null;
const inferredWithoutLabelCheck = validateAnalysisResult(inferredWithoutLabel);
assert.equal(inferredWithoutLabelCheck.valid, false);
assert.ok(inferredWithoutLabelCheck.errors.some(error => error.includes('must equal INFERENCE')));

const observedWithInferenceLabel = structuredClone(bankEconomics);
observedWithInferenceLabel.outputs.node3.expectation_basis[0].inference_label = 'INFERENCE';
const observedWithInferenceLabelCheck = validateAnalysisResult(observedWithInferenceLabel);
assert.equal(observedWithInferenceLabelCheck.valid, false);
assert.ok(observedWithInferenceLabelCheck.errors.some(error => error.includes('must be null for observed')));

const inferredWithBareConsensusClaim = structuredClone(realEstateEconomics);
inferredWithBareConsensusClaim.outputs.node3.expectation_basis[0].statement = 'Thị trường kỳ vọng lợi nhuận tăng 20%.';
const inferredWithBareConsensusClaimCheck = validateAnalysisResult(inferredWithBareConsensusClaim);
assert.equal(inferredWithBareConsensusClaimCheck.valid, false);
assert.ok(inferredWithBareConsensusClaimCheck.errors.some(error => error.includes('statement must explicitly signal inference')));

const inferredWithExplicitCue = structuredClone(realEstateEconomics);
inferredWithExplicitCue.outputs.node3.expectation_basis[0].statement = 'Định giá hiện tại hàm ý lợi nhuận kỳ vọng cao hơn nền hiện tại.';
assert.equal(validateAnalysisResult(inferredWithExplicitCue).valid, true);

const sectorEconomicsWithoutExpectationField = structuredClone(bankEconomics);
delete sectorEconomicsWithoutExpectationField.outputs.node3.expectation_basis;
const sectorEconomicsWithoutExpectationCheck = validateAnalysisResult(sectorEconomicsWithoutExpectationField);
assert.equal(sectorEconomicsWithoutExpectationCheck.valid, false);
assert.ok(sectorEconomicsWithoutExpectationCheck.errors.some(error => error.includes('requires explicit expectation_basis array')));

const sectorEconomicsWithNoExpectationEvidence = structuredClone(bankEconomics);
sectorEconomicsWithNoExpectationEvidence.outputs.node3.expectation_basis = [];
assert.equal(validateAnalysisResult(sectorEconomicsWithNoExpectationEvidence).valid, true);

const duplicateValuationMethod = structuredClone(realEstateEconomics);
duplicateValuationMethod.outputs.node3.sector_economics.valuation_method_selection.push({
  method: 'RNAV',
  status: 'CONDITIONAL',
  reason: 'Trùng phương pháp để kiểm tra validator.',
  evidence_refs: ['project-nav-evidence']
});
const duplicateValuationMethodCheck = validateAnalysisResult(duplicateValuationMethod);
assert.equal(duplicateValuationMethodCheck.valid, false);
assert.ok(duplicateValuationMethodCheck.errors.some(error => error.includes('must not duplicate another valuation method')));

const causalDelta = structuredClone(riskOnMarketContext);
causalDelta.outputs.node4.market_context_use = {
  source: 'NODE2.market_context',
  measurement_policy: 'CONSUME_ONLY',
  consumed_capabilities: ['market_foreign_flow','stock_relative_strength'],
  interpretation: 'Khối ngoại bán ròng là lực cản ngắn hạn, trong khi cổ phiếu vẫn mạnh hơn VN-Index và VN30.'
};
causalDelta.outputs.node4.what_changed = [{
  driver: 'USD/VND',
  driver_type: 'FX',
  exposure: 'Doanh thu ngoại tệ lớn hơn chi phí ngoại tệ.',
  prior_state: '25,000',
  current_state: '25,400',
  direction: 'UP',
  materiality: 'MEDIUM',
  transmission_lag: '1-2 quý',
  source_refs: ['sbv-fx-2026-10-03'],
  as_of: '2026-10-03',
  transmission_targets: ['REVENUE','MARGIN','VALUATION'],
  fact: 'USD/VND tăng so với mốc so sánh.',
  inference: 'Nếu cơ cấu tiền tệ không đổi, VND yếu hơn hỗ trợ doanh thu quy đổi nhưng có thể tăng chi phí nhập khẩu.',
  assumption: 'Cơ cấu hedging và tiền tệ không thay đổi đáng kể.',
  inference_confidence: 72
}];
assert.equal(validateAnalysisResult(causalDelta).valid, true);

const consumeMissingMarketCapability = structuredClone(degradedMarketContext);
consumeMissingMarketCapability.outputs.node4.market_context_use = {
  source: 'NODE2.market_context',
  measurement_policy: 'CONSUME_ONLY',
  consumed_capabilities: ['market_foreign_flow'],
  interpretation: 'Không được phép diễn giải capability chưa có dữ liệu.'
};
const consumeMissingMarketCapabilityCheck = validateAnalysisResult(consumeMissingMarketCapability);
assert.equal(consumeMissingMarketCapabilityCheck.valid, false);
assert.ok(consumeMissingMarketCapabilityCheck.errors.some(error => error.includes('cannot consume unavailable Node2 capability')));

const emptyMarketContextUse = structuredClone(causalDelta);
emptyMarketContextUse.outputs.node4.market_context_use.consumed_capabilities = [];
const emptyMarketContextUseCheck = validateAnalysisResult(emptyMarketContextUse);
assert.equal(emptyMarketContextUseCheck.valid, false);
assert.ok(emptyMarketContextUseCheck.errors.some(error => error.includes('must be non-empty when market_context_use is present')));

const causalDeltaWithoutPrior = structuredClone(causalDelta);
causalDeltaWithoutPrior.outputs.node4.what_changed[0].prior_state = null;
const causalDeltaWithoutPriorCheck = validateAnalysisResult(causalDeltaWithoutPrior);
assert.equal(causalDeltaWithoutPriorCheck.valid, false);
assert.ok(causalDeltaWithoutPriorCheck.errors.some(error => error.includes('direction must be UNKNOWN')));

const causalDeltaUnknownDirection = structuredClone(causalDelta);
causalDeltaUnknownDirection.outputs.node4.what_changed[0].prior_state = null;
causalDeltaUnknownDirection.outputs.node4.what_changed[0].direction = 'UNKNOWN';
assert.equal(validateAnalysisResult(causalDeltaUnknownDirection).valid, true);

const invalidTransmissionTarget = structuredClone(causalDelta);
invalidTransmissionTarget.outputs.node4.what_changed[0].transmission_targets = ['MARKET_SENTIMENT'];
const invalidTransmissionTargetCheck = validateAnalysisResult(invalidTransmissionTarget);
assert.equal(invalidTransmissionTargetCheck.valid, false);
assert.ok(invalidTransmissionTargetCheck.errors.some(error => error.includes('canonical company-economics target')));

const duplicatedVnindexDelta = structuredClone(causalDelta);
duplicatedVnindexDelta.outputs.node4.what_changed[0].driver = 'VNINDEX 20D return';
duplicatedVnindexDelta.outputs.node4.what_changed[0].driver_type = 'MACRO';
const duplicatedVnindexDeltaCheck = validateAnalysisResult(duplicatedVnindexDelta);
assert.equal(duplicatedVnindexDeltaCheck.valid, false);
assert.ok(duplicatedVnindexDeltaCheck.errors.some(error => error.includes('Node2-owned market-internal measurement')));

const duplicatedMarketFlowInLegacyMacro = structuredClone(causalDelta);
duplicatedMarketFlowInLegacyMacro.outputs.node4.macro_indicators = {
  market_foreign_flow: -850
};
const duplicatedMarketFlowInLegacyMacroCheck = validateAnalysisResult(duplicatedMarketFlowInLegacyMacro);
assert.equal(duplicatedMarketFlowInLegacyMacroCheck.valid, false);
assert.ok(duplicatedMarketFlowInLegacyMacroCheck.errors.some(error => error.includes('macro_indicators must not duplicate Node2')));

console.log('CRSM migration contract tests passed.');
