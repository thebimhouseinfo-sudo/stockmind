import { crsmState } from '../state.js';
import { NODE_LABELS } from './progress.js';

export function renderError() {
  const err = crsmState.error;
  if (!err) return '';
  const nodeLabel = NODE_LABELS[err.node] || err.node;
  return `
    <div class="panel panel-pad crsm-error">
      <p class="eyebrow">Lỗi</p>
      <h2>Node ${err.node} thất bại</h2>
      <p><strong>${nodeLabel}</strong></p>
      <p class="crsm-error-msg muted">${escapeHtml(err.message)}</p>
      <div class="actions">
        <button class="btn primary" id="crsmRetry">Thử lại từ node ${err.node}</button>
        <button class="btn" id="crsmRetryAll">Chạy lại từ đầu</button>
      </div>
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}