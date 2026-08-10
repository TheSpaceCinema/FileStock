/* ==========================================================================
   GESTIONE INVENTARIO WEB APP — APP.JS (Completo e Ottimizzato)
   ========================================================================== */

let cinemaName = "TSC Nola";
let warehouses = ["Magazzino 1 piano", "Retroconc", "Magazzinetti retroconc", "Concession", "Magazzino Caramelle"];
let rows = []; // Dati prodotti dal file Excel
let counts = {}; // Struttura: counts[whIdx][code] = { box: [..], sleeve: [..], sfuso: [..] }
let caramelleData = {}; // Struttura per magazzino caramelle: caramelleData[key] = [{ qta: 1, peso: 0, tara: 0 }]

const MAX_FIELDS = 50;

// Inizializzazione all'avvio
document.addEventListener("DOMContentLoaded", () => {
  loadFromStorage();
  ensureMagazzinoCaramelle();
  initTabs();
  render();
});

// Assicura che "Magazzino Caramelle" sia sempre presente nei magazzini
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
  if (savedWh) {
    try { warehouses = JSON.parse(savedWh); } catch(e) {}
  }

  const savedRows = localStorage.getItem("cinema_rows");
  if (savedRows) {
    try { rows = JSON.parse(savedRows); } catch(e) {}
  }

  const savedCounts = localStorage.getItem("cinema_counts");
  if (savedCounts) {
    try { counts = JSON.parse(savedCounts); } catch(e) {}
  }

  const savedCaramelle = localStorage.getItem("cinema_caramelle_data");
  if (savedCaramelle) {
    try { caramelleData = JSON.parse(savedCaramelle); } catch(e) {}
  }
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
  return parseFloat(val) || 0;
}

function getGlobalRilevato(code, r) {
  let total = 0;
  warehouses.forEach((whName, wIdx) => {
    if (whName.toLowerCase().includes("caramelle")) {
      // Calcolo dal magazzino caramelle strutturato a griglia (qta, peso lordo, tara)
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
      
      const boxSize = n(r.boxSize);
      const sleeveSize = n(r.sleeveSize);

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
  html += `<button class="tab-btn tab-riepilogo ${currentActiveWhIdx === 'riepilogo' ? 'active' : ''}" onclick="switchTab('riepilogo')">📊 RIEPILOGO TOTALE</button>`;
  
  tabsContainer.innerHTML = html;
}

function switchTab(idx) {
  if (idx === 'riepilogo') {
    currentActiveWhIdx = 'riepilogo';
  } else {
    currentActiveWhIdx = parseInt(idx) || 0;
  }
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
    <div class="caramelle-card" style="background:#fff; padding:20px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
      <h3>🍬 Gestione Magazzino Caramelle</h3>
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
          <th style="padding:10px; width:90px;">Iniziale</th>
          <th style="padding:10px; width:90px;">Danni</th>
          <th style="padding:10px; width:90px;">Venduto</th>
          <th style="padding:10px; width:110px;">Box (${rows[0]?.boxSize || 24})</th>
          <th style="padding:10px; width:110px;">Sfuso</th>
          <th style="padding:10px; width:100px;">Totale Rilevato</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (rows.length === 0) {
    html += `<tr><td colspan="8" style="padding:20px; text-align:center; color:#777;">Nessun prodotto caricato. Importa un file Excel dalla barra superiore.</td></tr>`;
  } else {
    rows.forEach(r => {
      html += `
        <tr style="border-bottom:1px solid #eee;">
          <td style="padding:10px;"><b>${esc(r.name)}</b><br><small style="color:#777;">${esc(r.code)}</small></td>
          <td style="padding:10px;">${esc(r.unit || 'PZ')}</td>
          <td style="padding:10px;">${n(r.iniziale)}</td>
          <td style="padding:10px;">${n(r.danni)}</td>
          <td style="padding:10px;">${n(r.venduto)}</td>
          <td style="padding:10px;">${renderMultiInput(whIdx, r.code, 'box', r.boxSize)}</td>
          <td style="padding:10px;">${renderMultiInput(whIdx, r.code, 'sfuso', 1)}</td>
          <td style="padding:10px; font-weight:bold;" id="wh-tot-${r.code}">...</td>
        </tr>
      `;
    });
  }

  html += `</tbody></table>`;
  container.innerHTML = html;
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
  let totalAtteso = 0;
  let totalRilevato = 0;
  let totalDiffValore = 0;

  rows.forEach(r => {
    const att = n(r.atteso);
    const eff = getGlobalRilevato(r.code, r);
    const diff = eff - att;
    const val = diff * n(r.standardCost);

    totalAtteso += att;
    totalRilevato += eff;
    totalDiffValore += val;
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

function render() {
  recalcKPIs();
  const container = document.getElementById("mainTableContainer");
  if (!container) return;

  if (currentActiveWhIdx === 'riepilogo') {
    renderRiepilogoView(container);
    return;
  }

  const whName = warehouses[currentActiveWhIdx] || "";
  
  // Controllo sicuro e flessibile sul nome del magazzino caramelle
  if (whName.toLowerCase().includes("caramelle") || whName.toLowerCase().includes("caramella")) {
    renderCaramelleViewContainer(container, currentActiveWhIdx);
  } else {
    renderStandardWarehouseView(container, currentActiveWhIdx);
  }
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

function updateRowCalculations(code) {
  const r = rows.find(x => x.code === code);
  if (!r) return;

  const effettivoTotaleComplesso = getGlobalRilevato(code, r);
  const diffTotale = effettivoTotaleComplesso - r.atteso;
  const diffValore = diffTotale * (r.standardCost || 0);

  const effEl = document.getElementById(`eff-${code}`);
  const diffEl = document.getElementById(`diff-${code}`);
  const valEl = document.getElementById(`val-${code}`);

  if (effEl) effEl.textContent = fmt(effettivoTotaleComplesso);
  if (diffEl) {
    diffEl.textContent = fmt(diffTotale);
    diffEl.style.color = diffTotale === 0 ? "#2e7d32" : "#c62828";
  }
  if (valEl) {
    valEl.textContent = `€ ${fmtMoney(diffValore)}`;
    valEl.style.color = diffValore >= 0 ? "#2e7d32" : "#c62828";
  }
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
