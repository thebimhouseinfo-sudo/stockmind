// Export the rendered Mapping table as a single PNG image.
const BUTTON_ID = 'mappingExportPng';

function addExportButton() {
  const page = document.querySelector('.mapping-preview-page');
  if (!page || document.getElementById(BUTTON_ID)) return;
  const head = page.querySelector('.mapping-preview-head');
  if (!head) return;
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.className = 'btn';
  button.textContent = 'Xuất bảng PNG';
  button.addEventListener('click', exportTable);
  const meta = page.querySelector('.mapping-preview-meta');
  (meta || head).appendChild(button);
}

function copyStyles(source, target) {
  const sourceNodes = [source, ...source.querySelectorAll('*')];
  const targetNodes = [target, ...target.querySelectorAll('*')];
  sourceNodes.forEach((node, i) => {
    const out = targetNodes[i];
    if (!out || node.nodeType !== 1) return;
    const computed = getComputedStyle(node);
    let style = '';
    for (const name of computed) style += `${name}:${computed.getPropertyValue(name)};`;
    out.setAttribute('style', style);
  });
}

async function exportTable() {
  const table = document.querySelector('.mapping-preview-page .mapping-table');
  const button = document.getElementById(BUTTON_ID);
  if (!table) return;
  if (button) { button.disabled = true; button.textContent = 'Đang tạo ảnh…'; }
  try {
    const clone = table.cloneNode(true);
    copyStyles(table, clone);
    const width = Math.ceil(table.scrollWidth || table.getBoundingClientRect().width);
    const height = Math.ceil(table.scrollHeight || table.getBoundingClientRect().height);
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.maxWidth = 'none';
    clone.style.maxHeight = 'none';
    const wrapper = document.createElement('div');
    wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    wrapper.style.width = `${width}px`;
    wrapper.style.height = `${height}px`;
    wrapper.appendChild(clone);
    const html = new XMLSerializer().serializeToString(wrapper);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = svgUrl; });
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(svgUrl);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('PNG creation failed');
    const url = URL.createObjectURL(png);
    const link = document.createElement('a');
    link.href = url;
    link.download = `stockmind-mapping-${new Date().toISOString().slice(0,10)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('[Mapping Export]', error);
    alert('Không thể xuất bảng thành ảnh PNG trên trình duyệt này.');
  } finally {
    if (button) { button.disabled = false; button.textContent = 'Xuất bảng PNG'; }
  }
}

function boot() {
  addExportButton();
  new MutationObserver(addExportButton).observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
