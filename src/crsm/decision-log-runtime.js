const HEADER_MAP = {
  'Ngày phân tích': 'Ngày phân tích',
  'Mã': 'Mã cổ phiếu',
  'Chế độ': 'Chế độ phân tích',
  'Giá tại thời điểm PT': 'Giá tại thời điểm phân tích',
  'Screen Score': 'Điểm sàng lọc',
  'Screen Rank': 'Xếp hạng sàng lọc',
  'Screen Grade': 'Hạng sàng lọc',
  'Quyết định': 'Quyết định',
  'AI Score': 'Điểm AI',
  'Confidence': 'Độ tin cậy',
  'CRSM−Screen Diff': 'Chênh lệch CRSM − Sàng lọc',
  'Entry': 'Vùng vào lệnh',
  'Trading Stop': 'Giá dừng lỗ',
  'TP1': 'Mục tiêu 1 (TP1)',
  'TP2': 'Mục tiêu 2 (TP2)',
  'Thesis Invalidation': 'Điều kiện vô hiệu'
};

const VALUE_MAP = {
  SCREENED: 'SÀNG LỌC',
  DIRECT: 'TRỰC TIẾP',
  BUY: 'MUA',
  SELL: 'BÁN',
  HOLD: 'NẮM GIỮ',
  BULL: 'TĂNG',
  BASE: 'CƠ SỞ',
  BEAR: 'GIẢM',
  'Data not available': 'Chưa có dữ liệu',
  'N/A': 'Không áp dụng'
};

function translate(value) {
  const text = String(value ?? '').trim();
  if (!text) return '—';
  return VALUE_MAP[text] || text.replace(/\bSCREENED\b/g, 'SÀNG LỌC').replace(/\bDIRECT\b/g, 'TRỰC TIẾP').replace(/\bBUY\b/g, 'MUA').replace(/\bSELL\b/g, 'BÁN').replace(/\bHOLD\b/g, 'NẮM GIỮ');
}

function buildCards(table) {
  if (table.dataset.cardsRendered === '1') return;
  const headers = [...table.querySelectorAll('thead th')].map(th => HEADER_MAP[th.textContent.trim()] || th.textContent.trim());
  const rows = [...table.querySelectorAll('tbody tr')];
  if (!rows.length) return;

  const cards = document.createElement('div');
  cards.className = 'decision-log-cards';

  rows.forEach((row, index) => {
    const cells = [...row.children];
    const values = headers.map((header, i) => ({ header, value: translate(cells[i]?.textContent) }));
    const ticker = values.find(v => v.header === 'Mã cổ phiếu')?.value || '—';
    const decision = values.find(v => v.header === 'Quyết định')?.value || '—';
    const mode = values.find(v => v.header === 'Chế độ phân tích')?.value || '—';
    const date = values.find(v => v.header === 'Ngày phân tích')?.value || '—';

    const card = document.createElement('article');
    card.className = 'decision-log-card';
    card.innerHTML = `
      <div class="decision-log-card-head">
        <div><strong>${escapeHtml(ticker)}</strong><span>${escapeHtml(date)} · ${escapeHtml(mode)}</span></div>
        <span class="decision-log-decision ${decisionClass(decision)}">${escapeHtml(decision)}</span>
      </div>
      <div class="decision-log-fields">
        ${values.filter(v => !['Mã cổ phiếu','Ngày phân tích','Chế độ phân tích','Quyết định'].includes(v.header)).map(v => `
          <div class="decision-log-field ${longField(v.header) ? 'is-long' : ''}">
            <span>${escapeHtml(v.header)}</span>
            <strong>${escapeHtml(v.value)}</strong>
          </div>`).join('')}
      </div>`;
    card.dataset.index = String(index + 1);
    cards.appendChild(card);
  });

  table.replaceWith(cards);
}

function longField(header) {
  return header === 'Điều kiện vô hiệu' || header === 'Vùng vào lệnh';
}

function decisionClass(value) {
  if (value === 'MUA') return 'is-buy';
  if (value === 'BÁN') return 'is-sell';
  if (value === 'NẮM GIỮ') return 'is-hold';
  return '';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function localizeReportLog(root = document) {
  root.querySelectorAll('.decision-log-panel .eyebrow').forEach(el => {
    if (el.textContent.trim() === 'DECISION LOG') el.textContent = 'NHẬT KÝ QUYẾT ĐỊNH';
  });
  root.querySelectorAll('.decision-log-panel .muted').forEach(el => {
    if (el.textContent.includes('Append-only history')) {
      el.textContent = 'Lịch sử chỉ ghi thêm · TRỰC TIẾP — các trường sàng lọc không áp dụng.';
    }
  });
}

function process(root = document) {
  localizeReportLog(root);
  root.querySelectorAll('.decision-log-table').forEach(buildCards);
}

const observer = new MutationObserver(() => process(document));
observer.observe(document.documentElement, { childList: true, subtree: true });
process(document);
