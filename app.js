/* ==========================================================================
   GESTIONE MAGAZZINO / INVENTARIO CINEMA — APPLICAZIONE COMPLETA
   ========================================================================== */

let cinemaName = "TSC Nola";

// Inizializzazione degli stati globali
window.candyConfig = window.candyConfig || {
  tares: ["", "", "", ""],
  numBlocks: 1,
  layout: "vertical",
  blocks: [{ rows: 3, cols: 3, cells: {} }]
};

window.distributorConfig = window.distributorConfig || {
  distributors: [
    {
      name: "MARS 1-9",
      date: "",
      fondoResti: 35,
      rows: [
        { product: "", stockIniziale: 0, ins: ["","","","",""], contaFinale: 0, prezzoVendita: 0 }
      ]
    }
  ]
};

function $(selector) {
  return document.querySelector(selector);
}

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* --------------------------------------------------------------------------
   1. SEZIONE CARAMELLE (Con tare in alto, blocchi e menù tendina)
   -------------------------------------------------------------------------- */
function renderCandyView() {
  const container = $("tbody");
  const thead = $("thead");
  if (!container || !thead) return;

  let cfg = window.candyConfig;

  thead.innerHTML = `<tr><th colspan="10" style="background:#d35400; color:white; font-size:1.1rem; padding:10px;">🍬 Gestione Caramelle (${esc(cinemaName)})</th></tr>`;

  let html = `<tr><td colspan="10" style="padding:15px; background:#fdf2e9;">`;

  // Pannello superiore con 4 tare, num blocchi e layout orizzontale/verticale
  html += `<div style="background:white; padding:12px; margin-bottom:15px; border-radius:6px; border:1px solid #f5b041; display:flex; flex-wrap:wrap; gap:15px; align-items:center;">
             <div>
               <strong>Tare (4 valori):</strong><br>
               <input type="number" step="any" value="${cfg.tares[0]}" placeholder="Tara 1" style="width:60px; margin-right:4px;" onchange="updateCandyTara(0, this.value)">
               <input type="number" step="any" value="${cfg.tares[1]}" placeholder="Tara 2" style="width:60px; margin-right:4px;" onchange="updateCandyTara(1, this.value)">
               <input type="number" step="any" value="${cfg.tares[2]}" placeholder="Tara 3" style="width:60px; margin-right:4px;" onchange="updateCandyTara(2, this.value)">
               <input type="number" step="any" value="${cfg.tares[3]}" placeholder="Tara 4" style="width:60px;" onchange="updateCandyTara(3, this.value)">
             </div>
             <div>
               <strong>Numero Blocchi:</strong><br>
               <select style="padding:4px; width:80px;" onchange="updateCandyNumBlocks(this.value)">`;
  for(let b=1; b<=6; b++) {
    html += `<option value="${b}" ${cfg.numBlocks == b ? 'selected' : ''}>${b}</option>`;
  }
  html += `    </select>
             </div>
             <div>
               <strong>Disposizione:</strong><br>
               <select style="padding:4px;" onchange="updateCandyLayout(this.value)">
                 <option value="vertical" ${cfg.layout === 'vertical' ? 'selected' : ''}>Verticali</option>
                 <option value="horizontal" ${cfg.layout === 'horizontal' ? 'selected' : ''}>Orizzontali</option>
               </select>
             </div>
           </div>`;

  // Area dinamica dei blocchi
  html += `<div style="display:flex; flex-direction: ${cfg.layout === 'horizontal' ? 'row' : 'column'}; flex-wrap:wrap; gap:15px;">`;

  for(let bIdx=0; bIdx < cfg.numBlocks; bIdx++) {
    if (!cfg.blocks[bIdx]) cfg.blocks[bIdx] = { rows: 3, cols: 3, cells: {} };
    let bData = cfg.blocks[bIdx];

    html += `<div style="background:white; padding:12px; border-radius:6px; border:1px solid #f5b041; flex:1; min-width:280px;">
               <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; background:#fef9e7; padding:6px; border-radius:4px;">
                 <strong>Blocco ${bIdx + 1}</strong>
                 <div>
                   Righe: <select style="padding:2px;" onchange="updateBlockDim(${bIdx}, 'rows', this.value)">`;
    for(let r=1; r<=10; r++) {
      html += `<option value="${r}" ${bData.rows == r ? 'selected' : ''}>${r}</option>`;
    }
    html += `      </select>
                   Colonne: <select style="padding:2px;" onchange="updateBlockDim(${bIdx}, 'cols', this.value)">`;
    for(let c=1; c<=10; c++) {
      html += `<option value="${c}" ${bData.cols == c ? 'selected' : ''}>${c}</option>`;
    }
    html += `      </select>
                 </div>
               </div>
               
               <table style="width:100%; border-collapse:collapse; font-size:0.85rem;">`;
    
    for(let r=0; r<bData.rows; r++) {
      html += `<tr>`;
      for(let c=0; c<bData.cols; c++) {
        let cellKey = `${r}_${c}`;
        let val = (bData.cells && bData.cells[cellKey]) ? bData.cells[cellKey] : "";
        html += `<td style="border:1px solid #ddd; padding:4px; text-align:center;">
                   <input type="text" placeholder="Prodotto" style="width:100%; border:none; background:transparent; font-size:0.8rem; text-align:center;" value="${esc(val)}" onchange="updateCandyCell(${bIdx}, ${r}, ${c}, this.value)">
                 </td>`;
      }
      html += `</tr>`;
    }

    html += `</table></div>`;
  }

  html += `</div></td></tr>`;
  container.innerHTML = html;
}

function updateCandyTara(idx, val) {
  if (!window.candyConfig) return;
  window.candyConfig.tares[idx] = val;
}

function updateCandyNumBlocks(val) {
  if (!window.candyConfig) return;
  window.candyConfig.numBlocks = parseInt(val);
  renderCandyView();
}

function updateCandyLayout(val) {
  if (!window.candyConfig) return;
  window.candyConfig.layout = val;
  renderCandyView();
}

function updateBlockDim(bIdx, dim, val) {
  if (!window.candyConfig || !window.candyConfig.blocks[bIdx]) return;
  window.candyConfig.blocks[bIdx][dim] = parseInt(val);
  renderCandyView();
}

function updateCandyCell(bIdx, r, c, val) {
  if (!window.candyConfig || !window.candyConfig.blocks[bIdx]) return;
  if (!window.candyConfig.blocks[bIdx].cells) {
    window.candyConfig.blocks[bIdx].cells = {};
  }
  window.candyConfig.blocks[bIdx].cells[`${r}_${c}`] = val;
}


/* --------------------------------------------------------------------------
   2. SEZIONE DISTRIBUTORI AUTOMATICI (Con 5 reintegri, data e prezzo)
   -------------------------------------------------------------------------- */
function renderDistributorsView() {
  const container = $("tbody");
  const thead = $("thead");
  if (!container || !thead) return;

  const cfg = window.distributorConfig;
  thead.innerHTML = `<tr><th colspan="10" style="background:#8e44ad; color:white; font-size:1.1rem; padding:10px;">🍫 Distributori Automatici (${esc(cinemaName)})</th></tr>`;

  let html = `<tr><td colspan="10" style="padding:15px; background:#f5eef8;">`;
  
  cfg.distributors.forEach((d, dIdx) => {
    html += `<div style="background:white; padding:12px; margin-bottom:15px; border-radius:6px; border:1px solid #d2b4de;">
              <h5 style="color:#8e44ad; margin-bottom:8px;">${esc(d.name)} — Data: <input type="text" value="${esc(d.date || '')}" placeholder="13/08/2026" style="padding:2px 6px; width:100px; border:1px solid #ccc; border-radius:3px;" onchange="updateDistMeta(${dIdx}, 'date', this.value)"> — Fondo Resti: €<input type="number" value="${d.fondoResti}" style="padding:2px 6px; width:60px; border:1px solid #ccc; border-radius:3px;" onchange="updateDistMeta(${dIdx}, 'fondoResti', this.value)"></h5>
              <table style="width:100%; font-size:0.8rem; border-collapse:collapse;">
                <thead>
                  <tr style="background:#ebdef0;">
                    <th style="padding:5px; border:1px solid #d2b4de;">Prodotto</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:90px;">Stock Iniziale</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:55px;">Ins 1</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:55px;">Ins 2</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:55px;">Ins 3</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:55px;">Ins 4</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:55px;">Ins 5</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:90px;">Conta Finale</th>
                    <th style="padding:5px; border:1px solid #d2b4de; width:80px;">Prezzo (€)</th>
                  </tr>
                </thead>
                <tbody>`;
                
    d.rows.forEach((r, rIdx) => {
      html += `<tr>
                <td style="padding:3px; border:1px solid #eee;"><input type="text" value="${esc(r.product)}" placeholder="Nome Prodotto" style="width:100%; border:1px solid #ddd; padding:4px;" onchange="updateDistRow(${dIdx}, ${rIdx}, 'product', this.value)"></td>
                <td style="padding:3px; border:1px solid #eee;"><input type="number" value="${r.stockIniziale}" style="width:100%; border:1px solid #ddd; text-align:center; padding:4px;" onchange="updateDistRow(${dIdx}, ${rIdx}, 'stockIniziale', this.value)"></td>`;
                
      for(let i=0; i<5; i++) {
        let insVal = (r.ins && r.ins[i]) !== undefined ? r.ins[i] : "";
        html += `<td style="padding:3px; border:1px solid #eee;"><input type="number" value="${insVal}" style="width:100%; border:1px solid #ddd; text-align:center; padding:4px;" onchange="updateDistIns(${dIdx}, ${rIdx}, ${i}, this.value)"></td>`;
      }

      html += `
                <td style="padding:3px; border:1px solid #eee;"><input type="number" value="${r.contaFinale}" style="width:100%; border:1px solid #ddd; text-align:center; font-weight:bold; padding:4px; background:#fcf3cf;" onchange="updateDistRow(${dIdx}, ${rIdx}, 'contaFinale', this.value)"></td>
                <td style="padding:3px; border:1px solid #eee;"><input type="number" step="any" value="${r.prezzoVendita || ''}" placeholder="0.00" style="width:100%; border:1px solid #ddd; text-align:center; padding:4px;" onchange="updateDistRow(${dIdx}, ${rIdx}, 'prezzoVendita', this.value)"></td>
              </tr>`;
    });
    
    html += `</tbody></table></div>`;
  });

  html += `</td></tr>`;
  container.innerHTML = html;
}

function updateDistMeta(dIdx, key, val) {
  const cfg = window.distributorConfig;
  if (cfg.distributors[dIdx]) {
    cfg.distributors[dIdx][key] = val;
  }
}

function updateDistIns(dIdx, rIdx, insIdx, val) {
  const cfg = window.distributorConfig;
  if (cfg.distributors[dIdx] && cfg.distributors[dIdx].rows[rIdx]) {
    if (!cfg.distributors[dIdx].rows[rIdx].ins) {
      cfg.distributors[dIdx].rows[rIdx].ins = ["", "", "", "", ""];
    }
    cfg.distributors[dIdx].rows[rIdx].ins[insIdx] = val;
  }
}

function updateDistRow(dIdx, rIdx, key, val) {
  const cfg = window.distributorConfig;
  if (cfg.distributors[dIdx] && cfg.distributors[dIdx].rows[rIdx]) {
    cfg.distributors[dIdx].rows[rIdx][key] = val;
  }
}
