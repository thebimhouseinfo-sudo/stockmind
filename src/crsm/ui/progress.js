import { crsmState } from '../state.js';

export const NODE_LABELS = {
  node1: 'Dữ liệu & Tài chính',
  node2: 'Kỹ thuật & Smart Money',
  node3: 'Cơ bản & Định giá',
  node4: 'Vĩ mô & Nhân quả',
  node5: 'Quyết định CIO',
  node6a: 'Báo cáo HTML',
  node6b: 'Báo cáo Word',
  node7: 'Ghi log theo dõi'
};

export const NODE_ORDER = ['node1', 'node2', 'node3', 'node4', 'node5', 'node6a', 'node6b', 'node7'];

export function renderProgress() {
  const statuses = crsmState.nodeStatus || {};
  const steps = NODE_ORDER.map(nodeId => {
    const status = statuses[nodeId] || 'pending';
    const label = NODE_LABELS[nodeId];
    const active = crsmState.currentNode === nodeId && status === 'running';
    const done = status === 'done';
    const failed = status === 'failed';
    const cls = failed ? 'failed' : done ? 'done' : active ? 'running' : 'pending';
    return `
      <div class="crsm-node ${cls}" data-node="${nodeId}">
        <span class="crsm-node-ico">${failed ? '✕' : done ? '✓' : '·'}</span>
        <span class="crsm-node-label">${label}</span>
      </div>`;
  }).join('');

  const pct = Math.round((NODE_ORDER.filter(id => (statuses[id] || 'pending') === 'done').length / NODE_ORDER.length) * 100);

  return `
    <div class="panel panel-pad crsm-progress">
      <div class="title-row"><div><p class="eyebrow">Pipeline</p><h2>${crsmState.isRunning ? 'Đang chạy' : 'Trạng thái'}</h2></div></div>
      <div class="crsm-bar"><div class="crsm-bar-fill" style="width:${pct}%"></div></div>
      <div class="crsm-nodes">${steps}</div>
      <div class="crsm-log">
        ${crsmState.logRows.slice(-6).map(r => `<div class="crsm-log-row muted">${r}</div>`).join('') || '<div class="crsm-log-row muted">Chưa có tiến trình.</div>'}
      </div>
    </div>`;
}