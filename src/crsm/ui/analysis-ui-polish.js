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

    /* Cleaner labels. The highlighted phrases in the screenshot are annotations, not UI state. */
    .crsm-hero h2{font-size:0!important}
    .crsm-hero h2::after{content:'Phân tích chuyên sâu';font-size:27px;line-height:1.2;color:#132341}
    .crsm-side-title{white-space:normal}

    /* Replace the placeholder glyph with a proper paper-plane action icon. */
    .crsm-dashboard-run{font-size:0!important;gap:0!important}
    .crsm-dashboard-run::before{content:'➤';font-size:16px;line-height:1;margin-right:7px;transform:rotate(-10deg);display:inline-block}
    .crsm-dashboard-run::after{content:'Phân tích bằng CRSM';font-size:10px;line-height:1;font-weight:850}

    /* Keep the pipeline footer subtle and prevent it from making the card feel oversized. */
    .crsm-pipeline-note{flex:0 0 auto}

    @media(max-width:760px){
      .crsm-hero h2::after{font-size:22px}
      .crsm-left-rail,.crsm-pipeline-card{height:auto!important}
      .crsm-dashboard-run::after{font-size:11px}
    }
  `;
  document.head.appendChild(style);
}
