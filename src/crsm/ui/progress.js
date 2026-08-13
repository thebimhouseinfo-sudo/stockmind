import { crsmState } from '../state.js';
import { getExecutionDescriptor } from '../execution-policy.js';
import { loadSettings } from '../settings.js';

export const NODE_LABELS = {
  userEvidence: 'Chuẩn bị tài liệu',
  node1: 'Dữ liệu & Tài chính',
  node2: 'Kỹ thuật & Smart Money',
  node3: 'Cơ bản & Định giá',
  node4: 'Vĩ mô & Nhân quả',
  node5: 'Tổng hợp & Quyết định',
  node6a: 'Báo cáo HTML',
  node6b: 'Báo cáo Word',
  node7: 'Nhật ký quyết định'
};

const DESCRIPTOR_LABELS = {
  research: 'Phân tích chuyên sâu',
  reports: 'Đầu ra báo cáo'
};

const PARALLEL_ELIGIBLE = new Set(['research', 'reports']);

export function renderProgress() {
  const statuses = crsmState.nodeStatus || {};
  const settings = loadSettings();
  const descriptors = getExecutionDescriptor(settings);
  const total = descriptors.reduce((sum, descriptor) => sum + descriptor.nodes.length, 0);
  const done = descriptors.reduce((sum, descriptor) => sum + descriptor.nodes.filter(id => statuses[id] === 'done').length, 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  const stages = descriptors.map(descriptor => {
    const eligible = PARALLEL_ELIGIBLE.has(descriptor.stage) && descriptor.nodes.length > 1;
    const title = descriptor.stage === 'research'
      ? 'Phân tích chuyên sâu'
      : descriptor.stage === 'reports'
        ? 'Đầu ra'
        : (NODE_LABELS[descriptor.nodes[0]] || descriptor.stage);
    return renderStage(descriptor, statuses, title, eligible);
  }).join('');

  return `
    <div class="panel panel-pad crsm-progress">
      <div class="title-row">
        <div>
          <p class="eyebrow">Pipeline</p>
          <h2>${crsmState.isRunning ? 'Đang chạy' : 'Trạng thái'}</h2>
        </div>
        <span class="crsm-progress-percent">${pct}%</span>
      </div>
      <div class="crsm-bar"><div class="crsm-bar-fill" style="width:${pct}%"></div></div>
      <div class="crsm-flow">${stages}</div>
      <div class="crsm-log">
        ${crsmState.logRows.slice(-6).map(r => `<div class="crsm-log-row muted">${escapeHtml(r)}</div>`).join('') || '<div class="crsm-log-row muted">Chưa có tiến trình.</div>'}
      </div>
    </div>`;
}

function renderStage(descriptor, statuses, title, eligible) {
  const cards = descriptor.nodes.map(nodeId => renderNodeCard(nodeId, statuses)).join('');
  const mode = descriptor.mode;
  const modeText = mode === 'parallel' ? 'Song song' : 'Tuần tự';
  const parallelClass = eligible && mode === 'parallel' ? ' active' : '';
  const showExecutionControl = eligible;
  const runningCount = descriptor.nodes.filter(id => statuses[id] === 'running').length;
  const parallelNow = runningCount > 1;

  return `
    <section class="crsm-stage ${parallelNow ? 'parallel-running' : ''}" data-stage="${descriptor.stage}">
      <div class="crsm-stage-head">
        <div>
          <div class="crsm-stage-kicker">${DESCRIPTOR_LABELS[descriptor.stage] || 'Bước xử lý'}</div>
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${showExecutionControl ? `<div class="crsm-stage-execution" aria-label="Execution policy">
          <span class="crsm-stage-mode-label">${parallelNow ? 'Đang chạy song song' : modeText}</span>
          <span class="crsm-parallel-toggle${parallelClass}" title="Cấu hình execution policy trong Settings">
            <span class="crsm-toggle-dot"></span>
            <span>Song song</span>
          </span>
        </div>` : ''}
      </div>
      <div class="crsm-stage-track">${cards}</div>
    </section>`;
}

function renderNodeCard(nodeId, statuses) {
  const status = statuses[nodeId] || 'pending';
  const active = status === 'running';
  const done = status === 'done';
  const failed = status === 'failed';
  const cls = failed ? 'failed' : done ? 'done' : active ? 'running' : 'pending';
  const icon = failed ? '✕' : done ? '✓' : active ? '•' : '○';
  return `<div class="crsm-node-card ${cls}" data-node="${nodeId}">
    <div class="crsm-node-card-icon">${icon}</div>
    <div class="crsm-node-card-copy"><strong>${escapeHtml(NODE_LABELS[nodeId] || nodeId)}</strong><span>${statusLabel(status)}</span></div>
  </div>`;
}

function statusLabel(status) {
  return ({
    pending: 'Đang chờ',
    running: 'Đang xử lý',
    done: 'Hoàn thành',
    failed: 'Có lỗi',
    skipped: 'Bỏ qua'
  })[status] || 'Đang chờ';
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
