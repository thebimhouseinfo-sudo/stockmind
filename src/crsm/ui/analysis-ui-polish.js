const STYLE_ID = 'crsm-analysis-ui-polish';

export function ensureAnalysisUiPolish() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Keep the center pipeline aligned to the left rail; right rail remains content-driven. */
    .crsm-main-grid{align-items:stretch!important}
    .crsm-left-rail,.crsm-pipeline-card{align-self:stretch!important}
    .crsm-right-rail{align-self:start!important;height:auto!important}
    .crsm-pipeline-card{height:100%!important;display:flex;flex-direction:column}
    .crsm-tree{flex:1 1 auto}

    .crsm-hero h2{font-size:27px!important;line-height:1.16!important;color:#132341}
    .crsm-activity-card .crsm-side-title{font-size:11px!important;letter-spacing:.05em;font-weight:950;color:#183e77}

    /* The small dependency reminder is redundant with the pipeline structure. */
    .crsm-pipeline-note{display:none!important}

    /* Replace the placeholder glyph with a proper paper-plane action icon. */
    .crsm-dashboard-run{font-size:0!important;gap:0!important}
    .crsm-dashboard-run::before{content:'➤';font-size:16px;line-height:1;margin-right:7px;transform:rotate(-10deg);display:inline-block}
    .crsm-dashboard-run::after{content:'Phân tích bằng CRSM';font-size:10px;line-height:1;font-weight:850}

    @media(max-width:760px){
      .crsm-hero h2{font-size:22px!important}
      .crsm-left-rail,.crsm-pipeline-card{height:auto!important}
      .crsm-activity-card .crsm-side-title{font-size:10px!important}
      .crsm-dashboard-run::after{font-size:11px}
    }
  `;
  document.head.appendChild(style);
}
