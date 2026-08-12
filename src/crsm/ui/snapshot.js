import { crsmState } from '../state.js';
import { formatDateVN } from '../context.js';

export function renderSnapshot() {
  const ctx = crsmState.screeningContext;
  const node5 = crsmState.nodeOutputs.node5 || null;
  const node1 = crsmState.nodeOutputs.node1 || null;

  if (!ctx) return '';

  const summary = node1?.screening_summary || {
    screen_score: ctx.screen_score,
    screen_rank: ctx.screen_rank,
    screen_grade: ctx.screen_grade,
    quality_score: ctx.quality_score,
    growth_score: ctx.growth_score,
    valuation_score: ctx.valuation_score,
    micro_score: ctx.micro_score,
    momentum_score: ctx.momentum_score,
    mispricing_score: ctx.mispricing_score
  };

  const badges = [
    ['Score', summary.screen_score],
    ['Rank', summary.screen_rank],
    ['Grade', summary.screen_grade],
    ['Quality', summary.quality_score],
    ['Growth', summary.growth_score],
    ['Valuation', summary.valuation_score],
    ['Micro', summary.micro_score],
    ['Momentum', summary.momentum_score],
    ['Mispricing', summary.mispricing_score]
  ];

  const vs = node5?.screen_vs_crsm;
  const statusText = vs?.status || '—';

  return `
    <div class="panel panel-pad screening-snapshot">
      <div class="title-row">
        <div><p class="eyebrow">Screening Snapshot</p><h2>${ctx.ticker} — ${ctx.industry || ''}</h2></div>
        <span class="crsm-status status-${(statusText || 'none').toLowerCase()}">${statusText}</span>
      </div>
      <p class="muted">Nguồn: StockScreener · cập nhật ${formatDateVN(ctx.screening_as_of) || 'hôm nay'} · ${crsmState.mode === 'SCREENED' ? 'Bối cảnh sàng lọc ban đầu — KHÔNG phải điểm số CRSM' : 'Chạy thủ công DIRECT'}</p>
      <div class="snapshot-grid">
        ${badges.map(([label, value]) => `<div class="snapshot-cell"><span class="muted">${label}</span><strong>${value ?? '—'}</strong></div>`).join('')}
      </div>
      ${vs ? `<div class="vs-block">
        <div><span class="muted">Screen</span><strong>${fmtNum(vs.screen_score)}</strong></div>
        <div class="vs-arrow">→</div>
        <div><span class="muted">CRSM</span><strong>${fmtNum(vs.crsm_score)}</strong></div>
        <div class="vs-diff"><span class="muted">Diff</span><strong>${vs.score_difference == null ? '—' : (vs.score_difference > 0 ? '+' : '') + fmtNum(vs.score_difference)}</strong></div>
      </div>
      ${vs.interpretation ? `<p class="muted vs-interp">${vs.interpretation}</p>` : ''}` : ''}
    </div>`;
}

function fmtNum(value) {
  if (value == null) return '—';
  return typeof value === 'number' ? value.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : value;
}