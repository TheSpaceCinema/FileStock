/* ==========================================================================
   GESTIONE INVENTARIO WEB APP — APP.JS (Versione Stabile Completa)
   ========================================================================== */

let cinemaName = "TSC Nola";
let warehouses = ["Magazzino 1 piano", "Retroconc", "Magazzinetti retroconc", "Concession", "Magazzino Caramelle"];
let rows = []; 
let counts = {}; 
let caramelleData = {}; 

const MAX_FIELDS = 50;

document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  ensureMagazzinoCaramelle();
  initTabs();
  render();
});

function ensureMagazzinoCaramelle() {
  if (!warehouses.some(w => w.toLowerCase().includes("caramelle"))) {
    warehouses.push("Magazzino Caramelle");
    saveWarehousesToStorage();
  }
}

/* ---------------- STORAGE & PERSISTENZA ---------------- */
function loadFromStorage() {
  const savedCinema = localStorage.getItem("cinema_name");
  if (savedCinema) cinemaName = savedCinema;

  const savedWh = localStorage.getItem("cinema_warehouses");
  if (savedWh) { try { warehouses = JSON.parse(savedWh); } catch(e) {} }

  const savedRows = localStorage.getItem("cinema_rows");
  if (savedRows) { try { rows = JSON.parse(savedRows); } catch(e) {} }

  const savedCounts = localStorage.getItem("cinema_counts");
  if (savedCounts) { try { counts = JSON.parse(savedCounts); } catch(e) {} }

  const savedCaramelle = localStorage.getItem("cinema_caramelle_data");
  if (savedCaramelle) { try { caramelleData = JSON.parse(savedCaramelle); } catch(e) {} }
}

function saveWarehousesToStorage() {
  ensureMagazzinoCaramelle();
  localStorage.setItem("cinema_warehouses", JSON.stringify(warehouses));
}

function saveCountsToStorage() {
  localStorage.setItem("cinema_counts", JSON.stringify(counts));
}

function saveCaramelleToStorage() {
  localStorage.setItem("cinema_caramelle_data", JSON.stringify(caramelleData));
}

/* ---------------- PARSING EXCEL (SheetJS) ---------------- */
function handleReportUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = evt.target.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      parseReportData(jsonData);
      alert("Report magazzino caricato con successo! Prodotti trovati: " + rows.length);
      render();
    } catch(err) {
      alert("Errore nella lettura del file Report: " + err.message);
    }
  };
  reader.readAsBinaryString(file);
}

function handleSizeUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      parseSizeData(jsonData);
      alert("Anagrafica Size caricata con successo!");
      render();
    } catch(err) {
      alert("Errore nella lettura del file Size: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

function parseReportData(json) {
  rows = [];
  json.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const code = String(row[0] || "").trim();
    const desc = String(row[1] || "").trim();
    if (!code || code.toLowerCase().includes("codice") || code.toLowerCase().includes("articolo")) {
      return;
    }

    rows.push({
      code: code,
      name: desc !== "" ? desc : "Prodotto " + idx,
      unit: String(row[2] || "PZ").trim(),
      iniziale: n(row[3]),
      danni: n(row[4]),
      venduto: n(row[5]),
      atteso: n(row[6]) !== 0 ? n(row[6]) : (n(row[3]) - n(row[4]) - n(row[5])),
      standardCost: n(row[7]) || 0.50,
      boxSize: 24,
      sleeveSize: 1
    });
  });
  localStorage.setItem("cinema_rows", JSON.stringify(rows));
}

function parseSizeData(json) {
  json.forEach((row, idx) => {
    if (!row || row.length === 0) return;
    const code = String(row[0] || "").trim();
    const boxSizeVal = n(row[1]);
    if (code && boxSizeVal > 0) {
      const found = rows.find(r => r.code === code);
      if (found) {
        found.boxSize = boxSizeVal;
      }
    }
  });
  localStorage.setItem("cinema_rows", JSON.stringify(rows));
}

/* ---------------- GESTIONE CONTEGGI ---------------- */
function getCount(whIdx, code) {
  if (!counts[whIdx]) counts[whIdx] = {};
  if (!counts[whIdx][code]) {
    counts[whIdx][code] = { box: [0], sleeve: [0], sfuso: [0] };
  }
  return counts[whIdx][code];
}

function sumArr(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, val) => acc + (parseFloat(val) || 0), 0);
}

function n(val) {
  if (typeof val === 'number') return val;
  return parseFloat(String(val || "0").replace(',', '.')) || 0;
}

function getGlobalRilevato(code, r) {
  let total = 0;
  warehouses.forEach((whName, wIdx) => {
    if (whName.toLowerCase().includes("caramelle")) {
      const key = `${cinemaName}_${wIdx}`;
      if (caramelleData[key] && Array.isArray(caramelleData[key])) {
        caramelleData[key].forEach(item => {
          const netto = Math.max(0, (n(item.peso) - n(item.tara)) * n(item.qta));
          total += netto;
        });
      }
    } else {
      const c = getCount(wIdx, code);
      const bSum = sumArr(c.box);
      const sSum = sumArr(c.sleeve);
      const sfSum = sumArr(c.sfuso);
      
      const boxSize = n(r.boxSize) || 24;
      const sleeveSize = n(r.sleeveSize) || 1;

      total += (bSum * boxSize) + (sSum * sleeveSize) + sfSum;
    }
  });
  return total;
}

/* ---------------- UI & RENDERING TAB ---------------- */
let currentActiveWhIdx = 0;

function initTabs() {
  const tabsContainer = document.getElementById("warehousesTabs");
  if (!tabsContainer) return;
  
  let html = "";
  warehouses.forEach((wh, idx) => {
    const isCaramelle = wh.toLowerCase().includes("caramelle");
    const icon = isCaramelle ? "🍬" : "📦";
    html += `<button class="tab-btn ${idx === currentActiveWhIdx ? 'active' : ''}" onclick="switchTab(${idx})">${icon} ${esc(wh)}</button>`;
  });
  html += `<button class="tab-btn tab-riepilogo" onclick="switchTab('riepilogo')">📊 RIEPILOGO TOTALE</button>`;
  
  tabsContainer.innerHTML = html;
}

function switchTab(idx) {
  currentActiveWhIdx = (idx === 'riepilogo') ? 'riepilogo' : (parseInt(idx) || 0);
  initTabs();
  render();
}

function render() {
  recalcKPIs();
  const container = document.getElementById("mainTableContainer");
  if (!container) return;

  if (currentActiveWhIdx === 'riepilogo') {
    renderRiepilogoView(container);
  } else {
    const whName = warehouses[currentActiveWhIdx];
    if (whName && whName.toLowerCase().includes("caramelle")) {
      renderCaramelleViewContainer(container, currentActiveWhIdx);
    } else {
      renderStandardWarehouseView(container, currentActiveWhIdx);
    }
  }
}

/* ---------------- VISTA MAGAZZINO CARAMELLE ---------------- */
function renderCaramelleViewContainer(container, whIdx) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key] || !Array.isArray(caramelleData[key])) {
    caramelleData[key] = Array(10).fill().map(() => ({ qta: 1, peso: 0, tara: 0 }));
  }
  const items = caramelleData[key];

  let html = `
    <div style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <h3>🍬 Magazzino Caramelle</h3>
      <table style="width:100%; border-collapse:collapse; margin-bottom:15px; max-width:800px;">
        <thead>
          <tr style="background:#333; color:#fff; text-align:left;">
            <th style="padding:8px; width:50px;">#</th>
            <th style="padding:8px; width:100px;">Quantità</th>
            <th style="padding:8px; width:130px;">Peso Lordo (kg)</th>
            <th style="padding:8px; width:130px;">Tara (kg)</th>
            <th style="padding:8px; width:130px;">Peso Netto</th>
            <th style="padding:8px; width:60px;">Azioni</th>
          </tr>
        </thead>
        <tbody>
  `;

  items.forEach((item, idx) => {
    const netto = Math.max(0, (n(item.peso) - n(item.tara)) * n(item.qta));
    html += `
      <tr style="border-bottom:1px solid #eee;">
        <td style="padding:8px; font-weight:bold;">${idx + 1}</td>
        <td style="padding:8px;"><input type="number" step="any" min="1" value="${item.qta || 1}" oninput="updateCaramelleItem(${whIdx}, ${idx}, 'qta', this.value)" style="width:70px; padding:4px; text-align:center; border:1px solid #ccc; border-radius:4px;"></td>
        <td style="padding:8px;"><input type="number" step="any" min="0" value="${item.peso !== 0 ? item.peso : ''}" placeholder="0" oninput="updateCaramelleItem(${whIdx}, ${idx}, 'peso', this.value)" style="width:90px; padding:4px; text-align:center; border:1px solid #ccc; border-radius:4px;"></td>
        <td style="padding:8px;"><input type="number" step="any" min="0" value="${item.tara !== 0 ? item.tara : ''}" placeholder="0" oninput="updateCaramelleItem(${whIdx}, ${idx}, 'tara', this.value)" style="width:90px; padding:4px; text-align:center; border:1px solid #ccc; border-radius:4px;"></td>
        <td style="padding:8px; font-weight:bold; color:#2e7d32;">${fmt(netto)} kg</td>
        <td style="padding:8px;">${items.length > 1 ? `<button onclick="removeCaramelleItem(${whIdx}, ${idx})" style="background:#d32f2f; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">×</button>` : ''}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <button onclick="addCaramelleItem(${whIdx})" style="background:#1976d2; color:white; border:none; padding:8px 14px; border-radius:4px; cursor:pointer;">+ Aggiungi Riga</button>
    </div>
  `;
  container.innerHTML = html;
}

function updateCaramelleItem(whIdx, idx, field, val) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key]) caramelleData[key] = Array(10).fill().map(() => ({ qta: 1, peso: 0, tara: 0 }));
  caramelleData[key][idx][field] = n(val);

  if (idx === caramelleData[key].length - 1 && n(val) > 0 && caramelleData[key].length < MAX_FIELDS) {
    caramelleData[key].push({ qta: 1, peso: 0, tara: 0 });
    renderCaramelleViewContainer(document.getElementById("mainTableContainer"), whIdx);
    return;
  }
  saveCaramelleToStorage();
  recalcKPIs();
}

function addCaramelleItem(whIdx) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key]) caramelleData[key] = [];
  caramelleData[key].push({ qta: 1, peso: 0, tara: 0 });
  saveCaramelleToStorage();
  renderCaramelleViewContainer(document.getElementById("mainTableContainer"), whIdx);
}

function removeCaramelleItem(whIdx, idx) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key]) return;
  caramelleData[key].splice(idx, 1);
  if (caramelleData[key].length === 0) caramelleData[key] = [{ qta: 1, peso: 0, tara: 0 }];
  saveCaramelleToStorage();
  renderCaramelleViewContainer(document.getElementById("mainTableContainer"), whIdx);
}

/* ---------------- VISTA MAGAZZINO STANDARD ---------------- */
function renderStandardWarehouseView(container, whIdx) {
  let html = `
    <table class="inventory-table" style="width:100%; border-collapse:collapse; background:#fff;">
      <thead>
        <tr style="background:#333; color:#fff; text-align:left;">
          <th style="padding:10px;">Prodotto</th>
          <th style="padding:10px; width:70px;">U.M.</th>
          <th style="padding:10px; width:80px;">Iniziale</th>
          <th style="padding:10px; width:80px;">Danni</th>
          <th style="padding:10px; width:80px;">Venduto</th>
          <th style="padding:10px; width:190px;">Box (${rows[0]?.boxSize || 24})</th>
          <th style="padding:10px; width:190px;">Sfuso</th>
          <th style="padding:10px; width:100px;">Rilevato</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (rows.length === 0) {
    html += `<tr><td colspan="8" style="padding:20px; text-align:center; color:#777;">Nessun prodotto caricato. Assicurati di aver caricato il file Report.</td></tr>`;
  } else {
    rows.forEach(r => {
      const eff = getGlobalRilevato(r.code, r);
      html += `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:8px;"><b>${esc(r.name)}</b><br><small style="color:#777;">${esc(r.code)}</small></td>
          <td style="padding:8px;">${esc(r.unit || 'PZ')}</td>
          <td style="padding:8px;">${n(r.iniziale)}</td>
          <td style="padding:8px;">${n(r.danni)}</td>
          <td style="padding:8px;">${n(r.venduto)}</td>
          <td style="padding:8px;">${renderMultiInput(whIdx, r.code, 'box', r.boxSize)}</td>
          <td style="padding:8px;">${renderMultiInput(whIdx, r.code, 'sfuso', 1)}</td>
          <td style="padding:8px; font-weight:bold;" id="wh-tot-${r.code}">${fmt(eff)}</td>
        </tr>
      `;
    });
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
}

function renderMultiInput(whIdx, code, type, sizeVal) {
  const c = getCount(whIdx, code);
  const arr = c[type] || [0];
  
  let html = `<div style="display:flex; flex-wrap:wrap; gap:3px; max-width:170px;">`;
  arr.forEach((val, idx) => {
    html += `
      <div style="display:flex; align-items:center; background:#f9f9f9; border:1px solid #ddd; border-radius:3px; padding:1px;">
        <input type="number" step="any" min="0" value="${val !== 0 ? val : ''}" placeholder="0"
               oninput="handleCountInput(${whIdx}, '${code}', '${type}', ${idx}, this.value)"
               style="width: 45px; padding: 2px; text-align: center; border: none; background: transparent; font-size: 12px;">
        ${arr.length > 1 ? `<button onclick="removeInputRow(${whIdx}, '${code}', '${type}', ${idx})" style="background:#d32f2f; color:white; border:none; border-radius:2px; width:14px; height:14px; cursor:pointer; font-size:9px; line-height:1; display:flex; align-items:center; justify-content:center;">×</button>` : ''}
      </div>
    `;
  });
  html += `</div>`;
  return html;
}

function handleCountInput(whIdx, code, type, idx, val) {
  const c = getCount(whIdx, code);
  c[type][idx] = n(val);

  if (idx === c[type].length - 1 && n(val) > 0 && c[type].length < MAX_FIELDS) {
    c[type].push(0);
    render();
    return;
  }

  saveCountsToStorage();
  updateRowCalculations(code);
  recalcKPIs();
}

function removeInputRow(whIdx, code, type, idx) {
  const c = getCount(whIdx, code);
  c[type].splice(idx, 1);
  if (c[type].length === 0) c[type] = [0];
  saveCountsToStorage();
  render();
}

/* ---------------- VISTA RIEPILOGO TOTALE ---------------- */
function renderRiepilogoView(container) {
  let html = `
    <table class="inventory-table" style="width:100%; border-collapse:collapse; background:#fff;">
      <thead>
        <tr style="background:#222; color:#fff; text-align:left;">
          <th style="padding:10px;">Prodotto</th>
          <th style="padding:10px; width:70px;">U.M.</th>
          <th style="padding:10px; width:90px;">Atteso</th>
          <th style="padding:10px; width:100px;">Rilevato Tot.</th>
          <th style="padding:10px; width:100px;">Diff. Pezzi</th>
          <th style="padding:10px; width:100px;">Costo Unit.</th>
          <th style="padding:10px; width:110px;">Diff. Valore</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (rows.length === 0) {
    html += `<tr><td colspan="7" style="padding:20px; text-align:center; color:#777;">Nessun prodotto caricato.</td></tr>`;
  } else {
    rows.forEach(r => {
      const att = n(r.atteso);
      const eff = getGlobalRilevato(r.code, r);
      const diff = eff - att;
      const val = diff * n(r.standardCost);
      const diffClass = diff === 0 ? 'color:#2e7d32;' : 'color:#c62828; font-weight:bold;';

      html += `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;"><b>${esc(r.name)}</b><br><small style="color:#777;">${esc(r.code)}</small></td>
          <td style="padding:10px;">${esc(r.unit || 'PZ')}</td>
          <td style="padding:10px;">${fmt(att)}</td>
          <td style="padding:10px; font-weight:bold;" id="eff-${r.code}">${fmt(eff)}</td>
          <td style="padding:10px; ${diffClass}" id="diff-${r.code}">${fmt(diff)}</td>
          <td style="padding:10px;">€ ${fmtMoney(r.standardCost)}</td>
          <td style="padding:10px; ${diffClass}" id="val-${r.code}">€ ${fmtMoney(val)}</td>
        </tr>
      `;
    });
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
}

/* ---------------- KPI & UTILS ---------------- */
function recalcKPIs() {
  let totalAtteso = 0, totalRilevato = 0, totalDiffValore = 0;

  rows.forEach(r => {
    const att = n(r.atteso);
    const eff = getGlobalRilevato(r.code, r);
    const diff = eff - att;
    totalAtteso += att;
    totalRilevato += eff;
    totalDiffValore += diff * n(r.standardCost);
  });

  const diffPezziTotali = totalRilevato - totalAtteso;

  if (document.getElementById("kpiAttesi")) document.getElementById("kpiAttesi").textContent = fmt(totalAtteso);
  if (document.getElementById("kpiRilevati")) document.getElementById("kpiRilevati").textContent = fmt(totalRilevato);
  
  const kpiDiffPezzi = document.getElementById("kpiDiffPezzi");
  if (kpiDiffPezzi) {
    kpiDiffPezzi.textContent = fmt(diffPezziTotali);
    kpiDiffPezzi.style.color = diffPezziTotali >= 0 ? "#2e7d32" : "#c62828";
  }

  const kpiDiffValore = document.getElementById("kpiDiffValore");
  if (kpiDiffValore) {
    kpiDiffValore.textContent = `€ ${fmtMoney(totalDiffValore)}`;
    kpiDiffValore.style.color = totalDiffValore >= 0 ? "#2e7d32" : "#c62828";
  }
}

function updateRowCalculations(code) {
  const r = rows.find(x => x.code === code);
  if (!r) return;

  const eff = getGlobalRilevato(code, r);
  const diff = eff - r.atteso;
  const val = diff * (r.standardCost || 0);

  const whTotEl = document.getElementById(`wh-tot-${code}`);
  const effEl = document.getElementById(`eff-${code}`);
  const diffEl = document.getElementById(`diff-${code}`);
  const valEl = document.getElementById(`val-${code}`);

  if (whTotEl) whTotEl.textContent = fmt(eff);
  if (effEl) effEl.textContent = fmt(eff);
  if (diffEl) { diffEl.textContent = fmt(diff); diffEl.style.color = diff === 0 ? "#2e7d32" : "#c62828"; }
  if (valEl) { valEl.textContent = `€ ${fmtMoney(val)}`; valEl.style.color = val >= 0 ? "#2e7d32" : "#c62828"; }
}

function openConfigModal() {
  alert("Pannello di configurazione Cinema e Magazzini attivo.");
}

function fmt(v) {
  const num = n(v);
  return Number.isInteger(num) ? num.toLocaleString('it-IT') : num.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtMoney(v) {
  return n(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
