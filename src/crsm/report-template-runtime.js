// CRSM Report Template Runtime
// The Node 6A report template remains locked. This runtime only mounts the
// already-rendered template directly into the Reports page instead of an iframe.
// It also localizes presentation text without changing template structure.

const FRAME_SELECTOR = 'iframe.crsm-report-frame';
const HOST_CLASS = 'crsm-report-host';
const ASSET_MARK = 'data-crsm-report-asset';

const VI_TEXT = new Map([
  ['Senior Equity Analyst & Geopolitical Strategist', 'Chuyên gia phân tích cổ phiếu & Chiến lược địa chính trị'],
  ['Senior Equity Analyst', 'Chuyên gia phân tích cổ phiếu'],
  ['AI Score', 'Điểm AI'],
  ['Invalidation', 'Điều kiện vô hiệu'],
  ['Screening Snapshot', 'Tóm tắt sàng lọc'],
  ['Score', 'Điểm'],
  ['Rank', 'Xếp hạng'],
  ['Grade', 'Phân loại'],
  ['Quality', 'Chất lượng'],
  ['Growth', 'Tăng trưởng'],
  ['Valuation', 'Định giá'],
  ['Momentum', 'Động lượng'],
  ['Mispricing', 'Định giá sai'],
  ['SCREEN → CRSM', 'SÀNG LỌC → CRSM'],
  ['Key Insight', 'Nhận định chính'],
  ['Volume Ratio', 'Tỷ lệ thanh khoản'],
  ['vs avg 20 phiên', 'so với bình quân 20 phiên'],
  ['P/E (TTM)', 'P/E (TTM)'],
  ['P/B Ratio', 'Hệ số P/B'],
  ['Target Price', 'Giá mục tiêu'],
  ['Stop Loss', 'Giá cắt lỗ'],
  ['Trade Setup', 'Thiết lập giao dịch'],
  ['BULL CASE', 'Kịch bản Tăng'],
  ['BASE CASE', 'Kịch bản Cơ sở'],
  ['BEAR CASE', 'Kịch bản Giảm'],
  ['Position Sizing', 'Quản trị vị thế'],
  ['Data not available', 'Chưa có dữ liệu'],
  ['Data Not Available', 'Chưa có dữ liệu'],
  ['Not available', 'Chưa có dữ liệu'],
  ['Target', 'Mục tiêu'],
  ['Trend', 'Xu hướng'],
  ['Technical Structure', 'Cấu trúc kỹ thuật'],
  ['Technical', 'Kỹ thuật'],
  ['Fundamental', 'Cơ bản'],
  ['Macro', 'Vĩ mô'],
  ['Liquidity', 'Thanh khoản'],
  ['Flow', 'Dòng tiền'],
  ['Risk', 'Rủi ro'],
  ['Sector/Macro', 'Ngành/Vĩ mô'],
  ['Thesis Invalidation', 'Điều kiện vô hiệu luận điểm'],
  ['Báo cáo được tạo tự động bởi AI Equity Research Engine', 'Báo cáo được tạo tự động bởi CRSM Engine'],
  ['AI Equity Research Engine', 'CRSM Engine'],
  ['for reference only, not an official investment recommendation.', 'chỉ dành cho mục đích tham khảo, không phải khuyến nghị đầu tư chính thức.'],
  ['FOR REFERENCE ONLY', 'CHỈ DÀNH CHO THAM KHẢO'],
  ['BUY', 'MUA'],
  ['SELL', 'BÁN'],
  ['HOLD', 'NẮM GIỮ'],
  ['STRONG BUY', 'MUA MẠNH'],
  ['STRONG SELL', 'BÁN MẠNH'],
  ['CONFIRMED', 'XÁC NHẬN'],
  ['PARTIAL', 'MỘT PHẦN'],
  ['DIVERGENT', 'KHÁC BIỆT']
]);

function localizeReport(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
    let text = node.nodeValue || '';
    for (const [from, to] of VI_TEXT) {
      text = text.split(from).join(to);
    }
    node.nodeValue = text;
  }

  if (document.title) {
    let title = document.title;
    for (const [from, to] of VI_TEXT) title = title.split(from).join(to);
    document.title = title;
  }
}

function mountReportFrame(frame) {
  if (!frame || frame.dataset.crsmDirectMounted === '1') return;

  const srcdoc = frame.getAttribute('srcdoc') || frame.srcdoc || '';
  if (!srcdoc) return;

  const parsed = new DOMParser().parseFromString(srcdoc, 'text/html');
  const body = parsed.body;
  if (!body) return;

  const host = document.createElement('div');
  host.className = `${HOST_CLASS} ${body.className || ''}`.trim();
  host.dataset.crsmDirectMounted = '1';
  host.style.width = '100%';
  host.style.minHeight = '100%';
  host.style.overflow = 'visible';

  parsed.querySelectorAll('style').forEach((style, index) => {
    const copy = document.createElement('style');
    copy.dataset.crsmReportAsset = `${ASSET_MARK}-style-${index}`;
    copy.textContent = scopeBodyRule(style.textContent || '');
    host.appendChild(copy);
  });

  parsed.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    const key = `${ASSET_MARK}-${href}`;
    if (document.head.querySelector(`[data-crsm-report-asset="${cssEscape(key)}"]`)) return;
    const copy = document.createElement('link');
    for (const attr of link.attributes) copy.setAttribute(attr.name, attr.value);
    copy.dataset.crsmReportAsset = key;
    document.head.appendChild(copy);
  });

  const scripts = [...parsed.head.querySelectorAll('script'), ...body.querySelectorAll('script')];
  const scriptQueue = scripts.map(script => ({
    src: script.getAttribute('src'),
    text: script.textContent || ''
  }));

  [...body.childNodes].forEach(node => {
    if (node.nodeName === 'SCRIPT') return;
    host.appendChild(document.importNode(node, true));
  });

  frame.replaceWith(host);
  localizeReport(host);
  runScriptsInOrder(scriptQueue, host);
}

function runScriptsInOrder(queue, host) {
  if (!queue.length) return;
  let index = 0;

  const next = () => {
    if (index >= queue.length) {
      localizeReport(host);
      return;
    }
    const item = queue[index++];
    if (item.src) {
      const existing = document.querySelector(`script[src="${cssEscape(item.src)}"][data-crsm-report-asset="${ASSET_MARK}-script"]`);
      if (existing) return next();
      const script = document.createElement('script');
      script.src = item.src;
      script.async = false;
      script.dataset.crsmReportAsset = `${ASSET_MARK}-script`;
      script.onload = () => { localizeReport(host); next(); };
      script.onerror = next;
      document.head.appendChild(script);
    } else {
      try {
        const script = document.createElement('script');
        script.textContent = item.text;
        script.dataset.crsmReportAsset = `${ASSET_MARK}-inline`;
        document.head.appendChild(script);
        script.remove();
      } catch (error) {
        console.warn('[CRSM] Report inline script failed:', error);
      }
      localizeReport(host);
      next();
    }
  };

  next();
}

function scopeBodyRule(css) {
  return String(css || '').replace(/(^|})\s*body\s*\{/g, '$1.crsm-report-host{');
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/(["\\])/g, '\\$1');
}

function scan(root = document) {
  root.querySelectorAll?.(FRAME_SELECTOR).forEach(mountReportFrame);
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.(FRAME_SELECTOR)) mountReportFrame(node);
      scan(node);
    });
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
scan();
