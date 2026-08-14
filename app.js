/* ==========================================================================
   APP STOCK MAGAZZINO CINEMA - FILE COMPLETO APP.JS (FIXED & ENHANCED)
   ========================================================================== */
let mag = [], size = [], rows = [], postMixProducts = [];
let cinemaName = "TSC Beinasco";
let warehouses = ["Bar Principale", "Deposito Centrale", "Stand Popcorn"]; 
let currentTab = 0; 
let countsData = {}; 
const MAX_FIELDS = 10;
const DEFAULT_CINEMAS = [
  "TSC Beinasco", "TSC Belpasso", "TSC Bologna", "TSC Casamassima", "TSC Catanzaro",
  "TSC Cerro Maggiore", "TSC Corciano", "TSC Firenze", "TSC Genova", "TSC Grosseto",
  "TSC Guidonia", "Sede Piazza Augusto Imperatore", "TSC Lamezia Terme", "TSC Limena",
  "TSC Livorno", "TSC Lugagnano", "TSC Montebello", "TSC Montesilvano", "TSC Napoli",
  "TSC Nola", "TSC Parma Barilla", "TSC Parma Campus", "TSC Pradamano", "TSC Quartucciu",
  "TSC Roma Moderno", "TSC Roma Parco de' Medici", "TSC Rozzano", "TSC Salerno",
  "TSC Sestu", "TSC Silea", "TSC Surbo", "TSC Terni", "TSC Torino",
  "TSC Torri di Quartesolo", "TSC Trieste", "TSC Vimercate"
];

/* --- CONFIGURAZIONE DINAMICA BLOCCHI CARAMELLE --- */
let candyGridConfigs = JSON.parse(localStorage.getItem("candy_grid_configs")) || {};

function getActiveCinemaCandyConfig() {
  if (!candyGridConfigs[cinemaName]) {
    candyGridConfigs[cinemaName] = {
      blocksCount: 2,
      orientation: "vertical",
      tares: [0.37, 0.72, 0.50, 1.00],
      blocks: [
        { id: "block_0", name: "🍬 Espositore Principale", columns: 22, rows: 2, gridValues: {} },
        { id: "block_1", name: "📦 Scorte / Magazzino", columns: 10, rows: 2, gridValues: {} }
      ],
      buste: Array(10).fill().map(() => ({kg: 0, sleeve: 0}))
    };
  }
  let cfg = candyGridConfigs[cinemaName];
  if (cfg.blocksCount === undefined) cfg.blocksCount = cfg.blocks ? cfg.blocks.length : 2;
  if (!cfg.orientation) cfg.orientation = "vertical";
  if (!cfg.tares || !Array.isArray(cfg.tares)) cfg.tares = [0.37, 0.72, 0.50, 1.00];
  if (!cfg.blocks || !Array.isArray(cfg.blocks)) {
    cfg.blocks = [
      { id: "block_0", name: "🍬 Espositore Principale", columns: 22, rows: 2, gridValues: {} },
      { id: "block_1", name: "📦 Scorte / Magazzino", columns: 10, rows: 2, gridValues: {} }
    ];
  }
  if (!cfg.buste || !Array.isArray(cfg.buste)) cfg.buste = Array(10).fill().map(() => ({kg: 0, sleeve: 0}));
  return cfg;
}

function saveCandyConfig() {
  localStorage.setItem("candy_grid_configs", JSON.stringify(candyGridConfigs));
}

function getCandyTotalKg() {
  const cfg = getActiveCinemaCandyConfig();
  let total = 0;
  if (cfg.blocks && Array.isArray(cfg.blocks)) {
    cfg.blocks.forEach(block => {
      let rowsCount = parseInt(block.rows) || 0;
      let colsCount = parseInt(block.columns) || 0;
      for(let r=0; r<rowsCount; r++) {
        for(let c=0; c<colsCount; c++) {
          let cellData = block.gridValues?.[r]?.[c];
          if (cellData) {
            let weight = n(cellData.weight || 0);
            let taraIdx = parseInt(cellData.taraIdx) || 0;
            let taraVal = n(cfg.tares[taraIdx] || 0);
            total += Math.max(0, weight - taraVal);
          }
        }
      }
    });
  }
  if (Array.isArray(cfg.buste)) {
    cfg.buste.forEach(b => { total += n(b.kg) * n(b.sleeve); });
  }
  return total;
}

/* --- CONFIGURAZIONE DINAMICA POST MIX --- */
let postMixGridConfigs = JSON.parse(localStorage.getItem("postmix_grid_configs")) || {};

function getActiveCinemaPostMixConfig() {
  if (!postMixGridConfigs[cinemaName]) {
    postMixGridConfigs[cinemaName] = {
      blocksCount: 1,
      orientation: "vertical",
      blocks: [
        { id: "pm_block_0", name: "🥤 Post Mix Principale", columns: 6, rows: 4, gridValues: {} }
      ]
    };
  }
  let cfg = postMixGridConfigs[cinemaName];
  if (cfg.blocksCount === undefined) cfg.blocksCount = cfg.blocks ? cfg.blocks.length : 1;
  if (!cfg.orientation) cfg.orientation = "vertical";
  if (!cfg.blocks || !Array.isArray(cfg.blocks)) {
    cfg.blocks = [{ id: "pm_block_0", name: "🥤 Post Mix Principale", columns: 6, rows: 4, gridValues: {} }];
  }
  return cfg;
}

function savePostMixConfig() {
  localStorage.setItem("postmix_grid_configs", JSON.stringify(postMixGridConfigs));
}

function getPostMixProductTotals() {
  const cfg = getActiveCinemaPostMixConfig();
  let totals = {}; 
  if (cfg.blocks && Array.isArray(cfg.blocks)) {
    cfg.blocks.forEach(block => {
      let rowsCount = parseInt(block.rows) || 0;
      let colsCount = parseInt(block.columns) || 0;
      for(let r=0; r<rowsCount; r++) {
        for(let c=0; c<colsCount; c++) {
          let cellData = block.gridValues?.[r]?.[c];
          if (cellData && cellData.prodName) {
            let weight = n(cellData.weight || 0);
            let prodName = cellData.prodName;
            let pmItem = postMixProducts.find(p => p.name === prodName);
            let taraVal = pmItem ? n(pmItem.tara) : 0;
            let netKg = Math.max(0, weight - taraVal);
            totals[prodName] = (totals[prodName] || 0) + netKg;
          }
        }
      }
    });
  }
  return totals;
}

/* --- CONFIGURAZIONE DISTRIBUTORI --- */
let distributorGridConfigs = JSON.parse(localStorage.getItem("distributor_grid_configs")) || {};

function getActiveCinemaDistributorConfig() {
  if (!distributorGridConfigs[cinemaName]) {
    distributorGridConfigs[cinemaName] = {
      distributorsCount: 2,
      distributors: [
        { id: "dist_0", name: "MARS 1-9", date: "13/08/2026", fondoResti: 35, rows: Array(20).fill().map(() => ({ product: "", stockIniziale: "", ins: ["", "", "", "", ""], contaFinale: "", prezzoVendita: "" })) },
        { id: "dist_1", name: "MARS 10-18", date: "13/08/2026", fondoResti: 35, rows: Array(20).fill().map(() => ({ product: "", stockIniziale: "", ins: ["", "", "", "", ""], contaFinale: "", prezzoVendita: "" })) }
      ]
    };
  }
  let cfg = distributorGridConfigs[cinemaName];
  if (cfg.distributorsCount === undefined) cfg.distributorsCount = cfg.distributors ? cfg.distributors.length : 2;
  if (!cfg.distributors || !Array.isArray(cfg.distributors)) {
    cfg.distributors = [];
  }
  return cfg;
}

function saveDistributorConfig() {
  localStorage.setItem("distributor_grid_configs", JSON.stringify(distributorGridConfigs));
}

function getDistributorsContaFinaleTotals() {
  const cfg = getActiveCinemaDistributorConfig();
  let totals = {};
  if (cfg.distributors && Array.isArray(cfg.distributors)) {
    cfg.distributors.forEach(d => {
      if (d.rows && Array.isArray(d.rows)) {
        d.rows.forEach(r => {
          if (r.product && r.contaFinale !== "" && !isNaN(n(r.contaFinale))) {
            let prodNameNorm = norm(r.product);
            totals[prodNameNorm] = (totals[prodNameNorm] || 0) + n(r.contaFinale);
          }
        });
      }
    });
  }
  return totals;
}

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  loadSetupFromStorage();
  loadCountsFromStorage();
  updateHeaderTitle();
  injectExcelTemplateButton();
  const bottomExportBtns = document.querySelectorAll("button[onclick*='export'], .btn-export");
  bottomExportBtns.forEach(btn => btn.remove());
  if ($("magFile")) {
    $("magFile").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if ($("magStatus")) $("magStatus").textContent = "Lettura del report in corso...";
      readMatrix(f).then(m => {
        mag = parseMag(m);
        if ($("magStatus")) $("magStatus").textContent = `✓ ${f.name} (${mag.length} articoli)`;
        build();
      }).catch(err => {
        if ($("magStatus")) $("magStatus").textContent = "❌ Errore file Magazzino";
        showError("Errore file Magazzino: " + err.message);
      });
    });
  }
  if ($("sizeFile")) {
    $("sizeFile").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if ($("sizeStatus")) $("sizeStatus").textContent = "Lettura anagrafica in corso...";
      readMatrix(f).then(m => {
        let parsedSizeResult = parseSize(m);
        size = parsedSizeResult.size;
        postMixProducts = parsedSizeResult.postMix;
        if ($("sizeStatus")) $("sizeStatus").textContent = `✓ ${f.name} (${size.length} articoli, ${postMixProducts.length} post-mix)`;
        build();
      }).catch(err => {
        if ($("sizeStatus")) $("sizeStatus").textContent = "❌ Errore file SIZE";
        showError("Errore file SIZE: " + err.message);
      });
    });
  }
  if ($("search")) {
    $("search").addEventListener("input", render);
  }
});

/* --- RENDER DELLE SCHEDE SPECIALI (CARAMELLE) --- */
function renderCandyView() {
  const container = $("tbody");
  const thead = $("thead");
  if (!container || !thead) return;
  const cfg = getActiveCinemaCandyConfig();
  if (!cfg.orientation) cfg.orientation = 'vertical';
  
  thead.innerHTML = `<tr><th colspan="10" style="background:#d35400; color:white; font-size:1.1rem; padding:10px;">🍬 Gestione Inserimento Caramelle (${esc(cinemaName)})</th></tr>`;
  
  let html = `<tr><td colspan="10" style="padding:20px; background:#fff3e0;">`;
  
  const totalKg = typeof getCandyTotalKg === 'function' ? getCandyTotalKg() : 0;
  html += `
    <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:20px; background:white; padding:15px; border-radius:8px; border:1px solid #ffe0b2;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
        <h3 style="color:#d35400; margin:0;">Totale Netto Caramelle: <span id="candyTotalKgDisplay">${totalKg.toFixed(2)} Kg</span></h3>
      </div>
      
      <!-- Tare -->
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span style="font-size:0.85rem; font-weight:bold; color:#d35400;">Tare (Kg):</span>
        ${[0,1,2,3].map(i => `
          <div style="display:flex; align-items:center; gap:4px;">
            <span style="font-size:0.75rem; color:#666;">T${i+1}:</span>
            <input type="number" step="any" value="${cfg.tares?.[i] !== undefined ? cfg.tares[i] : ''}" placeholder="0.00" 
              style="width:70px; padding:4px; text-align:center; font-size:0.85rem; border:1px solid #ccc; border-radius:4px;"
              oninput="updateCandyTareInput(${i}, this.value)">
          </div>
        `).join('')}
      </div>
      <!-- Menù Blocchi e Orientamento -->
      <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap; border-top:1px solid #eee; padding-top:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.85rem; font-weight:bold; color:#666;">Numero Blocchi:</label>
          <select style="padding:4px 8px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px;" onchange="updateCandyBlocksCount(this.value)">
            ${[1, 2, 3, 4, 5, 6].map(nOpt => `<option value="${nOpt}" ${cfg.blocksCount === nOpt ? 'selected' : ''}>${nOpt} Blocchi</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.85rem; font-weight:bold; color:#666;">Orientamento Griglia:</label>
          <select style="padding:4px 8px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px; background:#fff8f0; font-weight:bold; color:#d35400;" onchange="updateCandyOrientation(this.value)">
            <option value="vertical" ${cfg.orientation === 'vertical' ? 'selected' : ''}>⬇️ Verticale (dall'alto in basso)</option>
            <option value="horizontal" ${cfg.orientation === 'horizontal' ? 'selected' : ''}>➡️ Orizzontale (da sinistra a destra)</option>
          </select>
        </div>
      </div>
    </div>
  `;

  const blocksContainerStyle = (cfg.orientation === 'horizontal')
    ? 'display: flex; flex-direction: row; gap: 20px; overflow-x: auto; width: 100%; align-items: flex-start; padding-bottom: 10px;'
    : 'display: flex; flex-direction: column; gap: 20px; width: 100%;';

  html += `<div style="${blocksContainerStyle}">`;

  cfg.blocks.forEach((b, bIdx) => {
    const blockBoxStyle = (cfg.orientation === 'horizontal')
      ? 'background:white; padding:15px; border-radius:8px; border:1px solid #ffe0b2; min-width:380px; flex:1;'
      : 'background:white; padding:15px; border-radius:8px; border:1px solid #ffe0b2; width:100%; box-sizing:border-box;';

    html += `<div style="${blockBoxStyle}">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
                <h5 style="color:#e67e22; margin:0;">${esc(b.name)}</h5>
                <div style="display:flex; gap:15px; align-items:center;">
                  <div style="display:flex; align-items:center; gap:5px;">
                    <label style="font-size:0.8rem; color:#666;">Righe:</label>
                    <select style="padding:2px 6px; font-size:0.8rem; border:1px solid #ccc; border-radius:4px;" onchange="updateCandyBlockRows(${bIdx}, this.value)">
                      ${Array(10).fill(0).map((_, i) => `<option value="${i+1}" ${b.rows === (i+1) ? 'selected' : ''}>${i+1}</option>`).join('')}
                    </select>
                  </div>
                  <div style="display:flex; align-items:center; gap:5px;">
                    <label style="font-size:0.8rem; color:#666;">Colonne:</label>
                    <select style="padding:2px 6px; font-size:0.8rem; border:1px solid #ccc; border-radius:4px;" onchange="updateCandyBlockCols(${bIdx}, this.value)">
                      ${Array(35).fill(0).map((_, i) => `<option value="${i+1}" ${b.columns === (i+1) ? 'selected' : ''}>${i+1}</option>`).join('')}
                    </select>
                  </div>
                </div>
              </div>`;
    let gridStyle = '';
    let cellOrder = [];
    if (cfg.orientation === 'horizontal') {
      gridStyle = `display: grid; grid-template-columns: repeat(${b.columns}, minmax(110px, 1fr)); gap: 8px; margin-top: 8px; overflow-x: auto; padding-bottom: 5px;`;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.columns; c++) {
          let num = (r * b.columns) + c + 1;
          cellOrder.push({ r, c, num });
        }
      }
    } else {
      gridStyle = `display: grid; grid-template-rows: repeat(${b.rows}, auto); grid-auto-flow: column; grid-auto-columns: minmax(115px, 1fr); gap: 8px; margin-top: 8px; overflow-x: auto; padding: 10px; background: #fffdfa; border: 2px dashed #e67e22; border-radius: 6px;`;
      for (let c = 0; c < b.columns; c++) {
        for (let r = 0; r < b.rows; r++) {
          let num = (c * b.rows) + r + 1;
          cellOrder.push({ r, c, num });
        }
      }
    }
    html += `<div style="${gridStyle}">`;
    cellOrder.forEach(({ r, c, num }) => {
      let cell = b.gridValues?.[r]?.[c] || { weight: "", taraIdx: 0 };
      let selectedTaraIdx = cell.taraIdx !== undefined ? cell.taraIdx : 0;
      let badgeBg = cfg.orientation === 'vertical' ? '#e67e22' : '#7f8c8d';
      html += `
        <div style="border:1px solid #ddd; padding:6px; text-align:center; background:white; border-radius:6px; display:flex; flex-direction:column; gap:4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; font-weight:bold; background:${badgeBg}; color:white; padding:1px 5px; border-radius:3px;">N° ${num}</span>
            <span style="font-size:0.65rem; color:#888;">R${r+1}-C${c+1}</span>
          </div>
          <select style="font-size:0.75rem; padding:2px; border:1px solid #ccc; border-radius:3px; background:white;" onchange="updateCandyCellTara(${bIdx}, ${r}, ${c}, this.value)">
            ${cfg.tares.map((tVal, tIdx) => `<option value="${tIdx}" ${selectedTaraIdx === tIdx ? 'selected' : ''}>Tara: ${tVal}kg</option>`).join('')}
          </select>
          <input type="number" step="any" placeholder="Kg" value="${cell.weight || ''}" style="width:100%; font-size:0.85rem; text-align:center; padding:3px; border:1px solid #bbb; border-radius:4px;" 
            oninput="updateCandyCellWeight(${bIdx}, ${r}, ${c}, this.value)">
        </div>`;
    });
    html += `</div></div>`;
  });

  html += `</div>`;

  if (cfg.buste) {
    html += `
      <div style="margin-top:25px; background:white; padding:15px; border-radius:8px; border:1px solid #ffe0b2;">
        <h5 style="color:#e67e22; margin-bottom:10px;">📦 Gestione Buste e Scorte Sfuse</h5>
        <p style="font-size:0.85rem; color:#666; margin-bottom:12px;">Inserisci i Kg lordi e il numero di sleeve per ciascuna busta.</p>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:10px;">
    `;
    cfg.buste.forEach((busta, bIdx) => {
      html += `
        <div style="border:1px solid #ddd; padding:10px; border-radius:6px; background:#fafafa; display:flex; flex-direction:column; gap:6px;">
          <span style="font-size:0.8rem; font-weight:bold; color:#444;">Busta ${bIdx + 1}</span>
          <div style="display:flex; gap:6px;">
            <div style="flex:1;">
              <label style="font-size:0.7rem; color:#666; display:block;">Kg Lordi</label>
              <input type="number" step="any" value="${busta.kg || ''}" placeholder="0.00" style="width:100%; padding:4px; text-align:center; font-size:0.85rem;" oninput="updateBustaData(${bIdx}, 'kg', this.value)">
            </div>
            <div style="flex:1;">
              <label style="font-size:0.7rem; color:#666; display:block;">Sleeve (Pz)</label>
              <input type="number" step="any" value="${busta.sleeve || ''}" placeholder="0" style="width:100%; padding:4px; text-align:center; font-size:0.85rem;" oninput="updateBustaData(${bIdx}, 'sleeve', this.value)">
            </div>
          </div>
        </div>
      `;
    });
    html += `</div></div>`;
  }
  html += `</td></tr>`;
  container.innerHTML = html;
}

function updateCandyTareInput(idx, val) {
  const cfg = getActiveCinemaCandyConfig();
  if (!cfg.tares) cfg.tares = [0.37, 0.72, 0.50, 1.00];
  cfg.tares[idx] = n(val);
  saveCandyConfig();
  updateCandyTotalUI();
}

function updateCandyBlocksCount(countVal) {
  const cfg = getActiveCinemaCandyConfig();
  let count = parseInt(countVal) || 2;
  cfg.blocksCount = count;
  while (cfg.blocks.length < count) {
    cfg.blocks.push({ id: `block_${cfg.blocks.length}`, name: `📦 Blocco ${cfg.blocks.length + 1}`, columns: 10, rows: 2, gridValues: {} });
  }
  cfg.blocks = cfg.blocks.slice(0, count);
  saveCandyConfig();
  renderCandyView();
  recalcKPIs();
}

function updateCandyOrientation(orient) {
  const cfg = getActiveCinemaCandyConfig();
  if (!cfg) return;
  cfg.orientation = orient;
  saveCandyConfig();
  renderCandyView();
}

function updateCandyBlockRows(bIdx, rowsVal) {
  const cfg = getActiveCinemaCandyConfig();
  if (cfg.blocks[bIdx]) {
    cfg.blocks[bIdx].rows = Math.max(1, parseInt(rowsVal) || 1);
    saveCandyConfig();
    renderCandyView();
    recalcKPIs();
  }
}

function updateCandyBlockCols(bIdx, colsVal) {
  const cfg = getActiveCinemaCandyConfig();
  if (cfg.blocks[bIdx]) {
    cfg.blocks[bIdx].columns = Math.max(1, parseInt(colsVal) || 1);
    saveCandyConfig();
    renderCandyView();
    recalcKPIs();
  }
}

function updateCandyCellWeight(bIdx, r, c, val) {
  const cfg = getActiveCinemaCandyConfig();
  if (!cfg.blocks[bIdx].gridValues) cfg.blocks[bIdx].gridValues = {};
  if (!cfg.blocks[bIdx].gridValues[r]) cfg.blocks[bIdx].gridValues[r] = {};
  if (!cfg.blocks[bIdx].gridValues[r][c]) cfg.blocks[bIdx].gridValues[r][c] = { weight: "", taraIdx: 0 };
  
  cfg.blocks[bIdx].gridValues[r][c].weight = val;
  saveCandyConfig();
  updateCandyTotalUI();
}

function updateCandyCellTara(bIdx, r, c, taraIdx) {
  const cfg = getActiveCinemaCandyConfig();
  if (!cfg.blocks[bIdx].gridValues) cfg.blocks[bIdx].gridValues = {};
  if (!cfg.blocks[bIdx].gridValues[r]) cfg.blocks[bIdx].gridValues[r] = {};
  if (!cfg.blocks[bIdx].gridValues[r][c]) cfg.blocks[bIdx].gridValues[r][c] = { weight: "", taraIdx: 0 };
  
  cfg.blocks[bIdx].gridValues[r][c].taraIdx = parseInt(taraIdx) || 0;
  saveCandyConfig();
  updateCandyTotalUI();
}

function updateBustaData(bIdx, field, val) {
  const cfg = getActiveCinemaCandyConfig();
  if (!cfg.buste[bIdx]) cfg.buste[bIdx] = { kg: 0, sleeve: 0 };
  cfg.buste[bIdx][field] = n(val);
  saveCandyConfig();
  updateCandyTotalUI();
}

function updateCandyTotalUI() {
  const totalEl = document.getElementById("candyTotalKgDisplay");
  if (totalEl) {
    totalEl.textContent = `${getCandyTotalKg().toFixed(2)} Kg`;
  }
  recalcKPIs();
}

/* --- RENDER POST MIX --- */
function renderPostMixView() {
  const container = $("tbody");
  const thead = $("thead");
  if (!container || !thead) return;
  
  const cfg = getActiveCinemaPostMixConfig();
  if (!cfg.orientation) cfg.orientation = 'vertical';

  thead.innerHTML = `<tr><th colspan="10" style="background:#2980b9; color:white; font-size:1.1rem; padding:10px;">🥤 Post Mix e Sciroppi (${esc(cinemaName)})</th></tr>`;

  let html = `<tr><td colspan="10" style="padding:15px; background:#eaf2f8;">`;

  const totals = typeof getPostMixProductTotals === 'function' ? getPostMixProductTotals() : {};
  const productKeys = Object.keys(totals);

  html += `
    <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:20px; background:white; padding:15px; border-radius:8px; border:1px solid #aed6f1;">
      <div>
        <h4 style="color:#2980b9; margin:0 0 10px 0;">Totali Rilevati Sciroppi:</h4>
        <ul style="margin:0; padding-left:20px; font-size:0.9rem;">
  `;

  if (productKeys.length === 0) {
    html += `<li style="color:#666;">Nessun dato inserito.</li>`;
  } else {
    for (let p of productKeys) {
      html += `<li><b>${esc(p)}:</b> ${totals[p].toFixed(2)} Kg netti</li>`;
    }
  }

  html += `
        </ul>
      </div>

      <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap; border-top:1px solid #eee; padding-top:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.85rem; font-weight:bold; color:#666;">Numero Blocchi:</label>
          <select style="padding:4px 8px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px;" onchange="updatePostMixBlocksCount(this.value)">
            ${[1, 2, 3, 4, 5, 6].map(nOpt => `<option value="${nOpt}" ${cfg.blocksCount === nOpt ? 'selected' : ''}>${nOpt} Blocchi</option>`).join('')}
          </select>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="font-size:0.85rem; font-weight:bold; color:#666;">Orientamento Griglia:</label>
          <select style="padding:4px 8px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px; background:#f0f8ff; font-weight:bold; color:#2980b9;" onchange="updatePostMixOrientation(this.value)">
            <option value="vertical" ${cfg.orientation === 'vertical' ? 'selected' : ''}>⬇️ Verticale (dall'alto in basso)</option>
            <option value="horizontal" ${cfg.orientation === 'horizontal' ? 'selected' : ''}>➡️ Orizzontale (da sinistra a destra)</option>
          </select>
        </div>
      </div>
    </div>
  `;

  const pmContainerStyle = (cfg.orientation === 'horizontal')
    ? 'display:flex; flex-direction:row; gap:15px; overflow-x:auto; padding-bottom:10px; width:100%; align-items:flex-start;'
    : 'display:flex; flex-direction:column; gap:15px; width:100%;';

  html += `<div style="${pmContainerStyle}">`;

  cfg.blocks.forEach((b, bIdx) => {
    const blockBoxStyle = (cfg.orientation === 'horizontal')
      ? 'background:white; padding:15px; border-radius:8px; border:1px solid #aed6f1; min-width:340px; flex:1;'
      : 'background:white; padding:15px; border-radius:8px; border:1px solid #aed6f1; width:100%; box-sizing:border-box;';

    html += `
      <div style="${blockBoxStyle}">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
          <h5 style="color:#2980b9; margin:0;">${esc(b.name)}</h5>
          <div style="display:flex; gap:15px; align-items:center;">
            <div style="display:flex; align-items:center; gap:5px;">
              <label style="font-size:0.8rem; color:#666;">Righe:</label>
              <select style="padding:2px 6px; font-size:0.8rem; border:1px solid #ccc; border-radius:4px;" onchange="updatePostMixBlockRows(${bIdx}, this.value)">
                ${Array(10).fill(0).map((_, i) => `<option value="${i+1}" ${b.rows === (i+1) ? 'selected' : ''}>${i+1}</option>`).join('')}
              </select>
            </div>
            <div style="display:flex; align-items:center; gap:5px;">
              <label style="font-size:0.8rem; color:#666;">Colonne:</label>
              <select style="padding:2px 6px; font-size:0.8rem; border:1px solid #ccc; border-radius:4px;" onchange="updatePostMixBlockCols(${bIdx}, this.value)">
                ${Array(35).fill(0).map((_, i) => `<option value="${i+1}" ${b.columns === (i+1) ? 'selected' : ''}>${i+1}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
    `;

    let gridStyle = '';
    let cellOrder = [];

    if (cfg.orientation === 'horizontal') {
      gridStyle = `display: grid; grid-template-columns: repeat(${b.columns}, minmax(130px, 1fr)); gap: 8px; margin-top: 8px; overflow-x: auto; padding-bottom: 5px;`;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.columns; c++) {
          let num = (r * b.columns) + c + 1;
          cellOrder.push({ r, c, num });
        }
      }
    } else {
      gridStyle = `display: grid; grid-template-rows: repeat(${b.rows}, auto); grid-auto-flow: column; grid-auto-columns: minmax(130px, 1fr); gap: 8px; margin-top: 8px; overflow-x: auto; padding: 10px; background: #f4fbfd; border: 2px dashed #2980b9; border-radius: 6px;`;
      for (let c = 0; c < b.columns; c++) {
        for (let r = 0; r < b.rows; r++) {
          let num = (c * b.rows) + r + 1;
          cellOrder.push({ r, c, num });
        }
      }
    }

    html += `<div style="${gridStyle}">`;

    cellOrder.forEach(({ r, c, num }) => {
      let cell = b.gridValues?.[r]?.[c] || { prodName: "", weight: "" };
      let badgeBg = cfg.orientation === 'vertical' ? '#2980b9' : '#7f8c8d';

      html += `
        <div style="border:1px solid #ddd; padding:6px; text-align:center; background:#fafafa; border-radius:6px; display:flex; flex-direction:column; gap:4px; min-width:125px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:0.75rem; font-weight:bold; background:${badgeBg}; color:white; padding:1px 5px; border-radius:3px;">N° ${num}</span>
            <span style="font-size:0.65rem; color:#888;">R${r+1}-C${c+1}</span>
          </div>
          <select style="font-size:0.75rem; padding:2px; border:1px solid #ccc; border-radius:3px; background:white;" 
                  onchange="updatePostMixCell(${bIdx}, ${r}, ${c}, this.value, null)">
            <option value="">-- Prodotto --</option>
            ${postMixProducts.map(p => `<option value="${esc(p.name)}" ${cell.prodName === p.name ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
          </select>
          <input type="number" step="any" placeholder="Kg Lordi" value="${cell.weight || ''}" 
                 style="width:100%; font-size:0.85rem; text-align:center; padding:3px; border:1px solid #bbb; border-radius:4px;" 
                 oninput="updatePostMixCell(${bIdx}, ${r}, ${c}, null, this.value)">
        </div>`;
    });

    html += `</div></div>`;
  });

  html += `</div></td></tr>`;
  container.innerHTML = html;
}

function updatePostMixCell(bIdx, r, c, prodName, weight) {
  const cfg = getActiveCinemaPostMixConfig();
  if (!cfg.blocks[bIdx].gridValues) cfg.blocks[bIdx].gridValues = {};
  if (!cfg.blocks[bIdx].gridValues[r]) cfg.blocks[bIdx].gridValues[r] = {};
  let current = cfg.blocks[bIdx].gridValues[r][c] || { prodName: "", weight: "" };
  
  if (prodName !== null) current.prodName = prodName;
  if (weight !== null) current.weight = weight;
  
  cfg.blocks[bIdx].gridValues[r][c] = current;
  savePostMixConfig();
  recalcKPIs();
}

function updatePostMixOrientation(val) {
  const cfg = getActiveCinemaPostMixConfig();
  if (!cfg) return;
  cfg.orientation = val;
  savePostMixConfig();
  renderPostMixView();
}

function updatePostMixBlocksCount(val) {
  const cfg = getActiveCinemaPostMixConfig();
  if (!cfg) return;
  const count = parseInt(val, 10);
  if (isNaN(count) || count < 1) return;

  cfg.blocksCount = count;
  if (!cfg.blocks) cfg.blocks = [];

  while (cfg.blocks.length < count) {
    const nextIdx = cfg.blocks.length + 1;
    cfg.blocks.push({
      name: nextIdx === 1 ? 'Post Mix Principale' : `Post Mix Blocco ${nextIdx}`,
      rows: 4,
      columns: 6,
      gridValues: {}
    });
  }

  if (cfg.blocks.length > count) {
    cfg.blocks = cfg.blocks.slice(0, count);
  }

  savePostMixConfig();
  renderPostMixView();
}

function updatePostMixBlockRows(bIdx, val) {
  const cfg = getActiveCinemaPostMixConfig();
  if (!cfg || !cfg.blocks || !cfg.blocks[bIdx]) return;
  const rows = parseInt(val, 10);
  if (isNaN(rows) || rows < 1) return;

  cfg.blocks[bIdx].rows = rows;
  savePostMixConfig();
  renderPostMixView();
}

function updatePostMixBlockCols(bIdx, val) {
  const cfg = getActiveCinemaPostMixConfig();
  if (!cfg || !cfg.blocks || !cfg.blocks[bIdx]) return;
  const cols = parseInt(val, 10);
  if (isNaN(cols) || cols < 1) return;

  cfg.blocks[bIdx].columns = cols;
  savePostMixConfig();
  renderPostMixView();
}

/* ==========================================================================
   MODULO DISTRIBUTORI AUTOMATICI (Integrazione Excel & Magazzino)
   ========================================================================== */

function getAvailableProductsList() {
  let productsSet = new Set();
  
  if (typeof rows !== 'undefined' && Array.isArray(rows)) {
    rows.forEach(r => {
      const name = r.name || r.prodotto || r.product || r.Descrizione || r.Articolo;
      if (name) productsSet.add(name.trim());
    });
  }
  if (window.inventoryData && Array.isArray(window.inventoryData)) {
    window.inventoryData.forEach(item => {
      const name = item.prodotto || item.product || item.name;
      if (name) productsSet.add(name.trim());
    });
  }

  if (typeof getAllProducts === 'function') {
    try {
      const prods = getAllProducts();
      if (Array.isArray(prods)) {
        prods.forEach(p => { if (p) productsSet.add(p.trim()); });
      }
    } catch (e) {
      console.warn("getAllProducts non eseguibile:", e);
    }
  }
  if (window.globalProductsList && Array.isArray(window.globalProductsList)) {
    window.globalProductsList.forEach(p => { if (p) productsSet.add(p.trim()); });
  }

  if (productsSet.size > 0) {
    return Array.from(productsSet).sort();
  }

  return [
    "Bounty", "MM Peanuts 45gr", "MM Choco 45gr", "MM Crispy 36gr", "Twix", "Mars", "Snickers", 
    "Kinder Bueno", "Kinder Barrette", "KitKat", "Maltesers", "Haribo", "Patatine San Carlo", "Coca Cola", "Acqua"
  ];
}

function renderDistributorsView() {
  const container = document.querySelector("tbody");
  const thead = document.querySelector("thead");
  if (!container || !thead) return;

  const cfg = getActiveCinemaDistributorConfig();
  if (!cfg.distributors) cfg.distributors = [];
  if (!cfg.orientation) cfg.orientation = 'horizontal';

  // Sincronizza i dati con lo stock generale in sicurezza
  syncDistributorsToGlobalStock();

  let maxInsCount = 5;
  cfg.distributors.forEach(d => {
    (d.rows || []).forEach(r => {
      const insArray = r.insertions || [];
      const filledIns = insArray.filter(v => v !== "" && v !== null && !isNaN(v)).length;
      if (filledIns >= maxInsCount) {
        maxInsCount = filledIns + 1;
      }
    });
  });

  const cName = (typeof cinemaName !== 'undefined') ? cinemaName : '';
  thead.innerHTML = `<tr><th colspan="25" style="background:#8e44ad; color:white; font-size:1.1rem; padding:10px;">🍫 Distributori Automatici (${esc(cName)})</th></tr>`;

  let html = `<tr><td colspan="25" style="padding:15px; background:#f5eef8;">`;

  html += `
    <div style="background:white; padding:15px; border-radius:8px; border:1px solid #d2b4de; margin-bottom:20px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:15px;">
        
        <div style="display:flex; align-items:center; gap:15px; flex-wrap:wrap;">
          <div>
            <label style="font-size:0.85rem; font-weight:bold; color:#666; display:block;">N° Distributori:</label>
            <select style="padding:5px 10px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px;" onchange="updateDistributorsCount(this.value)">
              ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${cfg.distributors.length === n ? 'selected' : ''}>${n} Distributori</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="font-size:0.85rem; font-weight:bold; color:#666; display:block;">Disposizione Layout:</label>
            <select style="padding:5px 10px; font-size:0.85rem; border:1px solid #ccc; border-radius:4px;" onchange="updateDistributorOrientation(this.value)">
              <option value="horizontal" ${cfg.orientation === 'horizontal' ? 'selected' : ''}>↔️ Orizzontale (Affiancati)</option>
              <option value="vertical" ${cfg.orientation === 'vertical' ? 'selected' : ''}>↕️ Verticale (In Colonna)</option>
            </select>
          </div>
        </div>

        <button style="background:#27ae60; color:white; border:none; padding:8px 15px; border-radius:5px; font-weight:bold; cursor:pointer;" onclick="renderDistributorsView()">
          🔄 Aggiorna / Rinfresca
        </button>
      </div>
    </div>
  `;

  const containerStyle = cfg.orientation === 'horizontal' 
    ? 'display: flex; flex-direction: row; gap: 20px; overflow-x: auto; align-items: flex-start; padding-bottom: 15px;' 
    : 'display: flex; flex-direction: column; gap: 20px;';

  html += `<div style="${containerStyle}">`;

  const availableProducts = getAvailableProductsList();

  cfg.distributors.forEach((d, dIdx) => {
    const todayStr = d.date || new Date().toLocaleDateString('it-IT');

    html += `
      <div style="background:white; padding:12px; border-radius:8px; border:2px solid #8e44ad; min-width:780px; box-shadow:0 4px 6px rgba(0,0,0,0.05); flex-shrink:0;">
        
        <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:0.85rem;">
          <tr>
            <td style="font-weight:bold; text-align:right; width:30%; padding:2px 5px;">Data:</td>
            <td style="background:#f1f1f1; text-align:center; font-weight:bold; width:20%; border:1px solid #ccc;">${todayStr}</td>
            <td style="width:10%;"></td>
            <td style="background:#f1c40f; text-align:center; font-weight:bold; border:1px solid #b7950b;" colspan="2">
              <input type="text" value="${esc(d.name || `MARS ${dIdx + 1}`)}" 
                     style="width:90%; font-weight:bold; text-align:center; background:transparent; border:none; font-size:0.9rem;" 
                     onchange="updateDistributorMeta(${dIdx}, 'name', this.value)">
            </td>
          </tr>
          <tr>
            <td style="font-weight:bold; text-align:right; padding:2px 5px;">Distributore n°:</td>
            <td style="background:#fff; text-align:center; font-weight:bold; color:red; border:1px solid #ccc;">${dIdx + 1}</td>
            <td colspan="3"></td>
          </tr>
          <tr>
            <td style="font-weight:bold; text-align:right; padding:2px 5px;">Importo fondi resti:</td>
            <td style="background:#fff; border:1px solid #ccc; text-align:center;">
              <input type="number" value="${d.fondoResti ?? 35}" 
                     style="width:100%; text-align:center; font-weight:bold; border:none;" 
                     onchange="updateDistributorMeta(${dIdx}, 'fondoResti', this.value)">
            </td>
            <td colspan="3"></td>
          </tr>
        </table>

        <div style="overflow-x:auto;">
          <table style="width:100%; font-size:0.75rem; border-collapse:collapse; text-align:center;" border="1" borderColor="#ddd">
            <thead>
              <tr style="background:#fcf3cf; color:#7d6608; font-weight:bold;">
                <th style="padding:6px; min-width:140px;">PRODOTTO</th>
                <th style="padding:6px; width:55px;">STOCK INIZIALE</th>`;

    for (let i = 1; i <= maxInsCount; i++) {
      html += `<th style="padding:4px; width:45px; background:#fef9e7;">INS.${i}</th>`;
    }

    html += `
                <th style="padding:6px; width:65px; background:#f9e79f;">Somma inserimenti</th>
                <th style="padding:6px; width:60px;">CONTA FINALE</th>
                <th style="padding:6px; width:60px; background:#fadbd8;">VENDUTO</th>
                <th style="padding:6px; width:65px;">PREZZO DI VENDITA</th>
                <th style="padding:6px; width:70px; background:#d4efdf;">INCASSO</th>
                <th style="padding:4px; width:30px;">❌</th>
              </tr>
            </thead>
            <tbody>`;

    let totIncassoDist = 0;
    let totVendutoDist = 0;

    (d.rows || []).forEach((r, rIdx) => {
      const stIniz = parseFloat(r.stockIniziale) || 0;
      let insSum = 0;
      const insArray = r.insertions || [];
      for (let i = 0; i < maxInsCount; i++) {
        insSum += parseFloat(insArray[i]) || 0;
      }

      const sommaInserimenti = stIniz + insSum;
      const cntFin = parseFloat(r.contaFinale) || 0;
      const venduto = Math.max(0, sommaInserimenti - cntFin);
      const prezzoVendita = parseFloat(r.prezzoVendita) || 0;
      const incasso = venduto * prezzoVendita;

      totVendutoDist += venduto;
      totIncassoDist += incasso;

      html += `
        <tr>
          <td style="padding:2px; text-align:left;">
            <select style="width:100%; font-size:0.75rem; border:1px solid #ccc; background:#fff; border-radius:3px; padding:2px;" onchange="updateDistRow(${dIdx}, ${rIdx}, 'product', this.value)">
              <option value="">-- Seleziona --</option>
              ${availableProducts.map(p => `<option value="${esc(p)}" ${r.product === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
            </select>
          </td>

          <td style="padding:2px;">
            <input type="number" value="${r.stockIniziale ?? ''}" placeholder="0" 
                   style="width:100%; text-align:center; border:none;" 
                   onchange="updateDistRow(${dIdx}, ${rIdx}, 'stockIniziale', this.value)">
          </td>`;

      for (let i = 0; i < maxInsCount; i++) {
        const valIns = insArray[i] ?? '';
        html += `
          <td style="padding:2px; background:#fefde8;">
            <input type="number" value="${valIns}" placeholder="-" 
                   style="width:100%; text-align:center; border:none; background:transparent;" 
                   onchange="updateDistRowIns(${dIdx}, ${rIdx}, ${i}, this.value)">
          </td>`;
      }

      html += `
          <td style="font-weight:bold; background:#fbf2c4;">${sommaInserimenti}</td>

          <td style="padding:2px;">
            <input type="number" value="${r.contaFinale ?? ''}" placeholder="0" 
                   style="width:100%; text-align:center; font-weight:bold; color:#27ae60; border:1px solid #bbb; border-radius:3px;" 
                   onchange="updateDistRow(${dIdx}, ${rIdx}, 'contaFinale', this.value)">
          </td>

          <td style="font-weight:bold; color:#c0392b; background:#fadbd8;">${venduto}</td>

          <td style="padding:2px;">
            <input type="number" step="0.10" value="${r.prezzoVendita ?? ''}" placeholder="€ 0.00" 
                   style="width:100%; text-align:center; border:none;" 
                   onchange="updateDistRow(${dIdx}, ${rIdx}, 'prezzoVendita', this.value)">
          </td>

          <td style="font-weight:bold; color:#1e8449; background:#d4efdf;">€ ${incasso.toFixed(2)}</td>

          <td style="padding:2px;">
            <button style="background:transparent; color:#e74c3c; border:none; cursor:pointer; font-weight:bold;" onclick="removeDistributorRow(${dIdx}, ${rIdx})">✕</button>
          </td>
        </tr>`;
    });

    html += `
            </tbody>
            <tfoot>
              <tr style="background:#eaedd5; font-weight:bold;">
                <td colspan="${2 + maxInsCount + 1}" style="text-align:right; padding:5px;">TOTALI:</td>
                <td>-</td>
                <td style="color:#c0392b;">${totVendutoDist} pz</td>
                <td>-</td>
                <td style="color:#1e8449; font-size:0.85rem;">€ ${totIncassoDist.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
          <button style="background:#8e44ad; color:white; border:none; padding:4px 10px; font-size:0.75rem; border-radius:4px; cursor:pointer; font-weight:bold;" 
                  onclick="addDistributorRow(${dIdx})">
            ➕ Aggiungi Prodotto
          </button>
        </div>

      </div>`;
  });

  html += `</div></td></tr>`;
  container.innerHTML = html;
}

function updateDistRow(dIdx, rIdx, key, val) {
  const cfg = getActiveCinemaDistributorConfig();
  if (cfg.distributors && cfg.distributors[dIdx] && cfg.distributors[dIdx].rows[rIdx]) {
    cfg.distributors[dIdx].rows[rIdx][key] = val;
    saveDistributorConfig();
    syncDistributorsToGlobalStock();
    if (typeof recalcKPIs === 'function') recalcKPIs();
    renderDistributorsView();
  }
}

function updateDistRowIns(dIdx, rIdx, insIdx, val) {
  const cfg = getActiveCinemaDistributorConfig();
  if (cfg.distributors && cfg.distributors[dIdx] && cfg.distributors[dIdx].rows[rIdx]) {
    const row = cfg.distributors[dIdx].rows[rIdx];
    if (!row.insertions) row.insertions = [];
    row.insertions[insIdx] = val !== "" ? parseFloat(val) || 0 : "";
    saveDistributorConfig();
    syncDistributorsToGlobalStock();
    if (typeof recalcKPIs === 'function') recalcKPIs();
    renderDistributorsView();
  }
}

function updateDistributorOrientation(val) {
  const cfg = getActiveCinemaDistributorConfig();
  cfg.orientation = val;
  saveDistributorConfig();
  renderDistributorsView();
}

function updateDistributorMeta(dIdx, key, val) {
  const cfg = getActiveCinemaDistributorConfig();
  if (cfg.distributors && cfg.distributors[dIdx]) {
    cfg.distributors[dIdx][key] = key === 'fondoResti' ? parseFloat(val) || 0 : val;
    saveDistributorConfig();
    if (typeof recalcKPIs === 'function') recalcKPIs();
  }
}

function updateDistributorsCount(val) {
  const cfg = getActiveCinemaDistributorConfig();
  const count = parseInt(val, 10);
  if (isNaN(count) || count < 1) return;

  if (!cfg.distributors) cfg.distributors = [];

  while (cfg.distributors.length < count) {
    const nextIdx = cfg.distributors.length + 1;
    cfg.distributors.push({
      name: `MARS ${nextIdx}`,
      fondoResti: 35,
      date: new Date().toLocaleDateString('it-IT'),
      rows: [
        { product: "Bounty", stockIniziale: "", insertions: [], contaFinale: "", prezzoVendita: 1.90 },
        { product: "MM Peanuts 45gr", stockIniziale: "", insertions: [], contaFinale: "", prezzoVendita: 1.90 },
        { product: "MM Choco 45gr", stockIniziale: "", insertions: [], contaFinale: "", prezzoVendita: 1.90 },
        { product: "Twix", stockIniziale: "", insertions: [], contaFinale: "", prezzoVendita: 1.90 },
        { product: "Mars", stockIniziale: "", insertions: [], contaFinale: "", prezzoVendita: 1.90 },
        { product: "Snickers", stockIniziale: "", insertions: [], contaFinale: "", prezzoVendita: 1.90 }
      ]
    });
  }

  if (cfg.distributors.length > count) {
    cfg.distributors = cfg.distributors.slice(0, count);
  }

  saveDistributorConfig();
  syncDistributorsToGlobalStock();
  if (typeof recalcKPIs === 'function') recalcKPIs();
  renderDistributorsView();
}

function addDistributorRow(dIdx) {
  const cfg = getActiveCinemaDistributorConfig();
  if (cfg.distributors && cfg.distributors[dIdx]) {
    if (!cfg.distributors[dIdx].rows) cfg.distributors[dIdx].rows = [];
    cfg.distributors[dIdx].rows.push({
      product: "",
      stockIniziale: "",
      insertions: [],
      contaFinale: "",
      prezzoVendita: 1.50
    });
    saveDistributorConfig();
    renderDistributorsView();
  }
}

function removeDistributorRow(dIdx, rIdx) {
  const cfg = getActiveCinemaDistributorConfig();
  if (cfg.distributors && cfg.distributors[dIdx] && cfg.distributors[dIdx].rows) {
    cfg.distributors[dIdx].rows.splice(rIdx, 1);
    saveDistributorConfig();
    syncDistributorsToGlobalStock();
    if (typeof recalcKPIs === 'function') recalcKPIs();
    renderDistributorsView();
  }
}

function syncDistributorsToGlobalStock() {
  const cfg = getActiveCinemaDistributorConfig();
  if (!cfg || !cfg.distributors) return;

  const totalsByProduct = {};
  cfg.distributors.forEach(d => {
    (d.rows || []).forEach(r => {
      if (r.product && r.contaFinale !== "" && r.contaFinale !== null && r.contaFinale !== undefined) {
        const val = parseFloat(r.contaFinale) || 0;
        const key = String(r.product).trim().toLowerCase();
        totalsByProduct[key] = (totalsByProduct[key] || 0) + val;
      }
    });
  });

  let updated = false;

  const updateItemStock = (item) => {
    const prodName = item.name || item.prodotto || item.product || item.Descrizione || item.Articolo;
    if (!prodName) return;
    const itemKey = String(prodName).trim().toLowerCase();
    
    if (totalsByProduct[itemKey] !== undefined) {
      const val = totalsByProduct[itemKey];
      // Assegna il valore a tutte le possibili varianti di campi totali/effettivi
      item.effettivo = val;
      item.effettivoTotale = val;
      item.effettivo_totale = val;
      item.totaleEffettivo = val;
      item.distributori = val;
      updated = true;
    }
  };

  // Aggiorna l'array 'rows'
  if (typeof rows !== 'undefined' && Array.isArray(rows)) {
    rows.forEach(updateItemStock);
  }

  // Aggiorna window.inventoryData
  if (window.inventoryData && Array.isArray(window.inventoryData)) {
    window.inventoryData.forEach(updateItemStock);
  }

  // Attiva le funzioni di ricalcolo KPI/Totali globali se presenti nell'app
  ['recalcKPIs', 'calculateTotals', 'updateTotals', 'recalculate'].forEach(fnName => {
    if (typeof window[fnName] === 'function') {
      try { window[fnName](); } catch (e) {}
    }
  });

  // Salva i dati in modo persistente
  ['saveInventory', 'saveData', 'save', 'salvaDati', 'saveToLocalStorage', 'saveRows'].forEach(fnName => {
    if (typeof window[fnName] === 'function') {
      try { window[fnName](); } catch (e) {}
    }
  });

  if (typeof updateGlobalStockFromDistributors === 'function') {
    try {
      updateGlobalStockFromDistributors(totalsByProduct, 'effettivoTotale');
    } catch (e) {}
  }
}
/* --- PULSANTI EXCEL ED ESPORTAZIONE --- */
function injectExcelTemplateButton() {
  const headerContainer = document.querySelector("header") || document.querySelector(".header") || document.body;
  if ($("exportTemplateBtnContainer")) return;
  const btnContainer = document.createElement("div");
  btnContainer.id = "exportTemplateBtnContainer";
  btnContainer.className = "no-print";
  btnContainer.style.cssText = "display: flex; gap: 12px; margin: 10px 0; align-items: center; flex-wrap: wrap;";
  const exportTemplateBtn = document.createElement("button");
  exportTemplateBtn.id = "btnExportExcelTemplate";
  exportTemplateBtn.className = "btn btn-secondary";
  exportTemplateBtn.innerHTML = "📋 Esporta Excel (Template Vuoto)";
  exportTemplateBtn.style.cssText = "background: #005a9e; color: white; border: none; padding: 9px 16px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(0,0,0,0.15);";
  exportTemplateBtn.onclick = () => handleDynamicExport(true);
  const exportCountsBtn = document.createElement("button");
  exportCountsBtn.id = "btnExportExcelCounts";
  exportCountsBtn.className = "btn btn-success";
  exportCountsBtn.innerHTML = "📊 Esporta Report (Conteggi Rilevati)";
  exportCountsBtn.style.cssText = "background: #27ae60; color: white; border: none; padding: 9px 16px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(0,0,0,0.15);";
  exportCountsBtn.onclick = () => handleDynamicExport(false);
  btnContainer.appendChild(exportTemplateBtn);
  btnContainer.appendChild(exportCountsBtn);
  const titleEl = $("appTitle") || headerContainer;
  if (titleEl && titleEl.parentNode) {
    titleEl.parentNode.insertBefore(btnContainer, titleEl.nextSibling);
  } else {
    document.body.insertBefore(btnContainer, document.body.firstChild);
  }
}

function handleDynamicExport(isEmptyTemplate) {
  if (currentTab === 'candy') {
    if (typeof exportCandyGridExcel === 'function') exportCandyGridExcel(isEmptyTemplate);
  } else if (currentTab === 'postmix') {
    if (typeof exportPostMixGridExcel === 'function') exportPostMixGridExcel(isEmptyTemplate);
  } else if (currentTab === 'distributors') {
    if (typeof exportDistributorsExcel === 'function') exportDistributorsExcel(isEmptyTemplate);
  } else {
    if (isEmptyTemplate) {
      if (typeof exportEmptyTemplateToExcel === 'function') exportEmptyTemplateToExcel();
    } else {
      if (typeof exportCurrentInventoryToExcel === 'function') exportCurrentInventoryToExcel();
    }
  }
}

function exportCandyGridExcel(isEmpty) {
  const cfg = getActiveCinemaCandyConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 20px; }
        .title-row { background-color: #D35400; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 8px; }
        .block-title { background-color: #E67E22; color: #FFFFFF; font-size: 11pt; font-weight: bold; padding: 5px; }
        th, td { border: 1px solid #CCCCCC; text-align: center; padding: 6px; font-size: 9pt; }
        .header-cell { background-color: #F5CBA7; font-weight: bold; }
        .val-cell { background-color: #FFFFFF; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="15" class="title-row">SCHEDA CARAMELLE — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;
  cfg.blocks.forEach(b => {
    html += `<table><tr><td colspan="${b.columns}" class="block-title">${esc(b.name)}</td></tr>`;
    for (let r = 0; r < b.rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < b.columns; c++) {
        let cellData = b.gridValues?.[r]?.[c];
        let valStr = "";
        if (!isEmpty && cellData) {
          let w = n(cellData.weight || 0);
          let tIdx = parseInt(cellData.taraIdx) || 0;
          let tVal = n(cfg.tares[tIdx] || 0);
          valStr = `${w} kg (Tara ${tVal})`;
        }
        html += `<td class="val-cell">${valStr}</td>`;
      }
      html += `</tr>`;
    }
    html += `</table><br/>`;
  });
  html += `
    <table>
      <tr><td colspan="4" class="block-title">📦 BUSTE E SCORTE SFUSE</td></tr>
      <tr class="header-cell"><th>N° Busta</th><th>Kg Lordi</th><th>Sleeve (Pz)</th><th>Totale Netto Kg</th></tr>
  `;
  cfg.buste.forEach((b, idx) => {
    let kg = isEmpty ? "" : b.kg;
    let sl = isEmpty ? "" : b.sleeve;
    let tot = isEmpty ? "" : (n(b.kg) * n(b.sleeve)).toFixed(2);
    html += `<tr><td>Busta ${idx + 1}</td><td>${kg}</td><td>${sl}</td><td>${tot}</td></tr>`;
  });
  html += `</table></body></html>`;
  downloadExcelBlob(html, `Caramelle_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

function exportPostMixGridExcel(isEmpty) {
  const cfg = getActiveCinemaPostMixConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 20px; }
        .title-row { background-color: #2980B9; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 8px; }
        .block-title { background-color: #3498DB; color: #FFFFFF; font-size: 11pt; font-weight: bold; padding: 5px; }
        th, td { border: 1px solid #CCCCCC; text-align: center; padding: 6px; font-size: 9pt; }
        .header-cell { background-color: #AED6F1; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="10" class="title-row">SCHEDA POST MIX — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;
  cfg.blocks.forEach(b => {
    html += `<table><tr><td colspan="${b.columns}" class="block-title">${esc(b.name)}</td></tr>`;
    for (let r = 0; r < b.rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < b.columns; c++) {
        let cellData = b.gridValues?.[r]?.[c];
        let valStr = "";
        if (!isEmpty && cellData && cellData.prodName) {
          valStr = `${cellData.prodName}: ${cellData.weight} kg`;
        }
        html += `<td>${valStr}</td>`;
      }
      html += `</tr>`;
    }
    html += `</table><br/>`;
  });
  html += `</body></html>`;
  downloadExcelBlob(html, `PostMix_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

function exportDistributorsExcel(isEmpty) {
  const cfg = getActiveCinemaDistributorConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 25px; width: 100%; }
        .title-row { background-color: #8E44AD; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 8px; }
        .dist-header { background-color: #9B59B6; color: #FFFFFF; font-weight: bold; font-size: 11pt; }
        th { background-color: #D2B4DE; border: 1px solid #BB8FCE; padding: 5px; font-size: 9pt; }
        td { border: 1px solid #D5D8DC; text-align: center; padding: 5px; font-size: 9pt; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="10" class="title-row">SCHEDA DISTRIBUTORI AUTOMATICI — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;
  cfg.distributors.forEach(d => {
    html += `
      <table>
        <tr><td colspan="10" class="dist-header">${esc(d.name)} — Data: ${d.date || ''} — Fondo Resti: €${d.fondoResti || 0}</td></tr>
        <tr>
          <th>Prodotto</th><th>Stock Iniziale</th><th>Ins 1</th><th>Ins 2</th><th>Ins 3</th><th>Ins 4</th><th>Ins 5</th><th>Conta Finale</th><th>Prezzo Vendita</th>
        </tr>
    `;
    d.rows.forEach(r => {
      if (r.product || isEmpty) {
        html += `
          <tr>
            <td style="text-align:left; font-weight:bold;">${esc(r.product)}</td>
            <td>${isEmpty ? '' : r.stockIniziale}</td>
            ${Array(5).fill(0).map((_, i) => `<td>${isEmpty ? '' : (r.ins?.[i] || '')}</td>`).join('')}
            <td style="font-weight:bold; background:#F5EEF8;">${isEmpty ? '' : r.contaFinale}</td>
            <td>${isEmpty ? '' : (r.prezzoVendita ? '€ ' + r.prezzoVendita : '')}</td>
          </tr>
        `;
      }
    });
    html += `</table><br/>`;
  });
  html += `</body></html>`;
  downloadExcelBlob(html, `Distributori_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

function downloadExcelBlob(htmlContent, fileName) {
  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportCurrentInventoryToExcel() {
  if (!rows || rows.length === 0) {
    alert("Nessun dato prodotto caricato da esportare!");
    return;
  }
  let activeMagName = cinemaName;
  if (currentTab === 'summary') {
    activeMagName = `${cinemaName} - RIEPILOGO TOTALE`;
  } else if (typeof currentTab === 'number' && warehouses[currentTab]) {
    activeMagName = `${cinemaName} - ${warehouses[currentTab]}`;
  }
  let totalItems = rows.length;
  let totalAtteso = 0;
  let totalRilevato = 0;
  let totalDiffValore = 0;
  rows.forEach(r => {
    totalAtteso += (r.atteso || 0);
    const eff = getGlobalRilevato(r.code, r);
    totalRilevato += eff;
    totalDiffValore += (eff - (r.atteso || 0)) * (r.standardCost || 0);
  });
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        .title-row { background-color: #1F4E78; color: #FFFFFF; font-size: 16pt; font-weight: bold; text-align: left; padding: 10px; }
        .kpi-header { background-color: #F2F4F7; font-weight: bold; font-size: 9pt; color: #555555; text-align: center; border: 1px solid #D9D9D9; }
        .kpi-value { background-color: #FFFFFF; font-weight: bold; font-size: 11pt; color: #1F4E78; text-align: center; border: 1px solid #D9D9D9; }
        th { background-color: #ED7D31; color: #FFFFFF; font-size: 10pt; font-weight: bold; text-align: center; border: 1px solid #C55A11; padding: 6px; }
        td { font-size: 9.5pt; border: 1px solid #E0E0E0; padding: 5px; vertical-align: middle; }
        .row-even { background-color: #FFFDF9; }
        .row-odd { background-color: #FFFFFF; }
        .col-qta { background-color: #4472C4; color: #FFFFFF; font-weight: bold; text-align: center; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .num-bold { font-weight: bold; }
        .val-positive { color: #27AE60; font-weight: bold; }
        .val-negative { color: #C0392B; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="17" class="title-row">INVENTARIO MAGAZZINO — ${esc(activeMagName)}</td></tr>
        <tr><td colspan="17" style="height:10px; border:none;"></td></tr>
        <tr>
          <td colspan="3" class="kpi-header">N° ARTICOLI PRESENTI</td>
          <td colspan="3" class="kpi-header">PEZZI ATTESI</td>
          <td colspan="3" class="kpi-header">PEZZI RILEVATI</td>
          <td colspan="4" class="kpi-header">DIFFERENZA TOTALE VALORE</td>
          <td colspan="4" style="border:none;"></td>
        </tr>
        <tr>
          <td colspan="3" class="kpi-value">${fmt(totalItems)}</td>
          <td colspan="3" class="kpi-value">${fmt(totalAtteso)}</td>
          <td colspan="3" class="kpi-value">${fmt(totalRilevato)}</td>
          <td colspan="4" class="kpi-value ${totalDiffValore >= 0 ? 'val-positive' : 'val-negative'}">€ ${fmtMoney(totalDiffValore)}</td>
          <td colspan="4" style="border:none;"></td>
        </tr>
        <tr><td colspan="17" style="height:15px; border:none;"></td></tr>
        <tr>
          <th>Prodotto</th>
          <th>U.M.</th>
          <th>Iniziale</th>
          <th>Danni</th>
          <th>Venduto</th>
          <th>Size Box</th>
          <th>Q.tà Box</th>
          <th>Size Sleeve</th>
          <th>Q.tà Sleeve</th>
          <th>Q.tà Sfuso</th>
          <th>Atteso</th>
          <th>Rilevato Base</th>
          <th>Da Kit/Spec.</th>
          <th style="background-color: #2F5597;">EFFETTIVO TOTALE</th>
          <th>Diff. Totale</th>
          <th>Costo Unit.</th>
          <th>Diff. Valore</th>
        </tr>
  `;
  rows.forEach((r, idx) => {
    let totBoxLocal = 0, totSleeveLocal = 0, totSfusoLocal = 0;
    if (currentTab === 'summary') {
      warehouses.forEach((_, wIdx) => {
        const cWh = getCount(wIdx, r.code);
        totBoxLocal += sumArr(cWh.box);
        totSleeveLocal += sumArr(cWh.sleeve);
        totSfusoLocal += sumArr(cWh.sfuso);
      });
    } else if (typeof currentTab === 'number') {
      const c = getCount(currentTab, r.code);
      totBoxLocal = sumArr(c.box);
      totSleeveLocal = sumArr(c.sleeve);
      totSfusoLocal = sumArr(c.sfuso);
    }
    const baseRilevato = (totBoxLocal * (r.boxSize || 0)) + (totSleeveLocal * (r.sleeveSize || 0)) + totSfusoLocal;
    const kitPart = getKitContributionDetail(r.name, r.code);
    const effettivoTotaleComplesso = getGlobalRilevato(r.code, r);
    const diffTotale = effettivoTotaleComplesso - (r.atteso || 0);
    const diffValore = diffTotale * (r.standardCost || 0);
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';
    html += `
      <tr class="${rowClass}">
        <td class="text-left num-bold">${esc(r.name)}</td>
        <td class="text-center">${esc(r.uom)}</td>
        <td class="text-right">${fmt(r.iniziale)}</td>
        <td class="text-right">${fmt(r.danni)}</td>
        <td class="text-right">${fmt(r.venduto)}</td>
        <td class="text-center">${r.boxSize || '-'}</td>
        <td class="text-right">${fmt(totBoxLocal)}</td>
        <td class="text-center">${r.sleeveSize || '-'}</td>
        <td class="text-right">${fmt(totSleeveLocal)}</td>
        <td class="text-right">${fmt(totSfusoLocal)}</td>
        <td class="text-right">${fmt(r.atteso)}</td>
        <td class="text-right">${fmt(baseRilevato)}</td>
        <td class="text-right">${fmt(kitPart)}</td>
        <td class="col-qta">${fmt(effettivoTotaleComplesso)}</td>
        <td class="text-right ${diffTotale < 0 ? 'val-negative' : ''}">${fmt(diffTotale)}</td>
        <td class="text-right">€ ${fmtMoney(r.standardCost || 0)}</td>
        <td class="text-right ${diffValore < 0 ? 'val-negative' : 'val-positive'}">€ ${fmtMoney(diffValore)}</td>
      </tr>
    `;
  });
  html += `</table></body></html>`;
  downloadExcelBlob(html, `Report_Inventario_${activeMagName.replace(/[^a-zA-Z0-9-_]/g, "_")}.xls`);
}

function exportEmptyTemplateToExcel() {
  if (!rows || rows.length === 0) {
    alert("Nessun prodotto caricato!");
    return;
  }
  let activeMagName = cinemaName;
  if (typeof currentTab === 'number' && warehouses[currentTab]) {
    activeMagName = `${cinemaName} - ${warehouses[currentTab]}`;
  } else {
    activeMagName = `${cinemaName} - Template Conteggio`;
  }
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        .title-row { background-color: #1F4E78; color: #FFFFFF; font-size: 15pt; font-weight: bold; text-align: left; padding: 8px; }
        th { background-color: #ED7D31; color: #FFFFFF; font-size: 10pt; font-weight: bold; text-align: center; border: 1px solid #C55A11; padding: 6px; }
        td { font-size: 9.5pt; border: 1px solid #D9D9D9; padding: 5px; }
        .row-even { background-color: #FFFDF9; }
        .row-odd { background-color: #FFFFFF; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .empty-cell { background-color: #FFFFFF; }
        .nd-cell { background-color: #F2F2F2; color: #999999; text-align: center; font-style: italic; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="20" class="title-row">SCHEDA DI CONTEGGIO MANUALI — ${esc(activeMagName)}</td></tr>
        <tr><td colspan="20" style="height:10px; border:none;"></td></tr>
        <tr>
          <th>Prodotto</th>
          <th>U.M.</th>
          <th>Size Box</th>
          <th>Box 1</th><th>Box 2</th><th>Box 3</th><th>Box 4</th><th>Box 5</th>
          <th>Size Sleeve</th>
          <th>Sleeve 1</th><th>Sleeve 2</th><th>Sleeve 3</th><th>Sleeve 4</th><th>Sleeve 5</th>
          <th>Sfuso 1</th><th>Sfuso 2</th><th>Sfuso 3</th><th>Sfuso 4</th><th>Sfuso 5</th>
          <th>Valore Atteso</th>
        </tr>
  `;
  rows.forEach((r, idx) => {
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';
    const hasBox = r.boxSize > 0;
    const hasSleeve = r.sleeveSize > 0;
    html += `
      <tr class="${rowClass}">
        <td class="text-left" style="font-weight:bold;">${esc(r.name)}</td>
        <td class="text-center">${esc(r.uom)}</td>
        <td class="text-center">${r.boxSize || '-'}</td>
        ${Array(5).fill(0).map(() => hasBox ? `<td class="empty-cell"></td>` : `<td class="nd-cell">N/D</td>`).join('')}
        <td class="text-center">${r.sleeveSize || '-'}</td>
        ${Array(5).fill(0).map(() => hasSleeve ? `<td class="empty-cell"></td>` : `<td class="nd-cell">N/D</td>`).join('')}
        ${Array(5).fill(0).map(() => `<td class="empty-cell"></td>`).join('')}
        <td class="text-right" style="font-weight:bold;">${fmt(r.atteso)}</td>
      </tr>
    `;
  });
  html += `</table></body></html>`;
  downloadExcelBlob(html, `Template_Conteggio_${activeMagName.replace(/[^a-zA-Z0-9-_]/g, "_")}.xls`);
}

function toggleFilesSection() {
  const sec = $("filesSection");
  if (sec) sec.style.display = (sec.style.display === "none") ? "grid" : "none";
}

function updateHeaderTitle() {
  if ($("appTitle")) $("appTitle").textContent = `📊 Gestione Inventario — ${cinemaName}`;
}

function showError(msg) { alert(msg); }

function loadSetupFromStorage() {
  const savedCinema = localStorage.getItem("cinema_info_name");
  if (savedCinema) cinemaName = savedCinema;
  const savedWh = localStorage.getItem("cinema_warehouses");
  if (savedWh) { try { warehouses = JSON.parse(savedWh); } catch(e){} }
}

function loadCountsFromStorage() {
  const savedCounts = localStorage.getItem("inventory_counts");
  if (savedCounts) { try { countsData = JSON.parse(savedCounts); } catch(e){} }
}

function saveCountsToStorage() {
  localStorage.setItem("inventory_counts", JSON.stringify(countsData));
}

function resetCounts() {
  if (!confirm("Sei sicuro di voler azzerare tutti i conteggi inseriti?")) {
    return;
  }

  // Inventario standard
 countsData = {};
localStorage.removeItem("inventory_counts");

  // Caramelle
  delete candyGridConfigs[cinemaName];
  localStorage.setItem(
    "candy_grid_configs",
    JSON.stringify(candyGridConfigs)
  );

  // Post Mix
  delete postMixGridConfigs[cinemaName];
  localStorage.setItem(
    "postmix_grid_configs",
    JSON.stringify(postMixGridConfigs)
  );

  // Distributori
  delete distributorGridConfigs[cinemaName];
  localStorage.setItem(
    "distributor_grid_configs",
    JSON.stringify(distributorGridConfigs)
  );

  render();
  recalcKPIs();

  alert("Conteggi azzerati con successo.");
}

function handleCinemaSelectChange() {
  const sel = $("cinemaSelect").value;
  if ($("customCinemaDiv")) $("customCinemaDiv").style.display = (sel === "__CUSTOM__") ? "block" : "none";
}

function saveWarehousesSetup() {
  const sel = $("cinemaSelect").value;
  if (sel === "__CUSTOM__") {
    const customVal = $("customCinemaInput").value.trim();
    if (!customVal) { alert("Inserisci il nome della nuova sede!"); return; }
    cinemaName = customVal;
  } else {
    cinemaName = sel;
  }
  localStorage.setItem("cinema_info_name", cinemaName);
  const inputs = document.querySelectorAll(".wh-input-item");
  const newWh = [];
  inputs.forEach(inp => {
    const val = inp.value.trim();
    if (val) newWh.push(val);
  });
  if (newWh.length === 0) { alert("Inserisci almeno un magazzino!"); return; }
  
  warehouses = newWh;
  localStorage.setItem("cinema_warehouses", JSON.stringify(warehouses));
  
  updateHeaderTitle();
  currentTab = 0;
  switchTab();
}

function renderSetupView() {
  if ($("tabContent")) $("tabContent").style.display = "none";
  if ($("setupView")) $("setupView").style.display = "block";
  
  const select = $("cinemaSelect");
  if (select) {
    select.innerHTML = "";
    let matched = false;
    DEFAULT_CINEMAS.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      if (c === cinemaName) { opt.selected = true; matched = true; }
      select.appendChild(opt);
    });
    const customOpt = document.createElement("option");
    customOpt.value = "__CUSTOM__";
    customOpt.textContent = "➕ Altro / Aggiungi nuovo cinema...";
    if (!matched && cinemaName) {
      customOpt.selected = true;
      if ($("customCinemaDiv")) $("customCinemaDiv").style.display = "block";
      if ($("customCinemaInput")) $("customCinemaInput").value = cinemaName;
    } else {
      if ($("customCinemaDiv")) $("customCinemaDiv").style.display = "none";
    }
    select.appendChild(customOpt);
  }
  
  const container = $("whList");
  if (container) {
    container.innerHTML = "";
    warehouses.forEach((w) => {
      const div = document.createElement("div");
      div.className = "wh-item";
      div.style.cssText = "display: flex; gap: 10px; margin-bottom: 8px;";
      div.innerHTML = `
        <input class="wh-input-item" value="${esc(w)}" placeholder="Nome Magazzino" style="flex:1; padding: 6px 10px;">
        <button class="btn btn-danger" onclick="this.parentElement.remove()" style="background:#d32f2f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Elimina</button>
      `;
      container.appendChild(div);
    });
  }
}

function addWarehouseInput() {
  const container = $("whList");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "wh-item";
  div.style.cssText = "display: flex; gap: 10px; margin-bottom: 8px;";
  div.innerHTML = `
    <input class="wh-input-item" value="Magazzino ${container.children.length + 1}" placeholder="Nome Magazzino" style="flex:1; padding: 6px 10px;">
    <button class="btn btn-danger" onclick="this.parentElement.remove()" style="background:#d32f2f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Elimina</button>
  `;
  container.appendChild(div);
}

function renderTabs() {
  const bar = $("tabsBar");
  if (!bar) return;
  bar.innerHTML = "";
  
  const setupBtn = document.createElement("button");
  setupBtn.className = `tab-btn ${currentTab === 'setup' ? 'active' : ''}`;
  setupBtn.innerHTML = `⚙️ Impostazioni`;
  setupBtn.onclick = () => { currentTab = 'setup'; switchTab(); };
  bar.appendChild(setupBtn);
  
  warehouses.forEach((w, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${currentTab === idx ? 'active' : ''}`;
    btn.textContent = `📍 ${w.name || w.nome || ('Magazzino ' + (idx + 1))}`;
    btn.onclick = () => { currentTab = idx; switchTab(); };
    bar.appendChild(btn);
  });
  
  const candyBtn = document.createElement("button");
  candyBtn.className = `tab-btn ${currentTab === 'candy' ? 'active' : ''}`;
  candyBtn.innerHTML = `🍬 Caramelle`;
  candyBtn.onclick = () => { currentTab = 'candy'; switchTab(); };
  bar.appendChild(candyBtn);
  
  const postMixBtn = document.createElement("button");
  postMixBtn.className = `tab-btn ${currentTab === 'postmix' ? 'active' : ''}`;
  postMixBtn.innerHTML = `🥤 Post Mix`;
  postMixBtn.onclick = () => { currentTab = 'postmix'; switchTab(); };
  bar.appendChild(postMixBtn);
  
  const distBtn = document.createElement("button");
  distBtn.className = `tab-btn ${currentTab === 'distributors' ? 'active' : ''}`;
  distBtn.innerHTML = `🍫 Distributori`;
  distBtn.onclick = () => { currentTab = 'distributors'; switchTab(); };
  bar.appendChild(distBtn);
  
  const summaryBtn = document.createElement("button");
  summaryBtn.className = `tab-btn ${currentTab === 'summary' ? 'active' : ''}`;
  summaryBtn.innerHTML = `📊 RIEPILOGO TOTALE`;
  summaryBtn.onclick = () => { currentTab = 'summary'; switchTab(); };
  bar.appendChild(summaryBtn);
}

function switchTab() {
  renderTabs();
  if (currentTab === 'setup') {
    renderSetupView();
  } else {
    if ($("setupView")) $("setupView").style.display = "none";
    if ($("tabContent")) $("tabContent").style.display = "block";
    render();
  }
}

function readMatrix(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        if (typeof XLSX === "undefined") throw new Error("Libreria XLSX non presente.");
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error("Nessun foglio trovato.");
        let combinedMatrix = [];
        wb.SheetNames.forEach(sheetName => {
          const sheetData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
          if (sheetData && sheetData.length > 0) combinedMatrix = combinedMatrix.concat(sheetData);
        });
        resolve(combinedMatrix);
      } catch (x) { reject(x); }
    };
    r.onerror = () => reject(new Error("Errore nella lettura fisica del file."));
    r.readAsArrayBuffer(file);
  });
}

function text(v) { return String(v ?? "").trim(); }

function cleanCode(val) {
  if (val === null || val === undefined) return "";
  let s = text(val);
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
}

function n(v) {
  if (typeof v === "number") return v;
  let s = text(v).replace(/\s/g, "").replace(/€/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const x = parseFloat(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(x) ? x : 0;
}

function norm(v) { return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase(); }
function esc(str) { return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fmt(val) { return Number(val || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function fmtMoney(val) { return Number(val || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function parseMag(m) {
  const out = [];
  for (let i = 0; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;
    const uom = text(r[2]).trim().toUpperCase();
    if (!uom || (uom !== "PZ" && uom !== "KG" && uom !== "LT" && uom !== "CL" && uom !== "GR")) continue;
    let name = "";
    if (i + 1 < m.length && m[i + 1]) name = text(m[i + 1][1] || m[i + 1][0]).trim();
    if (!name) name = text(r[1]).trim();
    const rawCode = text(r[1]).trim();
    const code = cleanCode(rawCode);
    const iniziale = n(r[5]);
    const danni = n(r[14]);
    const venduto = n(r[18]);
    let atteso = n(r[23]);
    if (atteso === 0 && (iniziale > 0 || venduto > 0)) atteso = iniziale - danni - venduto;
    const standardCost = Math.abs(n(r[29] || r[32] || 0));
    out.push({ rawCode, code, name, uom, iniziale, danni, venduto, atteso, standardCost });
  }
  if (out.length === 0) throw new Error("Nessun prodotto trovato nel report Magazzino.");
  return out;
}

function parseSize(m) {
  const sizeOut = [];
  const postMixOut = [];
  let section = "SIZE"; 
  for (let i = 0; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;
    const firstVal = text(r[0]);
    const normFirst = norm(firstVal);
    if (normFirst === "KIT" || norm(r[1]) === "TIPO" || (normFirst === "" && norm(r[1]) === "TIPO")) {
      section = "KIT";
      continue;
    }
    if (normFirst === "POSTMIX" || normFirst === "POST MIX" || norm(r[1]) === "TARA" || norm(r[2]) === "TARA") {
      section = "POSTMIX";
      continue;
    }
    if (section === "KIT") {
      const kitName = firstVal;
      const kitType = text(r[1]); 
      if (!kitName || normFirst === "PRODOTTO" || normFirst === "KIT") continue;
      const ingredients = [];
      let currentIngName = "";
      for (let c = 2; c < r.length; c++) {
        const val = r[c];
        if (val === null || val === undefined || String(val).trim() === "") continue;
        const numericVal = Number(val);
        if (!isNaN(numericVal) && typeof val !== "string" && !isNaN(parseFloat(val))) {
          if (currentIngName && numericVal > 0) {
            ingredients.push({ name: currentIngName, qty: numericVal });
            currentIngName = ""; 
          }
        } else {
          const textVal = text(val);
          if (norm(textVal) !== "PRODOTTO" && norm(textVal) !== "Q.TA") currentIngName = textVal;
        }
      }
      sizeOut.push({
        code: "KIT_" + cleanCode(kitName),
        name: kitName,
        boxSize: 1,
        sleeveSize: 0,
        isKit: true,
        kitType,
        ingredients
      });
    } else if (section === "POSTMIX") {
      const prodName = firstVal;
      const taraVal = n(r[2] !== undefined && r[2] !== "" ? r[2] : r[1]);
      if (!prodName || normFirst === "PRODOTTO" || normFirst === "TARA") continue;
      postMixOut.push({ name: prodName, tara: taraVal });
    } else {
      const name = firstVal;
      const normName = norm(name);
      if (!name || name === "#N/D" || normName.includes("PRODOTTO") || normName.includes("DESCRIZIONE") || normName.includes("BOX")) continue;
      const boxSize = n(r[1]);
      const sleeveSize = n(r[2]);
      let primaryCode = "";
      for (let c = 4; c < r.length; c++) {
        const valStr = text(r[c]);
        if (valStr && !primaryCode) { primaryCode = cleanCode(valStr); break; }
      }
      if (!primaryCode) primaryCode = cleanCode(name);
      sizeOut.push({
        code: primaryCode,
        rawCode: primaryCode,
        name,
        boxSize,
        sleeveSize,
        isKit: false,
        ingredients: []
      });
    }
  }
  return { size: sizeOut, postMix: postMixOut };
}

function build() {
  if (!mag.length || !size.length) {
    if ($("mainStatus")) {
      $("mainStatus").style.display = "block";
      $("mainStatus").innerHTML = `Magazzino: <b>${mag.length}</b> · SIZE: <b>${size.length}</b><br>Carica entrambi i file per continuare.`;
    }
    return;
  }
  const sizeByCode = new Map();
  const sizeByName = new Map();
  size.forEach(s => {
    if (s.code) sizeByCode.set(s.code, s);
    if (s.name) sizeByName.set(norm(s.name), s);
  });
  rows = mag.map(x => {
    let s = sizeByCode.get(x.code) || sizeByName.get(norm(x.name)) || {};
    return { 
      ...x, 
      boxSize: s.boxSize || 0, 
      sleeveSize: s.sleeveSize || 0,
      isKit: !!s.isKit,
      ingredients: s.ingredients || []
    };
  });
  size.forEach(s => {
    if (s.isKit) {
      const exists = rows.some(r => norm(r.name) === norm(s.name));
      if (!exists) {
        rows.push({
          rawCode: s.code, code: s.code, name: s.name, uom: s.kitType || "BOX",
          iniziale: 0, danni: 0, venduto: 0, atteso: 0, standardCost: 0,
          boxSize: s.boxSize || 1, sleeveSize: s.sleeveSize || 0, isKit: true, ingredients: s.ingredients || []
        });
      }
    }
  });
  rows.sort((a, b) => {
    if (a.isKit && !b.isKit) return 1;
    if (!a.isKit && b.isKit) return -1;
    return a.name.localeCompare(b.name);
  });
  if ($("filesSection")) $("filesSection").style.display = "none";
  if ($("mainStatus")) $("mainStatus").style.display = "none";
  if ($("setupView")) $("setupView").style.display = "none";
  if ($("tabContent")) $("tabContent").style.display = "block";
  if (typeof currentTab === 'string' && currentTab !== 'tot' && currentTab !== 'candy' && currentTab !== 'postmix' && currentTab !== 'distributors' && currentTab !== 'summary') currentTab = 0;
  renderTabs();
  render();
}

function getCount(whIdx, code) {
  if (!countsData[whIdx]) countsData[whIdx] = {};
  if (!countsData[whIdx][code]) countsData[whIdx][code] = { box: [0], sleeve: [0], sfuso: [0] };
  const c = countsData[whIdx][code];
  if (!Array.isArray(c.box)) c.box = [n(c.box)];
  if (!Array.isArray(c.sleeve)) c.sleeve = [n(c.sleeve)];
  if (!Array.isArray(c.sfuso)) c.sfuso = [n(c.sfuso)];
  return c;
}

function sumArr(arr) { if (!Array.isArray(arr)) return 0; return arr.reduce((a, b) => a + n(b), 0); }

function getKitContributionDetail(productName, productCode) {
  let kitContribution = 0;
  const cleanStr = (str) => norm(str).replace(/[^A-Z0-9]/g, "");
  const normProdName = cleanStr(productName);
  const normProdCode = cleanCode(productCode);
  rows.forEach(rowItem => {
    if (rowItem.isKit && rowItem.ingredients && rowItem.ingredients.length > 0) {
      rowItem.ingredients.forEach(ing => {
        const normIngName = cleanStr(ing.name);
        const normIngCode = cleanCode(ing.code);
        const matchCode = (normProdCode && normIngCode && normProdCode === normIngCode);
        const matchName = (normProdName.includes(normIngName) || normIngName.includes(normProdName));
        if (matchCode || matchName) {
          warehouses.forEach((_, wIdx) => {
            const kitCounts = getCount(wIdx, rowItem.code);
            const kitBoxTot = sumArr(kitCounts.box);
            const kitSleeveTot = sumArr(kitCounts.sleeve);
            const kitSfusoTot = sumArr(kitCounts.sfuso);
            const kitTotalPezzi = (kitBoxTot * rowItem.boxSize) + (kitSleeveTot * rowItem.sleeveSize) + kitSfusoTot;
            kitContribution += kitTotalPezzi * ing.qty;
          });
        }
      });
    }
  });
  return kitContribution;
}

function getGlobalRilevato(code, r) {
  let totBox = 0, totSleeve = 0, totSfuso = 0;
  warehouses.forEach((_, idx) => {
    const c = getCount(idx, code);
    totBox += sumArr(c.box);
    totSleeve += sumArr(c.sleeve);
    totSfuso += sumArr(c.sfuso);
  });
  
  let basePezzi = (totBox * r.boxSize) + (totSleeve * r.sleeveSize) + totSfuso;
  
  if (norm(r.name).includes("CARAMELLE") && norm(r.name).includes("AERMONT")) {
    basePezzi += getCandyTotalKg();
  }
  const postMixTotals = getPostMixProductTotals();
  const cleanStr = str => norm(str).replace(/[^A-Z0-9]/g, "");
  const rNameClean = cleanStr(r.name);
  
  for (let [pmName, pmKg] of Object.entries(postMixTotals)) {
    const pmClean = cleanStr(pmName);
    if (rNameClean === pmClean || rNameClean.includes(pmClean) || pmClean.includes(rNameClean)) {
      basePezzi += pmKg;
    }
  }
  const distTotals = getDistributorsContaFinaleTotals();

for (let [dName, dVal] of Object.entries(distTotals)) {

  const dNameClean = cleanStr(dName);

  if (
      dNameClean === rNameClean ||
      dNameClean.includes(rNameClean) ||
      rNameClean.includes(dNameClean)
  ) {
      basePezzi += dVal;
      break;
  }
}
  return basePezzi + getKitContributionDetail(r.name, r.code);
}

function render() {
  if (currentTab === 'setup') return;
  if (currentTab === 'candy') { renderCandyView(); return; }
  if (currentTab === 'postmix') { renderPostMixView(); return; }
  if (currentTab === 'distributors') { renderDistributorsView(); return; }
  
  const q = $("search") ? norm($("search").value) : "";
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  if ($("count")) $("count").textContent = `${data.length} prodotti`;
  const isTotTab = (currentTab === 'summary' || currentTab === 'summary');
  
  if ($("thead")) {
    $("thead").innerHTML = `
      <tr style="position: sticky; top: 0; z-index: 20; background: #212529;">
        <th colspan="2" style="background: #212529; color: white;">PRODOTTO</th>
        <th colspan="3" style="background: #343a40; color: white;">REPORT MAGAZZINO</th>
        <th colspan="2" class="grp-box" style="background: #e3f2fd; color: #0d47a1;">BOX</th>
        <th colspan="2" class="grp-sleeve" style="background: #f3e5f5; color: #4a148c;">SLEEVE</th>
        <th class="grp-sfuso" style="background: #fff9c4; color: #f57f17;">SFUSO</th>
        <th colspan="7" style="background: #212529; color: white;">CONFRONTO GLOBALE (TUTTI I MAGAZZINI)</th>
      </tr>
      <tr style="position: sticky; top: 35px; z-index: 20; background: #343a40; color: white; font-size: 0.8rem;">
        <th>Prodotto</th>
        <th>U.M.</th>
        <th>Iniziale</th>
        <th>Danni</th>
        <th>Venduto</th>
        <th class="grp-box">Size</th>
        <th class="grp-box">Q.tà</th>
        <th class="grp-sleeve">Size</th>
        <th class="grp-sleeve">Q.tà</th>
        <th class="grp-sfuso">Q.tà Sfuso</th>
        <th>Atteso</th>
        <th>Rilevato Base</th>
        <th>Da Kit</th>
        <th>Effettivo Totale</th>
        <th>Diff. Totale</th>
        <th>Costo Unit.</th>
        <th>Diff. Valore</th>
      </tr>
    `;
  }
  
  const tbody = $("tbody");
  if (!tbody) return;
  let html = "";
  
  data.forEach((r) => {
    let boxVal = 0, sleeveVal = 0, sfusoVal = 0;
    
    if (!isTotTab && typeof currentTab === 'number') {
      const c = getCount(currentTab, r.code);
      boxVal = sumArr(c.box);
      sleeveVal = sumArr(c.sleeve);
      sfusoVal = sumArr(c.sfuso);
    } else if (isTotTab) {
      warehouses.forEach((_, widx) => {
        const cwh = getCount(widx, r.code);
        boxVal += sumArr(cwh.box);
        sleeveVal += sumArr(cwh.sleeve);
        sfusoVal += sumArr(cwh.sfuso);
      });
    }

    let kitPart = getKitContributionDetail(r.name, r.code);
    let baseRilevato = (boxVal * (r.boxSize || 0)) + (sleeveVal * (r.sleeveSize || 0)) + sfusoVal;
    
    let effettivo = getGlobalRilevato(r.code, r);
    let diff = effettivo - (r.atteso || 0);
    let diffVal = diff * (r.standardCost || 0);

    let boxHtml = '', sleeveHtml = '', sfusoHtml = '';

    if (isTotTab) {
      boxHtml = fmt(boxVal);
      sleeveHtml = fmt(sleeveVal);
      sfusoHtml = fmt(sfusoVal);
    } else {
      const c = getCount(currentTab, r.code);
      if (!c.box || c.box.length === 0) c.box = [0];
      if (!c.sleeve || c.sleeve.length === 0) c.sleeve = [0];
      if (!c.sfuso || c.sfuso.length === 0) c.sfuso = [0];

      // min-width: 220px forza la colonna ad accogliere esattamente 4 elementi per riga
      const buildCellInputs = (type, arr) => {
        let itemsStr = arr.map((val, idx) => `
          <div style="display:flex; align-items:center; gap:2px;">
            <input type="number" value="${val}" style="width:70px; text-align:center; padding:2px; font-size:0.85rem;" 
                   oninput="modifyCountValue(${currentTab}, '${r.code}', '${type}', ${idx}, this.value)">
            ${arr.length > 1 ? `<button type="button" onclick="removeCountBox(${currentTab}, '${r.code}', '${type}', ${idx})" style="background:transparent; border:none; color:#dc3545; cursor:pointer; font-weight:bold; font-size:0.85rem; padding:0; line-height:1;" title="Rimuovi">×</button>` : ''}
          </div>
        `).join('');

        let addBtn = `<button type="button" onclick="addCountBox(${currentTab}, '${r.code}', '${type}')" style="background:transparent; border:1px solid #ced4da; color:#495057; border-radius:3px; padding:1px 6px; cursor:pointer; font-size:0.75rem; height:24px;" title="Aggiungi">+</button>`;

return `<div style="
display:flex;
flex-wrap:wrap;
gap:6px;
align-items:flex-start;
min-width:280px;
">
${itemsStr}
${addBtn}
</div>`;
};
      boxHtml = (r.boxSize && r.boxSize > 0)
  ? buildCellInputs('box', c.box)
  : '<span style="color:#999;">-</span>';

sleeveHtml = (r.sleeveSize && r.sleeveSize > 0)
  ? buildCellInputs('sleeve', c.sleeve)
  : '<span style="color:#999;">-</span>';

sfusoHtml = buildCellInputs('sfuso', c.sfuso);
    }

    html += `
      <tr id="row-${r.code}">
        <td><b>${esc(r.name)}</b><br><small style="color:#666">${esc(r.code)}</small></td>
        <td>${esc(r.uom)}</td>
        <td>${fmt(r.iniziale)}</td>
        <td>${fmt(r.danni)}</td>
        <td>${fmt(r.venduto)}</td>
        <td class="grp-box">${r.boxSize || '-'}</td>
        <td class="grp-box"
        style="${(!r.boxSize || r.boxSize <= 0) ? 'background:#e9ecef;color:#6c757d;text-align:center;font-weight:bold;' : ''}">
        ${boxHtml}
        </td>
        <td class="grp-sleeve">${r.sleeveSize || '-'}</td>
        <td class="grp-sleeve"
        style="${(!r.sleeveSize || r.sleeveSize <= 0) ? 'background:#e9ecef;color:#6c757d;text-align:center;font-weight:bold;' : ''}">
        ${sleeveHtml}
        </td>
        <td class="grp-sfuso">${sfusoHtml}</td>
        <td><b>${fmt(r.atteso)}</b></td>
        <td class="cell-base-rilevato">${fmt(baseRilevato)}</td>
        <td>${fmt(kitPart)}</td>
        <td class="cell-effettivo"><b>${fmt(effettivo)}</b></td>
        <td class="cell-diff" style="color: ${diff < 0 ? 'red' : 'green'}"><b>${fmt(diff)}</b></td>
        <td>€ ${fmtMoney(r.standardCost)}</td>
        <td class="cell-diffval" style="color: ${diffVal < 0 ? 'red' : 'green'}"><b>€ ${fmtMoney(diffVal)}</b></td>
      </tr>
    `;
  });
  
  tbody.innerHTML = html;
  if (typeof recalcKPIs === 'function') recalcKPIs();
}

function modifyCountValue(widx, code, type, idx, val) {
  if (typeof updateCount === 'function') {
    updateCount(widx, code, type, idx, val);
  } else {
    const c = getCount(widx, code);
    if (c && c[type]) c[type][idx] = parseFloat(val) || 0;
  }
  updateRowLiveCalculations(code);
}

function addCountBox(widx, code, type) {
  const c = getCount(widx, code);
  if (!c[type]) c[type] = [];
  c[type].push(0);
  if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
  else if (typeof save === 'function') save();
  render();
}

function removeCountBox(widx, code, type, idx) {
  const c = getCount(widx, code);
  if (c && c[type] && c[type].length > 1) {
    c[type].splice(idx, 1);
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    else if (typeof save === 'function') save();
    render();
  }
}

function updateRowLiveCalculations(code) {
  const r = rows.find(x => x.code === code);
  if (!r) return;
  
  const isTotTab = (currentTab === 'summary' || currentTab === 'summary');
  let boxVal = 0, sleeveVal = 0, sfusoVal = 0;
  
  if (!isTotTab && typeof currentTab === 'number') {
    const c = getCount(currentTab, r.code);
    boxVal = sumArr(c.box);
    sleeveVal = sumArr(c.sleeve);
    sfusoVal = sumArr(c.sfuso);
  }
  
  let baseRilevato = (boxVal * (r.boxSize || 0)) + (sleeveVal * (r.sleeveSize || 0)) + sfusoVal;
  let effettivo = getGlobalRilevato(r.code, r);
  let diff = effettivo - (r.atteso || 0);
  let diffVal = diff * (r.standardCost || 0);
  
  const rowEl = document.getElementById(`row-${r.code}`);
  if (rowEl) {
    const baseEl = rowEl.querySelector('.cell-base-rilevato');
    const effEl = rowEl.querySelector('.cell-effettivo');
    const diffEl = rowEl.querySelector('.cell-diff');
    const diffValEl = rowEl.querySelector('.cell-diffval');
    
    if (baseEl) baseEl.textContent = fmt(baseRilevato);
    if (effEl) effEl.innerHTML = `<b>${fmt(effettivo)}</b>`;
    if (diffEl) {
      diffEl.innerHTML = `<b>${fmt(diff)}</b>`;
      diffEl.style.color = diff < 0 ? 'red' : 'green';
    }
    if (diffValEl) {
      diffValEl.innerHTML = `<b>€ ${fmtMoney(diffVal)}</b>`;
      diffValEl.style.color = diffVal < 0 ? 'red' : 'green';
    }
  }
  
  if (typeof recalcKPIs === 'function') recalcKPIs();
  if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
}
// Funzioni di supporto per aggiungere o rimuovere righe di conteggio con il tasto +
function addCountRow(widx, code, type) {
  const c = getCount(widx, code);
  if (!c[type]) c[type] = [];
  c[type].push(0);
  if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
  else if (typeof save === 'function') save();
  render();
}

function removeCountRow(widx, code, type, idx) {
  const c = getCount(widx, code);
  if (c[type] && c[type].length > 1) {
    c[type].splice(idx, 1);
    if (typeof saveToLocalStorage === 'function') saveToLocalStorage();
    else if (typeof save === 'function') save();
    render();
  }
}
function updateCount(whIdx, code, type, fieldIdx, val) {
  const c = getCount(whIdx, code);
  c[type][fieldIdx] = n(val);
  saveCountsToStorage();
  syncDistributorsToGlobalStock();
  recalcKPIs();
}

function recalcKPIs() {
  if (!rows || rows.length === 0) return;

  let totaleAtteso = 0;
  let totaleRilevato = 0;
  let totaleDiffValore = 0;

  rows.forEach(r => {
    const atteso = n(r.atteso);
    const rilevato = getGlobalRilevato(r.code, r);

    totaleAtteso += atteso;
    totaleRilevato += rilevato;
    totaleDiffValore += (rilevato - atteso) * n(r.standardCost);
  });

  const diffPezzi = totaleRilevato - totaleAtteso;

  const elAtteso = $("kpiAtteso");
  const elRilevato = $("kpiRilevato");
  const elDiffPezzi = $("kpiDiffPezzi");
  const elDiffValore = $("kpiDiffValore");

  if (elAtteso) elAtteso.textContent = fmt(totaleAtteso);
  if (elRilevato) elRilevato.textContent = fmt(totaleRilevato);
  if (elDiffPezzi) elDiffPezzi.textContent = fmt(diffPezzi);
  if (elDiffValore) elDiffValore.textContent = `€ ${fmtMoney(totaleDiffValore)}`;

  const diffBox = $("kpiDiffBox");
  const valBox = $("kpiValoreBox");

  if (diffBox) {
    diffBox.classList.remove("warning", "success");
    diffBox.classList.add(diffPezzi === 0 ? "success" : "warning");
  }

  if (valBox) {
    valBox.classList.remove("warning", "success");
    valBox.classList.add(totaleDiffValore >= 0 ? "success" : "warning");
  }
}
