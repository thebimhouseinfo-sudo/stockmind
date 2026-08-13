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
const STYLE_ID = 'crsm-progress-flow-style';

export function renderProgress() {
  ensureProgressStyles();

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
  const runningCount = descriptor.nodes.filter(id => statuses[id] === 'running').length;
  const parallelNow = runningCount > 1;

  return `
    <section class="crsm-stage ${parallelNow ? 'parallel-running' : ''}" data-stage="${descriptor.stage}">
      <div class="crsm-stage-head">
        <div>
          <div class="crsm-stage-kicker">${DESCRIPTOR_LABELS[descriptor.stage] || 'Bước xử lý'}</div>
          <h3>${escapeHtml(title)}</h3>
        </div>
        ${eligible ? `<div class="crsm-stage-execution" aria-label="Execution policy">
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

function ensureProgressStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .crsm-progress-percent{font-size:13px;font-weight:900;color:var(--blue)}
    .crsm-flow{display:flex;flex-direction:column;gap:14px}
    .crsm-stage{position:relative;padding:14px 0 4px}
    .crsm-stage:not(:last-child)::after{content:'';display:block;width:2px;height:14px;background:var(--line);margin:12px auto 0}
    .crsm-stage-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
    .crsm-stage-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.08em;font-weight:900;color:var(--muted);margin-bottom:3px}
    .crsm-stage-head h3{margin:0;font-size:15px;color:var(--ink)}
    .crsm-stage-execution{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    .crsm-stage-mode-label{font-size:11px;color:var(--muted);font-weight:800}
    .crsm-parallel-toggle{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid var(--line);border-radius:999px;background:#f8fafc;color:var(--muted);font-size:11px;font-weight:850;white-space:nowrap}
    .crsm-parallel-toggle.active{border-color:#93c5fd;background:#eff6ff;color:var(--blue)}
    .crsm-toggle-dot{width:9px;height:9px;border-radius:50%;background:#cbd5e1;display:inline-block}
    .crsm-parallel-toggle.active .crsm-toggle-dot{background:var(--blue);box-shadow:0 0 0 4px rgba(37,99,235,.10)}
    .crsm-stage-track{display:grid;grid-template-columns:1fr;gap:10px}
    .crsm-stage[data-stage="research"] .crsm-stage-track,.crsm-stage[data-stage="reports"] .crsm-stage-track{grid-template-columns:repeat(2,minmax(0,1fr))}
    .crsm-stage[data-stage="reports"] .crsm-stage-track{grid-template-columns:repeat(3,minmax(0,1fr))}
    .crsm-node-card{display:flex;align-items:center;gap:10px;min-height:62px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--muted);transition:border-color .2s ease,background .2s ease,box-shadow .2s ease}
    .crsm-node-card-icon{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:#e8eef6;color:#7a8699;font-size:13px;font-weight:950;flex:0 0 auto}
    .crsm-node-card-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
    .crsm-node-card-copy strong{font-size:12px;color:var(--ink);line-height:1.25}
    .crsm-node-card-copy span{font-size:11px;color:var(--muted)}
    .crsm-node-card.running{border-color:#93c5fd;background:#eff6ff;box-shadow:0 0 0 3px rgba(37,99,235,.07)}
    .crsm-node-card.running .crsm-node-card-icon{background:var(--blue);color:#fff;animation:crsmPulse .95s infinite}
    .crsm-node-card.done{border-color:#bbf7d0;background:#f0fdf4}
    .crsm-node-card.done .crsm-node-card-icon{background:var(--green);color:#fff}
    .crsm-node-card.failed{border-color:#fecaca;background:#fff1f2}
    .crsm-node-card.failed .crsm-node-card-icon{background:var(--red);color:#fff}
    .crsm-stage.parallel-running .crsm-stage-execution{color:var(--blue)}
    @keyframes crsmPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.94)}}
    @media(max-width:760px){.crsm-stage-track,.crsm-stage[data-stage="research"] .crsm-stage-track,.crsm-stage[data-stage="reports"] .crsm-stage-track{grid-template-columns:1fr}.crsm-stage-head{align-items:flex-start;flex-direction:column}.crsm-stage-execution{justify-content:flex-start}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
