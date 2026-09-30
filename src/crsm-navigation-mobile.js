const STYLE_ID = 'crsm-navigation-mobile-style';

const style = document.createElement('style');
style.id = STYLE_ID;
style.textContent = `
  .brand { display: none !important; }
  .topbar-inner { position: relative; justify-content: center !important; padding: 10px 12px !important; }
  .topbar .tabs { max-width: 100%; overflow: visible; scrollbar-width: none; justify-content: center; }
  .topbar .tabs::-webkit-scrollbar { display: none; }
  .topbar .tab { flex: 0 0 auto; }

  /* CRSM keeps exactly two user-facing pages: Analysis List and Results. */
  .crsm-subnav { display: none !important; }
  .crsm-menu {
    position: absolute;
    z-index: 1000;
    width: 188px;
    padding: 6px;
    border: 1px solid #e3e9f2;
    border-radius: 12px;
    background: rgba(255,255,255,.98);
    box-shadow: 0 14px 34px rgba(23,32,51,.14), 0 2px 8px rgba(23,32,51,.06);
    backdrop-filter: blur(12px);
  }
  .crsm-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 42px;
    padding: 9px 11px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--ink);
    font-size: 13px;
    font-weight: 800;
    text-align: left;
    cursor: pointer;
  }
  .crsm-menu-item:hover { background: #f2f6fd; color: var(--blue); }
  .crsm-menu-item.active { background: #edf4ff; color: var(--blue); }
  .crsm-menu-item .crsm-menu-icon { width: 18px; text-align: center; color: var(--blue); font-size: 15px; }
  .crsm-menu-item + .crsm-menu-item { margin-top: 2px; }

  @media (max-width: 600px) {
    .topbar-inner { padding: 8px !important; }
    .topbar .tabs { width: 100%; justify-content: center; padding: 4px; overflow-x: auto; }
    .topbar .tab { padding: 9px 12px; font-size: 12px; }
    .crsm-shell { width: 100%; min-width: 0; }
    .crsm-menu { width: 176px; }
  }
`;
document.head.appendChild(style);

let crsmMenu = null;
let menuOpen = false;

function getCRSMTab() {
  return document.querySelector('.topbar [data-tab="crsm"]');
}

function positionCRSMMenu() {
  if (!crsmMenu) return;
  const tab = getCRSMTab();
  const host = document.querySelector('.topbar-inner');
  if (!tab || !host) return;
  const tabRect = tab.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const left = tabRect.left - hostRect.left + (tabRect.width / 2) - (crsmMenu.offsetWidth / 2);
  crsmMenu.style.left = `${Math.max(6, Math.min(left, hostRect.width - crsmMenu.offsetWidth - 6))}px`;
  crsmMenu.style.top = `${tabRect.bottom - hostRect.top + 8}px`;
}

function closeCRSMMenu() {
  crsmMenu?.remove();
  crsmMenu = null;
  menuOpen = false;
}

function menuButton(label, icon, action, active = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `crsm-menu-item${active ? ' active' : ''}`;
  button.innerHTML = `<span class="crsm-menu-icon">${icon}</span><span>${label}</span>`;
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    action();
    closeCRSMMenu();
  });
  return button;
}

function openCRSMMenu() {
  const host = document.querySelector('.topbar-inner');
  const tab = getCRSMTab();
  const shell = document.querySelector('.crsm-shell');
  if (!host || !tab || !shell || menuOpen) return;

  crsmMenu = document.createElement('div');
  crsmMenu.className = 'crsm-menu';
  crsmMenu.setAttribute('role', 'menu');
  const activeView = shell.querySelector('.analysis-list-page')
    ? 'analysis'
    : shell.querySelector('.results-page')
      ? 'reports'
      : 'analysis';

  crsmMenu.appendChild(menuButton('Analysis List', 'A', () => {
    document.querySelector('.crsm-subnav [data-crsm-view="analysis"]')?.click();
  }, activeView === 'analysis'));
  crsmMenu.appendChild(menuButton('Results', 'R', () => {
    document.querySelector('.crsm-subnav [data-crsm-view="reports"]')?.click();
  }, activeView === 'reports'));

  host.appendChild(crsmMenu);
  menuOpen = true;
  positionCRSMMenu();
}

function toggleCRSMMenu() {
  if (menuOpen) closeCRSMMenu();
  else openCRSMMenu();
}

document.addEventListener('click', event => {
  const topTab = event.target.closest?.('[data-tab]');
  if (topTab?.dataset.tab === 'crsm') {
    if (topTab.classList.contains('active')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleCRSMMenu();
      return;
    }
    closeCRSMMenu();
  } else if (topTab && menuOpen) {
    closeCRSMMenu();
  }
}, true);

document.addEventListener('click', event => {
  if (!menuOpen) return;
  if (event.target.closest?.('.crsm-menu') || event.target.closest?.('[data-tab="crsm"]')) return;
  closeCRSMMenu();
}, false);

window.addEventListener('resize', positionCRSMMenu);
window.addEventListener('scroll', positionCRSMMenu, true);

const observer = new MutationObserver(() => {
  requestAnimationFrame(() => {
    if (menuOpen && !document.querySelector('.crsm-shell')) closeCRSMMenu();
  });
});
observer.observe(document.body, { childList: true, subtree: true });
