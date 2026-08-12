import { crsmState } from '../state.js';
import { getPendingUserEvidence } from '../user-evidence.js';

export function renderDirectEntry() {
  const afterScreened = crsmState.mode === 'SCREENED';
  const evidence = getPendingUserEvidence();
  const evidenceLabel = evidence
    ? `${evidence.documents.length} file · ${evidence.totalChars.toLocaleString('vi-VN')} ký tự đã đọc`
    : 'Không có dữ liệu bổ sung';

  return `<div class="panel panel-pad crsm-direct-entry ${afterScreened ? 'direct-secondary' : ''}">
    <p class="eyebrow">${afterScreened ? 'Direct Analysis' : 'Manual Analysis'}</p>
    <h2>${afterScreened ? 'Kiểm tra một mã khác' : 'Phân tích bằng CRSM'}</h2>
    <p class="muted">Nhập mã cổ phiếu Việt Nam (HOSE/HNX/UPCOM) — CRSM chạy full pipeline ${afterScreened ? 'không dùng screening context' : 'mà không cần dữ liệu screening'}.</p>
    <div class="direct-form"><input class="search" id="crsmTickerInput" placeholder="VD: VCB, HPG, MWG" maxlength="12"><button class="btn primary" id="crsmRunDirect">${afterScreened ? 'Chạy Direct CRSM' : 'Phân tích bằng CRSM'}</button></div>
    <div class="crsm-evidence-box">
      <div><strong>User evidence</strong><span class="muted">${evidenceLabel}</span></div>
      <label class="btn" for="crsmEvidenceFiles">Thêm Excel / PDF / CSV</label>
      <input id="crsmEvidenceFiles" type="file" multiple accept=".xlsx,.xls,.pdf,.csv,.tsv,.txt,.md,.json,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
      <small id="crsmEvidenceStatus" class="muted">File được đọc cục bộ và chỉ đưa vào các node phân tích sâu. Không ghi đè dữ liệu screening.</small>
    </div>
  </div>`;
}
