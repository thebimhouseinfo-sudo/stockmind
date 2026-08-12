function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReportImage(reportHtml, ticker) {
  if (!reportHtml) return;
  const html = normalizeHtmlDocument(reportHtml, ticker);
  try {
    const source = await measureReportDocument(html);
    const width = Math.min(1600, Math.max(1100, source.width));
    const height = Math.min(30000, Math.max(600, source.height));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><xhtml:body xmlns:xhtml="http://www.w3.org/1999/xhtml" style="width:${width}px;min-height:${height}px;margin:0;background:#fff;overflow:hidden"><xhtml:style><![CDATA[${source.styles}]]></xhtml:style>${source.body}</xhtml:body></foreignObject></svg>`;
    const image = await blobToImage(new Blob([svg], { type:'image/svg+xml;charset=utf-8' }));
    const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Không tạo được canvas.');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,width,height); ctx.drawImage(image,0,0,width,height);
    const png = await new Promise(resolve=>canvas.toBlob(resolve,'image/png')); if(!png) throw new Error('Không tạo được PNG.');
    downloadBlob(png,`CRSM_${safeName(ticker)}_${dateStamp()}.png`);
  } catch (error) {
    console.warn('[CRSM] Image export fallback:', error);
    downloadReportImageFallback(reportHtml,ticker);
  }
}

async function measureReportDocument(html) {
  const iframe=document.createElement('iframe');
  Object.assign(iframe.style,{position:'fixed',left:'-100000px',top:'0',width:'1600px',height:'1200px',border:'0',visibility:'hidden'});
  document.body.appendChild(iframe);
  try {
    await new Promise((resolve,reject)=>{ iframe.onload=resolve; iframe.onerror=reject; iframe.srcdoc=html; });
    const doc=iframe.contentDocument; if(!doc) throw new Error('Không truy cập được report document.');
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const body=doc.body;
    return { width:Math.ceil(Math.max(body.scrollWidth,body.offsetWidth,1100)), height:Math.ceil(Math.max(body.scrollHeight,body.offsetHeight,600)), body:body.innerHTML, styles:[...doc.querySelectorAll('style')].map(s=>s.textContent||'').join('\n') };
  } finally { iframe.remove(); }
}

function blobToImage(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob);const image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};image.onerror=e=>{URL.revokeObjectURL(url);reject(e)};image.src=url})}

function downloadReportImageFallback(reportHtml,ticker){const text=extractReportText(reportHtml),lines=wrapLines(text,92),width=1600,lineHeight=30,top=150,bottom=70,height=Math.max(520,top+lines.length*lineHeight+bottom),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.fillStyle='#172033';ctx.font='700 36px Arial';ctx.fillText(`CRSM — ${ticker}`,70,62);ctx.font='18px Arial';ctx.fillStyle='#667085';ctx.fillText(`Báo cáo phân tích · ${new Date().toLocaleDateString('vi-VN')}`,70,98);ctx.strokeStyle='#dbe2ec';ctx.beginPath();ctx.moveTo(70,120);ctx.lineTo(width-70,120);ctx.stroke();ctx.fillStyle='#172033';ctx.font='18px Arial';lines.forEach((line,i)=>ctx.fillText(line,70,top+i*lineHeight));canvas.toBlob(blob=>{if(blob)downloadBlob(blob,`CRSM_${safeName(ticker)}_${dateStamp()}.png`)},'image/png')}

export function downloadWordReport(reportHtml,ticker){
  if(!reportHtml)return;
  const html=normalizeHtmlDocument(reportHtml,ticker);
  const {styles,body}=extractStylesAndBody(html);
  const word=`<!doctype html><html><head><meta charset="utf-8"><meta name="ProgId" content="Word.Document"><title>CRSM ${escapeHtml(ticker)}</title><style>${styles}\n@page{size:A4;margin:18mm}body{print-color-adjust:exact;-webkit-print-color-adjust:exact} .page{max-width:none!important;margin:0!important}</style></head><body>${body}</body></html>`;
  downloadBlob(new Blob([word],{type:'application/msword'}),`CRSM_${safeName(ticker)}_${dateStamp()}.doc`);
}

function extractStylesAndBody(html){const doc=new DOMParser().parseFromString(html,'text/html');return{styles:[...doc.querySelectorAll('style')].map(s=>s.textContent||'').join('\n'),body:doc.body?.innerHTML||''}}
function extractReportText(html){const doc=new DOMParser().parseFromString(normalizeHtmlDocument(html,'CRSM'),'text/html');return(doc.body?.innerText||'').replace(/\s+/g,' ').trim()}
function wrapLines(text,maxChars){const lines=[];let current='';for(const word of String(text||'').split(' ')){const candidate=`${current} ${word}`.trim();if(candidate.length>maxChars){if(current)lines.push(current);current=word}else current=candidate}if(current)lines.push(current);return lines}
function normalizeHtmlDocument(reportHtml,ticker){const source=String(reportHtml||'').trim();return /^<!doctype\s+html/i.test(source)||/<html[\s>]/i.test(source)?source:`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>CRSM ${escapeHtml(ticker)}</title></head><body>${source}</body></html>`}
function safeName(value){return String(value||'report').replace(/[^a-zA-Z0-9_-]/g,'_')}
function dateStamp(){return new Date().toISOString().slice(0,10)}
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;')}
