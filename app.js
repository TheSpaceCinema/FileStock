const $ = id => document.getElementById(id);
let products = [];
const COL = {code:1,uom:2,opening:5,receipts:8,transfers:10,adjusts:12,wastage:14,sales:18,usage:21,closing:23,varQty:28,stdCost:29,varCost:32};

$('dropZone').addEventListener('click',()=> $('fileInput').click());
$('fileInput').addEventListener('change',e=>{ if(e.target.files[0]) loadFile(e.target.files[0]); });
['dragenter','dragover'].forEach(ev=>$('dropZone').addEventListener(ev,e=>{e.preventDefault();$('dropZone').classList.add('dragover')}));
['dragleave','drop'].forEach(ev=>$('dropZone').addEventListener(ev,e=>{e.preventDefault();$('dropZone').classList.remove('dragover')}));
$('dropZone').addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f)});
$('newFileBtn').onclick=()=>{ $('appSection').classList.add('hidden');$('uploadSection').classList.remove('hidden');$('fileInput').value='';window.scrollTo({top:0,behavior:'smooth'}); };
$('search').addEventListener('input',render);
$('filter').addEventListener('change',render);
$('clearBtn').onclick=()=>{if(confirm('Vuoi cancellare tutti i conteggi effettivi?')){products.forEach(p=>p.actual='');render();}};
$('saveBtn').onclick=()=>{localStorage.setItem('magazzinoConteggio',JSON.stringify(products));alert('Conteggio salvato nel browser.');};
$('exportBtn').onclick=exportExcel;

function n(v){ if(v===null||v===undefined||v==='') return 0; if(typeof v==='number') return v; const s=String(v).replace(/\s/g,'').replace(/\./g,'').replace(',','.'); const x=parseFloat(s); return Number.isFinite(x)?x:0; }
function txt(v){return v==null?'':String(v).trim()}
function round(v){return Math.round((v+Number.EPSILON)*100)/100}
function fmt(v){return Number.isInteger(v)?String(v):v.toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:2})}

async function loadFile(file){
  $('loadStatus').innerHTML='<div class="alert alert-info">Lettura del file in corso...</div>';
  try{
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array',cellDates:true});
    const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null,raw:true});
    products=parseReport(rows);
    if(!products.length) throw new Error('Non sono riuscito a trovare prodotti nel file.');
    $('fileInfo').textContent=`${file.name} • ${products.length} prodotti`;
    $('uploadSection').classList.add('hidden');$('appSection').classList.remove('hidden');
    render();
  }catch(err){$('loadStatus').innerHTML=`<div class="alert alert-danger"><strong>Errore:</strong> ${escapeHtml(err.message)}</div>`;}
}

function parseReport(rows){
  const out=[];
  // Il report allegato usa una riga con il codice e la riga immediatamente successiva con il nome del prodotto.
  for(let i=0;i<rows.length;i++){
    const r=rows[i]||[]; const code=txt(r[COL.code]);
    if(!code || !/^\d+(?:\.\d+)?$/.test(code)) continue;
    const name=txt((rows[i+1]||[])[COL.code]);
    if(!name) continue;
    const opening=n(r[COL.opening]), receipts=n(r[COL.receipts]), transfers=n(r[COL.transfers]), adjusts=n(r[COL.adjusts]), wastage=n(r[COL.wastage]), sales=n(r[COL.sales]), usage=n(r[COL.usage]);
    const expected=round(opening+receipts+transfers+adjusts-wastage-sales-usage);
    out.push({code,uom:txt(r[COL.uom]),name,opening,receipts,transfers,adjusts,wastage,sales,usage,expected,actual:'',variance:0,stdCost:n(r[COL.stdCost]),reportClosing:n(r[COL.closing]),reportVariance:n(r[COL.varQty]),reportVarCost:n(r[COL.varCost])});
  }
  return out;
}
function visible(p){
  const q=$('search').value.toLowerCase().trim(); const f=$('filter').value;
  if(q && !(p.code+' '+p.name).toLowerCase().includes(q)) return false;
  if(f==='unchecked' && p.actual!=='') return false;
  if(f==='different' && (p.actual==='' || Number(p.actual)===p.expected)) return false;
  if(f==='missing' && (p.actual==='' || Number(p.actual)>=p.expected)) return false;
  return true;
}
function render(){
  const body=$('stockTable').querySelector('tbody'); body.innerHTML='';
  products.filter(visible).forEach((p,idx)=>{
    const tr=document.createElement('tr'); const actual=p.actual===''?'':Number(p.actual); const diff=p.actual===''?'':round(actual-p.expected); const cost=p.actual===''?'':round(diff*p.stdCost);
    tr.innerHTML=`<td>${escapeHtml(p.code)}</td><td class="product-name">${escapeHtml(p.name)}</td><td>${escapeHtml(p.uom)}</td>${numCell(p.opening)}${numCell(p.receipts)}${numCell(p.transfers)}${numCell(p.adjusts)}${numCell(p.wastage)}${numCell(p.sales)}${numCell(p.usage)}${numCell(p.expected)}<td class="num"><input class="form-control form-control-sm actual-input" type="number" step="any" min="0" value="${p.actual}" data-idx="${idx}"></td><td class="num diff-cell"></td><td class="num cost-cell"></td>`;
    body.appendChild(tr); updateRow(tr,p);
    tr.querySelector('.actual-input').addEventListener('input',e=>{p.actual=e.target.value===''?'':n(e.target.value);updateRow(tr,p);updateSummary();});
  });
  updateSummary();
}
function numCell(v){return `<td class="num">${fmt(v)}</td>`}
function updateRow(tr,p){
  const d=tr.querySelector('.diff-cell'),c=tr.querySelector('.cost-cell'), a=p.actual==='';
  tr.classList.remove('diff-ok','diff-bad','diff-plus');
  if(a){d.textContent='—';c.textContent='—';return}
  const diff=round(Number(p.actual)-p.expected),cost=round(diff*p.stdCost);d.textContent=(diff>0?'+':'')+fmt(diff);c.textContent=(cost>0?'+':'')+fmt(cost)+' €';
  if(diff===0) tr.classList.add('diff-ok'); else if(diff<0) tr.classList.add('diff-bad'); else tr.classList.add('diff-plus');
}
function updateSummary(){
  const checked=products.filter(p=>p.actual!==''); const diffs=checked.filter(p=>round(Number(p.actual)-p.expected)!==0); const missing=checked.filter(p=>round(Number(p.actual)-p.expected)<0);
  $('totProducts').textContent=products.length;$('totChecked').textContent=checked.length;$('totDifferences').textContent=diffs.length;$('totMissing').textContent=missing.length;
}
function exportExcel(){
  const data=products.map(p=>{const actual=p.actual===''?'':Number(p.actual);const diff=p.actual===''?'':round(actual-p.expected);return {Codice:p.code,Prodotto:p.name,'U.M.':p.uom,'Conteggio iniziale':p.opening,Carichi:p.receipts,Trasferimenti:p.transfers,Rettifiche:p.adjusts,Danni:p.wastage,Venduto:p.sales,Uso:p.usage,'Conteggio finale atteso':p.expected,'Conteggio finale effettivo':actual,Differenza:diff,'Costo differenza':p.actual===''?'':round(diff*p.stdCost)};});
  const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Conteggio');XLSX.writeFile(wb,'Conteggio_Magazzino.xlsx');
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
