export const REPORT_VI_TEXT = [
  ['Senior Equity Analyst & Geopolitical Strategist', 'Chuyên gia phân tích cổ phiếu & Chiến lược địa chính trị'],
  ['Senior Equity Analyst', 'Chuyên gia phân tích cổ phiếu'],
  ['AI Score', 'Điểm AI'],
  ['Invalidation', 'Điều kiện vô hiệu'],
  ['Screening Snapshot', 'Tóm tắt sàng lọc'],
  ['Score', 'Điểm'],
  ['Rank', 'Xếp hạng'],
  ['Grade', 'Phân loại'],
  ['Quality', 'Chất lượng'],
  ['Growth', 'Tăng trưởng'],
  ['Valuation', 'Định giá'],
  ['Momentum', 'Động lượng'],
  ['Mispricing', 'Định giá sai'],
  ['SCREEN → CRSM', 'SÀNG LỌC → CRSM'],
  ['Key Insight', 'Nhận định chính'],
  ['Volume Ratio', 'Tỷ lệ thanh khoản'],
  ['vs avg 20 phiên', 'so với bình quân 20 phiên'],
  ['Target Price', 'Giá mục tiêu'],
  ['Stop Loss', 'Giá cắt lỗ'],
  ['Trade Setup', 'Thiết lập giao dịch'],
  ['BULL CASE', 'Kịch bản Tăng'],
  ['BASE CASE', 'Kịch bản Cơ sở'],
  ['BEAR CASE', 'Kịch bản Giảm'],
  ['Position Sizing', 'Quản trị vị thế'],
  ['Data not available', 'Chưa có dữ liệu'],
  ['Data Not Available', 'Chưa có dữ liệu'],
  ['Not available', 'Chưa có dữ liệu'],
  ['Target', 'Mục tiêu'],
  ['Trend', 'Xu hướng'],
  ['Technical Structure', 'Cấu trúc kỹ thuật'],
  ['Technical', 'Kỹ thuật'],
  ['Fundamental', 'Cơ bản'],
  ['Macro', 'Vĩ mô'],
  ['Liquidity', 'Thanh khoản'],
  ['Flow', 'Dòng tiền'],
  ['Risk', 'Rủi ro'],
  ['Sector/Macro', 'Ngành/Vĩ mô'],
  ['Thesis Invalidation', 'Điều kiện vô hiệu luận điểm'],
  ['Báo cáo được tạo tự động bởi AI Equity Research Engine', 'Báo cáo được tạo tự động bởi CRSM Engine'],
  ['AI Equity Research Engine', 'CRSM Engine'],
  ['for reference only, not an official investment recommendation.', 'chỉ dành cho mục đích tham khảo, không phải khuyến nghị đầu tư chính thức.'],
  ['FOR REFERENCE ONLY', 'CHỈ DÀNH CHO THAM KHẢO'],
  ['BUY', 'MUA'],
  ['SELL', 'BÁN'],
  ['HOLD', 'NẮM GIỮ'],
  ['STRONG BUY', 'MUA MẠNH'],
  ['STRONG SELL', 'BÁN MẠNH'],
  ['CONFIRMED', 'XÁC NHẬN'],
  ['PARTIAL', 'MỘT PHẦN'],
  ['DIVERGENT', 'KHÁC BIỆT']
];

export function localizeReportText(value) {
  let text = String(value ?? '');
  for (const [from, to] of REPORT_VI_TEXT) text = text.split(from).join(to);
  return text;
}

export function prepareNode6AOutputs(outputs) {
  const cloned = cloneValue(outputs || {});
  const n5 = cloned.node5 || {};
  const n3 = cloned.node3 || {};
  const n4 = cloned.node4 || {};

  if (Array.isArray(n5.drivers)) {
    n5.drivers = n5.drivers.map(humanizeObject);
  }

  n5.strategy = normalizeStrategy(n5.strategy || {});
  n5.conflict_detector = normalizeConflictDetector(n5.conflict_detector || {});

  if (Array.isArray(n3.earnings_quality?.red_flags)) {
    n3.earnings_quality.red_flags = n3.earnings_quality.red_flags.map(humanizeObject);
  }

  n4.risk_scenarios = normalizeScenarios(n4.risk_scenarios);
  if (Array.isArray(n4.sensitivity_table)) {
    n4.sensitivity_table = n4.sensitivity_table.map(normalizeSensitivityRow);
  }
  n4.risk_regime = normalizeScaleLabel(n4.risk_regime);

  cloned.node5 = n5;
  cloned.node3 = n3;
  cloned.node4 = n4;
  return cloned;
}

function normalizeSensitivityRow(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    sensitivity: normalizeScaleLabel(row.sensitivity),
    direction: normalizeDirectionLabel(row.direction ?? row.impact ?? row.direction_of_impact),
    confidence: normalizeScaleLabel(row.confidence)
  };
}

function normalizeScaleLabel(value) {
  const map = {
    high: 'Cao',
    'medium-high': 'Trung bình cao',
    medium: 'Trung bình',
    low: 'Thấp',
    elevated: 'Cao',
    neutral: 'Trung tính'
  };
  const key = String(value ?? '').trim().toLowerCase();
  return map[key] || value;
}

function normalizeDirectionLabel(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return value;
  if (key === 'direct') return 'Cùng chiều';
  if (key === 'inverse') return 'Ngược chiều';
  if (key.includes('positive') || key.includes('tích cực')) return 'Tích cực';
  if (key.includes('negative') || key.includes('tiêu cực')) return 'Tiêu cực';
  return value;
}

function normalizeConflictDetector(value) {
  if (!value || typeof value !== 'object') return value;
  const copy = { ...value };
  copy.alignment = copy.alignment ?? copy.signal_alignment ?? copy.signalAlignment;
  return copy;
}

function normalizeStrategy(strategy) {
  if (!strategy || typeof strategy !== 'object') return strategy;
  const copy = { ...strategy };

  copy.tp1 = normalizeTarget(copy.tp1, copy.tp1_desc ?? copy.tp1_rationale ?? copy.target1_desc);
  copy.tp2 = normalizeTarget(copy.tp2, copy.tp2_desc ?? copy.tp2_rationale ?? copy.target2_desc);

  const allocation = copy.allocation_plan ?? copy.allocation_steps ?? copy.allocationSteps ?? copy.disbursement_plan;
  copy.allocation_plan = normalizeAllocationPlan(allocation, copy.entry_zone);

  return copy;
}

function normalizeTarget(value, fallbackRationale) {
  if (value && typeof value === 'object') {
    return {
      ...value,
      price: value.price ?? value.value ?? value.target ?? value.target_price,
      rationale: value.rationale ?? value.basis ?? value.description ?? fallbackRationale
    };
  }
  return {
    price: value,
    rationale: fallbackRationale
  };
}

function normalizeAllocationPlan(value, entryZone) {
  const fallback = { note: textOrMissing(value), steps: [] };
  if (Array.isArray(value)) {
    return {
      note: '',
      steps: value.map(stepText).filter(Boolean).slice(0, 3)
    };
  }
  if (value && typeof value === 'object') {
    const directSteps = [value.step1, value.step2, value.step3, ...(Array.isArray(value.steps) ? value.steps : [])]
      .filter(v => v != null && v !== '')
      .map(stepText);
    return {
      note: textOrMissing(value.note ?? value.summary ?? value.description),
      steps: directSteps.length ? directSteps.slice(0, 3) : splitAllocationText(value.note ?? value.summary ?? value.description ?? '')
    };
  }
  if (typeof value === 'string') {
    const steps = splitAllocationText(value);
    return {
      note: steps.length ? '' : value,
      steps: steps.length ? steps : inferAllocationFromEntry(value, entryZone)
    };
  }
  return fallback;
}

function splitAllocationText(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const explicit = source
    .split(/(?:^|\s)(?:bước|step)\s*\d+\s*[:.-]\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
  if (explicit.length >= 2) return explicit.slice(0, 3);

  const percentChunks = source.match(/(?:mua|giải ngân|add|buy)[^.;]*(?:\d+(?:[,.]\d+)?\s*%)[^.;]*/gi);
  if (percentChunks?.length >= 2) return percentChunks.map(s => s.trim()).slice(0, 3);

  const semicolon = source.split(/\s*[;•]\s*/).map(s => s.trim()).filter(Boolean);
  if (semicolon.length >= 2) return semicolon.slice(0, 3);
  return [];
}

function inferAllocationFromEntry(text, entryZone) {
  const source = String(text || '');
  if (!/%/.test(source)) return [];
  const zone = entryZone ? ` quanh vùng ${entryZone}` : '';
  return [
    `Mua thăm dò theo kế hoạch đã nêu${zone}`,
    'Gia tăng khi giá xác nhận vùng hỗ trợ hoặc điều kiện kỹ thuật tích cực hơn',
    'Hoàn tất vị thế khi luận điểm được xác nhận và thanh khoản ủng hộ'
  ];
}

function stepText(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    const action = value.action ?? value.label ?? value.title ?? value.step;
    const condition = value.condition ?? value.trigger ?? value.description ?? value.note;
    const allocation = value.allocation ?? value.weight ?? value.percent;
    return [action, allocation, condition].filter(Boolean).map(formatScalar).join(' - ');
  }
  return String(value);
}

function normalizeScenarios(value) {
  if (!value) return {};
  if (!Array.isArray(value) && typeof value === 'object') {
    return {
      bull: normalizeScenario(value.bull ?? value.BULL ?? value.upside ?? value.best),
      base: normalizeScenario(value.base ?? value.BASE ?? value.neutral ?? value.base_case),
      bear: normalizeScenario(value.bear ?? value.BEAR ?? value.downside ?? value.worst)
    };
  }
  if (Array.isArray(value)) {
    const find = (...keys) => value.find(item => keys.some(key => scenarioName(item).includes(key)));
    return {
      bull: normalizeScenario(find('bull', 'tăng', 'upside')),
      base: normalizeScenario(find('base', 'cơ sở', 'neutral')),
      bear: normalizeScenario(find('bear', 'giảm', 'downside'))
    };
  }
  return {};
}

function normalizeScenario(value) {
  if (!value || typeof value !== 'object') return {};
  return {
    ...value,
    probability: value.probability ?? value.prob ?? value.weight,
    condition: value.condition ?? value.conditions ?? value.description ?? value.thesis,
    target: value.target ?? value.target_price ?? value.price_target ?? value.bear_price ?? value.stop_loss
  };
}

function scenarioName(value) {
  return String(value?.scenario ?? value?.label ?? value?.name ?? value?.case ?? '').toLowerCase();
}

function textOrMissing(value) {
  return value == null ? '' : formatScalar(value);
}

function formatScalar(value) {
  if (value == null) return '';
  if (typeof value === 'object') return humanizeObject(value);
  return String(value);
}

function humanizeObject(value) {
  if (value == null || typeof value !== 'object') return value;
  const name = value.name ?? value.title ?? value.label;
  const detail = value.value ?? value.description ?? value.flag ?? value.observation;
  if (name != null && detail != null) return `${name}: ${detail}`;
  if (detail != null) return String(detail);
  if (name != null) return String(name);
  return Object.entries(value)
    .filter(([, item]) => item != null && typeof item !== 'object')
    .map(([key, item]) => `${key}: ${item}`)
    .join(' · ');
}

function cloneValue(value) {
  if (value == null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}
