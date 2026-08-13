const STYLE_ID = 'crsm-settings-polish';

if (!document.getElementById(STYLE_ID)) {
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Settings: centered, compact, aligned. */
    .settings-panel {
      width: min(1120px, calc(100% - 32px));
      margin-left: auto;
      margin-right: auto;
    }

    /* Keep the execution policy readable without repeating implementation details. */
    .settings-panel .execution-policy-card {
      padding: 14px 16px;
    }
    .settings-panel .execution-policy-head > div > .muted,
    .settings-panel .execution-policy-note {
      display: none;
    }
    .settings-panel .settings-section-head > div > p.muted {
      display: none;
    }

    /* Model assignment rows stay aligned across every function. */
    .settings-panel .assignment {
      display: grid;
      grid-template-columns: minmax(230px, 1fr) minmax(170px, 0.8fr) minmax(220px, 1fr) 72px;
      align-items: center;
      column-gap: 14px;
      row-gap: 8px;
    }
    .settings-panel .assignment .assignment-title,
    .settings-panel .assignment .settings-label,
    .settings-panel .assignment .settings-check {
      min-width: 0;
      margin: 0;
    }
    .settings-panel .assignment .settings-check {
      justify-self: stretch;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      white-space: nowrap;
      min-height: 40px;
    }
    .settings-panel .assignment .settings-check input {
      margin: 0;
    }

    /* Make the three execution choices sit on one clean line. */
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
        grid-template-columns: minmax(180px, 1fr) minmax(160px, 1fr) minmax(200px, 1fr) 64px;
      }
    }

    @media (max-width: 720px) {
      .settings-panel {
        width: min(100% - 16px, 680px);
      }
      .settings-panel .assignment {
        grid-template-columns: 1fr;
      }
      .settings-panel .assignment .settings-check {
        justify-self: start;
        justify-content: flex-start;
      }
    }
  `;
  document.head.appendChild(style);
}
