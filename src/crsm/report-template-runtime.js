// CRSM Report Template Runtime
// The Node 6A HTML template is locked. This runtime only makes the host iframe
// capable of executing the template's own Tailwind/font bootstrap scripts.
// It does not alter report HTML, DOM structure, classes, or content.

const FRAME_SELECTOR = 'iframe.crsm-report-frame';
const PATCHED_ATTR = 'data-crsm-template-runtime';

function patchReportFrame(frame) {
  if (!frame || frame.getAttribute(PATCHED_ATTR) === '1') return;

  const srcdoc = frame.getAttribute('srcdoc') || frame.srcdoc || '';
  if (!srcdoc) return;

  // The report template intentionally contains its own Tailwind/font bootstrap.
  // A bare sandbox attribute disables scripts, which leaves Tailwind classes
  // unstyled and makes the locked template look like raw HTML.
  const replacement = document.createElement('iframe');
  for (const attr of frame.attributes) {
    if (attr.name === 'sandbox' || attr.name === 'srcdoc') continue;
    replacement.setAttribute(attr.name, attr.value);
  }
  replacement.setAttribute('sandbox', 'allow-scripts');
  replacement.setAttribute(PATCHED_ATTR, '1');
  replacement.srcdoc = srcdoc;
  frame.replaceWith(replacement);
}

function scan(root = document) {
  root.querySelectorAll?.(FRAME_SELECTOR).forEach(patchReportFrame);
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches?.(FRAME_SELECTOR)) patchReportFrame(node);
      scan(node);
    });
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
scan();
