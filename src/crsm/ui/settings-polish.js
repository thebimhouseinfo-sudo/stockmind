const STYLE_ID = 'crsm-settings-polish';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Settings: centered within the available page, not pinned to the left. */
    .settings-panel {
      width: min(1120px, calc(100% - 32px)) !important;
      max-width: 1120px !important;
      margin-left: auto !important;
      margin-right: auto !important;
      justify-self: center !important;
      box-sizing: border-box;
    }

    /* Remove any accidental highlight/mark treatment from the settings UI. */
    .settings-panel mark,
    .settings-panel .highlight,
    .settings-panel [data-highlight] {
      background: transparent !important;
      color: inherit !important;
      box-shadow: none !important;
    }

    /* Compact execution policy without extra explanatory text. */
    .settings-panel .execution-policy-card {
      padding: 14px 16px;
    }
    .settings-panel .execution-policy-head > div > .muted,
    .settings-panel .execution-policy-note,
    .settings-panel .settings-section-head > div > p.muted {
      display: none !important;
    }

    /* Model assignment rows: fixed columns so the enable controls line up exactly. */
    .settings-panel .assignment {
      display: grid !important;
      grid-template-columns: minmax(230px, 1fr) minmax(170px, 0.8fr) minmax(220px, 1fr) 64px !important;
      align-items: center !important;
      column-gap: 14px;
      row-gap: 8px;
    }
    .settings-panel .assignment .assignment-title,
    .settings-panel .assignment .settings-label,
    .settings-panel .assignment .settings-check {
      min-width: 0;
      margin: 0 !important;
    }
    .settings-panel .assignment .settings-check {
      width: 64px !important;
      height: 40px !important;
      min-height: 40px !important;
      justify-self: end !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px;
      white-space: nowrap;
      box-sizing: border-box;
    }
    .settings-panel .assignment .settings-check input {
      width: auto !important;
      height: auto !important;
      margin: 0 !important;
      flex: 0 0 auto;
    }
    .settings-panel .assignment .settings-check label {
      margin: 0 !important;
      line-height: 1 !important;
      white-space: nowrap;
    }

    /* Execution choices remain on one clean line. */
    .settings-panel .execution-policy-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .settings-panel .policy-option {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 34px;
      padding: 0 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f8fafc;
      white-space: nowrap;
    }

    @media (max-width: 900px) {
      .settings-panel .assignment {
        grid-template-columns: minmax(180px, 1fr) minmax(160px, 1fr) minmax(200px, 1fr) 64px !important;
      }
    }

    @media (max-width: 720px) {
      .settings-panel {
        width: min(100% - 16px, 680px) !important;
      }
      .settings-panel .assignment {
        grid-template-columns: 1fr !important;
      }
      .settings-panel .assignment .settings-check {
        width: auto !important;
        justify-self: start !important;
        justify-content: flex-start !important;
      }
    }
  `;
  document.head.appendChild(style);
}
