import { runScreenerV2Sandbox } from './screener-v2/diagnostic-runner.js';

export function scoreStocks(rawRows) {
  return runScreenerV2Sandbox(rawRows);
}

export function buildStats(rows) {
  const industryCount = {};
  rows.forEach(row => {
    const industry = row.INDUSTRY || row.industry || 'Unknown';
    industryCount[industry] = (industryCount[industry] || 0) + 1;
  });

  const profileReady = rows.filter(row => row.SCREENER_V2?.price_dislocation?.profile === 'PROFILE_ONLY');
  const blocked = rows.filter(row => row.SCREENER_V2?.price_dislocation?.profile !== 'PROFILE_ONLY');
  const classificationCount = {};
  rows.forEach(row => {
    const group = row.SCREENING_GROUP || 'WATCH_NEUTRAL';
    classificationCount[group] = (classificationCount[group] || 0) + 1;
  });

  return {
    total: rows.length,
    avgScore: average(rows.map(row => row.FINALSCORE)),
    top10: [...rows].filter(row => Number.isFinite(row.FINALSCORE)).sort((a, b) => a.RANK - b.RANK).slice(0, 10),
    cleanTop10: profileReady.filter(row => !row.DATA_FLAGS?.length && Number.isFinite(row.FINALSCORE)).sort((a, b) => a.RANK - b.RANK).slice(0, 10),
    flaggedTop20: rows.filter(row => row.DATA_FLAGS?.length).slice(0, 20),
    industryCount,
    classificationCount,
    screenerV2: {
      registry_version: rows[0]?.SCREENER_V2?.registry?.registry_version ?? null,
      calibration_status: rows[0]?.SCREENER_V2?.registry?.calibration_status ?? null,
      profile_ready: profileReady.length,
      blocked: blocked.length,
      production_ranking: false,
      reason: 'D1_D2_D3_PRICE_DISLOCATION_VERTICAL_SLICE'
    }
  };
}

export function buildPrompt(stock) {
  const v2 = stock?.SCREENER_V2;
  const priceDislocation = v2?.price_dislocation;
  const momentumVolume = v2?.momentum_volume;
  const derived = priceDislocation?.derived || {};
  const momentumDerived = momentumVolume?.derived || {};
  const flags = Array.isArray(stock?.DATA_FLAGS) && stock.DATA_FLAGS.length
    ? stock.DATA_FLAGS.join('; ')
    : 'No flags';

  return `Bạn là chuyên viên phân tích cổ phiếu Việt Nam cho một quỹ đầu tư kỷ luật.

Hãy phân tích mã ${stock?.TICKER || '-'} trong ngành ${stock?.INDUSTRY || 'Unknown'}.

Screener V2 hiện chỉ cung cấp sandbox vertical slice D1/D2/D3 cho Price Dislocation. Không coi đây là điểm đầu tư, không suy ra catalyst, value trap hay high reward thesis từ drawdown đơn lẻ.

Dữ liệu Screener V2:
- Registry: ${v2?.registry?.registry_version || 'N/A'} (${v2?.registry?.calibration_status || 'N/A'})
- Classification: ${v2?.classification?.classification || 'WATCH_NEUTRAL'}
- Price: ${line(stock?.PRICE)}
- High 52W: ${line(stock?.HIGH_52W)}
- Low 52W: ${line(stock?.LOW_52W)}
- Drawdown 52W: ${line(derived.drawdown_52w?.value)}
- Upside to 52W High: ${line(derived.upside_to_52w_high?.value)}
- Position 52W Range: ${line(derived.position_52w_range?.value)}
- Price Dislocation Profile: ${priceDislocation?.profile || 'UNKNOWN'}
- Computability: ${priceDislocation?.computability_state || 'UNKNOWN'}
- Signals: ${(priceDislocation?.signals || []).join(', ') || 'None'}
- Quality Flags: ${(priceDislocation?.quality_flags || []).join(', ') || 'None'}
- Momentum/Volume Profile: ${momentumVolume?.profile || 'UNKNOWN'}
- Medium Momentum: ${line(momentumDerived.medium_momentum?.value)}
- Momentum Stack: ${line(momentumDerived.momentum_stack?.value)}
- Volume Confirmation: ${line(momentumDerived.volume_confirmation?.value)}
- Momentum/Volume Signals: ${(momentumVolume?.signals || []).join(', ') || 'None'}
- Momentum/Volume Quality Flags: ${(momentumVolume?.quality_flags || []).join(', ') || 'None'}
- Data Flags: ${flags}

Node 1 cần xác minh các dữ liệu và điều tra nguyên nhân nếu có tín hiệu bất thường. Không thay thế dữ liệu thiếu bằng benchmark ngành hoặc giả định.`;
}

function line(value) {
  return value == null || value === '' ? 'chưa đủ dữ liệu' : value;
}

function average(values) {
  const valid = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 100) / 100;
}
