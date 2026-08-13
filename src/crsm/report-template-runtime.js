// CRSM Report Template Runtime
// The Node 6A report template remains locked. This runtime only mounts the
// already-rendered template directly into the Reports page instead of an iframe.

const FRAME_SELECTOR = 'iframe.crsm-report-frame';
const HOST_CLASS = 'crsm-report-host';
const ASSET_MARK = 'data-crsm-report-asset';

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

  // Keep the locked template's own styles, but scope its body rule to the
  // report host so the application shell is not restyled by the report.
  parsed.querySelectorAll('style').forEach((style, index) => {
    const copy = document.createElement('style');
    copy.dataset.crsmReportAsset = `${ASSET_MARK}-style-${index}`;
    copy.textContent = scopeBodyRule(style.textContent || '');
    host.appendChild(copy);
  });

  // External fonts/resources declared by the template are mounted once.
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

  // The report's Tailwind bootstrap must execute in document context so its
  // utility classes style the directly-mounted template. Scripts are copied
  // in source order and deduplicated by src.
  const scripts = [...parsed.head.querySelectorAll('script'), ...body.querySelectorAll('script')];
  const scriptQueue = scripts.map(script => ({
    src: script.getAttribute('src'),
    text: script.textContent || ''
  }));

  // Move only visual/body nodes into the host; do not recreate the report's
  // <html>/<head>/<body> wrappers.
  [...body.childNodes].forEach(node => {
    if (node.nodeName === 'SCRIPT') return;
    host.appendChild(document.importNode(node, true));
  });

  frame.replaceWith(host);
  runScriptsInOrder(scriptQueue);
}

function runScriptsInOrder(queue) {
  if (!queue.length) return;
  let index = 0;

  const next = () => {
    if (index >= queue.length) return;
    const item = queue[index++];
    if (item.src) {
      const existing = document.querySelector(`script[src="${cssEscape(item.src)}"][data-crsm-report-asset="${ASSET_MARK}-script"]`);
      if (existing) return next();
      const script = document.createElement('script');
      script.src = item.src;
      script.async = false;
      script.dataset.crsmReportAsset = `${ASSET_MARK}-script`;
      script.onload = next;
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
