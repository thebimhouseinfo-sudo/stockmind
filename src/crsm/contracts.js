export const CRSM_REQUEST_VERSION = 'crsm-request.v1';
export const CRSM_RESULT_VERSION = 'crsm-result.v1';
export const CRSM_PIPELINE_VERSION = 'crsm-pipeline.v1';

export const ANALYSIS_SOURCES = Object.freeze({
  SCREENED_WEB: 'SCREENED_WEB',
  EVIDENCE_WEB: 'EVIDENCE_WEB',
  WEB_ONLY: 'WEB_ONLY'
});

export const REQUIRED_RENDER_OUTPUT_KEYS = Object.freeze([
  'node1',
  'node2',
  'node3',
  'node4',
  'node5'
]);

export const DECISION_RECORD_FIELDS = Object.freeze([
  'date',
  'ticker',
  'price_at_analysis',
  'decision',
  'ai_score',
  'confidence',
  'entry_zone',
  'trading_stop',
  'tp1',
  'tp2',
  'thesis_invalidation'
]);

export function validateAnalysisItem(item) {
  const errors = [];
  if (!isPlainObject(item)) return fail('item must be an object');

  requireString(item.item_id, 'item_id', errors);
  requireTicker(item.ticker, 'ticker', errors);

  if (!Object.values(ANALYSIS_SOURCES).includes(item.analysis_source)) {
    errors.push('analysis_source must be SCREENED_WEB, EVIDENCE_WEB, or WEB_ONLY');
    return { valid: false, errors };
  }

  const evidenceRefs = Array.isArray(item.evidence_refs) ? item.evidence_refs : [];
  if (!Array.isArray(item.evidence_refs)) errors.push('evidence_refs must be an array');

  if (item.analysis_source === ANALYSIS_SOURCES.SCREENED_WEB) {
    if (!isPlainObject(item.screening_context)) {
      errors.push('SCREENED_WEB requires screening_context');
    }
    if (evidenceRefs.length) {
      errors.push('SCREENED_WEB forbids evidence_refs');
    }
  }

  if (item.analysis_source === ANALYSIS_SOURCES.EVIDENCE_WEB) {
    if (item.screening_context != null) {
      errors.push('EVIDENCE_WEB forbids screening_context');
    }
    if (!evidenceRefs.length) {
      errors.push('EVIDENCE_WEB requires at least one evidence_ref');
    }
    for (const ref of evidenceRefs) {
      errors.push(...validateEvidenceRef(ref, item).errors);
    }
  }

  if (item.analysis_source === ANALYSIS_SOURCES.WEB_ONLY) {
    if (item.screening_context != null) {
      errors.push('WEB_ONLY forbids screening_context');
    }
    if (evidenceRefs.length) {
      errors.push('WEB_ONLY forbids evidence_refs');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidenceRef(ref, ownerItem) {
  const errors = [];
  if (!isPlainObject(ref)) return fail('evidence_ref must be an object');

  requireString(ref.document_id, 'evidence_ref.document_id', errors);
  requireString(ref.item_id, 'evidence_ref.item_id', errors);
  requireTicker(ref.ticker, 'evidence_ref.ticker', errors);
  requireString(ref.filename, 'evidence_ref.filename', errors);
  requireString(ref.type, 'evidence_ref.type', errors);
  requireString(ref.checksum, 'evidence_ref.checksum', errors);
  requireString(ref.repository_path, 'evidence_ref.repository_path', errors);

  if (!Number.isFinite(ref.size) || ref.size < 0) {
    errors.push('evidence_ref.size must be a non-negative finite number');
  }

  if (ownerItem) {
    if (ref.item_id !== ownerItem.item_id) {
      errors.push('evidence_ref.item_id must match owner item_id');
    }
    if (normalizeTicker(ref.ticker) !== normalizeTicker(ownerItem.ticker)) {
      errors.push('evidence_ref.ticker must match owner ticker');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateEvidencePayload(payload) {
  const errors = [];
  if (!isPlainObject(payload)) return fail('evidence payload must be an object');

  const refResult = validateEvidenceRef(payload);
  errors.push(...refResult.errors);

  if (!('extracted_content' in payload)) {
    errors.push('evidence payload requires extracted_content');
  } else if (
    typeof payload.extracted_content !== 'string'
    && !Array.isArray(payload.extracted_content)
    && !isPlainObject(payload.extracted_content)
  ) {
    errors.push('evidence payload extracted_content must be string, array, or object');
  }

  if (payload.routing_metadata != null && !isPlainObject(payload.routing_metadata)) {
    errors.push('evidence payload routing_metadata must be an object when present');
  }

  return { valid: errors.length === 0, errors };
}

export function validateAnalysisRequest(request) {
  const errors = [];
  if (!isPlainObject(request)) return fail('request must be an object');

  if (request.request_version !== CRSM_REQUEST_VERSION) {
    errors.push(`request_version must equal ${CRSM_REQUEST_VERSION}`);
  }
  if (request.pipeline_version !== CRSM_PIPELINE_VERSION) {
    errors.push(`pipeline_version must equal ${CRSM_PIPELINE_VERSION}`);
  }
  requireString(request.run_id, 'run_id', errors);

  if (!Array.isArray(request.items) || request.items.length === 0) {
    errors.push('items must be a non-empty array');
    return { valid: false, errors };
  }

  const itemIds = new Set();
  const tickers = new Set();
  request.items.forEach((item, index) => {
    const result = validateAnalysisItem(item);
    errors.push(...result.errors.map(error => `items[${index}]: ${error}`));

    if (item?.item_id) {
      if (itemIds.has(item.item_id)) errors.push(`items[${index}]: duplicate item_id`);
      itemIds.add(item.item_id);
    }

    const ticker = normalizeTicker(item?.ticker);
    if (ticker) {
      if (tickers.has(ticker)) errors.push(`items[${index}]: duplicate ticker`);
      tickers.add(ticker);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function validateDecisionRecord(record, ticker = null, node5 = null) {
  const errors = [];
  if (!isPlainObject(record)) return fail('decision_record must be an object');

  for (const field of DECISION_RECORD_FIELDS) {
    if (!(field in record)) errors.push(`decision_record missing field: ${field}`);
  }

  requireString(record.date, 'decision_record.date', errors);
  requireTicker(record.ticker, 'decision_record.ticker', errors);

  if (ticker && normalizeTicker(record.ticker) !== normalizeTicker(ticker)) {
    errors.push('decision_record.ticker must match result ticker');
  }

  if (isPlainObject(node5) && hasAdaptiveNode5Synthesis(node5)) {
    if (record.decision !== node5.decision) {
      errors.push('decision_record.decision must match adaptive Node5 decision');
    }
    if (Number.isFinite(node5.ai_score?.value)) {
      if (!Number.isFinite(record.ai_score) || !nearlyEqual(record.ai_score, node5.ai_score.value, 0.11)) {
        errors.push('decision_record.ai_score must be numeric and match adaptive Node5 ai_score.value');
      }
    } else if (node5.ai_score?.value == null && record.ai_score != null) {
      errors.push('decision_record.ai_score must be null when adaptive Node5 ai_score.value is null');
    }
    if (Number.isFinite(node5.confidence?.value)) {
      if (!Number.isFinite(record.confidence) || !nearlyEqual(record.confidence, node5.confidence.value, 0.11)) {
        errors.push('decision_record.confidence must be numeric and match adaptive Node5 confidence.value');
      }
    } else if (node5.confidence?.value == null && record.confidence != null) {
      errors.push('decision_record.confidence must be null when adaptive Node5 confidence.value is null');
    }

    if ('thesis_conviction' in record) {
      if (record.thesis_conviction !== node5.thesis_conviction?.level) {
        errors.push('decision_record.thesis_conviction must match Node5 thesis_conviction.level');
      }
    }
    if ('market_regime' in record) {
      if (record.market_regime !== node5.decision_overlay?.market_regime?.regime_state) {
        errors.push('decision_record.market_regime must match Node5 decision_overlay.market_regime.regime_state');
      }
    }
    if ('investment_horizon' in record) {
      if (record.investment_horizon !== node5.investment_horizon?.bucket) {
        errors.push('decision_record.investment_horizon must match Node5 investment_horizon.bucket');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAnalysisResult(result) {
  const errors = [];
  const warnings = [];
  if (!isPlainObject(result)) return fail('result must be an object');

  if (result.result_version !== CRSM_RESULT_VERSION) {
    errors.push(`result_version must equal ${CRSM_RESULT_VERSION}`);
  }
  if (result.pipeline_version !== CRSM_PIPELINE_VERSION) {
    errors.push(`pipeline_version must equal ${CRSM_PIPELINE_VERSION}`);
  }

  requireString(result.run_id, 'run_id', errors);
  requireString(result.item_id, 'item_id', errors);
  requireTicker(result.ticker, 'ticker', errors);
  if (result.methodology_revision != null) {
    requireString(result.methodology_revision, 'methodology_revision', errors);
  }

  if (!Object.values(ANALYSIS_SOURCES).includes(result.analysis_source)) {
    errors.push('analysis_source must be SCREENED_WEB, EVIDENCE_WEB, or WEB_ONLY');
  }

  if (!isPlainObject(result.outputs)) {
    errors.push('outputs must be an object');
  } else {
    for (const key of REQUIRED_RENDER_OUTPUT_KEYS) {
      if (!(key in result.outputs) || result.outputs[key] == null) {
        errors.push(`outputs missing required renderer key: ${key}`);
      }
    }
    if ('node6a' in result.outputs && result.outputs.node6a != null && typeof result.outputs.node6a !== 'string') {
      warnings.push('outputs.node6a legacy HTML is ignored by the deterministic web renderer');
    }
    if ('node6b' in result.outputs && result.outputs.node6b != null && typeof result.outputs.node6b !== 'string') {
      warnings.push('outputs.node6b is not Markdown text; the webapp may use a deterministic fallback');
    }

    if (isPlainObject(result.outputs.node1)) {
      errors.push(...validateNode1Output(result.outputs.node1).map(error => 'outputs.node1: ' + error));
    }
    if (isPlainObject(result.outputs.node2)) {
      errors.push(...validateNode2Output(result.outputs.node2).map(error => 'outputs.node2: ' + error));
      warnings.push(...validateRequiredKeys(
        result.outputs.node2,
        ['ohlcv_source','trend_status','sma_200_rel','volume_analysis','smart_money_phase','zones','sector_benchmark','sector_vs_market','screening_signal_analysis','signal_strength','conclusion']
      ).map(error => 'outputs.node2: ' + error));
    }
    if (isPlainObject(result.outputs.node3)) {
      errors.push(...validateNode3AdaptiveOutput(result.outputs.node3, result.outputs.node1).map(error => 'outputs.node3: ' + error));
      warnings.push(...validateRequiredKeys(
        result.outputs.node3,
        ['data_period','screening_flags','screening_metrics_used','capital_efficiency','earnings_quality','earnings_sustainability','f_score','m_score','m_score_note','health_status','valuation','moat','conclusion']
      ).map(error => 'outputs.node3: ' + error));
    }
    if (isPlainObject(result.outputs.node4)) {
      errors.push(...validateNode4CausalOutput(result.outputs.node4, result.outputs.node2).map(error => 'outputs.node4: ' + error));
      warnings.push(...validateRequiredKeys(
        result.outputs.node4,
        ['risk_regime','macro_indicators','company_specific_drivers','sensitivity_table','geopolitical_events','causal_chains','risk_scenarios','macro_view','industry_impact','company_impact','conclusion']
      ).map(error => 'outputs.node4: ' + error));
    }
    if (isPlainObject(result.outputs.node5)) {
      errors.push(...validateNode5Output(result.outputs.node5, {
        node2: result.outputs.node2,
        node3: result.outputs.node3,
        node4: result.outputs.node4
      }).map(error => 'outputs.node5: ' + error));
    }
    if (typeof result.outputs.node6a === 'string' && result.outputs.node6a.trim()) {
      warnings.push(...validateNode6AReport(result.outputs.node6a).map(error => 'outputs.node6a: ' + error));
    }
    if (typeof result.outputs.node6b === 'string' && result.outputs.node6b.trim()) {
      const node6bSemantic = validateNode6BSemanticCore(result.outputs.node6b);
      if (result.methodology_revision) {
        errors.push(...node6bSemantic.map(error => 'outputs.node6b: ' + error));
      } else {
        warnings.push(...node6bSemantic.map(error => 'outputs.node6b: ' + error));
      }
      warnings.push(...validateNode6BPresentation(result.outputs.node6b).map(error => 'outputs.node6b: ' + error));
    } else {
      warnings.push('outputs.node6b is missing or empty; deterministic detail fallback may be used');
    }
  }

  const decision = validateDecisionRecord(result.decision_record, result.ticker, result.outputs?.node5);
  errors.push(...decision.errors);

  return { valid: errors.length === 0, errors, warnings };
}

export const NODE5_DECISIONS = Object.freeze(['BUY', 'HOLD', 'SELL', 'BUY ON DIP', 'WATCH']);
export const NODE2_COVERAGE_STATES = Object.freeze(['FULL', 'DEGRADED']);
export const NODE2_COVERAGE_MODELS = Object.freeze(['LEGACY_300_V1', 'CAPABILITY_BASED_V1']);
export const NODE2_MARKET_CONTEXT_CAPABILITIES = Object.freeze(['vnindex_baseline','secondary_benchmark','breadth','turnover_liquidity','leadership_rotation','volatility','market_foreign_flow','stock_relative_strength']);
export const NODE5_CONFIDENCE_METHODS = Object.freeze(['LEGACY_V1', 'EVIDENCE_QUALITY_V1']);
export const NODE1_SECTOR_PROFILES = Object.freeze(['BANK','INSURANCE','SECURITIES','REAL_ESTATE','UTILITIES_POWER','COMMODITY_CYCLICAL','INDUSTRIAL_LOGISTICS','TECHNOLOGY_SERVICES','CONSUMER','GENERIC']);
export const NODE1_MATERIAL_QUESTION_STATES = Object.freeze(['ANSWERED','PARTIAL','MISSING']);
export const NODE3_EXPECTATION_BASES = Object.freeze(['OBSERVED_CONSENSUS','COMPANY_GUIDANCE','VALUATION_IMPLIED','PRICE_ACTION_INFERENCE']);
export const NODE3_EXPECTATION_GAP_DIRECTIONS = Object.freeze(['ABOVE','IN_LINE','BELOW','UNCERTAIN']);
export const NODE3_VALUATION_METHOD_STATUSES = Object.freeze(['SELECTED','CONDITIONAL','NOT_USED']);
export const NODE3_VALUATION_METHODS_BY_SECTOR = Object.freeze({
  BANK: Object.freeze(['PB_ROE','RESIDUAL_INCOME','DIVIDEND_DISCOUNT','PE_SUPPLEMENTARY']),
  INSURANCE: Object.freeze(['PB','PE','EMBEDDED_VALUE']),
  SECURITIES: Object.freeze(['PB','NORMALIZED_PE']),
  REAL_ESTATE: Object.freeze(['RNAV','NAV','PB','NORMALIZED_PE']),
  UTILITIES_POWER: Object.freeze(['DCF','EV_EBITDA','PE']),
  COMMODITY_CYCLICAL: Object.freeze(['MID_CYCLE_EV_EBITDA','MID_CYCLE_PB','SCENARIO_DCF']),
  INDUSTRIAL_LOGISTICS: Object.freeze(['EV_EBITDA','PE','DCF']),
  TECHNOLOGY_SERVICES: Object.freeze(['PE','EV_EBITDA','DCF','GROWTH_MULTIPLE']),
  CONSUMER: Object.freeze(['PE','EV_EBITDA','DCF']),
  GENERIC: Object.freeze(['PE','NORMALIZED_PE','PB','EV_EBITDA','DCF'])
});
export const NODE4_DRIVER_TYPES = Object.freeze(['MACRO','POLICY','RATES','FX','COMMODITY','REGULATORY','COMPANY_EXTERNAL']);
export const NODE4_DELTA_DIRECTIONS = Object.freeze(['UP','DOWN','UNCHANGED','MIXED','UNKNOWN']);
export const NODE4_MATERIALITY = Object.freeze(['LOW','MEDIUM','HIGH']);
export const NODE4_TRANSMISSION_TARGETS = Object.freeze(['REVENUE','MARGIN','CASH_FLOW','BALANCE_SHEET','VALUATION']);
export const NODE5_AI_SCORE_WEIGHTS = Object.freeze({fundamental:30,valuation:20,technical:15,flow:15,sector_macro:10,risk:10});
export const NODE5_CONVICTION_LEVELS = Object.freeze(['LOW','MEDIUM','HIGH']);
export const NODE5_CATALYST_VISIBILITY = Object.freeze(['LOW','MEDIUM','HIGH','UNKNOWN']);
export const NODE5_PAYOFF_ASYMMETRY = Object.freeze(['NEGATIVE','BALANCED','POSITIVE','UNCERTAIN']);
export const NODE5_REGIME_STATES = Object.freeze(['RISK_ON','NEUTRAL','RISK_OFF','MIXED','UNKNOWN']);
export const NODE5_TIMING_EFFECTS = Object.freeze(['NONE','ACCELERATE','DELAY','WAIT_FOR_ENTRY']);
export const NODE5_SIZING_EFFECTS = Object.freeze(['NONE','INCREASE','REDUCE','CAP']);
export const NODE5_DECISION_EFFECTS = Object.freeze(['NONE','WORDING_ONLY','OVERRIDE']);
export const NODE5_RISK_OWNERS = Object.freeze(['FUNDAMENTAL','VALUATION','TECHNICAL','FLOW','SECTOR_MACRO','RISK']);
export const NODE5_RESIDUAL_RISK_EFFECTS = Object.freeze(['NONE','LOW','MEDIUM','HIGH']);
export const NODE5_RISK_TREATMENTS = Object.freeze(['NO_ADDITIONAL_PENALTY','RESIDUAL_TAIL_PENALTY','PRIMARY_RISK_PENALTY']);
export const NODE5_HORIZONS = Object.freeze(['0-3M','3-12M','12M+']);

function validateNode1Output(node) {
  const errors = validateRequiredKeys(node, [
    'ticker','sector_type','timestamp','data_period','analysis_mode','screening_metrics',
    'screening_summary','trusted_screener_snapshot','screening_as_of','data_integrity',
    'market_data','valuation_multiples','financial_core_raw','cost_of_capital_raw_inputs',
    'ownership_insider','upcoming_events','anomaly_investigation','data_completion','sources'
  ]);

  if ('sector_profile' in node) {
    if (!NODE1_SECTOR_PROFILES.includes(node.sector_profile)) {
      errors.push('sector_profile must be a canonical CRSM sector profile');
    }
  }

  if ('material_questions' in node) {
    if (!Array.isArray(node.material_questions)) {
      errors.push('material_questions must be an array');
    } else {
      node.material_questions.forEach((item, index) => {
        if (!isPlainObject(item)) {
          errors.push('material_questions[' + index + '] must be an object');
          return;
        }
        requireString(item.question, 'material_questions[' + index + '].question', errors);
        requireString(item.why_material, 'material_questions[' + index + '].why_material', errors);
        if (!NODE1_MATERIAL_QUESTION_STATES.includes(item.status)) {
          errors.push('material_questions[' + index + '].status must be ANSWERED, PARTIAL, or MISSING');
        }
        if (!(item.answer == null || typeof item.answer === 'string')) {
          errors.push('material_questions[' + index + '].answer must be string or null');
        }
        if (!Array.isArray(item.source_refs)) {
          errors.push('material_questions[' + index + '].source_refs must be an array');
        } else {
          item.source_refs.forEach((ref, sourceIndex) => {
            if (typeof ref !== 'string' || !ref.trim()) {
              errors.push('material_questions[' + index + '].source_refs[' + sourceIndex + '] must be a non-empty string');
            }
          });
        }
        if (item.status === 'ANSWERED' || item.status === 'PARTIAL') {
          if (typeof item.answer !== 'string' || !item.answer.trim()) {
            errors.push(item.status + ' material question answer must be a non-empty string');
          }
          if (!Array.isArray(item.source_refs) || item.source_refs.length === 0) {
            errors.push(item.status + ' material question must cite at least one source_ref');
          }
        }
        if (item.status === 'MISSING' && item.answer != null) {
          errors.push('MISSING material question answer must be null');
        }
        if (!(item.freshness == null || typeof item.freshness === 'string')) {
          errors.push('material_questions[' + index + '].freshness must be string or null');
        }
      });
    }
  }

  return errors;
}

function validateNode2Output(node) {
  const errors = [];
  const coverage = node.technical_coverage;
  if (!isPlainObject(coverage)) {
    errors.push('technical_coverage must be an object');
    return errors;
  }

  if (!NODE2_COVERAGE_STATES.includes(coverage.status)) {
    errors.push('technical_coverage.status must be FULL or DEGRADED');
  }

  const coverageModel = coverage.coverage_model ?? 'LEGACY_300_V1';
  if (!NODE2_COVERAGE_MODELS.includes(coverageModel)) {
    errors.push('technical_coverage.coverage_model must be LEGACY_300_V1 or CAPABILITY_BASED_V1');
  }

  if (coverageModel === 'LEGACY_300_V1') {
    if (coverage.required_sessions !== 300) {
      errors.push('legacy technical_coverage.required_sessions must equal 300');
    }
  } else if (coverageModel === 'CAPABILITY_BASED_V1') {
    if ('required_sessions' in coverage && coverage.required_sessions != null
      && (!Number.isFinite(coverage.required_sessions) || coverage.required_sessions < 0)) {
      errors.push('capability-based technical_coverage.required_sessions must be null or a non-negative finite number');
    }
    if (!Array.isArray(coverage.indicator_requirements) || coverage.indicator_requirements.length === 0) {
      errors.push('capability-based technical_coverage.indicator_requirements must be a non-empty array');
    } else {
      coverage.indicator_requirements.forEach((requirement, index) => {
        if (!isPlainObject(requirement)) {
          errors.push('technical_coverage.indicator_requirements[' + index + '] must be an object');
          return;
        }
        requireString(requirement.capability, 'technical_coverage.indicator_requirements[' + index + '].capability', errors);
        if (!(requirement.required_sessions == null
          || (Number.isFinite(requirement.required_sessions) && requirement.required_sessions >= 0))) {
          errors.push('technical_coverage.indicator_requirements[' + index + '].required_sessions must be null or a non-negative finite number');
        }
        if (typeof requirement.satisfied !== 'boolean') {
          errors.push('technical_coverage.indicator_requirements[' + index + '].satisfied must be boolean');
        }
        if (coverage.status === 'FULL' && requirement.satisfied === false) {
          errors.push('FULL capability-based technical coverage cannot contain unsatisfied indicator requirements');
        }
      });
    }
  }

  if (!(coverage.sessions_used == null || Number.isFinite(coverage.sessions_used))) {
    errors.push('technical_coverage.sessions_used must be a finite number or null');
  }
  if (!Array.isArray(coverage.missing_capabilities)) {
    errors.push('technical_coverage.missing_capabilities must be an array');
  }
  if (coverage.status === 'FULL' && coverage.missing_capabilities?.length) {
    errors.push('FULL technical coverage cannot declare missing capabilities');
  }
  if (coverage.status === 'DEGRADED' && !coverage.missing_capabilities?.length) {
    errors.push('DEGRADED technical coverage must name missing capabilities');
  }

  if (coverageModel === 'CAPABILITY_BASED_V1') {
    const requirements = Array.isArray(coverage.indicator_requirements) ? coverage.indicator_requirements : [];
    const missingCapabilities = Array.isArray(coverage.missing_capabilities) ? coverage.missing_capabilities : [];
    for (const requirement of requirements) {
      if (!isPlainObject(requirement) || typeof requirement.capability !== 'string' || !requirement.capability.trim()) continue;
      const capability = requirement.capability.trim();
      if (requirement.satisfied === false && !missingCapabilities.includes(capability)) {
        errors.push('unsatisfied technical capability must be named in missing_capabilities: ' + capability);
      }
      if (requirement.satisfied === true && missingCapabilities.includes(capability)) {
        errors.push('satisfied technical capability cannot also be missing: ' + capability);
      }
    }
    if (Number.isFinite(coverage.sessions_used)
      && isPlainObject(node.ohlcv_source)
      && Number.isFinite(node.ohlcv_source.sessions_used)
      && coverage.sessions_used !== node.ohlcv_source.sessions_used) {
      errors.push('capability-based technical_coverage.sessions_used must match ohlcv_source.sessions_used');
    }
  }

  // Degraded technical evidence is a valid analytical outcome. Missing inputs
  // reduce coverage/confidence; they do not invalidate the whole ticker.
  if (coverage.status === 'FULL') {
    const ohlcv = node.ohlcv_source;
    if (!isPlainObject(ohlcv)) {
      errors.push('FULL technical coverage requires ohlcv_source');
    } else {
      requireString(ohlcv.source, 'ohlcv_source.source', errors);
      if (coverageModel === 'LEGACY_300_V1') {
        if (!Number.isFinite(ohlcv.sessions_used) || ohlcv.sessions_used < 200) {
          errors.push('FULL legacy technical coverage requires at least 200 verified sessions');
        }
      } else if (!Number.isFinite(ohlcv.sessions_used) || ohlcv.sessions_used <= 0) {
        errors.push('FULL capability-based technical coverage requires verified OHLCV sessions_used');
      } else {
        for (const [index, requirement] of (coverage.indicator_requirements || []).entries()) {
          if (isPlainObject(requirement)
            && requirement.satisfied === true
            && Number.isFinite(requirement.required_sessions)
            && requirement.required_sessions > ohlcv.sessions_used) {
            errors.push('technical_coverage.indicator_requirements[' + index + '] cannot be satisfied with fewer verified sessions than required');
          }
        }
      }
    }
  }

  if (coverageModel === 'CAPABILITY_BASED_V1') {
    const requirements = Array.isArray(coverage.indicator_requirements) ? coverage.indicator_requirements : [];
    const sma200Requirement = requirements.find(requirement =>
      isPlainObject(requirement)
      && typeof requirement.capability === 'string'
      && requirement.capability.toLowerCase() === 'sma200'
    );
    if (node.sma_200_rel != null) {
      if (!sma200Requirement || sma200Requirement.satisfied !== true
        || !Number.isFinite(sma200Requirement.required_sessions)
        || sma200Requirement.required_sessions < 200) {
        errors.push('capability-based sma_200_rel requires a satisfied sma200 indicator requirement with at least 200 sessions');
      }
    }
  }

  if ('market_context' in node) {
    errors.push(...validateNode2EvidenceGatedSignals(node));
    errors.push(...validateNode2MarketContext(node.market_context));
  }

  return errors;
}

function validateNode2EvidenceGatedSignals(node) {
  const errors = [];

  if (node.smart_money_phase != null) {
    if (!isPlainObject(node.smart_money_phase)) {
      errors.push('market-context smart_money_phase must be null or an evidence-gated object');
    } else {
      requireString(node.smart_money_phase.label, 'smart_money_phase.label', errors);
      if (!['CANDIDATE','VERIFIED'].includes(node.smart_money_phase.evidence_status)) {
        errors.push('smart_money_phase.evidence_status must be CANDIDATE or VERIFIED');
      }
      if (!Array.isArray(node.smart_money_phase.supporting_evidence)
        || node.smart_money_phase.supporting_evidence.length === 0) {
        errors.push('smart_money_phase requires supporting_evidence');
      } else {
        node.smart_money_phase.supporting_evidence.forEach((evidence, index) => {
          requireString(evidence, 'smart_money_phase.supporting_evidence[' + index + ']', errors);
        });
      }
      if (node.smart_money_phase.evidence_status === 'VERIFIED'
        && (!Array.isArray(node.smart_money_phase.supporting_evidence)
          || node.smart_money_phase.supporting_evidence.length < 2)) {
        errors.push('VERIFIED smart_money_phase requires at least two supporting evidence items');
      }
    }
  }

  const volume = node.volume_analysis;
  if (isPlainObject(volume)) {
    const candidate = typeof volume.vsa_signal_candidate === 'string'
      ? volume.vsa_signal_candidate.trim().toLowerCase()
      : volume.vsa_signal_candidate;
    const claimsSignal = candidate != null && candidate !== '' && candidate !== 'none' && candidate !== 'null';
    if (claimsSignal) {
      if (!Array.isArray(volume.supporting_evidence) || volume.supporting_evidence.length === 0) {
        errors.push('VSA signal candidate requires supporting_evidence');
      } else {
        volume.supporting_evidence.forEach((evidence, index) => {
          requireString(evidence, 'volume_analysis.supporting_evidence[' + index + ']', errors);
        });
      }
    }
  }

  return errors;
}

function validateNode2MarketContext(context) {
  const errors = [];
  if (!isPlainObject(context)) {
    errors.push('market_context must be an object');
    return errors;
  }

  const requiredKeys = [
    'as_of','benchmarks','breadth','turnover_liquidity','leadership_rotation',
    'volatility','market_foreign_flow','stock_relative_strength','coverage'
  ];
  errors.push(...validateRequiredKeys(context, requiredKeys).map(error => 'market_context ' + error));

  const coverage = context.coverage;
  if (!isPlainObject(coverage)) {
    errors.push('market_context.coverage must be an object');
    return errors;
  }

  if (!NODE2_COVERAGE_STATES.includes(coverage.status)) {
    errors.push('market_context.coverage.status must be FULL or DEGRADED');
  }
  if (!Array.isArray(coverage.available_capabilities)) {
    errors.push('market_context.coverage.available_capabilities must be an array');
  }
  if (!Array.isArray(coverage.missing_capabilities)) {
    errors.push('market_context.coverage.missing_capabilities must be an array');
  }

  const available = Array.isArray(coverage.available_capabilities) ? coverage.available_capabilities : [];
  const missing = Array.isArray(coverage.missing_capabilities) ? coverage.missing_capabilities : [];
  const combined = [...available, ...missing];

  for (const capability of combined) {
    if (!NODE2_MARKET_CONTEXT_CAPABILITIES.includes(capability)) {
      errors.push('market_context.coverage contains unsupported capability: ' + capability);
    }
  }
  if (new Set(available).size !== available.length) {
    errors.push('market_context.coverage.available_capabilities must not contain duplicates');
  }
  if (new Set(missing).size !== missing.length) {
    errors.push('market_context.coverage.missing_capabilities must not contain duplicates');
  }
  for (const capability of available) {
    if (missing.includes(capability)) {
      errors.push('market_context capability cannot be both available and missing: ' + capability);
    }
  }
  for (const capability of NODE2_MARKET_CONTEXT_CAPABILITIES) {
    if (!available.includes(capability) && !missing.includes(capability)) {
      errors.push('market_context.coverage must account for capability: ' + capability);
    }
  }
  if (coverage.status === 'FULL' && missing.length) {
    errors.push('FULL market_context coverage cannot declare missing capabilities');
  }
  if (coverage.status === 'DEGRADED' && missing.length === 0) {
    errors.push('DEGRADED market_context coverage must name missing capabilities');
  }

  if (!Array.isArray(coverage.provenance)) {
    errors.push('market_context.coverage.provenance must be an array');
  } else {
    coverage.provenance.forEach((entry, index) => {
      if (!isPlainObject(entry)) {
        errors.push('market_context.coverage.provenance[' + index + '] must be an object');
        return;
      }
      if (!NODE2_MARKET_CONTEXT_CAPABILITIES.includes(entry.capability)) {
        errors.push('market_context.coverage.provenance[' + index + '].capability must be canonical');
      }
      requireString(entry.source, 'market_context.coverage.provenance[' + index + '].source', errors);
      requireString(entry.as_of, 'market_context.coverage.provenance[' + index + '].as_of', errors);
      if (missing.includes(entry.capability)) {
        errors.push('missing market_context capability must not declare provenance: ' + entry.capability);
      }
    });

    for (const capability of available) {
      const hasSource = coverage.provenance.some(entry =>
        isPlainObject(entry)
        && entry.capability === capability
        && typeof entry.source === 'string'
        && entry.source.trim()
      );
      if (!hasSource) {
        errors.push('available market_context capability lacks provenance: ' + capability);
      }
    }
  }

  requireString(context.as_of, 'market_context.as_of', errors);

  if (!isPlainObject(context.benchmarks)) {
    errors.push('market_context.benchmarks must be an object');
  } else {
    const vnindex = context.benchmarks.vnindex;
    const secondary = context.benchmarks.secondary;
    if (available.includes('vnindex_baseline')) {
      if (!isPlainObject(vnindex)) {
        errors.push('available vnindex_baseline requires market_context.benchmarks.vnindex');
      } else {
        if (vnindex.name !== 'VNINDEX') errors.push('market_context.benchmarks.vnindex.name must be VNINDEX');
        requireString(vnindex.period, 'market_context.benchmarks.vnindex.period', errors);
        if (!Number.isFinite(vnindex.performance_pct)) {
          errors.push('available vnindex_baseline requires numeric performance_pct');
        }
        requireString(vnindex.source, 'market_context.benchmarks.vnindex.source', errors);
      }
    } else if (missing.includes('vnindex_baseline') && vnindex != null) {
      errors.push('missing vnindex_baseline must use null market_context.benchmarks.vnindex');
    }

    if (available.includes('secondary_benchmark')) {
      if (!Array.isArray(secondary) || secondary.length === 0) {
        errors.push('available secondary_benchmark requires at least one market_context.benchmarks.secondary entry');
      } else {
        secondary.forEach((benchmark, index) => {
          if (!isPlainObject(benchmark)) {
            errors.push('market_context.benchmarks.secondary[' + index + '] must be an object');
            return;
          }
          requireString(benchmark.name, 'market_context.benchmarks.secondary[' + index + '].name', errors);
          if (!['INDEX','SECTOR','PEER_BASKET'].includes(benchmark.kind)) {
            errors.push('market_context.benchmarks.secondary[' + index + '].kind must be INDEX, SECTOR, or PEER_BASKET');
          }
          requireString(benchmark.period, 'market_context.benchmarks.secondary[' + index + '].period', errors);
          if (!Number.isFinite(benchmark.performance_pct)) {
            errors.push('market_context.benchmarks.secondary[' + index + '].performance_pct must be numeric');
          }
          requireString(benchmark.source, 'market_context.benchmarks.secondary[' + index + '].source', errors);
          if (benchmark.kind === 'PEER_BASKET'
            && (!Array.isArray(benchmark.constituents) || benchmark.constituents.length < 3 || benchmark.constituents.length > 5)) {
            errors.push('PEER_BASKET secondary benchmark must name 3-5 constituents');
          }
        });
      }
    } else if (missing.includes('secondary_benchmark') && Array.isArray(secondary) && secondary.length) {
      errors.push('missing secondary_benchmark must use an empty market_context.benchmarks.secondary array');
    }
  }

  const capabilityFields = {
    breadth: 'breadth',
    turnover_liquidity: 'turnover_liquidity',
    leadership_rotation: 'leadership_rotation',
    volatility: 'volatility',
    market_foreign_flow: 'market_foreign_flow',
    stock_relative_strength: 'stock_relative_strength'
  };
  for (const [capability, field] of Object.entries(capabilityFields)) {
    if (available.includes(capability) && !isPlainObject(context[field])) {
      errors.push('available ' + capability + ' requires market_context.' + field);
    }
    if (missing.includes(capability) && context[field] != null) {
      errors.push('missing ' + capability + ' must use null market_context.' + field);
    }
  }

  if (available.includes('breadth') && isPlainObject(context.breadth)) {
    if (!Number.isFinite(context.breadth.advancers) || !Number.isFinite(context.breadth.decliners)) {
      errors.push('available breadth requires numeric advancers and decliners');
    }
    requireString(context.breadth.source, 'market_context.breadth.source', errors);
  }
  if (available.includes('turnover_liquidity') && isPlainObject(context.turnover_liquidity)) {
    if (!Number.isFinite(context.turnover_liquidity.market_turnover_value)) {
      errors.push('available turnover_liquidity requires numeric market_turnover_value');
    }
    requireString(context.turnover_liquidity.source, 'market_context.turnover_liquidity.source', errors);
  }
  if (available.includes('leadership_rotation') && isPlainObject(context.leadership_rotation)) {
    if (!Array.isArray(context.leadership_rotation.leaders) || !Array.isArray(context.leadership_rotation.laggards)) {
      errors.push('available leadership_rotation requires leaders and laggards arrays');
    }
    if (!Array.isArray(context.leadership_rotation.source_refs) || context.leadership_rotation.source_refs.length === 0) {
      errors.push('available leadership_rotation requires source_refs');
    } else {
      context.leadership_rotation.source_refs.forEach((ref, index) => {
        requireString(ref, 'market_context.leadership_rotation.source_refs[' + index + ']', errors);
      });
    }
  }
  if (available.includes('volatility') && isPlainObject(context.volatility)) {
    requireString(context.volatility.measure, 'market_context.volatility.measure', errors);
    if (!Number.isFinite(context.volatility.value)) {
      errors.push('available volatility requires numeric value');
    }
    requireString(context.volatility.source, 'market_context.volatility.source', errors);
  }
  if (available.includes('market_foreign_flow') && isPlainObject(context.market_foreign_flow)) {
    if (!Number.isFinite(context.market_foreign_flow.net_value)) {
      errors.push('available market_foreign_flow requires numeric net_value');
    }
    requireString(context.market_foreign_flow.source, 'market_context.market_foreign_flow.source', errors);
  }
  if (available.includes('stock_relative_strength') && isPlainObject(context.stock_relative_strength)) {
    const relative = context.stock_relative_strength;
    requireString(relative.period, 'market_context.stock_relative_strength.period', errors);
    for (const key of ['stock_perf_pct','vnindex_perf_pct','vs_vnindex_pct']) {
      if (!Number.isFinite(relative[key])) {
        errors.push('available stock_relative_strength requires numeric ' + key);
      }
    }
    if (!Array.isArray(relative.source_refs) || relative.source_refs.length === 0) {
      errors.push('available stock_relative_strength requires source_refs');
    } else {
      relative.source_refs.forEach((ref, index) => {
        requireString(ref, 'market_context.stock_relative_strength.source_refs[' + index + ']', errors);
      });
    }

    const vnindex = isPlainObject(context.benchmarks) ? context.benchmarks.vnindex : null;
    if (available.includes('vnindex_baseline') && isPlainObject(vnindex)
      && typeof relative.period === 'string' && relative.period.trim()
      && vnindex.period !== relative.period) {
      errors.push('stock_relative_strength period must match VNINDEX benchmark period');
    }

    if (available.includes('secondary_benchmark')) {
      requireString(relative.secondary_benchmark_name, 'market_context.stock_relative_strength.secondary_benchmark_name', errors);
      if (!Number.isFinite(relative.secondary_benchmark_perf_pct)) {
        errors.push('available secondary_benchmark requires stock_relative_strength.secondary_benchmark_perf_pct');
      }
      if (!Number.isFinite(relative.vs_secondary_benchmark_pct)) {
        errors.push('available secondary_benchmark requires stock_relative_strength.vs_secondary_benchmark_pct');
      }
      const secondary = isPlainObject(context.benchmarks) && Array.isArray(context.benchmarks.secondary)
        ? context.benchmarks.secondary
        : [];
      const selected = secondary.find(benchmark =>
        isPlainObject(benchmark)
        && typeof relative.secondary_benchmark_name === 'string'
        && benchmark.name === relative.secondary_benchmark_name
      );
      if (!selected) {
        errors.push('stock_relative_strength secondary_benchmark_name must match a declared secondary benchmark');
      } else if (typeof relative.period === 'string' && relative.period.trim() && selected.period !== relative.period) {
        errors.push('stock_relative_strength period must match selected secondary benchmark period');
      }
    }
  }

  return errors;
}




function hasExplicitExpectationInferenceCue(statement) {
  return /(hàm\s*ý|suy\s*luận|cho\s*thấy\s*khả\s*năng|gợi\s*ý|có\s*thể\s*phản\s*ánh|ước\s*tính\s*từ|implies?|suggests?|may\s+reflect|inferred?\s+from)/i.test(statement);
}

function looksLikeNode2MarketInternalMeasurement(value) {
  if (typeof value !== 'string') return false;
  const normalized = value
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /\bvn\s*-?\s*index\b/,
    /\bvn30\b/,
    /\bhnxindex\b|\bhnx\s*index\b/,
    /\bupcomindex\b|\bupcom\s*index\b/,
    /\bmarket\s+breadth\b|độ\s*rộng\s*thị\s*trường/,
    /\bmarket\s+turnover\b|thanh\s*khoản\s*thị\s*trường/,
    /\bmarket\s+foreign\s+flow\b|khối\s*ngoại.*toàn\s*thị\s*trường/,
    /\brelative\s+strength\b|sức\s*mạnh\s*tương\s*đối/,
    /\bmarket\s+volatility\b|biến\s*động\s*thị\s*trường/,
    /\bleadership\s+rotation\b|luân\s*chuyển.*(?:ngành|nhóm)/
  ];
  return patterns.some(pattern => pattern.test(normalized));
}


function validateNode3AdaptiveOutput(node, node1) {
  const errors = [];

  if ('sector_economics' in node) {
    const economics = node.sector_economics;
    if (!isPlainObject(economics)) {
      errors.push('sector_economics must be an object');
    } else {
      const required = [
        'sector_profile','earnings_bridge','normalized_earnings','capital_allocation',
        'balance_sheet_capacity','valuation_method_selection'
      ];
      errors.push(...validateRequiredKeys(economics, required).map(error => 'sector_economics ' + error));

      if (!NODE1_SECTOR_PROFILES.includes(economics.sector_profile)) {
        errors.push('sector_economics.sector_profile must be a canonical CRSM sector profile');
      }
      if (isPlainObject(node1) && node1.sector_profile != null
        && economics.sector_profile !== node1.sector_profile) {
        errors.push('sector_economics.sector_profile must match node1.sector_profile');
      }
      if (!Array.isArray(economics.earnings_bridge)) {
        errors.push('sector_economics.earnings_bridge must be an array');
      }
      if (!(economics.normalized_earnings == null || isPlainObject(economics.normalized_earnings))) {
        errors.push('sector_economics.normalized_earnings must be object or null');
      }
      if (!Array.isArray(economics.capital_allocation)) {
        errors.push('sector_economics.capital_allocation must be an array');
      }
      if (!(economics.balance_sheet_capacity == null || isPlainObject(economics.balance_sheet_capacity))) {
        errors.push('sector_economics.balance_sheet_capacity must be object or null');
      }

      const selections = economics.valuation_method_selection;
      if (!Array.isArray(selections) || selections.length === 0) {
        errors.push('sector_economics.valuation_method_selection must be a non-empty array');
      } else {
        const allMethods = new Set(Object.values(NODE3_VALUATION_METHODS_BY_SECTOR).flat());
        const allowed = NODE3_VALUATION_METHODS_BY_SECTOR[economics.sector_profile] || [];
        const seenMethods = new Set();
        let hasUsableMethod = false;

        selections.forEach((selection, index) => {
          const prefix = 'sector_economics.valuation_method_selection[' + index + ']';
          if (!isPlainObject(selection)) {
            errors.push(prefix + ' must be an object');
            return;
          }
          requireString(selection.method, prefix + '.method', errors);
          if (typeof selection.method === 'string' && selection.method.trim()) {
            if (seenMethods.has(selection.method)) {
              errors.push(prefix + '.method must not duplicate another valuation method');
            }
            seenMethods.add(selection.method);
          }
          if (typeof selection.method === 'string' && selection.method.trim() && !allMethods.has(selection.method)) {
            errors.push(prefix + '.method must be a canonical Node3 valuation method');
          }
          if (!NODE3_VALUATION_METHOD_STATUSES.includes(selection.status)) {
            errors.push(prefix + '.status must be SELECTED, CONDITIONAL, or NOT_USED');
          }
          requireString(selection.reason, prefix + '.reason', errors);
          if (!Array.isArray(selection.evidence_refs)) {
            errors.push(prefix + '.evidence_refs must be an array');
          } else {
            selection.evidence_refs.forEach((ref, refIndex) => {
              requireString(ref, prefix + '.evidence_refs[' + refIndex + ']', errors);
            });
            if ((selection.status === 'SELECTED' || selection.status === 'CONDITIONAL')
              && selection.evidence_refs.length === 0) {
              errors.push(prefix + ' selected/conditional method must cite evidence');
            }
          }
          if ((selection.status === 'SELECTED' || selection.status === 'CONDITIONAL')
            && typeof selection.method === 'string'
            && !allowed.includes(selection.method)) {
            errors.push(prefix + '.method is not suitable for sector_profile ' + economics.sector_profile);
          }
          if (selection.status === 'SELECTED' || selection.status === 'CONDITIONAL') {
            hasUsableMethod = true;
          }
        });

        if (!hasUsableMethod) {
          errors.push('sector_economics.valuation_method_selection must contain at least one SELECTED or CONDITIONAL method');
        }
      }

      if ((economics.sector_profile === 'BANK' || economics.sector_profile === 'INSURANCE')
        && node.f_score != null) {
        errors.push('f_score must be null for BANK/INSURANCE sector economics');
      }
      if (!('expectation_basis' in node)) {
        errors.push('sector_economics requires explicit expectation_basis array, which may be empty');
      }
    }
  }

  if ('expectation_basis' in node) {
    if (!Array.isArray(node.expectation_basis)) {
      errors.push('expectation_basis must be an array');
    } else {
      node.expectation_basis.forEach((entry, index) => {
        const prefix = 'expectation_basis[' + index + ']';
        if (!isPlainObject(entry)) {
          errors.push(prefix + ' must be an object');
          return;
        }
        requireString(entry.topic, prefix + '.topic', errors);
        requireString(entry.statement, prefix + '.statement', errors);
        if (!NODE3_EXPECTATION_BASES.includes(entry.expectation_basis)) {
          errors.push(prefix + '.expectation_basis must be OBSERVED_CONSENSUS, COMPANY_GUIDANCE, VALUATION_IMPLIED, or PRICE_ACTION_INFERENCE');
        }
        if (!NODE3_EXPECTATION_GAP_DIRECTIONS.includes(entry.gap_direction)) {
          errors.push(prefix + '.gap_direction must be ABOVE, IN_LINE, BELOW, or UNCERTAIN');
        }
        if (!Array.isArray(entry.source_refs) || entry.source_refs.length === 0) {
          errors.push(prefix + '.source_refs must be a non-empty array');
        } else {
          entry.source_refs.forEach((ref, refIndex) => {
            requireString(ref, prefix + '.source_refs[' + refIndex + ']', errors);
          });
        }
        requireString(entry.as_of, prefix + '.as_of', errors);
        if (!('expected_value' in entry)) {
          errors.push(prefix + ' missing field: expected_value');
        } else if (!(entry.expected_value == null
          || typeof entry.expected_value === 'string'
          || Number.isFinite(entry.expected_value))) {
          errors.push(prefix + '.expected_value must be string, finite number, or null');
        }
        if (!('expected_unit' in entry)) errors.push(prefix + ' missing field: expected_unit');
        if (!(entry.expected_unit == null || (typeof entry.expected_unit === 'string' && entry.expected_unit.trim()))) {
          errors.push(prefix + '.expected_unit must be string or null');
        }
        if (!('analyst_view' in entry) || entry.analyst_view == null
          || !((typeof entry.analyst_view === 'string' && entry.analyst_view.trim())
            || Number.isFinite(entry.analyst_view))) {
          errors.push(prefix + '.analyst_view must be a non-empty string or finite number');
        }
        requireString(entry.investment_implication, prefix + '.investment_implication', errors);

        const observed = entry.expectation_basis === 'OBSERVED_CONSENSUS'
          || entry.expectation_basis === 'COMPANY_GUIDANCE';
        const inferred = entry.expectation_basis === 'VALUATION_IMPLIED'
          || entry.expectation_basis === 'PRICE_ACTION_INFERENCE';

        if (observed && entry.inference_label != null) {
          errors.push(prefix + '.inference_label must be null for observed expectation bases');
        }
        if (inferred && entry.inference_label !== 'INFERENCE') {
          errors.push(prefix + '.inference_label must equal INFERENCE for inferred expectation bases');
        }
        if (inferred && typeof entry.statement === 'string' && entry.statement.trim()
          && !hasExplicitExpectationInferenceCue(entry.statement)) {
          errors.push(prefix + '.statement must explicitly signal inference for VALUATION_IMPLIED/PRICE_ACTION_INFERENCE');
        }
      });
    }
  }

  return errors;
}

function validateNode4CausalOutput(node, node2) {
  const errors = [];
  const adaptiveNode4 = 'market_context_use' in node || 'what_changed' in node;

  if (adaptiveNode4 && isPlainObject(node.macro_indicators)) {
    for (const key of Object.keys(node.macro_indicators)) {
      if (looksLikeNode2MarketInternalMeasurement(key)) {
        errors.push('adaptive Node4 macro_indicators must not duplicate Node2 market-internal measurement: ' + key);
      }
    }
  }

  if ('market_context_use' in node) {
    const use = node.market_context_use;
    if (!isPlainObject(use)) {
      errors.push('market_context_use must be an object');
    } else {
      if (use.source !== 'NODE2.market_context') {
        errors.push('market_context_use.source must equal NODE2.market_context');
      }
      if (use.measurement_policy !== 'CONSUME_ONLY') {
        errors.push('market_context_use.measurement_policy must equal CONSUME_ONLY');
      }
      if (!Array.isArray(use.consumed_capabilities)) {
        errors.push('market_context_use.consumed_capabilities must be an array');
      } else {
        if (use.consumed_capabilities.length === 0) {
          errors.push('market_context_use.consumed_capabilities must be non-empty when market_context_use is present');
        }
        if (new Set(use.consumed_capabilities).size !== use.consumed_capabilities.length) {
          errors.push('market_context_use.consumed_capabilities must not contain duplicates');
        }
        const available = isPlainObject(node2?.market_context?.coverage)
          && Array.isArray(node2.market_context.coverage.available_capabilities)
          ? node2.market_context.coverage.available_capabilities
          : [];
        use.consumed_capabilities.forEach((capability, index) => {
          if (!NODE2_MARKET_CONTEXT_CAPABILITIES.includes(capability)) {
            errors.push('market_context_use.consumed_capabilities[' + index + '] must be a canonical Node2 market capability');
          } else if (!available.includes(capability)) {
            errors.push('market_context_use cannot consume unavailable Node2 capability: ' + capability);
          }
        });
      }
      requireString(use.interpretation, 'market_context_use.interpretation', errors);
    }
  }

  if ('what_changed' in node) {
    if (!Array.isArray(node.what_changed)) {
      errors.push('what_changed must be an array');
    } else {
      node.what_changed.forEach((entry, index) => {
        const prefix = 'what_changed[' + index + ']';
        if (!isPlainObject(entry)) {
          errors.push(prefix + ' must be an object');
          return;
        }
        requireString(entry.driver, prefix + '.driver', errors);
        if (typeof entry.driver === 'string' && looksLikeNode2MarketInternalMeasurement(entry.driver)) {
          errors.push(prefix + '.driver is a Node2-owned market-internal measurement and must be consumed via market_context_use');
        }
        if (!NODE4_DRIVER_TYPES.includes(entry.driver_type)) {
          errors.push(prefix + '.driver_type must be a canonical external driver type');
        }
        requireString(entry.exposure, prefix + '.exposure', errors);
        if (!('prior_state' in entry)) errors.push(prefix + ' missing field: prior_state');
        if (!('current_state' in entry)) errors.push(prefix + ' missing field: current_state');
        const scalarOrNull = value => value == null || typeof value === 'string' || Number.isFinite(value);
        if (!scalarOrNull(entry.prior_state)) errors.push(prefix + '.prior_state must be string, number, or null');
        if (!scalarOrNull(entry.current_state)) errors.push(prefix + '.current_state must be string, number, or null');
        if (entry.prior_state == null && entry.current_state == null) {
          errors.push(prefix + ' must provide at least one of prior_state or current_state');
        }
        if (!NODE4_DELTA_DIRECTIONS.includes(entry.direction)) {
          errors.push(prefix + '.direction must be UP, DOWN, UNCHANGED, MIXED, or UNKNOWN');
        }
        if (entry.direction !== 'UNKNOWN' && (entry.prior_state == null || entry.current_state == null)) {
          errors.push(prefix + '.direction must be UNKNOWN when prior/current evidence is incomplete');
        }
        if (!NODE4_MATERIALITY.includes(entry.materiality)) {
          errors.push(prefix + '.materiality must be LOW, MEDIUM, or HIGH');
        }
        requireString(entry.transmission_lag, prefix + '.transmission_lag', errors);
        if (!Array.isArray(entry.source_refs) || entry.source_refs.length === 0) {
          errors.push(prefix + '.source_refs must be a non-empty array');
        } else {
          entry.source_refs.forEach((ref, refIndex) => {
            requireString(ref, prefix + '.source_refs[' + refIndex + ']', errors);
          });
        }
        requireString(entry.as_of, prefix + '.as_of', errors);
        if (!Array.isArray(entry.transmission_targets) || entry.transmission_targets.length === 0) {
          errors.push(prefix + '.transmission_targets must be a non-empty array');
        } else {
          if (new Set(entry.transmission_targets).size !== entry.transmission_targets.length) {
            errors.push(prefix + '.transmission_targets must not contain duplicates');
          }
          entry.transmission_targets.forEach((target, targetIndex) => {
            if (!NODE4_TRANSMISSION_TARGETS.includes(target)) {
              errors.push(prefix + '.transmission_targets[' + targetIndex + '] must be a canonical company-economics target');
            }
          });
        }
        requireString(entry.fact, prefix + '.fact', errors);
        requireString(entry.inference, prefix + '.inference', errors);
        if (!(entry.assumption == null || (typeof entry.assumption === 'string' && entry.assumption.trim()))) {
          errors.push(prefix + '.assumption must be string or null');
        }
        if (!Number.isFinite(entry.inference_confidence)
          || entry.inference_confidence < 0
          || entry.inference_confidence > 100) {
          errors.push(prefix + '.inference_confidence must be numeric from 0 to 100');
        }
      });
    }
  }

  return errors;
}


function validateNode5Output(node, upstream = {}) {
  const errors = validateRequiredKeys(node, [
    'ticker','data_period','scores','ai_score','confidence','conflict_detector',
    'catalyst_horizon','decision','drivers','thesis_invalidation','trading_stop',
    'liquidity_note','strategy','localized_upstream','full_reasoning'
  ]);

  if (!NODE5_DECISIONS.includes(node.decision)) {
    errors.push('decision must be BUY, HOLD, SELL, BUY ON DIP, or WATCH');
  }

  if (!isPlainObject(node.scores)) {
    errors.push('scores must be an object');
  } else {
    for (const key of ['fundamental','valuation','technical','flow','sector_macro','risk']) {
      if (!(key in node.scores)) {
        errors.push('scores missing field: ' + key);
        continue;
      }
      const value = node.scores[key];
      if (value != null && (!Number.isFinite(value) || value < 0 || value > 20)) {
        errors.push('scores.' + key + ' must be null or a scalar number from 0 to 20');
      }
    }
    if ('money_flow' in node.scores) errors.push('scores.money_flow is invalid; use scores.flow');
  }

  if (!isPlainObject(node.ai_score) || !('value' in node.ai_score)) {
    errors.push('ai_score must be an object with value');
  } else if (node.ai_score.value != null && (!Number.isFinite(node.ai_score.value) || node.ai_score.value < 0 || node.ai_score.value > 100)) {
    errors.push('ai_score.value must be null or numeric from 0 to 100');
  }

  errors.push(...validateNode5Confidence(node.confidence));

  if (!isPlainObject(node.conflict_detector)) {
    errors.push('conflict_detector must be an object');
  } else {
    for (const key of ['fundamental','technical','macro','liquidity','signal_alignment','alignment','override_applied']) {
      if (!(key in node.conflict_detector)) errors.push('conflict_detector missing field: ' + key);
    }
  }

  if (!isPlainObject(node.catalyst_horizon)) {
    errors.push('catalyst_horizon must be an object');
  } else {
    if (!('nearest_catalyst' in node.catalyst_horizon)) errors.push('catalyst_horizon.nearest_catalyst is required');
    if (!('bucket' in node.catalyst_horizon)) errors.push('catalyst_horizon.bucket is required');
    const bucket = node.catalyst_horizon.bucket;
    if (bucket != null && !['0-30d','30-90d','90-180d','>180d'].includes(bucket)) {
      errors.push('catalyst_horizon.bucket must be null or a canonical bucket');
    }
  }

  if (!Array.isArray(node.drivers)) {
    errors.push('drivers must be an array');
  }
  if (typeof node.thesis_invalidation !== 'string' || !node.thesis_invalidation.trim()) {
    errors.push('thesis_invalidation must be a non-empty string');
  }

  if (!isPlainObject(node.trading_stop) || !('price' in node.trading_stop)) {
    errors.push('trading_stop must be an object with price');
  }

  if (!isPlainObject(node.strategy)) {
    errors.push('strategy must be an object');
  } else {
    for (const key of ['entry_zone','allocation_plan','tp1','tp2','risk_per_trade_pct_nav','position_size_note','max_portfolio_weight_pct','position_type']) {
      if (!(key in node.strategy)) errors.push('strategy missing field: ' + key);
    }
  }

  if (typeof node.full_reasoning !== 'string' || !node.full_reasoning.trim()) {
    errors.push('full_reasoning must be a non-empty Vietnamese investment synthesis');
  }

  if (hasAdaptiveNode5Synthesis(node)) {
    errors.push(...validateAdaptiveNode5Synthesis(node, upstream));
  }

  return errors;
}

function hasAdaptiveNode5Synthesis(node) {
  if (!isPlainObject(node)) return false;
  return [
    'thesis_conviction','decision_overlay','risk_attribution','investment_horizon',
    'anti_thesis','variant_view','monitoring_kpis','what_would_change_my_mind'
  ].some(key => key in node);
}

function validateAdaptiveNode5Synthesis(node, upstream) {
  const errors = [];
  const adaptiveFields = [
    'thesis_conviction','decision_overlay','risk_attribution','investment_horizon',
    'anti_thesis','variant_view','monitoring_kpis','what_would_change_my_mind'
  ];
  for (const field of adaptiveFields) {
    if (!(field in node)) errors.push('adaptive CIO synthesis missing field: ' + field);
  }

  const calculatedAiScore = calculateFixedAiScore(node.scores);
  if (calculatedAiScore != null) {
    if (!Number.isFinite(node.ai_score?.value)) {
      errors.push('adaptive CIO synthesis requires numeric ai_score.value when all six factor scores are numeric');
    } else if (!nearlyEqual(node.ai_score.value, calculatedAiScore, 0.11)) {
      errors.push('adaptive CIO ai_score.value must equal the fixed six-factor AI Score formula');
    }
  } else if (node.ai_score?.value != null) {
    errors.push('adaptive CIO ai_score.value must be null when any six-factor score is unavailable');
  }

  errors.push(...validateAdaptiveEvidenceQualityConfidence(node.confidence));
  errors.push(...validateNode5Conviction(node.thesis_conviction, upstream?.node3));
  errors.push(...validateNode5DecisionOverlay(node.decision_overlay, node, upstream));
  errors.push(...validateNode5RiskAttribution(node.risk_attribution, node.scores?.risk));
  errors.push(...validateNode5Monitoring(node, upstream?.node3));

  return errors;
}

function calculateFixedAiScore(scores) {
  if (!isPlainObject(scores)) return null;
  const keys = Object.keys(NODE5_AI_SCORE_WEIGHTS);
  if (!keys.every(key => Number.isFinite(scores[key]))) return null;
  return keys.reduce((sum, key) => (
    sum + (scores[key] / 20) * NODE5_AI_SCORE_WEIGHTS[key]
  ), 0);
}

function validateAdaptiveEvidenceQualityConfidence(confidence) {
  const errors = [];
  if (!isPlainObject(confidence) || confidence.method !== 'EVIDENCE_QUALITY_V1') {
    errors.push('adaptive CIO synthesis requires confidence.method EVIDENCE_QUALITY_V1');
    return errors;
  }

  const components = confidence.components;
  if (!isPlainObject(components)) return errors;

  const weights = {
    data_completeness: 25,
    source_quality: 20,
    freshness: 15,
    cross_source_consistency: 15,
    method_suitability: 15,
    key_uncertainty_coverage: 10
  };
  const complete = Object.keys(weights).every(key => Number.isFinite(components[key]));
  if (complete) {
    const expected = Object.entries(weights).reduce((sum, [key, weight]) => (
      sum + components[key] * weight / 100
    ), 0);
    if (!Number.isFinite(confidence.value) || !nearlyEqual(confidence.value, expected, 0.11)) {
      errors.push('adaptive EVIDENCE_QUALITY_V1 confidence.value must equal the fixed weighted evidence-quality formula');
    }
  } else if (confidence.value != null) {
    errors.push('adaptive EVIDENCE_QUALITY_V1 confidence.value must be null when any weighted component is unavailable');
  }
  return errors;
}

function validateNode5Conviction(conviction, node3) {
  const errors = [];
  if (!isPlainObject(conviction)) {
    errors.push('thesis_conviction must be an object');
    return errors;
  }
  if (!NODE5_CONVICTION_LEVELS.includes(conviction.level)) {
    errors.push('thesis_conviction.level must be LOW, MEDIUM, or HIGH');
  }
  requireString(conviction.rationale, 'thesis_conviction.rationale', errors);
  if (!Array.isArray(conviction.expectation_basis_refs)) {
    errors.push('thesis_conviction.expectation_basis_refs must be an array');
  } else {
    const basis = Array.isArray(node3?.expectation_basis) ? node3.expectation_basis : [];
    conviction.expectation_basis_refs.forEach((ref, index) => {
      if (!Number.isInteger(ref) || ref < 0 || ref >= basis.length) {
        errors.push('thesis_conviction.expectation_basis_refs[' + index + '] must reference an existing Node3 expectation_basis entry');
      }
    });
    if (basis.length > 0 && conviction.expectation_basis_refs.length === 0) {
      errors.push('thesis_conviction must reference at least one Node3 expectation_basis entry when expectation evidence exists');
    }
  }
  for (const field of ['supporting_evidence_refs','contradictory_evidence_refs']) {
    if (!Array.isArray(conviction[field])) {
      errors.push('thesis_conviction.' + field + ' must be an array');
    } else {
      conviction[field].forEach((ref, index) => requireString(ref, 'thesis_conviction.' + field + '[' + index + ']', errors));
    }
  }
  if (Array.isArray(conviction.supporting_evidence_refs) && conviction.supporting_evidence_refs.length === 0) {
    errors.push('thesis_conviction.supporting_evidence_refs must be non-empty');
  }
  if (!NODE5_CATALYST_VISIBILITY.includes(conviction.catalyst_visibility)) {
    errors.push('thesis_conviction.catalyst_visibility must be LOW, MEDIUM, HIGH, or UNKNOWN');
  }
  if (!NODE5_PAYOFF_ASYMMETRY.includes(conviction.payoff_asymmetry)) {
    errors.push('thesis_conviction.payoff_asymmetry must be NEGATIVE, BALANCED, POSITIVE, or UNCERTAIN');
  }
  return errors;
}

function validateNode5DecisionOverlay(overlay, node, upstream = {}) {
  const errors = [];
  if (!isPlainObject(overlay)) {
    errors.push('decision_overlay must be an object');
    return errors;
  }
  if (!isPlainObject(overlay.market_regime)) {
    errors.push('decision_overlay.market_regime must be an object');
  } else {
    if (!NODE5_REGIME_STATES.includes(overlay.market_regime.regime_state)) {
      errors.push('decision_overlay.market_regime.regime_state must be RISK_ON, NEUTRAL, RISK_OFF, MIXED, or UNKNOWN');
    }
    if (!Array.isArray(overlay.market_regime.evidence_refs)) {
      errors.push('decision_overlay.market_regime.evidence_refs must be an array');
    } else {
      overlay.market_regime.evidence_refs.forEach((ref, index) => {
        requireString(ref, 'decision_overlay.market_regime.evidence_refs[' + index + ']', errors);
      });
    }
  }

  if (!NODE5_TIMING_EFFECTS.includes(overlay.timing_effect)) {
    errors.push('decision_overlay.timing_effect must be a canonical timing effect');
  }
  if (!NODE5_SIZING_EFFECTS.includes(overlay.sizing_effect)) {
    errors.push('decision_overlay.sizing_effect must be a canonical sizing effect');
  }
  if (!NODE5_DECISION_EFFECTS.includes(overlay.decision_effect)) {
    errors.push('decision_overlay.decision_effect must be NONE, WORDING_ONLY, or OVERRIDE');
  }
  if (!NODE5_DECISIONS.includes(overlay.pre_overlay_decision)) {
    errors.push('decision_overlay.pre_overlay_decision must be a canonical decision');
  }
  if (!NODE5_DECISIONS.includes(overlay.post_overlay_decision)) {
    errors.push('decision_overlay.post_overlay_decision must be a canonical decision');
  }
  if (overlay.post_overlay_decision !== node.decision) {
    errors.push('decision_overlay.post_overlay_decision must equal Node5 decision');
  }

  if (overlay.ai_score_effect !== 'NONE') {
    errors.push('decision_overlay.ai_score_effect must equal NONE');
  }
  if (Number.isFinite(node.ai_score?.value)) {
    if (!Number.isFinite(overlay.ai_score_reference)
      || !nearlyEqual(overlay.ai_score_reference, node.ai_score.value, 0.11)) {
      errors.push('decision_overlay.ai_score_reference must be numeric and equal Node5 ai_score.value');
    }
  } else if (node.ai_score?.value == null && overlay.ai_score_reference != null) {
    errors.push('decision_overlay.ai_score_reference must be null when Node5 ai_score.value is null');
  }

  const changedDecision = overlay.pre_overlay_decision !== overlay.post_overlay_decision;
  if (overlay.decision_effect === 'OVERRIDE' && !changedDecision) {
    errors.push('decision_overlay OVERRIDE requires pre/post decision to differ');
  }
  if ((overlay.decision_effect === 'NONE' || overlay.decision_effect === 'WORDING_ONLY') && changedDecision) {
    errors.push('decision_overlay decision enum may change only when decision_effect is OVERRIDE');
  }

  const hasAnyEffect = overlay.timing_effect !== 'NONE'
    || overlay.sizing_effect !== 'NONE'
    || overlay.decision_effect !== 'NONE';
  const evidenceRefs = overlay.market_regime?.evidence_refs;
  if (hasAnyEffect) {
    if (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0) {
      errors.push('decision_overlay effects require market_regime evidence_refs');
    }
    requireString(overlay.override_rationale, 'decision_overlay.override_rationale', errors);
  } else if (!(overlay.override_rationale == null || (typeof overlay.override_rationale === 'string' && overlay.override_rationale.trim()))) {
    errors.push('decision_overlay.override_rationale must be string or null');
  }

  if (overlay.market_regime?.regime_state !== 'UNKNOWN'
    && (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0)) {
    errors.push('known market regime requires evidence_refs');
  }

  if (Array.isArray(evidenceRefs)) {
    evidenceRefs.forEach((ref, index) => {
      if (typeof ref !== 'string') return;
      if (ref.startsWith('NODE2.market_context:')) {
        const capability = ref.slice('NODE2.market_context:'.length);
        const available = upstream?.node2?.market_context?.coverage?.available_capabilities;
        if (!NODE2_MARKET_CONTEXT_CAPABILITIES.includes(capability)) {
          errors.push('decision_overlay.market_regime.evidence_refs[' + index + '] names unknown Node2 capability');
        } else if (!Array.isArray(available) || !available.includes(capability)) {
          errors.push('decision_overlay cannot cite unavailable Node2 market capability: ' + capability);
        }
      }
      if (ref.startsWith('NODE4.what_changed:')) {
        const raw = ref.slice('NODE4.what_changed:'.length);
        const idx = Number(raw);
        if (!Number.isInteger(idx) || idx < 0 || !Array.isArray(upstream?.node4?.what_changed) || idx >= upstream.node4.what_changed.length) {
          errors.push('decision_overlay.market_regime.evidence_refs[' + index + '] must reference an existing Node4.what_changed entry');
        }
      }
    });
  }

  return errors;
}

function validateNode5RiskAttribution(entries, riskScore = null) {
  const errors = [];
  if (!Array.isArray(entries)) {
    errors.push('risk_attribution must be an array');
    return errors;
  }
  if (Number.isFinite(riskScore) && riskScore < 20 && entries.length === 0) {
    errors.push('risk_attribution must explain a non-maximal Risk score in adaptive CIO synthesis');
  }
  const seenDrivers = new Set();
  entries.forEach((entry, index) => {
    const prefix = 'risk_attribution[' + index + ']';
    if (!isPlainObject(entry)) {
      errors.push(prefix + ' must be an object');
      return;
    }
    requireString(entry.driver, prefix + '.driver', errors);
    if (typeof entry.driver === 'string' && entry.driver.trim()) {
      const key = entry.driver.trim().toLowerCase();
      if (seenDrivers.has(key)) errors.push(prefix + '.driver must not duplicate another risk driver');
      seenDrivers.add(key);
    }
    if (!NODE5_RISK_OWNERS.includes(entry.primary_owner)) {
      errors.push(prefix + '.primary_owner must be a canonical score owner');
    }
    if (!NODE5_RESIDUAL_RISK_EFFECTS.includes(entry.residual_risk_effect)) {
      errors.push(prefix + '.residual_risk_effect must be NONE, LOW, MEDIUM, or HIGH');
    }
    if (!NODE5_RISK_TREATMENTS.includes(entry.risk_score_treatment)) {
      errors.push(prefix + '.risk_score_treatment must be canonical');
    }
    requireString(entry.rationale, prefix + '.rationale', errors);
    if (!Array.isArray(entry.evidence_refs) || entry.evidence_refs.length === 0) {
      errors.push(prefix + '.evidence_refs must be a non-empty array');
    } else {
      entry.evidence_refs.forEach((ref, refIndex) => requireString(ref, prefix + '.evidence_refs[' + refIndex + ']', errors));
    }

    if (entry.primary_owner === 'RISK') {
      if (entry.risk_score_treatment !== 'PRIMARY_RISK_PENALTY') {
        errors.push(prefix + ' primary RISK owner requires PRIMARY_RISK_PENALTY');
      }
      if (entry.residual_risk_effect === 'NONE') {
        errors.push(prefix + ' primary RISK owner must have non-NONE risk effect');
      }
    } else if (entry.residual_risk_effect === 'NONE') {
      if (entry.risk_score_treatment !== 'NO_ADDITIONAL_PENALTY') {
        errors.push(prefix + ' non-RISK owner with no residual tail risk requires NO_ADDITIONAL_PENALTY');
      }
    } else if (entry.risk_score_treatment !== 'RESIDUAL_TAIL_PENALTY') {
      errors.push(prefix + ' non-RISK owner with residual tail risk requires RESIDUAL_TAIL_PENALTY');
    }
  });
  return errors;
}

function validateNode5Monitoring(node, node3) {
  const errors = [];
  if (!isPlainObject(node.investment_horizon)) {
    errors.push('investment_horizon must be an object');
  } else {
    if (!NODE5_HORIZONS.includes(node.investment_horizon.bucket)) {
      errors.push('investment_horizon.bucket must be 0-3M, 3-12M, or 12M+');
    }
    requireString(node.investment_horizon.rationale, 'investment_horizon.rationale', errors);
  }

  requireString(node.anti_thesis, 'anti_thesis', errors);

  if (!isPlainObject(node.variant_view)) {
    errors.push('variant_view must be an object');
  } else {
    for (const field of ['summary','why_different','payoff_if_right','what_proves_wrong']) {
      requireString(node.variant_view[field], 'variant_view.' + field, errors);
    }
    if (!Array.isArray(node.variant_view.expectation_basis_refs)) {
      errors.push('variant_view.expectation_basis_refs must be an array');
    } else {
      const basis = Array.isArray(node3?.expectation_basis) ? node3.expectation_basis : [];
      node.variant_view.expectation_basis_refs.forEach((ref, index) => {
        if (!Number.isInteger(ref) || ref < 0 || ref >= basis.length) {
          errors.push('variant_view.expectation_basis_refs[' + index + '] must reference an existing Node3 expectation_basis entry');
        }
      });
    }
  }

  if (!Array.isArray(node.monitoring_kpis) || node.monitoring_kpis.length < 3 || node.monitoring_kpis.length > 5) {
    errors.push('monitoring_kpis must contain 3 to 5 entries');
  } else {
    node.monitoring_kpis.forEach((entry, index) => {
      const prefix = 'monitoring_kpis[' + index + ']';
      if (!isPlainObject(entry)) {
        errors.push(prefix + ' must be an object');
        return;
      }
      requireString(entry.kpi, prefix + '.kpi', errors);
      if (!('current_state' in entry)) errors.push(prefix + ' missing field: current_state');
      if (!(entry.current_state == null || typeof entry.current_state === 'string' || Number.isFinite(entry.current_state))) {
        errors.push(prefix + '.current_state must be string, finite number, or null');
      }
      requireString(entry.watch_condition, prefix + '.watch_condition', errors);
      requireString(entry.thesis_link, prefix + '.thesis_link', errors);
      if (!Array.isArray(entry.source_refs) || entry.source_refs.length === 0) {
        errors.push(prefix + '.source_refs must be a non-empty array');
      } else {
        entry.source_refs.forEach((ref, refIndex) => requireString(ref, prefix + '.source_refs[' + refIndex + ']', errors));
      }
    });
  }

  if (!Array.isArray(node.what_would_change_my_mind)
    || node.what_would_change_my_mind.length < 1
    || node.what_would_change_my_mind.length > 5) {
    errors.push('what_would_change_my_mind must contain 1 to 5 entries');
  } else {
    node.what_would_change_my_mind.forEach((entry, index) => requireString(entry, 'what_would_change_my_mind[' + index + ']', errors));
  }

  return errors;
}


function validateNode5Confidence(confidence) {
  const errors = [];
  if (!isPlainObject(confidence) || !('value' in confidence)) {
    errors.push('confidence must be an object with value');
    return errors;
  }

  if (confidence.value != null && (!Number.isFinite(confidence.value) || confidence.value < 0 || confidence.value > 100)) {
    errors.push('confidence.value must be null or numeric from 0 to 100');
  }

  const method = confidence.method ?? 'LEGACY_V1';
  if (!NODE5_CONFIDENCE_METHODS.includes(method)) {
    errors.push('confidence.method must be LEGACY_V1 or EVIDENCE_QUALITY_V1');
    return errors;
  }

  const components = confidence.components;
  if (!isPlainObject(components)) {
    errors.push('confidence.components must be an object');
    return errors;
  }

  const requiredKeys = method === 'EVIDENCE_QUALITY_V1'
    ? ['data_completeness','source_quality','freshness','cross_source_consistency','method_suitability','key_uncertainty_coverage']
    : ['data_completeness','source_quality','cross_source_agreement','fundamental_consistency','technical_confirmation','macro_clarity'];

  for (const key of requiredKeys) {
    if (!(key in components)) errors.push('confidence.components missing field: ' + key);
    const value = components[key];
    if (value != null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      errors.push('confidence.components.' + key + ' must be null or numeric from 0 to 100');
    }
  }

  return errors;
}

function nearlyEqual(a, b, tolerance = 0.000001) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
}

function validateNode6AReport(html) {
  const errors = [];
  const requiredMarkers = [
    '<div id="report"',
    'hero-card',
    'metric-card',
    'sub-card',
    'tailwind.config',
    'BÁO CÁO PHÂN TÍCH CHUYÊN SÂU'
  ];
  for (const marker of requiredMarkers) {
    if (!html.includes(marker)) errors.push('locked template marker missing: ' + marker);
  }
  if (/\[[A-Z][A-Z0-9_]*\]/.test(html)) {
    errors.push('unresolved locked-template placeholder remains');
  }
  if (/^\s*<article[\s>]/i.test(html)) {
    errors.push('free-form article layout is invalid; locked Node6A template is required');
  }
  return errors;
}

const NODE6B_TEMPLATE_PLACEHOLDERS = new Set(["ACCRUAL_RATIO","AI_SCORE","ALLOC_NOTE","ANALYSIS_MODE","BASE_CONDITION","BASE_PROB","BASE_TARGET","BEAR_CONDITION","BEAR_PRICE","BEAR_PROB","BULL_CONDITION","BULL_PROB","BULL_TARGET","CATALYST_BUCKET","CATALYST_NEAREST","CAUSAL_ASSUMPTIONS","CAUSAL_CHAIN_SUMMARY","CAUSAL_FACTS","CAUSAL_INFERENCES","CFO_NPAT","COMPANY_NAME","CONFIDENCE","DATA_PERIOD","DATE","DCF_FAIR_VALUE","DECISION","DRIVER_1","DRIVER_2","DRIVER_3","EARNINGS_QUALITY_RED_FLAGS","ECONOMIC_SPREAD","ENTRY_ZONE","FCF_NPAT","FED_RATE","F_SCORE","INFERENCE_CONFIDENCE","LIQUIDITY_NOTE","MACRO_CONCLUSION","MAX_PORTFOLIO_WEIGHT","MOAT","M_SCORE","M_SCORE_NOTE","OHLCV_DATE_RANGE","OHLCV_SESSIONS","OHLCV_SOURCE","OIL_PRICE","PB_DESC","PB_VALUE","PE_PEER_AVG","PE_VALUE","PLACEHOLDER","POSITION_TYPE","PROFIT_VALUE","PROFIT_YOY","REVENUE_PERIOD","REVENUE_VALUE","REVENUE_YOY","REVERSE_DCF_CAGR","REVERSE_DCF_COMMENTARY","RISK_COMPANY","RISK_MACRO","RISK_PER_TRADE_PCT_NAV","RISK_REGIME","ROIC_VALUE","SCREENING_MOMENTUM_EVIDENCE","SCREENING_MOMENTUM_STATUS","SCREEN_GRADE","SCREEN_GROWTH","SCREEN_MISPRICING","SCREEN_MOMENTUM","SCREEN_QUALITY","SCREEN_RANK","SCREEN_SCORE","SCREEN_VALUATION","SECTOR_BENCHMARK_METHOD","SECTOR_PERF","SECTOR_STRENGTH","SIGNAL_ALIGNMENT","SIGNAL_FUNDAMENTAL","SIGNAL_LIQUIDITY","SIGNAL_MACRO","SIGNAL_TECHNICAL","SMART_MONEY_INSIGHT","SMART_MONEY_PHASE","SMART_MONEY_ZONE","SMA_STATUS","STEP1_DESC","STEP2_DESC","STEP3_DESC","SUSTAINABILITY_CLASSIFICATION","SUSTAINABILITY_REASONING","THESIS_INVALIDATION","TICKER","TP1_DESC","TP1_PRICE","TP2_DESC","TP2_PRICE","TRADING_STOP_BASIS","TRADING_STOP_PRICE","TREND_LABEL","USD_VND","US_INFLATION","VNINDEX_PERF","VOLUME_CLASSIFICATION","VOLUME_RATIO","WACC_FORMULA_NOTE","WACC_VALUE","X"]);

function validateNode6BSemanticCore(markdown) {
  const errors = [];
  const tokens = markdown.match(/\[([A-Z][A-Z0-9_]*)\](?!\()/g) || [];
  const hasTemplatePlaceholder = tokens.some(token =>
    NODE6B_TEMPLATE_PLACEHOLDERS.has(token.slice(1, -1))
  );
  if (hasTemplatePlaceholder) {
    errors.push('unresolved detail-report placeholder remains');
  }
  return errors;
}

function validateNode6BPresentation(markdown) {
  const warnings = [];
  const recommendedSections = [
    '## 1. Quyết định đầu tư',
    'Tín hiệu tổng hợp',
    'Vĩ mô',
    'Doanh nghiệp',
    'Định giá',
    'Kỹ thuật',
    'Rủi ro',
    'Phân tích nhân quả',
    'Kịch bản',
    'Chiến lược giao dịch',
    'Nguồn dữ liệu'
  ];
  for (const section of recommendedSections) {
    if (!markdown.includes(section)) warnings.push('recommended full-report section missing: ' + section);
  }
  const tableSeparators = (markdown.match(/\|\s*---/g) || []).length;
  if (tableSeparators < 3) {
    warnings.push('full report has fewer than 3 Markdown tables; adaptive reports may omit immaterial modules');
  }
  return warnings;
}

function validateRequiredKeys(value, keys) {
  const errors = [];
  for (const key of keys) {
    if (!(key in value)) errors.push('missing field: ' + key);
  }
  return errors;
}

export function assertValidAnalysisRequest(request) {
  const result = validateAnalysisRequest(request);
  if (!result.valid) throw new Error(result.errors.join('; '));
  return request;
}

export function assertValidAnalysisResult(result) {
  const check = validateAnalysisResult(result);
  if (!check.valid) throw new Error(check.errors.join('; '));
  return result;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value, label, errors) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${label} must be a non-empty string`);
}

function requireTicker(value, label, errors) {
  requireString(value, label, errors);
  if (typeof value === 'string' && value.trim() && !/^[A-Z0-9._-]+$/i.test(value.trim())) {
    errors.push(`${label} contains unsupported characters`);
  }
}

function normalizeTicker(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function fail(message) {
  return { valid: false, errors: [message] };
}
