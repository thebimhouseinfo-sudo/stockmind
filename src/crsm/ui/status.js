import { crsmState } from '../state.js';

export function renderStatusBadge() {
  const node5 = crsmState.nodeOutputs.node5;
  const status = node5?.screen_vs_crsm?.status;
  if (!status) return '';
  const map = {
    CONFIRMED: { label: 'CONFIRMED', text: 'Screening được xác nhận bởi nghiên cứu sâu' },
    PARTIAL: { label: 'PARTIAL', text: 'Một phần tín hiệu khớp — có sub-factor lệch' },
    DIVERGENT: { label: 'DIVERGENT', text: 'CRSM khác biệt rõ với Screening — cần đọc kỹ nguyên nhân' }
  };
  const info = map[status] || {};
  return `
    <div class="crsm-status-card status-${(status || '').toLowerCase()}">
      <span class="crsm-status">${info.label}</span>
      <p>${info.text}</p>
    </div>`;
}