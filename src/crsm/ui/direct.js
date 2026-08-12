export function renderDirectEntry() {
  return `
    <div class="panel panel-pad crsm-direct-entry">
      <p class="eyebrow">Direct Analysis</p>
      <h2>Phân tích bằng CRSM</h2>
      <p class="muted">Nhập mã cổ phiếu Việt Nam (HOSE/HNX/UPCOM) — CRSM chạy full pipeline mà không cần dữ liệu screening.</p>
      <div class="direct-form">
        <input class="search" id="crsmTickerInput" placeholder="VD: VCB, HPG, MWG" maxlength="12">
        <button class="btn primary" id="crsmRunDirect">Phân tích bằng CRSM</button>
      </div>
    </div>`;
}