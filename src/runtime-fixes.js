const app = document.getElementById('app');

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
  app.addEventListener('input', event => {
    const input = event.target?.closest?.('#searchInput');
    if (!input) return;
    event.stopImmediatePropagation();
    filterRanking(input);
  }, true);
}
