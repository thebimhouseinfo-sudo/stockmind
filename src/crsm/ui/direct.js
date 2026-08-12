import { crsmState } from '../state.js';

export function renderDirectEntry() {
  const afterScreened = crsmState.mode === 'SCREENED';
  return `<div class="panel panel-pad crsm-direct-entry ${afterScreened ? 'direct-secondary' : ''}">
    <p class="eyebrow">${afterScreened ? 'Direct Analysis' : 'Manual Analysis'}</p>
    <h2>${afterScreened ? 'Kiểm tra một mã khác' : 'Phân tích bằng CRSM'}</h2>
    <p class="muted">Nhập mã cổ phiếu Việt Nam (HOSE/HNX/UPCOM) — CRSM chạy full pipeline ${afterScreened ? 'không dùng screening context' : 'mà không cần dữ liệu screening'}.</p>
    <div class="direct-form"><input class="search" id="crsmTickerInput" placeholder="VD: VCB, HPG, MWG" maxlength="12"><button class="btn primary" id="crsmRunDirect">${afterScreened ? 'Chạy Direct CRSM' : 'Phân tích bằng CRSM'}</button></div>
  </div>`;
}
