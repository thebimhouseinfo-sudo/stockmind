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

export function validateDecisionRecord(record, ticker = null) {
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
      warnings.push(...validateRequiredKeys(
        result.outputs.node3,
        ['data_period','screening_flags','screening_metrics_used','capital_efficiency','earnings_quality','earnings_sustainability','f_score','m_score','m_score_note','health_status','valuation','moat','conclusion']
      ).map(error => 'outputs.node3: ' + error));
    }
    if (isPlainObject(result.outputs.node4)) {
      warnings.push(...validateRequiredKeys(
        result.outputs.node4,
        ['risk_regime','macro_indicators','company_specific_drivers','sensitivity_table','geopolitical_events','causal_chains','risk_scenarios','macro_view','industry_impact','company_impact','conclusion']
      ).map(error => 'outputs.node4: ' + error));
    }
    if (isPlainObject(result.outputs.node5)) {
      errors.push(...validateNode5Output(result.outputs.node5).map(error => 'outputs.node5: ' + error));
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

  const decision = validateDecisionRecord(result.decision_record, result.ticker);
  errors.push(...decision.errors);

  return { valid: errors.length === 0, errors, warnings };
}

export const NODE5_DECISIONS = Object.freeze(['BUY', 'HOLD', 'SELL', 'BUY ON DIP', 'WATCH']);
export const NODE2_COVERAGE_STATES = Object.freeze(['FULL', 'DEGRADED']);
export const NODE2_COVERAGE_MODELS = Object.freeze(['LEGACY_300_V1', 'CAPABILITY_BASED_V1']);
export const NODE5_CONFIDENCE_METHODS = Object.freeze(['LEGACY_V1', 'EVIDENCE_QUALITY_V1']);

function validateNode1Output(node) {
  return validateRequiredKeys(node, [
    'ticker','sector_type','timestamp','data_period','analysis_mode','screening_metrics',
    'screening_summary','trusted_screener_snapshot','screening_as_of','data_integrity',
    'market_data','valuation_multiples','financial_core_raw','cost_of_capital_raw_inputs',
    'ownership_insider','upcoming_events','anomaly_investigation','data_completion','sources'
  ]);
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
        if (Number.isFinite(coverage.sessions_used) && coverage.sessions_used !== ohlcv.sessions_used) {
          errors.push('capability-based technical_coverage.sessions_used must match ohlcv_source.sessions_used');
        }
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

  return errors;
}

function validateNode5Output(node) {
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
