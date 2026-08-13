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

const FLOW_STYLE = `
.crsm-flow{display:flex;flex-direction:column;gap:0;margin:6px 0 18px}
.crsm-stage{position:relative;padding:10px 0 24px}
.crsm-stage:last-child{padding-bottom:4px}
.crsm-stage-head{display:flex;align-items:center;gap:9px;margin-bottom:9px;min-height:28px}
.crsm-stage-step{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#eef3fb;color:#66758a;font-size:11px;font-weight:900;flex:0 0 auto}
.crsm-stage-title{font-size:12px;font-weight:850;letter-spacing:.02em;color:#536176}
.crsm-stage-parallel{margin-left:auto;padding:4px 8px;border-radius:999px;background:#fff7ed;color:#b45309;font-size:10px;font-weight:850}
.crsm-stage-body{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.crsm-stage.is-parallel-stage .crsm-stage-body{grid-template-columns:repeat(${2},minmax(0,1fr))}
.crsm-task{display:flex;align-items:center;gap:11px;min-height:64px;padding:12px 14px;border:1px solid #dde4ef;border-radius:12px;background:#fff;box-shadow:0 5px 16px rgba(23,32,51,.05);transition:transform .2s ease,border-color .2s ease,box-shadow .2s ease,background .2s ease}
.crsm-task-icon{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#eef2f7;color:#7b8798;font-size:13px;font-weight:900;flex:0 0 auto}
.crsm-task-copy{display:flex;flex-direction:column;min-width:0;gap:3px}
.crsm-task-copy strong{font-size:12px;line-height:1.25;color:#253247}
.crsm-task-copy span{font-size:11px;color:#8490a3}
.crsm-task.pending{background:#fbfcfe}
.crsm-task.running{border-color:#93c5fd;background:#eff6ff;box-shadow:0 0 0 1px rgba(37,99,235,.08),0 8px 22px rgba(37,99,235,.12);transform:translateY(-1px)}
.crsm-task.running .crsm-task-icon{background:#2563eb;color:#fff;animation:crsmPulse .9s infinite}
.crsm-task.running .crsm-task-copy strong{color:#1d4ed8}
.crsm-task.done{border-color:#bbf7d0;background:#f0fdf4}
.crsm-task.done .crsm-task-icon{background:#059669;color:#fff}
.crsm-task.done .crsm-task-copy strong{color:#166534}
.crsm-task.failed{border-color:#fecaca;background:#fff7f7}
.crsm-task.failed .crsm-task-icon{background:#dc2626;color:#fff}
.crsm-task.failed .crsm-task-copy strong{color:#b91c1c}
.crsm-task.skipped{background:#f8fafc;opacity:.78}
.crsm-stage-connector{position:absolute;left:11px;bottom:0;width:2px;height:18px;background:#d7dfeb;border-radius:999px}
.crsm-stage-connector:after{content:"";position:absolute;left:-4px;bottom:-1px;width:10px;height:10px;border-right:2px solid #d7dfeb;border-bottom:2px solid #d7dfeb;transform:rotate(45deg)}
.crsm-stage.is-running .crsm-stage-step{background:#dbeafe;color:#2563eb}
.crsm-stage.is-done .crsm-stage-step{background:#dcfce7;color:#15803d}
.crsm-stage.has-failed .crsm-stage-step{background:#fee2e2;color:#b91c1c}
.crsm-progress-meta{display:flex;align-items:center;gap:9px;color:#42516a;font-size:13px}
.crsm-progress-meta>strong{font-size:16px;color:#172033}
.crsm-parallel-badge{padding:5px 9px;border-radius:999px;background:#fff7ed;color:#b45309;font-size:10px;font-weight:900}
.crsm-progress .crsm-bar{margin-bottom:8px}
@keyframes crsmPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.9)}}
@media(max-width:760px){.crsm-stage.is-parallel-stage .crsm-stage-body{grid-template-columns:1fr}.crsm-stage-parallel{font-size:9px}.crsm-task{min-height:58px;padding:10px 12px}.crsm-task-copy strong{font-size:11px}.crsm-progress-meta{gap:6px}.crsm-parallel-badge{display:none}}
`;

export function renderProgress() {
  const statuses = crsmState.nodeStatus || {};
  const doneCount = NODE_ORDER.filter(id => statuses[id] === 'done').length;
  const pct = Math.round((doneCount / NODE_ORDER.length) * 100);
  const activeParallel = STAGES.some(stage => stage.ids.filter(id => statuses[id] === 'running').length > 1);
  const stages = STAGES.map((stage, stageIndex) => renderStage(stage, stageIndex, statuses)).join('');

  return `
    <style data-crsm-progress-style="1">${FLOW_STYLE}</style>
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
