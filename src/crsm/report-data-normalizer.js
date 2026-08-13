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

  if (Array.isArray(n5.drivers)) {
    n5.drivers = n5.drivers.map(humanizeObject);
  }

  if (Array.isArray(n3.earnings_quality?.red_flags)) {
    n3.earnings_quality.red_flags = n3.earnings_quality.red_flags.map(humanizeObject);
  }

  cloned.node5 = n5;
  cloned.node3 = n3;
  return cloned;
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
