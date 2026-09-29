import { parseTradingViewPaste } from './parser.js';
import { buildPrompt, buildStats, scoreStocks } from './scoring.js';
import { crsmState, subscribeCRSM } from './crsm/state.js';
import { buildScreeningContext } from './crsm/context.js';
import { runCRSM } from './crsm/engine.js';
import { updateDynamicRegion } from './crsm/ui/index.js';
import {
  addManualTicker,
  addScreenedTicker,
  attachDocuments,
  buildSubmission,
  clearDraft,
  loadDraft,
  removeDocument,
  removeItem,
  saveDraft
} from './crsm/draft-list.js';
import {
  fetchMemoCurrent,
  fetchMemoHistory,
  fetchMemoMaintenance,
  fetchMemoRun,
  isActiveMemoRun,
  repairMemoHistory,
  retryMemoItem,
  submitMemoRun
} from './crsm/memo-client.js';
import { bindAnalysisListPage, renderAnalysisListPage } from './crsm/ui/analysis-list.js';
import { bindResultsPage, renderResultsPage } from './crsm/ui/results.js';
import {
  normalizeMemoRun,
  selectDefaultTicker,
  selectedRunItem
} from './crsm/result-adapter.js';
import { createResultsPoller } from './crsm/results-poller.js';
import { extractUserEvidence } from './crsm/user-evidence.js';
import { loadLog } from './crsm/nodes/node7.js';
import { downloadReportImage, downloadWordReport, downloadWordReportFromMarkdown, buildWordHtmlDocument } from './crsm/report-export.js';
import { decisionLabel } from './crsm/nodes/render-common.js';
import { encodeShareCode, decodeShareCode } from './share-code.js';

const STORAGE_KEY = 'stock-mind.dataset.v1';
let state = {
  tab:'import',
  crsmView:'analysis',
  reportTab:'html',
  pasteText:'',
  rows:loadRows(),
  errors:[],
  selectedTicker:null,
  selectedTickers:[],
  search:'',
  batchRunning:false,
  batchProgress:null,
  importStatus:null,
  shareStatus:null,
  crsmDraft:loadDraft(),
  memoCurrent:null,
  memoLoading:false,
  memoError:null,
  crsmNotice:null,
  crsmSubmitting:false,
  draftBusyItem:null,
  resultsCurrentRun:null,
  resultsHistory:[],
  resultsSelectedRun:null,
  resultsSelectedRunId:null,
  resultsSelectedTicker:null,
  resultsLoading:false,
  resultsError:null,
  resultsUpdatedAt:null,
  resultsRetryingItemId:null,
  resultsMaintenance:null,
  resultsRepairing:false
};
const app=document.getElementById('app');
const resultsPoller=createResultsPoller({poll:()=>refreshResults({background:true})});
document.addEventListener('stockmind:analyze-tickers',event=>analyzeDashboardTickers(event.detail?.tickers||[]));
subscribeCRSM(()=>{
  if (crsmState.completedAt && crsmState.finalReport && !crsmState.isRunning && !crsmState.failedNode && !crsmState.error) {
    if (state.tab === 'crsm') { state.crsmView='reports'; render(); return; }
  }
  if(state.tab==='crsm' && state.crsmView==='analysis') return;
  if(state.tab==='crsm' && state.crsmView==='reports') updateReportsRegion();
});
render();

function render(){
  const content=`${state.tab==='import'?renderImport():''}${state.tab==='dashboard'?renderDashboard():''}${state.tab==='list'?renderList():''}${state.tab==='detail'?renderDetail():''}${state.tab==='crsm'?renderCRSMSection():''}`;
  app.innerHTML=`<div class="shell">${renderTopbar()}<main class="main">${content}</main></div>`;
  bindEvents();
  syncResultsPolling();
}
function renderTopbar(){ const tabs=[['import','Screen'],['dashboard','Dashboard'],['list','Ranking'],['crsm','CRSM']]; return `<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-mark">↗</div><span>Stock Mind</span></div><nav class="tabs">${tabs.map(([id,label])=>`<button class="tab ${state.tab===id?'active':''}" data-tab="${id}">${label}</button>`).join('')}</nav></div></header>`; }
function renderCRSMSection(){
  const active=state.crsmView==='reports'?'reports':'analysis';
  return `<section class="crsm-shell">
    <div class="crsm-subnav" role="tablist" aria-label="CRSM pages">
      <button class="crsm-subtab ${active==='analysis'?'active':''}" data-crsm-view="analysis">Analysis List</button>
      <button class="crsm-subtab ${active==='reports'?'active':''}" data-crsm-view="reports">Results</button>
    </div>
    ${active==='reports'
      ? renderResultsPage({
          currentRun:state.resultsCurrentRun,
          history:state.resultsHistory,
          selectedRun:state.resultsSelectedRun,
          selectedTicker:state.resultsSelectedTicker,
          reportTab:state.reportTab,
          loading:state.resultsLoading,
          error:state.resultsError,
          updatedAt:state.resultsUpdatedAt,
          retryingItemId:state.resultsRetryingItemId,
          maintenance:state.resultsMaintenance,
          repairing:state.resultsRepairing
        })
      : renderAnalysisListPage({
          draft:state.crsmDraft,
          memoCurrent:state.memoCurrent,
          memoLoading:state.memoLoading,
          memoError:state.memoError,
          notice:state.crsmNotice,
          submitting:state.crsmSubmitting,
          busyItemId:state.draftBusyItem
        })}
  </section>`;
}
function renderImport(){ const status=state.importStatus||(state.rows.length?{count:state.rows.length,columns:null,time:null}:null); return `<section class="screen-page"><div class="screen-hero"><div class="screen-copy"><p class="eyebrow">Stock Screening</p><h1>From TradingView<br>to Stock Mind</h1><p class="screen-lead">Lọc cổ phiếu trên TradingView, copy toàn bộ bảng kết quả, rồi đưa thẳng vào Stock Mind.</p><div class="screen-actions screen-actions-row"><button class="btn primary screen-action" id="openTradingView">Open TradingView <span>↗</span></button><button class="btn screen-action" id="importClipboard">Import &amp; Screen</button></div><p class="screen-hint">TradingView → Ctrl+A → Ctrl+C → Import &amp; Screen</p><div class="screen-actions screen-actions-row screen-share-row"><button class="btn screen-action" id="exportShareCode" ${state.rows.length?'':'disabled'}>Share Screen</button><button class="btn screen-action" id="importShareCode">Import Screen</button><input id="shareFileInput" type="file" accept=".stockmind,.txt,application/json,text/plain" hidden></div>${state.shareStatus?`<p class="screen-share-status">${escapeHtml(state.shareStatus)}</p>`:''}${status?`<div class="screen-status"><strong>${status.count.toLocaleString('vi-VN')} mã</strong><span>${status.columns?`${status.columns} cột`:'Screening data'}${status.time?` · ${escapeHtml(status.time)}`:''}</span></div>`:''}${state.errors.length?`<div class="errors" style="margin-top:14px">${state.errors.map(escapeHtml).join('<br>')}</div>`:''}</div><div class="screen-visual" aria-hidden="true"><div class="screen-orbit orbit-one"></div><div class="screen-orbit orbit-two"></div><div class="screen-flow-card flow-tv"><div class="flow-card-top"><span class="flow-dot"></span><span>TRADINGVIEW</span></div><div class="mini-table"><i></i><i></i><i></i><i></i><i></i></div><div class="mini-bars"><b></b><b></b><b></b><b></b></div></div><div class="screen-flow-arrow">→</div><div class="screen-flow-card flow-rank"><div class="flow-card-top"><span class="flow-dot"></span><span>STOCK MIND</span></div><div class="rank-row"><strong>#01</strong><span>VCB</span><em>A+</em></div><div class="rank-row"><strong>#02</strong><span>HPG</span><em>A</em></div><div class="rank-row"><strong>#03</strong><span>HAH</span><em>A</em></div></div><div class="screen-flow-card flow-crsm"><div class="flow-card-top"><span class="flow-dot"></span><span>CRSM</span></div><div class="crsm-pulse"></div><small>Deep analysis</small></div><div class="screen-caption"><span>01</span> Copy your screen <span>02</span> Rank candidates <span>03</span> Analyze deeply</div></div></div></section>`; }
function renderDashboard(){ if(!state.rows.length)return emptyState(); const stats=buildStats(state.rows),industries=Object.entries(stats.industryCount).sort((a,b)=>b[1]-a[1]).slice(0,8),groups=['CORE','QUALITY_UNDERPERFORMER','HIGH_REWARD_HIGH_RISK','AVOID_VALUE_TRAP','WATCH_NEUTRAL']; return `<section class="grid"><div class="grid metrics">${metric('Tổng mã',stats.total)}${metric('Điểm V2 TB',fmt(stats.avgScore))}${metric('Ngành',Object.keys(stats.industryCount).length)}${metric('Registry',stats.screenerV2?.calibration_status||'SANDBOX')}</div><div class="grid two"><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Screener V2</p><h2>Top ranking sandbox</h2></div></div>${stats.top10.map(row=>stockLine(row)).join('')}</div><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Classification</p><h2>Nhóm đầu tư</h2></div></div>${groups.map(group=>`<div class="stock-line"><span>${classificationLabel(group)}</span><strong>${stats.classificationCount?.[group]||0} mã</strong></div>`).join('')}</div></div><div class="grid two"><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Industries</p><h2>Phân bổ ngành</h2></div></div>${industries.map(([name,count])=>`<div class="stock-line"><span>${escapeHtml(name)}</span><strong>${count} mã</strong></div>`).join('')}</div><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Boundary</p><h2>Sandbox calibration</h2></div></div><p class="muted">Screener V2 đã chạy đủ factor/axis/risk/classification/ranking. Các ngưỡng hiện là SANDBOX registry, chưa phải production calibration.</p></div></div></section>`; }
function renderList(){ if(!state.rows.length)return emptyState(); const rows=state.rows.filter(row=>{const q=state.search.trim().toLowerCase(); return !q||String(row.TICKER||'').toLowerCase().includes(q)||String(row.INDUSTRY||'').toLowerCase().includes(q)||String(row.SCREENING_GROUP||'').toLowerCase().includes(q)}); return `<section class="panel panel-pad"><div class="toolbar"><div><p class="eyebrow">Screener V2 Ranking</p><h2>${rows.length} mã</h2><p class="muted">Ranking chỉ để xem toàn bộ universe. Bấm ticker để thêm mã vào Analysis List; chọn nhiều mã ở Dashboard.</p></div><input class="search" id="searchInput" value="${escapeHtml(state.search)}" placeholder="Tìm ticker, ngành hoặc nhóm" autocomplete="off"></div><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Ticker</th><th>Nhóm</th><th>Industry</th><th>Price</th><th>Quality</th><th>Growth</th><th>Valuation</th><th>Safety</th><th>Momentum</th><th>Opportunity</th><th>V2 Score</th><th>Grade</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${row.RANK?`#${row.RANK}`:'-'}</td><td class="ticker"><button class="ticker-link" type="button" data-crsm="${escapeHtml(row.TICKER)}">${escapeHtml(row.TICKER)}</button>${renderFlags(row)}</td><td>${escapeHtml(classificationLabel(row.SCREENING_GROUP))}</td><td>${escapeHtml(row.INDUSTRY)}</td><td>${fmt(row.PRICE)}</td><td>${fmt(row.QUALITY_SCORE)}</td><td>${fmt(row.GROWTH_SCORE)}</td><td>${fmt(row.VALUATION_SCORE)}</td><td>${fmt(row.MICRO)}</td><td>${fmt(row.MOMENTUM)}</td><td>${fmt(row.MISPRICING)}</td><td><strong>${fmt(row.FINALSCORE)}</strong></td><td>${gradeBadge(row.GRADE)}</td></tr>`).join('')}</tbody></table></div></section>`; }
function renderDetail(){ const stock=state.rows.find(r=>r.TICKER===state.selectedTicker)||state.rows[0]; if(!stock)return emptyState(); const prompt=buildPrompt(stock),v2=stock.SCREENER_V2||{}; return `<section class="grid"><div class="detail-head"><div class="panel panel-pad"><p class="eyebrow">${escapeHtml(stock.INDUSTRY)} · ${escapeHtml(classificationLabel(stock.SCREENING_GROUP))}</p><h1>${stock.TICKER}</h1><div class="score-big">${fmt(stock.FINALSCORE)}</div><p>Rank ${stock.RANK?`#${stock.RANK}`:'-'} · ${gradeBadge(stock.GRADE)}</p><button class="btn primary" data-crsm="${stock.TICKER}">Add to Analysis List →</button></div><div class="panel panel-pad"><p class="eyebrow">Screener V2</p><div class="score-grid">${scoreCard('Quality',stock.QUALITY_SCORE)}${scoreCard('Safety',stock.MICRO)}${scoreCard('Growth',stock.GROWTH_SCORE)}${scoreCard('Valuation',stock.VALUATION_SCORE)}${scoreCard('Momentum',stock.MOMENTUM)}${scoreCard('Opportunity Axis',stock.MISPRICING)}</div><p class="muted">Risk Gate: ${escapeHtml(v2.risk_gate?.state||'-')} · Coverage: ${fmt(stock.DATA_COVERAGE)}%</p></div></div><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">Signals</p><h2>${escapeHtml(v2.classification?.reason||'Sandbox classification')}</h2></div></div><p class="muted">${escapeHtml((v2.signals||stock.DATA_FLAGS||[]).join(' · ')||'Không có signal nổi bật')}</p></div><div class="panel panel-pad"><div class="title-row"><div><p class="eyebrow">AI Prompt</p><h2>Prompt phân tích tối ưu</h2></div><button class="btn primary" id="copyPrompt">Copy prompt</button></div><textarea class="prompt" id="promptText" readonly>${escapeHtml(prompt)}</textarea></div></section>`; }
function renderReports(){
  const htmlReport = crsmState.finalReport || crsmState.nodeOutputs.node6a;
  const wordMarkdown = crsmState.nodeOutputs.node6b;
  const log = loadLog().rows || [];
  if (!htmlReport && !wordMarkdown && !log.length) return emptyState();

  const wordDoc = wordMarkdown ? buildWordHtmlDocument(wordMarkdown, crsmState.ticker) : null;
  const activeSrcdoc = state.reportTab === 'word'
    ? (wordDoc || '<div style="padding:24px;font-family:sans-serif">Chưa có Word Report (Node 6B).</div>')
    : (htmlReport || '<div style="padding:24px;font-family:sans-serif">Chưa có Visual Report.</div>');

  return `<section class="reports-page"><div class="reports-head"><div><p class="eyebrow">CRSM REPORT</p><h1>Báo cáo &amp; lịch sử · ${escapeHtml(crsmState.ticker||'')}</h1><p class="muted">Visual report, detailed export và decision log của CRSM.</p></div></div><div class="report-controls"><div class="report-tabs"><button class="report-tab ${state.reportTab==='html'?'active':''}" data-report-tab="html">Visual Report</button><button class="report-tab ${state.reportTab==='word'?'active':''}" data-report-tab="word">Detail Report</button><button class="report-tab ${state.reportTab==='log'?'active':''}" data-report-tab="log">Decision Log${log.length?` <span class="report-count">${log.length}</span>`:''}</button></div>${htmlReport||wordMarkdown?`<div class="report-export-actions"><button class="btn primary" id="crsmDownloadImage">Tải ảnh</button><button class="btn" id="crsmDownloadWord">Tải Word</button></div>`:''}</div>${state.reportTab==='log'?renderDecisionLog(log):`<div class="report-paper"><iframe class="crsm-report-frame" srcdoc="${escapeAttr(activeSrcdoc)}" sandbox></iframe></div>`}</section>`;
}
function renderDecisionLog(rows){ const columns=[['date','Ngày phân tích'],['ticker','Mã'],['mode','Chế độ'],['price_at_analysis','Giá tại thời điểm PT'],['screen_score','Screen Score'],['screen_rank','Screen Rank'],['screen_grade','Screen Grade'],['decision','Quyết định'],['ai_score','AI Score'],['confidence','Confidence'],['score_difference','CRSM−Screen Diff'],['entry_zone','Entry'],['trading_stop','Trading Stop'],['tp1','TP1'],['tp2','TP2'],['thesis_invalidation','Điều kiện vô hiệu hóa']]; return `<div class="panel panel-pad decision-log-panel"><div class="title-row"><div><p class="eyebrow">DECISION LOG</p><h2>${rows.length} lần phân tích</h2><p class="muted">Append-only history · DIRECT dùng — cho các trường không áp dụng.</p></div></div>${rows.length?`<div class="table-wrap decision-log-wrap"><table class="decision-log-table"><thead><tr>${columns.map(([,label])=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(([key])=>`<td>${formatLogValue(row[key],key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Chưa có decision log.</div>'}</div>`; }
function formatLogValue(value,key){ if(value==null||value==='')return '—'; if(key==='decision')return escapeHtml(decisionLabel(value)); if(typeof value==='number')return Number.isFinite(value)?value.toLocaleString('vi-VN',{maximumFractionDigits:2}):'—'; return escapeHtml(String(value)); }
function updateReportsRegion(){ if(state.tab==='crsm'&&state.crsmView==='reports') render(); }
function bindEvents(){ document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;if(state.tab==='crsm'){state.crsmView='analysis';render();void refreshMemoCurrent();return;}render();})); document.querySelectorAll('[data-crsm-view]').forEach(b=>b.addEventListener('click',()=>{state.crsmView=b.dataset.crsmView;render();if(state.crsmView==='analysis')void refreshMemoCurrent();})); document.querySelectorAll('[data-report-tab]').forEach(b=>b.addEventListener('click',()=>{state.reportTab=b.dataset.reportTab;render();})); document.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();state.selectedTicker=b.dataset.detail;state.tab='detail';render();})); document.querySelectorAll('[data-crsm]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();launchScreenedCRSM(b.dataset.crsm);})); document.querySelectorAll('[data-select-ticker]').forEach(i=>i.addEventListener('change',e=>toggleSelectedTicker(e.target.dataset.selectTicker,e.target.checked))); bind('openTradingView','click',()=>window.open('https://www.tradingview.com/screener/','_blank','noopener,noreferrer')); bind('importClipboard','click',importFromClipboard); bind('exportShareCode','click',exportShareCode); bind('importShareCode','click',()=>document.getElementById('shareFileInput')?.click()); bind('copyPrompt','click',copyPrompt); bind('crsmRunDirect','click',runDirectCRSM); bind('selectAllCRSM','change',e=>selectVisible(e.target.checked)); bind('selectVisibleCRSM','click',selectAllVisibleToggle); bind('clearSelectedCRSM','click',()=>{state.selectedTickers=[];render();}); bind('runSelectedCRSM','click',runSelectedCRSM); bind('crsmDownloadImage','click',async()=>downloadReportImage(crsmState.finalReport||crsmState.nodeOutputs.node6a,crsmState.ticker)); bind('crsmDownloadWord','click',()=>{ const md=crsmState.nodeOutputs.node6b; if(md){ downloadWordReportFromMarkdown(md,crsmState.ticker); } else { downloadWordReport(crsmState.finalReport||crsmState.nodeOutputs.node6a,crsmState.ticker); } }); bindAnalysisListBindings(); bindResultsBindings(); const shareFileInput=document.getElementById('shareFileInput'); if(shareFileInput)shareFileInput.addEventListener('change',importShareCodeFile); const crsmTickerInput=document.getElementById('crsmTickerInput'); if(crsmTickerInput)crsmTickerInput.addEventListener('keydown',e=>{if(e.key==='Enter')runDirectCRSM();}); const searchInput=document.getElementById('searchInput'); if(searchInput)searchInput.addEventListener('input',e=>{const value=e.target.value,s=e.target.selectionStart??value.length;state.search=value;render();const next=document.getElementById('searchInput');if(next){next.focus();try{next.setSelectionRange(s,s)}catch{}}}); }
function bind(id,event,handler){const n=document.getElementById(id);if(n)n.addEventListener(event,handler)}
async function importFromClipboard(){state.errors=[];try{if(!navigator.clipboard?.readText)throw new Error('Trình duyệt không hỗ trợ đọc Clipboard.');const text=await navigator.clipboard.readText();if(!text.trim())throw new Error('Clipboard đang trống.');const result=parseTradingViewPaste(text);state.errors=result.errors;if(result.errors.length||!result.rows.length){state.importStatus=null;render();return;}state.pasteText=text;state.rows=scoreStocks(result.rows);state.selectedTicker=state.rows[0]?.TICKER||null;state.selectedTickers=[];state.importStatus={count:state.rows.length,columns:result.rows[0]?Object.keys(result.rows[0]).length:null,time:new Date().toLocaleString('vi-VN')};localStorage.setItem(STORAGE_KEY,JSON.stringify(state.rows));state.tab='dashboard';render()}catch(error){state.errors=[error?.message||'Không thể đọc dữ liệu từ Clipboard.'];render()}}
async function exportShareCode(){if(!state.rows.length)return;state.errors=[];try{state.shareStatus='Đang tạo file share...';render();const code=await encodeShareCode(state.rows,{source:'Stock Mind',count:state.rows.length});downloadTextFile(code,`stockmind-screener-${new Date().toISOString().slice(0,10)}.stockmind`);state.shareStatus='Đã tải file share.';render()}catch(error){state.errors=[error?.message||'Không thể tạo file share.'];state.shareStatus=null;render()}}
async function importShareCodeFile(event){const file=event.target.files?.[0];if(!file)return;state.errors=[];try{const text=await file.text();const payload=await decodeShareCode(text);state.rows=scoreStocks(payload.rows||[]);state.selectedTicker=state.rows[0]?.TICKER||null;state.selectedTickers=[];state.importStatus={count:state.rows.length,columns:state.rows[0]?Object.keys(state.rows[0]).length:null,time:new Date().toLocaleString('vi-VN')};localStorage.setItem(STORAGE_KEY,JSON.stringify(state.rows));state.shareStatus=`Đã import ${state.rows.length.toLocaleString('vi-VN')} mã từ file.`;state.tab='dashboard';render()}catch(error){state.errors=[error?.message||'Không thể import file share.'];state.shareStatus='Import file thất bại.';render()}finally{event.target.value=''}}
function downloadTextFile(text,filename){const blob=new Blob([text],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function launchScreenedCRSM(ticker){addScreenedTickersToDraft([ticker])}
async function runSelectedCRSM(){if(!state.selectedTickers.length)return;addScreenedTickersToDraft(state.selectedTickers)}
async function runDirectCRSM(){const input=document.getElementById('crsmTickerInput'),ticker=(input?.value||'').trim().toUpperCase();if(!ticker)return;state.selectedTicker=ticker;setCrsmRunning();await runCRSM({mode:'DIRECT',ticker,screeningContext:null})}
function setCrsmRunning(){if(state.tab!=='crsm'){state.tab='crsm';state.crsmView='analysis';render()}else if(state.crsmView!=='analysis'){state.crsmView='analysis';render()}else updateDynamicRegion()}
function retryFailedCRSM(){const mode=crsmState.mode,ticker=crsmState.ticker,startFrom=crsmState.failedNode;if(mode&&ticker&&startFrom)runCRSM({mode,ticker,screeningContext:mode==='SCREENED'?crsmState.screeningContext:null,startFrom,existingOutputs:crsmState.nodeOutputs})}
function retryAllCRSM(){const mode=crsmState.mode,ticker=crsmState.ticker;if(mode&&ticker)runCRSM({mode,ticker,screeningContext:mode==='SCREENED'?crsmState.screeningContext:null,startFrom:'node1',existingOutputs:null,bypassCache:true})}
function toggleSelectedTicker(ticker,checked){const next=new Set(state.selectedTickers);if(checked)next.add(ticker);else next.delete(ticker);state.selectedTickers=[...next];render()}
function selectVisible(checked){const q=state.search.toLowerCase(),visible=state.rows.filter(r=>r.TICKER.toLowerCase().includes(q)||r.INDUSTRY.toLowerCase().includes(q)).map(r=>r.TICKER),next=new Set(state.selectedTickers);visible.forEach(t=>checked?next.add(t):next.delete(t));state.selectedTickers=[...next];render()}
function selectAllVisibleToggle(){const q=state.search.toLowerCase(),visible=state.rows.filter(r=>r.TICKER.toLowerCase().includes(q)||r.INDUSTRY.toLowerCase().includes(q)).map(r=>r.TICKER),all=visible.length>0&&visible.every(t=>state.selectedTickers.includes(t));selectVisible(!all)}
async function analyzeDashboardTickers(tickers){const clean=[...new Set((tickers||[]).map(t=>String(t||'').toUpperCase()).filter(Boolean))];if(!clean.length)return;addScreenedTickersToDraft(clean)}
function bindAnalysisListBindings(){
  if(state.tab!=='crsm'||state.crsmView!=='analysis')return;
  bindAnalysisListPage({
    onAddTicker:handleManualTicker,
    onRemoveItem:handleRemoveDraftItem,
    onAttachDocuments:handleAttachDocuments,
    onRemoveDocument:handleRemoveDraftDocument,
    onClear:handleClearDraft,
    onAnalyze:submitAnalysisDraft,
    onViewResults:()=>{state.crsmView='reports';render();}
  });
}

function handleManualTicker(ticker){
  const result=addManualTicker(state.crsmDraft,ticker);
  if(!result.changed){
    state.crsmNotice={
      type:result.reason==='DUPLICATE'?'info':'error',
      message:result.reason==='DUPLICATE'?'Ticker already in list.':'Enter a valid ticker.'
    };
    render();
    focusDraftItem(result.item?.item_id);
    return;
  }
  persistCrsmDraft(result.draft);
  state.crsmNotice={type:'success',message:`${result.item.ticker} added as Web only.`};
  render();
  document.getElementById('analysisTickerInput')?.focus();
}

function addScreenedTickersToDraft(tickers){
  let draft=state.crsmDraft;
  const added=[];
  const conflicts=[];
  for(const ticker of tickers){
    const stock=state.rows.find(row=>row.TICKER===ticker);
    if(!stock)continue;
    const result=addScreenedTicker(draft,ticker,buildScreeningContext(stock));
    if(result.changed){
      draft=result.draft;
      added.push(ticker);
    }else{
      conflicts.push({ticker,reason:result.reason,item:result.item});
    }
  }
  if(added.length)persistCrsmDraft(draft);
  state.tab='crsm';
  state.crsmView='analysis';
  state.crsmNotice=conflicts.length
    ? {type:'info',message:`${added.length} ticker(s) added. ${conflicts.length} duplicate/source conflict(s) kept unchanged.`}
    : {type:'success',message:`${added.length} ticker(s) added from Screener.`};
  render();
  void refreshMemoCurrent();
  const focusId=added.length
    ? state.crsmDraft.items.find(item=>item.ticker===added[0])?.item_id
    : conflicts[0]?.item?.item_id;
  focusDraftItem(focusId);
}

function handleRemoveDraftItem(itemId){
  persistCrsmDraft(removeItem(state.crsmDraft,itemId));
  state.crsmNotice=null;
  render();
}

async function handleAttachDocuments(itemId,files){
  state.draftBusyItem=itemId;
  state.crsmNotice=null;
  render();
  try{
    const evidence=await extractUserEvidence(files);
    const result=attachDocuments(state.crsmDraft,itemId,evidence.documents);
    if(!result.changed){
      throw new Error(result.reason==='SCREENED_EVIDENCE_FORBIDDEN'
        ?'Screener items cannot accept documents.'
        :'Could not attach documents.');
    }
    persistCrsmDraft(result.draft);
    const extra=evidence.errors?.length?` ${evidence.errors.length} file(s) could not be read.`:'';
    state.crsmNotice={
      type:'success',
      message:`${evidence.documents.length} document(s) attached to ${result.item.ticker}.${extra}`
    };
  }catch(error){
    state.crsmNotice={type:'error',message:error?.message||String(error)};
  }finally{
    state.draftBusyItem=null;
    render();
    focusDraftItem(itemId);
  }
}

function handleRemoveDraftDocument(itemId,documentId){
  const result=removeDocument(state.crsmDraft,itemId,documentId);
  if(result.changed)persistCrsmDraft(result.draft);
  state.crsmNotice=null;
  render();
  focusDraftItem(itemId);
}

function handleClearDraft(){
  state.crsmDraft=clearDraft();
  state.crsmNotice=null;
  render();
  document.getElementById('analysisTickerInput')?.focus();
}

async function submitAnalysisDraft(){
  if(state.crsmSubmitting||!state.crsmDraft.items.length)return;
  state.crsmSubmitting=true;
  state.crsmNotice=null;
  render();
  try{
    const currentData=await fetchMemoCurrent();
    state.memoCurrent=currentData.current;
    if(isActiveMemoRun(state.memoCurrent)){
      throw new Error('An analysis is already in progress. View Results and submit this draft after it finishes.');
    }
    const payload=buildSubmission(state.crsmDraft);
    const submitted=await submitMemoRun(payload);
    state.memoCurrent=submitted.current;
    state.crsmDraft=clearDraft();
    state.crsmNotice={
      type:'success',
      message:'Analysis list submitted. Invoke Stockmind in ChatGPT to process it.',
      viewResults:true
    };
  }catch(error){
    state.crsmNotice={type:'error',message:error?.message||String(error)};
  }finally{
    state.crsmSubmitting=false;
    render();
  }
}

async function refreshMemoCurrent(){
  if(state.memoLoading)return;
  state.memoLoading=true;
  state.memoError=null;
  if(state.tab==='crsm'&&state.crsmView==='analysis')render();
  try{
    const data=await fetchMemoCurrent();
    state.memoCurrent=data.current;
  }catch(error){
    state.memoError=error?.message||String(error);
  }finally{
    state.memoLoading=false;
    if(state.tab==='crsm'&&state.crsmView==='analysis')render();
  }
}

function bindResultsBindings(){
  if(!isResultsVisible())return;
  bindResultsPage({
    onRefresh:handleResultsRefresh,
    onRepair:handleResultsRepair,
    onSelectRun:selectResultsRun,
    onSelectTicker:selectResultsTicker,
    onRetry:handleResultsRetry,
    onReportTab:tab=>{state.reportTab=tab;render();},
    onDownloadImage:downloadSelectedResultImage,
    onDownloadWord:downloadSelectedResultWord
  });
}

function isResultsVisible(){
  return state.tab==='crsm'&&state.crsmView==='reports';
}

function syncResultsPolling(){
  if(!isResultsVisible()||state.resultsError){
    resultsPoller.stop();
    return;
  }
  const started=resultsPoller.start();
  if(started&&!state.resultsUpdatedAt&&!state.resultsLoading){
    void refreshResults();
  }
}

async function refreshResults({background=false}={}){
  if(state.resultsLoading)return;
  state.resultsLoading=true;
  if(!background&&isResultsVisible())render();

  try{
    const tasks=[
      fetchMemoCurrent(),
      fetchMemoHistory(),
      background&&state.resultsMaintenance
        ? Promise.resolve(state.resultsMaintenance)
        : fetchMemoMaintenance()
    ];
    const [currentResult,historyResult,maintenanceResult]=await Promise.allSettled(tasks);

    if(currentResult.status!=='fulfilled')throw currentResult.reason;
    const currentData=currentResult.value;
    state.memoCurrent=currentData.current;

    let currentRun=null;
    if(currentData.current?.run_id){
      currentRun=normalizeMemoRun(await fetchMemoRun(currentData.current.run_id));
    }
    state.resultsCurrentRun=currentRun;

    const warnings=[];
    if(historyResult.status==='fulfilled'){
      state.resultsHistory=historyResult.value.index?.runs||[];
    }else{
      warnings.push(historyResult.reason?.message||String(historyResult.reason));
    }

    if(maintenanceResult.status==='fulfilled'){
      state.resultsMaintenance=maintenanceResult.value;
    }else{
      warnings.push(maintenanceResult.reason?.message||String(maintenanceResult.reason));
    }

    const available=new Set([
      ...(currentRun?.run_id?[currentRun.run_id]:[]),
      ...state.resultsHistory.map(run=>run.run_id)
    ]);
    if(!state.resultsSelectedRunId||!available.has(state.resultsSelectedRunId)){
      state.resultsSelectedRunId=currentRun?.run_id||state.resultsHistory[0]?.run_id||null;
      state.resultsSelectedTicker=null;
    }

    if(state.resultsSelectedRunId){
      if(currentRun?.run_id===state.resultsSelectedRunId){
        state.resultsSelectedRun=currentRun;
      }else if(state.resultsSelectedRun?.run_id!==state.resultsSelectedRunId){
        state.resultsSelectedRun=normalizeMemoRun(await fetchMemoRun(state.resultsSelectedRunId));
      }
      state.resultsSelectedTicker=selectDefaultTicker(
        state.resultsSelectedRun,
        state.resultsSelectedTicker
      );
    }else{
      state.resultsSelectedRun=null;
      state.resultsSelectedTicker=null;
    }

    state.resultsUpdatedAt=new Date().toISOString();
    state.resultsError=warnings[0]||null;
    if(state.resultsError)resultsPoller.stop();
  }catch(error){
    state.resultsError=error?.message||String(error);
    resultsPoller.stop();
  }finally{
    state.resultsLoading=false;
    if(isResultsVisible())render();
  }
}

async function handleResultsRefresh(){
  state.resultsError=null;
  state.resultsMaintenance=null;
  resultsPoller.stop();
  await refreshResults();
}

async function selectResultsRun(runId){
  if(!runId||state.resultsLoading)return;
  state.resultsSelectedRunId=runId;
  state.resultsSelectedTicker=null;

  if(state.resultsCurrentRun?.run_id===runId){
    state.resultsSelectedRun=state.resultsCurrentRun;
    state.resultsSelectedTicker=selectDefaultTicker(state.resultsSelectedRun);
    render();
    return;
  }

  state.resultsLoading=true;
  render();
  try{
    state.resultsSelectedRun=normalizeMemoRun(await fetchMemoRun(runId));
    state.resultsSelectedTicker=selectDefaultTicker(state.resultsSelectedRun);
    state.resultsError=null;
  }catch(error){
    state.resultsError=error?.message||String(error);
    resultsPoller.stop();
  }finally{
    state.resultsLoading=false;
    render();
  }
}

async function selectResultsTicker(runId,ticker){
  if(runId&&runId!==state.resultsSelectedRunId){
    await selectResultsRun(runId);
  }
  if(!state.resultsSelectedRun)return;
  state.resultsSelectedTicker=selectDefaultTicker(state.resultsSelectedRun,ticker);
  render();
}

async function handleResultsRetry(runId,itemId){
  const current=state.resultsCurrentRun;
  if(!current||current.run_id!==runId||!current.status_sha)return;
  state.resultsRetryingItemId=itemId;
  state.resultsError=null;
  render();
  try{
    await retryMemoItem({
      run_id:runId,
      item_id:itemId,
      expected_status_sha:current.status_sha
    });
    await refreshResults();
  }catch(error){
    state.resultsError=error?.message||String(error);
    resultsPoller.stop();
  }finally{
    state.resultsRetryingItemId=null;
    if(isResultsVisible())render();
  }
}

async function handleResultsRepair(){
  if(state.resultsRepairing)return;
  state.resultsRepairing=true;
  state.resultsError=null;
  render();
  try{
    await repairMemoHistory();
    state.resultsMaintenance=null;
    await refreshResults();
  }catch(error){
    state.resultsError=error?.message||String(error);
    resultsPoller.stop();
  }finally{
    state.resultsRepairing=false;
    if(isResultsVisible())render();
  }
}

function selectedMemoResult(){
  return selectedRunItem(
    state.resultsSelectedRun,
    state.resultsSelectedTicker
  )?.result||null;
}

async function downloadSelectedResultImage(){
  const result=selectedMemoResult();
  if(result?.visualReport)await downloadReportImage(result.visualReport,result.ticker);
}

function downloadSelectedResultWord(){
  const result=selectedMemoResult();
  if(!result)return;
  if(result.detailReport)downloadWordReportFromMarkdown(result.detailReport,result.ticker);
  else if(result.visualReport)downloadWordReport(result.visualReport,result.ticker);
}

function persistCrsmDraft(draft){
  state.crsmDraft=saveDraft(draft);
  return state.crsmDraft;
}

function focusDraftItem(itemId){
  if(!itemId)return;
  requestAnimationFrame(()=>{
    const node=document.querySelector('[data-analysis-item="'+cssSelectorValue(itemId)+'"]');
    node?.focus();
    node?.scrollIntoView?.({block:'nearest'});
  });
}

function cssSelectorValue(value){
  return globalThis.CSS?.escape
    ?globalThis.CSS.escape(String(value))
    :String(value).replace(/"/g,'\\"');
}

function copyPrompt(){const text=document.getElementById('promptText')?.value;if(text)navigator.clipboard?.writeText(text)}
function renderFlags(row){const flags=row.DATA_FLAGS||[],notes=row.DATA_NOTES||[];if(flags.length)return`<sup class="data-flags data-flags-critical" title="${escapeHtml(flags.join(', '))}">!${flags.length}</sup>`;return notes.length?`<sup class="data-flags data-flags-soft" title="${escapeHtml(notes.join(', '))}">n${notes.length}</sup>`:''}
function loadRows(){try{const raw=localStorage.getItem(STORAGE_KEY);return raw?JSON.parse(raw):[]}catch{return[]}}
function emptyState(){return `<section class="panel panel-pad"><p class="eyebrow">No Data</p><h1>Chưa có dữ liệu cổ phiếu</h1><p class="muted">Hãy import bảng TradingView ở tab Screen để bắt đầu.</p><button class="btn primary" data-tab="import">Đi tới Screen</button></section>`}
function metric(label,value){return `<div class="panel metric"><p class="metric-label">${label}</p><p class="metric-value">${value}</p></div>`}
function stockLine(row){return `<div class="stock-line clickable" data-crsm="${row.TICKER}" title="Thêm ${row.TICKER} vào Analysis List"><span><strong>${row.TICKER}</strong> <span class="muted">${escapeHtml(classificationLabel(row.SCREENING_GROUP))}</span></span><span>${fmt(row.FINALSCORE)} ${gradeBadge(row.GRADE)}</span></div>`}
function scoreCard(label,value){return `<div class="score-card"><span class="muted">${label}</span><strong>${fmt(value)}</strong></div>`}
function classificationLabel(value){return ({CORE:'Core Performer',QUALITY_UNDERPERFORMER:'Quality Underperformer',HIGH_REWARD_HIGH_RISK:'High Reward / High Risk',AVOID_VALUE_TRAP:'Avoid / Value Trap',WATCH_NEUTRAL:'Watch / Neutral'})[value]||value||'-'}
function gradeBadge(grade){const cls=grade?.startsWith('A')?'grade-a':grade==='B'?'grade-b':grade==='C'?'grade-c':'grade-d';return `<span class="badge ${cls}">${grade||'-'}</span>`}
function fmt(value){if(value==null||Number.isNaN(value))return '-';if(typeof value==='number')return value.toLocaleString('vi-VN',{maximumFractionDigits:2});return value}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;')}
function escapeAttr(value){return escapeHtml(value).replace(/\"/g,'&quot;').replace(/'/g,'&#039;')}
