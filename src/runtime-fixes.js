import { runCRSM } from './crsm/engine.js';
import { buildScreeningContext } from './crsm/context.js';
import { crsmState, notifyCRSM } from './crsm/state.js';

const DATASET_KEY = 'stock-mind.dataset.v1';
const app = document.getElementById('app');

function getRows() {
  try {
    const raw = localStorage.getItem(DATASET_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function showRuntimeError(error) {
  crsmState.isRunning = false;
  crsmState.error = { node: null, message: String(error?.message || error) };
  crsmState.logRows = [...(crsmState.logRows || []), `✖ launch failed: ${error?.message || error}`];
  notifyCRSM();
}

function findStock(ticker) {
  const symbol = String(ticker || '').trim().toUpperCase();
  return getRows().find(row => String(row?.TICKER || '').trim().toUpperCase() === symbol) || null;
}

async function launchScreened(ticker) {
  const stock = findStock(ticker);
  if (!stock) {
    showRuntimeError(new Error(`Không tìm thấy dữ liệu screening cho mã ${ticker}.`));
    return;
  }

  const crsmTab = app?.querySelector('[data-tab="crsm"]');
  if (!crsmTab) {
    showRuntimeError(new Error('Không tìm thấy tab CRSM.'));
    return;
  }

  crsmTab.click();
  await runCRSM({
    mode: 'SCREENED',
    ticker: String(ticker).trim().toUpperCase(),
    screeningContext: buildScreeningContext(stock)
  });
}

async function launchDirect() {
  const input = app?.querySelector('#crsmTickerInput');
  const ticker = String(input?.value || '').trim().toUpperCase();
  if (!ticker) {
    input?.focus();
    showRuntimeError(new Error('Hãy nhập mã cổ phiếu trước khi phân tích.'));
    return;
  }

  try {
    await runCRSM({ mode: 'DIRECT', ticker, screeningContext: null });
  } catch (error) {
    showRuntimeError(error);
  }
}

function filterRanking(input) {
  const query = String(input?.value || '').trim().toLowerCase();
  const table = app?.querySelector('.table-wrap table');
  if (!table) return;

  const rows = [...table.querySelectorAll('tbody tr')];
  let visible = 0;
  rows.forEach(row => {
    const ticker = row.querySelector('[data-crsm]')?.textContent?.toLowerCase() || '';
    const cells = row.querySelectorAll('td');
    const industry = cells[3]?.textContent?.toLowerCase() || '';
    const match = !query || ticker.includes(query) || industry.includes(query);
    row.hidden = !match;
    if (match) visible += 1;
  });

  const heading = app?.querySelector('.toolbar h2');
  if (heading) heading.textContent = `${visible} mã`;
}

if (app) {
  app.addEventListener('click', event => {
    const direct = event.target?.closest?.('[data-crsm-direct]');
    if (direct) {
      event.preventDefault();
      event.stopImmediatePropagation();
      void launchDirect();
      return;
    }

    const ticker = event.target?.closest?.('[data-crsm]');
    if (ticker && !event.target?.closest?.('[data-select-ticker]')) {
      const symbol = ticker.dataset.crsm;
      event.preventDefault();
      event.stopImmediatePropagation();
      void launchScreened(symbol).catch(showRuntimeError);
    }
  }, true);

  app.addEventListener('input', event => {
    const input = event.target?.closest?.('#searchInput');
    if (!input) return;
    event.stopImmediatePropagation();
    filterRanking(input);
  }, true);
}
