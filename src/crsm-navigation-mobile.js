import { renderSettings, bindSettingsEvents } from './crsm/ui/settings.js';

const STYLE_ID = 'crsm-navigation-mobile-style';

const style = document.createElement('style');
style.id = STYLE_ID;
style.textContent = `
  .brand { display: none !important; }
  .topbar-inner { justify-content: center !important; padding: 10px 12px !important; }
  .topbar .tabs { max-width: 100%; overflow-x: auto; scrollbar-width: none; justify-content: center; }
  .topbar .tabs::-webkit-scrollbar { display: none; }
  .topbar .tab { flex: 0 0 auto; }
  .topbar #openSettings { display: none !important; }

  .crsm-subnav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    overflow-x: auto;
    scrollbar-width: none;
    margin-bottom: 18px;
    padding: 4px;
    background: #eef3fb;
    border-radius: 10px;
  }
  .crsm-subnav::-webkit-scrollbar { display: none; }
  .crsm-subtab {
    flex: 0 0 auto;
    padding: 9px 16px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
    white-space: nowrap;
    cursor: pointer;
  }
  .crsm-subtab.active,
  .crsm-subtab.settings-active {
    background: #fff;
    color: var(--blue);
    box-shadow: 0 1px 4px rgba(23,32,51,.08);
  }

  .crsm-shell.settings-view-open > .crsm-analysis-page,
  .crsm-shell.settings-view-open > .reports-page { display: none !important; }
  .crsm-inline-settings { width: 100%; }
  .crsm-inline-settings .settings-panel { width: 100%; margin: 0; }

  @media (max-width: 600px) {
    .topbar-inner { padding: 8px !important; }
    .topbar .tabs { width: 100%; justify-content: center; padding: 4px; }
    .topbar .tab { padding: 9px 12px; font-size: 12px; }
    .crsm-shell { width: 100%; min-width: 0; }
    .crsm-subnav { justify-content: center; margin-left: 0; margin-right: 0; }
    .crsm-subtab { padding: 9px 14px; }
  }
`;
document.head.appendChild(style);

function closeInlineSettings() {
  document.getElementById('crsmInlineSettings')?.remove();
  document.querySelector('.crsm-shell')?.classList.remove('settings-view-open');
  document.querySelector('[data-crsm-settings]')?.classList.remove('settings-active');
}

function openInlineSettings() {
  const shell = document.querySelector('.crsm-shell');
  const subnav = shell?.querySelector('.crsm-subnav');
  if (!shell || !subnav) return;
  if (document.getElementById('crsmInlineSettings')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'crsmInlineSettings';
  wrapper.className = 'crsm-inline-settings';
  wrapper.innerHTML = renderSettings();
  shell.appendChild(wrapper);
  shell.classList.add('settings-view-open');
  subnav.querySelector('[data-crsm-settings]')?.classList.add('settings-active');
  bindSettingsEvents();
  wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function enhanceCRSMNavigation() {
  const shell = document.querySelector('.crsm-shell');
  const subnav = shell?.querySelector('.crsm-subnav');
  if (!shell || !subnav) return;

  let button = subnav.querySelector('[data-crsm-settings]');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'crsm-subtab';
    button.setAttribute('data-crsm-settings', '1');
    button.textContent = 'Settings';
    subnav.appendChild(button);
  }

  const open = !!document.getElementById('crsmInlineSettings');
  shell.classList.toggle('settings-view-open', open);
  button.classList.toggle('settings-active', open);
}

document.addEventListener('click', event => {
  const settings = event.target.closest?.('[data-crsm-settings]');
  if (settings) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openInlineSettings();
    return;
  }

  const close = event.target.closest?.('#crsmSettingsClose');
  if (close && document.getElementById('crsmInlineSettings')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeInlineSettings();
    return;
  }

  const crsmView = event.target.closest?.('[data-crsm-view]');
  if (crsmView && document.getElementById('crsmInlineSettings')) {
    closeInlineSettings();
  }

  const topTab = event.target.closest?.('[data-tab]');
  if (topTab && document.getElementById('crsmInlineSettings')) {
    closeInlineSettings();
  }
}, true);

const observer = new MutationObserver(() => {
  requestAnimationFrame(enhanceCRSMNavigation);
});
observer.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhanceCRSMNavigation, { once: true });
} else {
  enhanceCRSMNavigation();
}
