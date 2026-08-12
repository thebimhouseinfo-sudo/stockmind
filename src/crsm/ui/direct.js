import { crsmState } from '../state.js';
import { getPendingUserEvidence } from '../user-evidence.js';

export function renderDirectEntry() {
  const afterScreened = crsmState.mode === 'SCREENED';
  const evidence = getPendingUserEvidence();
  const evidenceLabel = evidence ? `${evidence.documents.length} file · ${evidence.totalChars.toLocaleString('vi-VN')} ký tự` : 'Thêm tài liệu';

  return `<div class="panel panel-pad crsm-direct-entry ${afterScreened ? 'direct-secondary' : ''}">
    <p class="eyebrow">${afterScreened ? 'Direct Analysis' : 'Manual Analysis'}</p>
    <h2>${afterScreened ? 'Kiểm tra một mã khác' : 'Phân tích bằng CRSM'}</h2>
    <div class="direct-form">
      <input class="search" id="crsmTickerInput" placeholder="VD: VCB, HPG, MWG" maxlength="12" autocomplete="off" aria-label="Mã cổ phiếu">
      <button class="btn primary" id="crsmRunDirect" data-crsm-direct type="button">${afterScreened ? 'Chạy Direct CRSM' : 'Phân tích bằng CRSM'}</button>
      <label class="btn" for="crsmEvidenceFiles">${evidence ? '✓ ' : '＋ '}${evidenceLabel}</label>
    </div>
    <input id="crsmEvidenceFiles" type="file" multiple accept=".xlsx,.xls,.pdf,.csv,.tsv,.txt,.md,.json,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
    <div id="crsmEvidenceStatus" class="muted crsm-evidence-status" aria-live="polite">${evidence ? `Đã đọc ${evidence.documents.length} file` : ''}</div>
  </div>`;
}
