// ==========================================
// CONFIGURAZIONE E STATO GLOBALE
// ==========================================
const $ = (id) => document.getElementById(id);
const norm = (str) => (str || "").toString().toLowerCase().trim();
const esc = (str) => (str || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return Number(val).toLocaleString("it-IT", { maximumFractionDigits: 2 });
};
const fmtMoney = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "0,00";
  return Number(val).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Variabili di Stato
let warehouses = ["Magazzino 1", "Magazzino 2"];
let currentTab = 0; // 'setup', 'tot', 'candy', 'postmix', 'distributors', o indice numerico
let rows = []; 
let counts = {}; 
let setupData = [];

// Dati Schede Speciali
let candyData = [];
let postMixData = [];
let distributorData = [];

// ==========================================
// PARSING E CARICAMENTO FILE EXCEL
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const fileReport = $("fileReport") || document.querySelectorAll('input[type="file"]')[0];
  const fileSize = $("fileSize") || document.querySelectorAll('input[type="file"]')[1];

  if (fileReport) {
    fileReport.addEventListener("change", (e) => handleFileUpload(e, "report"));
  }
  if (fileSize) {
    fileSize.addEventListener("change", (e) => handleFileUpload(e, "size"));
  }

  const searchInput = $("search");
  if (searchInput) {
    searchInput.addEventListener("input", () => render());
  }

  switchTab();
});

function handleFileUpload(e, type) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (type === "report") {
        processReportData(json);
      } else if (type === "size") {
        processSizeData(json);
      }
      render();
    } catch (err) {
      alert("Errore nella lettura del file: " + err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function processReportData(json) {
  rows = [];
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row || row.length === 0) continue;

    const code = row[0] ? row[0].toString().trim() : "";
    const name = row[1] ? row[1].toString().trim() : "";
    if (!code && !name) continue;

    const uom = row[2] || "PZ";
    const iniziale = parseFloat(row[3]) || 0;
    const danni = parseFloat(row[4]) || 0;
    const venduto = parseFloat(row[5]) || 0;
    const atteso = iniziale - danni - venduto;
    const standardCost = parseFloat(row[6]) || 0;

    rows.push({
      code: code,
      name: name,
      uom: uom,
      iniziale: iniziale,
      danni: danni,
      venduto: venduto,
      atteso: atteso,
      boxSize: 0,
      sleeveSize: 0,
      standardCost: standardCost,
      isKit: name.toLowerCase().includes("kit")
    });
  }
  
  const msg = $("uploadMsg") || document.querySelector(".text-muted");
  if (msg) msg.textContent = `Caricati ${rows.length} prodotti con successo!`;
}

function processSizeData(json) {
  if (rows.length === 0) {
    alert("Carica prima il Report Magazzino!");
    return;
  }
  for (let i = 1; i < json.length; i++) {
    const row = json[i];
    if (!row) continue;
    const code = row[0] ? row[0].toString().trim() : "";
    const boxSize = parseFloat(row[1]) || 0;
    const sleeveSize = parseFloat(row[2]) || 0;

    const prod = rows.find(r => r.code === code);
    if (prod) {
      prod.boxSize = boxSize;
      prod.sleeveSize = sleeveSize;
    }
  }
  alert("Anagrafica Size applicata correttamente!");
}

// ==========================================
// HELPER CONTEGGI E KIT
// ==========================================
function getCount(wIdx, code) {
  if (!counts[wIdx]) counts[wIdx] = {};
  if (!counts[wIdx][code]) counts[wIdx][code] = { box: [], sleeve: [], sfuso: [] };
  return counts[wIdx][code];
}

function sumArr(arr) {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((a, b) => a + (parseFloat(b) || 0), 0);
}

function getKitContributionDetail(productName, productCode) {
  let totalAdd = 0;
  candyData.forEach(c => {
    if (c.code === productCode) totalAdd += (parseFloat(c.qty) || 0);
  });
  postMixData.forEach(p => {
    if (p.code === productCode) totalAdd += (parseFloat(p.qty) || 0);
  });
  distributorData.forEach(d => {
    if (d.code === productCode) totalAdd += (parseFloat(d.qty) || 0);
  });
  return totalAdd;
}

function getGlobalRilevato(productCode, rowObj) {
  let totalBase = 0;
  warehouses.forEach((_, wIdx) => {
    const c = getCount(wIdx, productCode);
    const boxSize = rowObj.boxSize || 0;
    const sleeveSize = rowObj.sleeveSize || 0;
    totalBase += (sumArr(c.box) * boxSize) + (sumArr(c.sleeve) * sleeveSize) + sumArr(c.sfuso);
  });
  return totalBase + getKitContributionDetail(rowObj.name, productCode);
}

function clearAllCounts() {
  if (confirm("Sei sicuro di voler azzerare tutti i conteggi inseriti?")) {
    counts = {};
    candyData = [];
    postMixData = [];
    distributorData = [];
    render();
    alert("Conteggi azzerati con successo!");
  }
}

// ==========================================
// GESTIONE TAB
// ==========================================
function switchTab() {
  renderTabs();
  
  const customContainer = $("customViewContainer");
  if (customContainer) customContainer.style.display = "none";

  if (currentTab === 'setup') {
    renderSetupView();
  } else {
    if ($("setupView")) $("setupView").style.display = "none";
    if ($("tabContent")) $("tabContent").style.display = "block";
    render();
  }
}

function renderTabs() {
  const container = $("tabsContainer") || document.querySelector(".nav-tabs");
  if (!container) return;
  
  let html = `<li class="nav-item"><a class="nav-link ${currentTab === 'setup' ? 'active' : ''}" href="#" onclick="selectTab('setup')">⚙️ Setup Impostazioni</a></li>`;
  
  warehouses.forEach((wName, idx) => {
    html += `<li class="nav-item"><a class="nav-link ${currentTab === idx ? 'active' : ''}" href="#" onclick="selectTab(${idx})">📦 ${esc(wName)}</a></li>`;
  });

  html += `<li class="nav-item"><a class="nav-link ${currentTab === 'tot' ? 'active' : ''}" href="#" onclick="selectTab('tot')">📊 Totale Generale</a></li>`;
  html += `<li class="nav-item"><a class="nav-link ${currentTab === 'candy' ? 'active' : ''}" href="#" onclick="selectTab('candy')">🍬 Caramelle</a></li>`;
  html += `<li class="nav-item"><a class="nav-link ${currentTab === 'postmix' ? 'active' : ''}" href="#" onclick="selectTab('postmix')">🥤 Post-Mix</a></li>`;
  html += `<li class="nav-item"><a class="nav-link ${currentTab === 'distributors' ? 'active' : ''}" href="#" onclick="selectTab('distributors')">🎰 Distributori</a></li>`;

  container.innerHTML = html;
}

function selectTab(tab) {
  currentTab = tab;
  switchTab();
}

// ==========================================
// RENDER TABELLA PRINCIPALE
// ==========================================
function render() {
  if (currentTab === 'setup') return;

  const tableContainer = document.querySelector(".table-responsive") || $("tbody")?.closest("table")?.parentElement;

  if (currentTab === 'candy') {
    if (tableContainer) tableContainer.style.display = "none";
    renderCandyView();
    return;
  }
  
  if (currentTab === 'postmix') {
    if (tableContainer) tableContainer.style.display = "none";
    renderPostMixView();
    return;
  }
  
  if (currentTab === 'distributors') {
    if (tableContainer) tableContainer.style.display = "none";
    renderDistributorsView();
    return;
  }

  // MAGAZZINI E TOTALE
  const customContainer = $("customViewContainer");
  if (customContainer) customContainer.style.display = "none";
  if (tableContainer) tableContainer.style.display = "block";

  const q = $("search") ? norm($("search").value) : "";
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  if ($("count")) $("count").textContent = `${data.length} prodotti`;
  const isTotTab = (currentTab === 'tot');

  if ($("thead")) {
    $("thead").innerHTML = `
      <tr>
        <th colspan="2" style="background: #212529; color: white;">PRODOTTO</th>
        <th colspan="3" style="background: #343a40; color: white;">REPORT MAGAZZINO</th>
        <th colspan="2" class="grp-box" style="background: #e3f2fd; color: #0d47a1;">BOX</th>
        <th colspan="2" class="grp-sleeve" style="background: #f3e5f5; color: #4a148c;">SLEEVE</th>
        <th class="grp-sfuso" style="background: #fff9c4; color: #f57f17;">SFUSO</th>
        <th colspan="5" style="background: #212529; color: white;">CONFRONTO GLOBALE (TUTTI I MAGAZZINI)</th>
        <th colspan="2" class="grp-valore" style="background: #ffebee; color: #b71c1c;">VALORIZZAZIONE</th>
      </tr>
      <tr style="background: #343a40; color: white;">
        <th style="background: #343a40; color: white;">Prodotto</th>
        <th style="background: #343a40; color: white;">U.M.</th>
        <th class="num" style="background: #343a40; color: white;">Iniziale</th>
        <th class="num" style="background: #343a40; color: white;">Danni</th>
        <th class="num" style="background: #343a40; color: white;">Venduto</th>
        <th class="num grp-box" style="background: #bbdefb; color: #0d47a1;">Size</th>
        <th class="grp-box" style="background: #bbdefb; color: #0d47a1;">Q.tà Box</th>
        <th class="num grp-sleeve" style="background: #e1bee7; color: #4a148c;">Size</th>
        <th class="grp-sleeve" style="background: #e1bee7; color: #4a148c;">Q.tà Sleeve</th>
        <th class="grp-sfuso" style="background: #fff59d; color: #f57f17;">Q.tà Sfuso</th>
        <th class="num" style="background: #343a40; color: white;">Atteso</th>
        <th class="num" style="background: #343a40; color: white;">Rilevato Base</th>
        <th class="num" style="background: #e3f2fd; color: #1976d2;">➕ Da Kit/Spec.</th>
        <th class="num" style="background: #343a40; color: white;">Effettivo Totale</th>
        <th class="num" style="background: #343a40; color: white;">Diff. Totale</th>
        <th class="num grp-valore" style="background: #ffcdd2; color: #b71c1c;">Costo Unit.</th>
        <th class="num grp-valore" style="background: #ffcdd2; color: #b71c1c;">Diff. Valore</th>
      </tr>
    `;
  }

  if ($("tbody")) {
    $("tbody").innerHTML = "";
    data.forEach(r => {
      const tr = document.createElement("tr");
      if (r.isKit) {
        tr.style.backgroundColor = "#e3f2fd";
        tr.style.borderLeft = "4px solid #1976d2";
      }
      let totBoxLocal = 0, totSleeveLocal = 0, totSfusoLocal = 0;
      if (isTotTab) {
        warehouses.forEach((_, wIdx) => {
          const cWh = getCount(wIdx, r.code);
          totBoxLocal += sumArr(cWh.box);
          totSleeveLocal += sumArr(cWh.sleeve);
          totSfusoLocal += sumArr(cWh.sfuso);
        });
      } else {
        const c = getCount(currentTab, r.code);
        totBoxLocal = sumArr(c.box);
        totSleeveLocal = sumArr(c.sleeve);
        totSfusoLocal = sumArr(c.sfuso);
      }
      const baseRilevato = (totBoxLocal * r.boxSize) + (totSleeveLocal * r.sleeveSize) + totSfusoLocal;
      const kitPart = getKitContributionDetail(r.name, r.code);
      const effettivoTotaleComplesso = getGlobalRilevato(r.code, r);
      const diffTotale = effettivoTotaleComplesso - r.atteso;
      const diffValore = diffTotale * (r.standardCost || 0);

      tr.innerHTML = `
        <td style="${r.isKit ? 'font-weight:bold; color:#0d47a1;' : ''}">${r.isKit ? '📦 ' : ''}${esc(r.name)}</td>
        <td>${esc(r.uom)}</td>
        <td class="num">${fmt(r.iniziale)}</td>
        <td class="num">${fmt(r.danni)}</td>
        <td class="num">${fmt(r.venduto)}</td>
        <td class="num grp-box">${r.boxSize ? fmt(r.boxSize) : '-'}</td>
        <td class="grp-box">${isTotTab ? fmt(totBoxLocal) : renderMultiInput(currentTab, r.code, 'box')}</td>
        <td class="num grp-sleeve">${r.sleeveSize ? fmt(r.sleeveSize) : '-'}</td>
        <td class="grp-sleeve">${isTotTab ? fmt(totSleeveLocal) : renderMultiInput(currentTab, r.code, 'sleeve')}</td>
        <td class="grp-sfuso">${isTotTab ? fmt(totSfusoLocal) : renderMultiInput(currentTab, r.code, 'sfuso')}</td>
        <td class="num">${fmt(r.atteso)}</td>
        <td class="num">${fmt(baseRilevato)}</td>
        <td class="num" style="background:#f0f4f8; font-weight:bold; color:#1976d2;">${fmt(kitPart)}</td>
        <td class="num cell-eff" id="eff-${r.code}">${fmt(effettivoTotaleComplesso)}</td>
        <td class="num cell-diff ${diffTotale === 0 ? 'ok' : 'bad'}" id="diff-${r.code}">${fmt(diffTotale)}</td>
        <td class="num grp-valore">€ ${fmtMoney(r.standardCost || 0)}</td>
        <td class="num grp-valore cell-val ${diffValore >= 0 ? 'ok' : 'bad'}" id="val-${r.code}">€ ${fmtMoney(diffValore)}</td>
      `;
      $("tbody").appendChild(tr);
    });
  }
  recalcKPIs();
}

function renderMultiInput(wIdx, code, type) {
  const c = getCount(wIdx, code);
  const arr = c[type] || [];
  let html = `<div class="d-flex flex-wrap gap-1 align-items-center">`;
  arr.forEach((val, i) => {
    html += `<input type="number" class="form-control form-control-sm" style="width:60px;" value="${val}" onchange="updateMultiInput(${wIdx}, '${code}', '${type}', ${i}, this.value)">`;
  });
  html += `<button class="btn btn-sm btn-outline-primary py-0 px-1" onclick="addMultiInput(${wIdx}, '${code}', '${type}')">+</button></div>`;
  return html;
}

function updateMultiInput(wIdx, code, type, index, val) {
  const c = getCount(wIdx, code);
  c[type][index] = parseFloat(val) || 0;
  render();
}

function addMultiInput(wIdx, code, type) {
  const c = getCount(wIdx, code);
  c[type].push(0);
  render();
}

// ==========================================
// VISTE SPECIALI COMPLETE
// ==========================================
function getCustomContainer() {
  let container = $("customViewContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "customViewContainer";
    container.className = "mt-3";
    const parent = $("tabContent") || document.body;
    parent.appendChild(container);
  }
  container.style.display = "block";
  return container;
}

function renderCandyView() {
  const container = getCustomContainer();
  container.innerHTML = `
    <div class="card p-3 shadow-sm">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="text-primary m-0">🍬 Griglia Conteggio Caramelle</h4>
        <button class="btn btn-sm btn-success" onclick="addCandyRow()">+ Aggiungi Caramella</button>
      </div>
      <table class="table table-bordered table-striped">
        <thead class="table-dark">
          <tr>
            <th>Codice / Prodotto</th>
            <th>Descrizione Espositore</th>
            <th>Q.tà Rilevata</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          ${candyData.map((item, idx) => `
            <tr>
              <td><input type="text" class="form-control form-control-sm" value="${esc(item.code)}" onchange="candyData[${idx}].code=this.value; render();"></td>
              <td><input type="text" class="form-control form-control-sm" value="${esc(item.desc)}" onchange="candyData[${idx}].desc=this.value;"></td>
              <td><input type="number" class="form-control form-control-sm" value="${item.qty}" onchange="candyData[${idx}].qty=parseFloat(this.value)||0; render();"></td>
              <td><button class="btn btn-danger btn-sm" onclick="candyData.splice(${idx},1); render();">🗑️</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function addCandyRow() {
  candyData.push({ code: '', desc: '', qty: 0 });
  renderCandyView();
}

function renderPostMixView() {
  const container = getCustomContainer();
  container.innerHTML = `
    <div class="card p-3 shadow-sm">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="text-primary m-0">🥤 Modulo Sciroppi Post-Mix</h4>
        <button class="btn btn-sm btn-success" onclick="addPostMixRow()">+ Aggiungi Sciroppo</button>
      </div>
      <table class="table table-bordered table-striped">
        <thead class="table-dark">
          <tr>
            <th>Codice Sciroppo</th>
            <th>Gusto / Linea</th>
            <th>Bag in Box Rilevati (Litri/Kg)</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          ${postMixData.map((item, idx) => `
            <tr>
              <td><input type="text" class="form-control form-control-sm" value="${esc(item.code)}" onchange="postMixData[${idx}].code=this.value; render();"></td>
              <td><input type="text" class="form-control form-control-sm" value="${esc(item.desc)}" onchange="postMixData[${idx}].desc=this.value;"></td>
              <td><input type="number" class="form-control form-control-sm" value="${item.qty}" onchange="postMixData[${idx}].qty=parseFloat(this.value)||0; render();"></td>
              <td><button class="btn btn-danger btn-sm" onclick="postMixData.splice(${idx},1); render();">🗑️</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function addPostMixRow() {
  postMixData.push({ code: '', desc: '', qty: 0 });
  renderPostMixView();
}

function renderDistributorsView() {
  const container = getCustomContainer();
  container.innerHTML = `
    <div class="card p-3 shadow-sm">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h4 class="text-primary m-0">🎰 Inserimenti Distributori Automatici</h4>
        <button class="btn btn-sm btn-success" onclick="addDistributorRow()">+ Aggiungi Carico Distributore</button>
      </div>
      <table class="table table-bordered table-striped">
        <thead class="table-dark">
          <tr>
            <th>Codice Prodotto</th>
            <th>ID / Posizione Distributore</th>
            <th>Q.tà Inserita</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          ${distributorData.map((item, idx) => `
            <tr>
              <td><input type="text" class="form-control form-control-sm" value="${esc(item.code)}" onchange="distributorData[${idx}].code=this.value; render();"></td>
              <td><input type="text" class="form-control form-control-sm" value="${esc(item.desc)}" onchange="distributorData[${idx}].desc=this.value;"></td>
              <td><input type="number" class="form-control form-control-sm" value="${item.qty}" onchange="distributorData[${idx}].qty=parseFloat(this.value)||0; render();"></td>
              <td><button class="btn btn-danger btn-sm" onclick="distributorData.splice(${idx},1); render();">🗑️</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function addDistributorRow() {
  distributorData.push({ code: '', desc: '', qty: 0 });
  renderDistributorsView();
}

function renderSetupView() {
  if ($("tabContent")) $("tabContent").style.display = "none";
  let setupContainer = $("setupView");
  if (!setupContainer) {
    setupContainer = document.createElement("div");
    setupContainer.id = "setupView";
    setupContainer.className = "container mt-3";
    document.body.appendChild(setupContainer);
  }
  setupContainer.style.display = "block";
  setupContainer.innerHTML = `
    <div class="card p-4 shadow-sm">
      <h3>⚙️ Impostazioni Magazzini Cinema</h3>
      <p>Configura i magazzini per la struttura corrente.</p>
    </div>
  `;
}

// ==========================================
// CALCOLO KPI E ESPORTAZIONE EXCEL
// ==========================================
function recalcKPIs() {
  let totAtteso = 0, totRilevato = 0, totDiffPezzi = 0, totDiffVal = 0;

  rows.forEach(r => {
    const eff = getGlobalRilevato(r.code, r);
    const diff = eff - r.atteso;
    const val = diff * (r.standardCost || 0);

    totAtteso += r.atteso;
    totRilevato += eff;
    totDiffPezzi += diff;
    totDiffVal += val;
  });

  const k1 = document.querySelectorAll(".card h2, .card .h2")[0] || $("kpiAttesi");
  const k2 = document.querySelectorAll(".card h2, .card .h2")[1] || $("kpiRilevati");
  const k3 = document.querySelectorAll(".card h2, .card .h2")[2] || $("kpiDiffPezzi");
  const k4 = document.querySelectorAll(".card h2, .card .h2")[3] || $("kpiDiffVal");

  if (k1) k1.textContent = fmt(totAtteso);
  if (k2) k2.textContent = fmt(totRilevato);
  if (k3) k3.textContent = fmt(totDiffPezzi);
  if (k4) k4.textContent = "€ " + fmtMoney(totDiffVal);
}

function exportToExcel() {
  if (rows.length === 0) {
    alert("Nessun dato da esportare!");
    return;
  }
  const exportData = rows.map(r => {
    const eff = getGlobalRilevato(r.code, r);
    const diff = eff - r.atteso;
    return {
      "Codice": r.code,
      "Prodotto": r.name,
      "U.M.": r.uom,
      "Iniziale": r.iniziale,
      "Danni": r.danni,
      "Venduto": r.venduto,
      "Atteso": r.atteso,
      "Effettivo Totale": eff,
      "Differenza Pezzi": diff,
      "Costo Unitario": r.standardCost,
      "Differenza Valore": diff * r.standardCost
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report Inventario");
  XLSX.writeFile(wb, "Report_Inventario_Cinema.xlsx");
}
