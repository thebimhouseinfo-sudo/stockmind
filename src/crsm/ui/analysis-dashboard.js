import { crsmState } from '../state.js';
import { getExecutionDescriptor } from '../execution-policy.js';
import { loadSettings } from '../settings.js';
import { totalUsage, usageByNode } from '../usage.js';

const NODE_LABELS = {
  userEvidence: 'Chuẩn bị tài liệu',
  node1: 'Dữ liệu & Tài chính',
  node2: 'Kỹ thuật & Smart Money',
  node3: 'Cơ bản & Định giá',
  node4: 'Vĩ mô & Nhân quả',
  node5: 'Tổng hợp & Quyết định',
  node6a: 'Báo cáo phân tích (HTML)',
  node6b: 'Báo cáo phân tích (Word)',
  node7: 'Nhật ký quyết định'
};

const ICONS = {
  userEvidence: '✎',
  node1: '▤',
  node2: '◒',
  node3: '▦',
  node4: '◉',
  node5: '⬡',
  node6a: '▧',
  node6b: 'W',
  node7: '▥'
};

const STYLE_ID = 'crsm-analysis-dashboard-style';

export function renderAnalysisDashboard() {
  ensureStyles();
  const descriptors = getExecutionDescriptor(loadSettings());
  const statuses = visibleNodeStatuses();
  const total = descriptors.reduce((sum, d) => sum + d.nodes.length, 0);
  const done = descriptors.reduce((sum, d) => sum + d.nodes.filter(id => statuses[id] === 'done').length, 0);
  const percent = total ? Math.round(done / total * 100) : 0;
  const running = Object.values(statuses).filter(s => s === 'running').length;
  const completedCount = Object.values(statuses).filter(s => s === 'done').length;
  const pendingCount = total - completedCount - running;
  const mode = crsmState.mode === 'SCREENED' ? 'SCREENED' : crsmState.mode === 'DIRECT' ? 'DIRECT' : '—';
  const ticker = crsmState.ticker || '—';
  const activities = (crsmState.logRows || []).slice(-8).reverse();
  const started = formatTime(crsmState.startedAt);
  const duration = formatDuration(crsmState.startedAt, crsmState.completedAt);
  const usage = totalUsage();
  const nodeCostRows = buildNodeCostRows();
  const hasError = Boolean(crsmState.error || crsmState.failedNode);

  return `
    <div class="crsm-dashboard">
      <section class="crsm-hero">
        <div class="crsm-hero-copy">
          <span class="crsm-hero-chip">CRSM</span>
          <h2>Phân tích chuyên sâu</h2>
          <p>Dữ liệu thời gian thực <span>•</span> Phân tích đa lớp <span>•</span> Khung phân tích độc quyền</p>
        </div>
        <div class="crsm-run-card">
          <div><small>ĐANG PHÂN TÍCH</small><strong>${escapeHtml(ticker)}</strong></div>
          <div class="crsm-run-divider"></div>
          <div><small>TRẠNG THÁI TỔNG THỂ</small><div class="crsm-run-percent"><span>${percent}%</span><i class="crsm-mini-ring" style="--pct:${percent}"></i></div></div>
        </div>
      </section>

      <section class="crsm-input-row">
        <div class="crsm-input-title">MÃ CỔ PHIẾU</div>
        <div class="crsm-input-slot">${renderExistingDirectEntry()}</div>
        <div class="crsm-session-meta"><span>CHẾ ĐỘ PHÂN TÍCH</span><strong class="${mode !== '—' ? 'is-active' : ''}">${mode}</strong><span>BẮT ĐẦU LÚC</span><b>${started}</b></div>
      </section>

      <section class="crsm-main-grid">
        <aside class="crsm-left-rail">
          <section class="crsm-side-card crsm-progress-card">
            <div class="crsm-side-title">TIẾN ĐỘ TỔNG THỂ</div>
            <div class="crsm-progress-donut" style="--pct:${percent}"><div><strong>${percent}%</strong><span>Đã hoàn thành</span></div></div>
            <div class="crsm-progress-row"><span>Tiến độ chi tiết</span><b>${completedCount}/${total}</b></div>
            <div class="crsm-thin-bar"><i style="width:${percent}%"></i></div><small>${percent}%</small>
          </section>
          <section class="crsm-side-card"><div class="crsm-side-title">TRẠNG THÁI</div>
            <div class="crsm-legend-row"><span class="dot green"></span><span>Hoàn thành</span><b>${completedCount}</b></div>
            <div class="crsm-legend-row"><span class="dot blue"></span><span>Đang xử lý</span><b>${running}</b></div>
            <div class="crsm-legend-row"><span class="dot gray"></span><span>Chờ xử lý</span><b>${pendingCount}</b></div>
          </section>
          <section class="crsm-side-card crsm-cost-card"><div class="crsm-side-title">CHI PHÍ</div>
            <div class="crsm-cost-total"><span>Tổng</span><strong>$${Number(usage.cost || 0).toFixed(4)}</strong><b>${((usage.input || 0) + (usage.output || 0)).toLocaleString('vi-VN')} tokens</b></div>
            <div class="crsm-node-cost-table">
              <div class="crsm-node-cost-head"><span>Node</span><span>Tokens</span><span>Cost</span></div>
              ${nodeCostRows.map(row => `<div class="crsm-node-cost-row"><span title="${escapeHtml(row.label)}">${escapeHtml(row.shortLabel)}</span><b>${row.tokens.toLocaleString('vi-VN')}</b><strong>$${row.cost.toFixed(4)}</strong></div>`).join('')}
            </div>
            <div class="crsm-cost-grand-total"><span>Tổng cộng</span><b>${((usage.input || 0) + (usage.output || 0)).toLocaleString('vi-VN')}</b><strong>$${Number(usage.cost || 0).toFixed(4)}</strong></div>
          </section>
        </aside>

        <main class="crsm-pipeline-card">
          <div class="crsm-pipeline-head">
            <div><div class="crsm-side-title">QUY TRÌNH PHÂN TÍCH</div><p>Các bước được thiết kế theo phương pháp nghiên cứu của CRSM</p></div>
            <div class="crsm-status-key"><span><i class="green"></i> Hoàn thành</span><span><i class="blue"></i> Đang xử lý</span><span><i class="gray"></i> Chờ xử lý</span><span><i class="amber"></i> Song song</span></div>
          </div>
          <div class="crsm-tree">${renderPipeline(descriptors, statuses)}</div>
          <div class="crsm-pipeline-note">ⓘ Song song chỉ áp dụng trong phạm vi dependency cho phép.</div>
        </main>

        <aside class="crsm-right-rail">
          <section class="crsm-side-card crsm-activity-card">
            <div class="crsm-side-title">HOẠT ĐỘNG</div>
            <div class="crsm-activity-list">${activities.length ? activities.map(renderActivity).join('') : '<div class="crsm-empty">Chưa có hoạt động.</div>'}</div>
            ${hasError ? `<div class="crsm-inline-error-actions"><button class="crsm-retry-btn" id="crsmRetry" type="button">↻ Thử lại bước lỗi</button><button class="crsm-retry-btn secondary" id="crsmRetryAll" type="button">↻ Chạy lại từ đầu</button></div>` : ''}
            <button class="crsm-secondary-btn" type="button">Xem chi tiết log <span>›</span></button>
          </section>
          <section class="crsm-side-card"><div class="crsm-side-title">PHIÊN PHÂN TÍCH</div>
            <div class="crsm-session-box"><span>MÃ CỔ PHIẾU</span><strong>${escapeHtml(ticker)}</strong></div>
            <div class="crsm-session-box"><span>THỜI GIAN BẮT ĐẦU</span><strong>${started}</strong></div>
            <div class="crsm-session-box"><span>TRẠNG THÁI</span><strong>${crsmState.isRunning ? 'Đang chạy' : percent === 100 ? 'Hoàn thành' : hasError ? 'Có lỗi' : 'Chưa chạy'}</strong></div>
          </section>
        </aside>
      </section>
    </div>`;
}

function buildNodeCostRows() {
  const usageRows = usageByNode(crsmState.usage || []);
  const byNode = new Map(usageRows.map(row => [row.nodeId, row]));
  return ['node1', 'node2', 'node3', 'node4', 'node5'].map(nodeId => {
    const row = byNode.get(nodeId) || {};
    return {
      nodeId,
      label: NODE_LABELS[nodeId] || nodeId,
      shortLabel: nodeId.toUpperCase(),
      tokens: Number(row.inputTokens || 0) + Number(row.outputTokens || 0),
      cost: Number(row.totalCost || 0)
    };
  });
}

function visibleNodeStatuses() {
  const statuses = { ...(crsmState.nodeStatus || {}) };
  if (crsmState.mode === 'SCREENED' && crsmState.screeningContext && statuses.userEvidence !== 'running' && statuses.userEvidence !== 'failed') {
    statuses.userEvidence = 'done';
  }
  return statuses;
}

function renderExistingDirectEntry() {
  return `<input class="crsm-dashboard-ticker" id="crsmTickerInput" placeholder="⌕  VD: VCB, HPG, MWG..." maxlength="12" autocomplete="off" aria-label="Mã cổ phiếu">
    <label class="crsm-dashboard-doc" for="crsmEvidenceFiles">＋ Thêm tài liệu</label>
    <button class="crsm-dashboard-run" id="crsmRunDirect" data-crsm-direct type="button">⚯  Phân tích bằng CRSM</button>
    <input id="crsmEvidenceFiles" type="file" multiple accept=".xlsx,.xls,.pdf,.csv,.tsv,.txt,.md,.json,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>`;
}

function renderPipeline(descriptors, statuses) {
  return descriptors.map((descriptor, index) => {
    const isParallelGroup = descriptor.nodes.length > 1;
    return `<div class="crsm-tree-stage ${isParallelGroup ? 'is-parallel' : ''} ${index > 0 ? 'has-parent' : ''}">${descriptor.nodes.map(id => renderTreeNode(id, statuses, descriptor.mode)).join('')}</div>`;
  }).join('');
}

function renderTreeNode(nodeId, statuses, stageMode) {
  const status = statuses[nodeId] || 'pending';
  const cls = status === 'running' ? 'running' : status === 'done' ? 'done' : status === 'failed' ? 'failed' : 'pending';
  const sub = {
    node1: 'Thu thập và xử lý dữ liệu doanh nghiệp',
    node2: 'Phân tích kỹ thuật, dòng tiền và hành vi giá',
    node3: 'Phân tích doanh nghiệp và định giá cổ phiếu',
    node4: 'Phân tích bối cảnh vĩ mô và tác động nhân quả',
    node5: 'Tổng hợp toàn bộ phân tích, đánh giá rủi ro và đưa ra quyết định',
    node6a: 'Tạo báo cáo phân tích chi tiết dạng HTML',
    node6b: 'Tạo báo cáo phân tích chi tiết dạng Word',
    node7: 'Ghi lại toàn bộ luận điểm và quyết định đầu tư'
  }[nodeId] || '';
  return `<div class="crsm-tree-node ${cls}"><div class="crsm-tree-icon">${ICONS[nodeId] || '•'}</div><div class="crsm-tree-copy"><strong>${escapeHtml(NODE_LABELS[nodeId] || nodeId)}</strong><span>${escapeHtml(sub)}</span></div><div class="crsm-tree-state">${status === 'running' ? '<i class="spinner"></i>' : status === 'done' ? '✓' : status === 'failed' ? '!' : '○'}</div>${stageMode === 'parallel' && status === 'running' ? '<em>Đang chạy song song</em>' : ''}</div>`;
}

function renderActivity(text) {
  const lower = String(text || '').toLowerCase();
  const color = lower.includes('error') || lower.includes('fail') || lower.includes('✖') || lower.includes('thất bại') ? 'red' : lower.includes('song song') || lower.includes('parallel') ? 'amber' : lower.includes('done') || lower.includes('hoàn thành') || lower.includes('✓') ? 'green' : 'blue';
  return `<div class="crsm-activity-item"><i class="${color}"></i><span>${escapeHtml(text)}</span></div>`;
}

function formatTime(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return '—'; } }
function formatDuration(start, end) { if (!start) return '—'; const ms = Math.max(0, new Date(end || Date.now()).getTime() - new Date(start).getTime()); const sec = Math.floor(ms / 1000); const min = Math.floor(sec / 60); return min ? `${min}m ${sec % 60}s` : `${sec}s`; }

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style'); style.id = STYLE_ID;
  style.textContent = `
    .crsm-dashboard{display:flex;flex-direction:column;gap:14px;max-width:1500px;margin:0 auto;padding:4px 0 24px;min-width:0}
    .crsm-dashboard *{box-sizing:border-box;min-width:0}
    .crsm-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;border:1px solid #dbe5f2;border-radius:16px;background:linear-gradient(135deg,#fff 0%,#f6f9ff 100%);box-shadow:0 8px 28px rgba(37,99,235,.08);min-width:0}
    .crsm-hero-chip{display:inline-flex;padding:4px 9px;border-radius:999px;background:#edf4ff;color:#2563eb;font-size:11px;font-weight:900}.crsm-hero h2{margin:7px 0 5px;font-size:27px;color:#132341}.crsm-hero p{margin:0;color:#60718c;font-size:13px}.crsm-hero p span{margin:0 6px;color:#9ab0cb}
    .crsm-run-card{display:flex;align-items:center;gap:18px;min-width:280px;padding:13px 16px;border:1px solid #dce6f2;border-radius:14px;background:#fff;flex:0 1 auto}.crsm-run-card small{display:block;color:#73839a;font-size:9px;font-weight:900;letter-spacing:.08em}.crsm-run-card strong{display:block;margin-top:5px;font-size:23px;color:#132341}.crsm-run-divider{width:1px;height:38px;background:#e2e8f0}.crsm-run-percent{display:flex;align-items:center;gap:9px;color:#2563eb;font-size:22px;font-weight:950}.crsm-mini-ring{width:28px;height:28px;border-radius:50%;display:inline-block;background:conic-gradient(#2563eb calc(var(--pct)*1%),#e6edf6 0);position:relative}.crsm-mini-ring::after{content:'';position:absolute;inset:5px;border-radius:50%;background:#fff}
    .crsm-input-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border:1px solid #dbe5f2;border-radius:14px;background:#fff;box-shadow:0 6px 18px rgba(18,35,65,.04);min-width:0;overflow:hidden}.crsm-input-title{font-size:10px;font-weight:900;color:#6f819a;white-space:nowrap}.crsm-input-slot{display:flex;align-items:center;gap:10px;flex:1;min-width:0}.crsm-dashboard-ticker{width:100%;max-width:320px;height:42px;border:1px solid #d5e0ef;border-radius:10px;padding:0 14px;background:#fbfdff;color:#132341;min-width:0}.crsm-dashboard-doc,.crsm-dashboard-run{height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:10px;padding:0 17px;font-weight:850;cursor:pointer;white-space:nowrap;flex:0 0 auto}.crsm-dashboard-doc{border:1px solid #d5e0ef;background:#fff;color:#193760}.crsm-dashboard-run{border:0;background:#2167eb;color:#fff;box-shadow:0 7px 16px rgba(33,103,235,.2)}
    .crsm-session-meta{display:flex;align-items:center;gap:9px;margin-left:auto;font-size:10px;color:#77889f;white-space:nowrap;flex:0 0 auto;max-width:38%;overflow:hidden}.crsm-session-meta span,.crsm-session-meta strong,.crsm-session-meta b{overflow:hidden;text-overflow:ellipsis}.crsm-session-meta span{font-weight:900}.crsm-session-meta strong{padding:4px 8px;border-radius:999px;background:#efe7ff;color:#6346ff}.crsm-session-meta b{font-size:11px;color:#1e3557}
    .crsm-main-grid{display:grid;grid-template-columns:240px minmax(0,1fr) 300px;gap:14px;align-items:stretch;min-width:0}.crsm-left-rail,.crsm-right-rail{display:flex;flex-direction:column;gap:12px;min-width:0;height:100%}.crsm-side-card{padding:17px;border:1px solid #dbe5f2;border-radius:14px;background:#fff;box-shadow:0 6px 20px rgba(18,35,65,.04);min-width:0;overflow:hidden}.crsm-side-title{font-size:11px;letter-spacing:.05em;font-weight:950;color:#183e77}.crsm-progress-donut{width:128px;height:128px;margin:13px auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#1f78ed calc(var(--pct)*1%),#e7edf5 0);position:relative}.crsm-progress-donut::after{content:'';position:absolute;inset:12px;border-radius:50%;background:#fff}.crsm-progress-donut>div{position:relative;z-index:1;text-align:center}.crsm-progress-donut strong{display:block;font-size:29px;color:#132341}.crsm-progress-donut span{font-size:10px;color:#64758d}.crsm-progress-row,.crsm-legend-row,.crsm-info-row{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;padding:6px 0}.crsm-thin-bar{height:7px;border-radius:999px;background:#e8eef6;overflow:hidden;margin-top:3px}.crsm-thin-bar i{display:block;height:100%;background:#2f78eb;border-radius:999px}.crsm-progress-card>small{display:block;margin-top:4px;text-align:center;color:#65788e;font-size:10px}.dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:4px;flex:0 0 auto}.dot.green,.green{background:#1f9d65}.dot.blue,.blue{background:#2372ee}.dot.gray,.gray{background:#91a1b5}.dot.amber,.amber{background:#f4a61a}.dot.red,.red{background:#e35a5a}.crsm-legend-row span:nth-child(2){flex:1;color:#40536d;min-width:0}.crsm-legend-row b{color:#183e77}.crsm-info-row span{color:#697c95}.crsm-info-row b{color:#1c355a}.crsm-cost-card{min-height:240px;flex:1;display:flex;flex-direction:column}.crsm-cost-total{display:grid;grid-template-columns:minmax(70px,1fr) minmax(72px,1fr) minmax(70px,1fr);gap:6px;align-items:end;margin:12px 0 9px;padding-bottom:9px;border-bottom:1px solid #edf1f6}.crsm-cost-total span{color:#71839b;font-size:10px}.crsm-cost-total strong{justify-self:end;color:#173a6f;font-size:13px}.crsm-cost-total b{justify-self:end;color:#60748e;font-size:10px;font-weight:800}.crsm-node-cost-table{display:grid;gap:0}.crsm-node-cost-head,.crsm-node-cost-row,.crsm-cost-grand-total{display:grid;grid-template-columns:minmax(58px,1fr) minmax(64px,1fr) minmax(64px,1fr);gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid #edf1f6}.crsm-node-cost-head{padding-top:0;color:#71839b;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.04em}.crsm-node-cost-head span:nth-child(2),.crsm-node-cost-head span:nth-child(3){text-align:right}.crsm-node-cost-row:last-child{border-bottom:0}.crsm-node-cost-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#173a6f;font-size:10px;font-weight:900}.crsm-node-cost-row b,.crsm-node-cost-row strong,.crsm-cost-grand-total b,.crsm-cost-grand-total strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right;font-size:10px}.crsm-node-cost-row b{color:#4e6380}.crsm-node-cost-row strong{color:#173a6f}.crsm-cost-grand-total{margin-top:auto;padding-top:10px;border-top:1px solid #dbe5f2;border-bottom:0}.crsm-cost-grand-total span{color:#183e77;font-size:10px;font-weight:950}.crsm-cost-grand-total b{color:#4e6380}.crsm-cost-grand-total strong{color:#173a6f}
    .crsm-pipeline-card{padding:19px 16px;border:1px solid #dbe5f2;border-radius:14px;background:#fff;box-shadow:0 6px 20px rgba(18,35,65,.04);min-width:0;overflow:hidden}.crsm-pipeline-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;min-width:0}.crsm-pipeline-head>div{min-width:0}.crsm-pipeline-head p{margin:5px 0 0;color:#71829a;font-size:11px;overflow-wrap:anywhere}.crsm-status-key{display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;font-size:10px;color:#65768e;min-width:0}.crsm-status-key span{display:flex;align-items:center;gap:4px;white-space:nowrap}.crsm-status-key i{width:7px;height:7px;border-radius:50%;display:inline-block}
    .crsm-tree{position:relative;padding:11px 0 0;min-width:0;width:100%;display:flex;flex-direction:column;gap:0;overflow:visible}.crsm-tree-stage{position:relative;display:grid;width:100%;max-width:100%;grid-template-columns:minmax(0,1fr);gap:10px;padding:10px 0 16px;min-width:0}.crsm-tree-stage.is-parallel{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.crsm-tree-stage.is-parallel:last-child{grid-template-columns:repeat(3,minmax(0,1fr))}.crsm-tree-stage:not(:first-child)::before{content:'';position:absolute;top:-10px;left:50%;width:2px;height:20px;background:#b8d2fa}.crsm-tree-stage.is-parallel::after{content:'';position:absolute;left:25%;right:25%;top:-10px;height:2px;background:#b8d2fa}.crsm-tree-node{position:relative;display:flex;align-items:center;gap:10px;width:100%;max-width:100%;min-height:78px;padding:13px 14px;border:1px solid #dbe6f4;border-radius:13px;background:#fff;box-shadow:0 3px 12px rgba(31,65,112,.04);transition:.2s;min-width:0;overflow:hidden}.crsm-tree-node::before{content:'';position:absolute;left:50%;top:-10px;width:2px;height:10px;background:#b8d2fa}.crsm-tree-stage:first-child .crsm-tree-node::before{display:none}.crsm-tree-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:#eef4fb;color:#2c6ee6;font-size:19px;font-weight:900;flex:0 0 auto}.crsm-tree-copy{display:flex;flex-direction:column;min-width:0;gap:4px;flex:1}.crsm-tree-copy strong{font-size:13px;color:#153a74;overflow-wrap:anywhere}.crsm-tree-copy span{font-size:10px;line-height:1.3;color:#6b7c93;overflow-wrap:anywhere;word-break:break-word}.crsm-tree-state{margin-left:auto;font-size:19px;color:#91a1b5;flex:0 0 auto}.crsm-tree-node.running{border-color:#86b8ff;background:#f1f7ff;box-shadow:0 0 0 3px rgba(37,99,235,.07)}.crsm-tree-node.running .crsm-tree-icon{background:#2572eb;color:#fff;animation:crsmNodePulse 1s infinite}.crsm-tree-node.done{border-color:#bcead5;background:#f8fffb}.crsm-tree-node.done .crsm-tree-icon{background:#e8f8f0;color:#158a5a}.crsm-tree-node.done .crsm-tree-state{color:#169160}.crsm-tree-node.failed{border-color:#f2c3c3;background:#fff8f8}.crsm-tree-node.failed .crsm-tree-state{color:#cf4747}.crsm-tree-node em{position:absolute;right:10px;bottom:7px;font-size:9px;color:#d28a12;font-style:normal;font-weight:900}.spinner{display:block;width:18px;height:18px;border:2px solid #d8e5f5;border-top-color:#2a74ee;border-right-color:#2a74ee;border-radius:50%;animation:crsmSpin 1s linear infinite}.crsm-pipeline-note{margin-top:6px;padding:10px 12px;border-radius:10px;background:#f4f8ff;border:1px solid #dbe8fb;color:#627691;font-size:10px;overflow-wrap:anywhere}
    .crsm-activity-list{display:flex;flex-direction:column;gap:9px;margin-top:12px;max-height:250px;overflow:auto;padding-right:2px;min-width:0}.crsm-activity-item{display:flex;gap:8px;align-items:flex-start;font-size:10px;line-height:1.35;color:#435772;min-width:0}.crsm-activity-item i{width:7px;height:7px;border-radius:50%;margin-top:4px;flex:0 0 auto}.crsm-activity-item span{min-width:0;overflow-wrap:anywhere;word-break:break-word}.crsm-inline-error-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px;padding-top:10px;border-top:1px solid #edf1f6}.crsm-retry-btn{height:34px;padding:0 11px;border:0;border-radius:9px;background:#2167eb;color:#fff;font-size:10px;font-weight:850;cursor:pointer;white-space:nowrap;max-width:100%}.crsm-retry-btn.secondary{background:#eef3f9;color:#244a79;border:1px solid #d9e3ef}.crsm-secondary-btn{width:100%;margin-top:12px;height:36px;border:1px solid #dce5f1;border-radius:9px;background:#fff;color:#1f4f94;font-weight:800;font-size:10px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;max-width:100%}.crsm-session-box{padding:10px 0;border-bottom:1px solid #edf1f6;min-width:0}.crsm-session-box:last-child{border-bottom:0}.crsm-session-box span{display:block;font-size:9px;color:#7b8ca1;font-weight:900}.crsm-session-box strong{display:block;margin-top:4px;font-size:12px;color:#1a365d;overflow-wrap:anywhere}.crsm-empty{padding:10px 0;font-size:10px;color:#7b8ca1}
    @keyframes crsmNodePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.55;transform:scale(.96)}}@keyframes crsmSpin{to{transform:rotate(360deg)}}
    @media(max-width:1100px){.crsm-main-grid{grid-template-columns:200px minmax(0,1fr)}.crsm-right-rail{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.crsm-input-row{flex-wrap:wrap}.crsm-session-meta{width:100%;max-width:none;margin-left:0;justify-content:flex-start}}
    @media(max-width:760px){.crsm-dashboard{padding-bottom:10px}.crsm-hero{align-items:flex-start;flex-direction:column;padding:18px}.crsm-hero h2{font-size:22px}.crsm-run-card{width:100%;min-width:0}.crsm-input-row{align-items:stretch;flex-direction:column}.crsm-input-slot{width:100%;flex-direction:column;align-items:stretch}.crsm-dashboard-ticker{max-width:none}.crsm-main-grid{grid-template-columns:1fr}.crsm-right-rail{display:flex}.crsm-pipeline-head{flex-direction:column}.crsm-status-key{justify-content:flex-start}.crsm-tree-stage.is-parallel,.crsm-tree-stage.is-parallel:last-child{grid-template-columns:1fr}.crsm-tree-stage.is-parallel::after{display:none}.crsm-tree-stage:not(:first-child)::before{left:20px}.crsm-tree-node::before{left:20px}.crsm-pipeline-note{font-size:9px}.crsm-cost-card{min-height:0}.crsm-node-cost-head,.crsm-node-cost-row{grid-template-columns:1fr 1fr 1fr}.crsm-inline-error-actions{flex-direction:column}.crsm-retry-btn{width:100%}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\"/g,'&quot;').replace(/'/g,'&#039;'); }
