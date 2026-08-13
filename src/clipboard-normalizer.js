// Normalize TradingView markdown copied from the browser before parser.js sees it.
// Some clipboard implementations omit the final empty Markdown cell (`|   |`),
// turning TradingView's 49-cell rows into 48-cell rows. parser.js historically
// expected the trailing empty cell, which caused the legacy watchlist fallback
// to mis-map Sector/Industry/Price.

const originalReadText = navigator.clipboard?.readText?.bind(navigator.clipboard);

if (originalReadText) {
  navigator.clipboard.readText = async function normalizedReadText() {
    const text = await originalReadText();
    return normalizeTradingViewMarkdownClipboard(text);
  };
}

function normalizeTradingViewMarkdownClipboard(text) {
  return String(text || '').split(/\r?\n/).map(line => {
    const trimmed = line.trim();
    if (!/^\|/.test(trimmed) || !trimmed.includes('|')) return line;

    const withoutLeading = trimmed.slice(1);
    const withoutOuter = withoutLeading.endsWith('|')
      ? withoutLeading.slice(0, -1)
      : withoutLeading;
    const cells = withoutOuter.split('|');

    // TradingView's current screener Markdown has 48 real columns plus
    // one trailing empty cell. Restore that empty cell when clipboard text
    // has been normalized to 48 cells by the browser.
    if (cells.length === 48) return `${trimmed}|   |`;
    return line;
  }).join('\n');
}
