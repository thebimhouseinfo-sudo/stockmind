import { crsmState } from '../state.js';

export const NODE_LABELS = {
  userEvidence: 'Tài liệu bổ sung',
  node1: 'Dữ liệu & Tài chính',
  node2: 'Kỹ thuật & Smart Money',
  node3: 'Cơ bản & Định giá',
  node4: 'Vĩ mô & Nhân quả',
  node5: 'Tổng hợp & Quyết định',
  node6a: 'Báo cáo HTML',
  node6b: 'Báo cáo Word',
  node7: 'Nhật ký quyết định'
};

const STAGES = [
  { ids: ['userEvidence'], title: 'Chuẩn bị dữ liệu' },
  { ids: ['node1'], title: 'Xác minh dữ liệu' },
  { ids: ['node2', 'node3'], title: 'Phân tích chuyên sâu', parallel: true },
  { ids: ['node4'], title: 'Vĩ mô & Nhân quả' },
  { ids: ['node5'], title: 'Tổng hợp & Quyết định' },
  { ids: ['node6a', 'node6b', 'node7'], title: 'Đầu ra', parallel: true }
];

const NODE_ORDER = STAGES.flatMap(stage => stage.ids);

export function renderProgress() {
  const statuses = crsmState.nodeStatus || {};
  const doneCount = NODE_ORDER.filter(id => statuses[id] === 'done').length;
  const pct = Math.round((doneCount / NODE_ORDER.length) * 100);
  const activeParallel = STAGES.some(stage => stage.ids.filter(id => statuses[id] === 'running').length > 1);
  const stages = STAGES.map((stage, stageIndex) => renderStage(stage, stageIndex, statuses)).join('');

  return `
    <div class="panel panel-pad crsm-progress">
      <div class="title-row">
        <div>
          <p class="eyebrow">Quy trình CRSM</p>
          <h2>${crsmState.isRunning ? 'Đang phân tích' : 'Trạng thái phân tích'}</h2>
        </div>
        <div class="crsm-progress-meta">
          ${activeParallel ? '<span class="crsm-parallel-badge">Đang chạy song song</span>' : ''}
          <strong>${pct}%</strong>
        </div>
      </div>
      <div class="crsm-bar"><div class="crsm-bar-fill" style="width:${pct}%"></div></div>
      <div class="crsm-flow" aria-label="Tiến trình phân tích CRSM">
        ${stages}
      </div>
      <div class="crsm-log">
        ${crsmState.logRows.slice(-6).map(r => `<div class="crsm-log-row muted">${escapeHtml(r)}</div>`).join('') || '<div class="crsm-log-row muted">Chưa có tiến trình.</div>'}
      </div>
    </div>`;
}

function renderStage(stage, stageIndex, statuses) {
  const cards = stage.ids.map(nodeId => renderTaskCard(nodeId, statuses[nodeId] || 'pending', stage.parallel)).join('');
  const runningCount = stage.ids.filter(id => statuses[id] === 'running').length;
  const stageDone = stage.ids.every(id => statuses[id] === 'done');
  const stageFailed = stage.ids.some(id => statuses[id] === 'failed');
  const stageRunning = runningCount > 0;
  const stageClass = stageFailed ? 'has-failed' : stageDone ? 'is-done' : stageRunning ? 'is-running' : 'is-pending';

  return `
    <div class="crsm-stage ${stageClass} ${stage.parallel ? 'is-parallel-stage' : ''}">
      <div class="crsm-stage-head">
        <span class="crsm-stage-step">${stageIndex + 1}</span>
        <span class="crsm-stage-title">${escapeHtml(stage.title)}</span>
        ${stage.parallel ? '<span class="crsm-stage-parallel">Có thể song song</span>' : ''}
      </div>
      <div class="crsm-stage-body">${cards}</div>
      ${stageIndex < STAGES.length - 1 ? '<div class="crsm-stage-connector" aria-hidden="true"></div>' : ''}
    </div>`;
}

function renderTaskCard(nodeId, status, isParallelStage) {
  const label = NODE_LABELS[nodeId] || nodeId;
  const active = status === 'running';
  const done = status === 'done';
  const failed = status === 'failed';
  const skipped = status === 'skipped';
  const cls = failed ? 'failed' : done ? 'done' : active ? 'running' : skipped ? 'skipped' : 'pending';
  const icon = failed ? '×' : done ? '✓' : skipped ? '—' : active ? '•' : '○';
  const action = active ? 'Đang xử lý' : done ? 'Hoàn thành' : failed ? 'Lỗi' : skipped ? 'Bỏ qua' : 'Đang chờ';

  return `
    <div class="crsm-task ${cls}" data-node="${escapeHtml(nodeId)}" data-parallel-capable="${isParallelStage ? '1' : '0'}">
      <div class="crsm-task-icon">${icon}</div>
      <div class="crsm-task-copy">
        <strong>${escapeHtml(label)}</strong>
        <span>${action}</span>
      </div>
    </div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
