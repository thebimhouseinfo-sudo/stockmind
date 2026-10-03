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

console.log('CRSM migration contract tests passed.');
