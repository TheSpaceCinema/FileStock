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
let candyData = [];
let postMixData = [];
let distributorData = [];

// ==========================================
// HELPER PER CONTEGGI E KIT
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
  // Calcolo contributi da Kit / Schede speciali
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

// ==========================================
// GESTIONE TAB E INTERFACCIA
// ==========================================
function switchTab() {
  renderTabs();
  
  // Nascondiamo il contenitore delle griglie speciali di default
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
  const container = $("tabsContainer");
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
// RENDER PRINCIPALE
// ==========================================
function render() {
  if (currentTab === 'setup') return;

  const tableContainer = document.querySelector(".table-responsive") || $("tbody")?.closest("table")?.parentElement;

  // 1. SCHEDA CARAMELLE
  if (currentTab === 'candy') {
    if (tableContainer) tableContainer.style.display = "none";
    renderCandyView();
    return;
  }
  
  // 2. SCHEDA POST MIX
  if (currentTab === 'postmix') {
    if (tableContainer) tableContainer.style.display = "none";
    renderPostMixView();
    return;
  }
  
  // 3. SCHEDA DISTRIBUTORI
  if (currentTab === 'distributors') {
    if (tableContainer) tableContainer.style.display = "none";
    renderDistributorsView();
    return;
  }

  // --- DA QUI IN POI: MAGAZZINI CLASSICI E RIEPILOGO TOTALE ---
  
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
        <td class="grp-box">${isTotTab ? fmt(totBoxLocal) : renderMultiInput(currentTab, r.code, 'box', r.boxSize)}</td>
        <td class="num grp-sleeve">${r.sleeveSize ? fmt(r.sleeveSize) : '-'}</td>
        <td class="grp-sleeve">${isTotTab ? fmt(totSleeveLocal) : renderMultiInput(currentTab, r.code, 'sleeve', r.sleeveSize)}</td>
        <td class="grp-sfuso">${isTotTab ? fmt(totSfusoLocal) : renderMultiInput(currentTab, r.code, 'sfuso', 1)}</td>
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

function renderMultiInput(wIdx, code, type, multiplier) {
  const c = getCount(wIdx, code);
  const arr = c[type] || [];
  let html = `<div class="d-flex flex-wrap gap-1 align-items-center">`;
  arr.forEach((val, i) => {
    html += `<input type="number" class="form-control form-control-sm" style="width:65px;" value="${val}" onchange="updateMultiInput(${wIdx}, '${code}', '${type}', ${i}, this.value)">`;
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
// VISTE SPECIALI (CARAMELLE, POST-MIX, DISTRIBUTORI)
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
      <h4 class="text-primary mb-3">🍬 Gestione Griglia Caramelle</h4>
      <p class="text-muted">Inserimento guidato per il conteggio e l'esposizione delle caramelle.</p>
      <div id="candyGrid" class="alert alert-info">Griglia caramelle pronta per l'inserimento dati.</div>
    </div>
  `;
}

function renderPostMixView() {
  const container = getCustomContainer();
  container.innerHTML = `
    <div class="card p-3 shadow-sm">
      <h4 class="text-primary mb-3">🥤 Gestione Post-Mix</h4>
      <p class="text-muted">Modulo di conteggio sciroppi e bibite alla spina.</p>
      <div id="postMixGrid" class="alert alert-info">Griglia Post-Mix pronta per l'inserimento dati.</div>
    </div>
  `;
}

function renderDistributorsView() {
  const container = getCustomContainer();
  container.innerHTML = `
    <div class="card p-3 shadow-sm">
      <h4 class="text-primary mb-3">🎰 Elenco Inserimenti Distributori</h4>
      <p class="text-muted">Registro dei carichi e scarichi effettuati sui distributori automatici.</p>
      <div id="distributorsGrid" class="alert alert-info">Elenco distributori pronto per la registrazione.</div>
    </div>
  `;
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
      <h3>⚙️ Impostazioni Magazzini e Sistema</h3>
      <p>Configura i nomi delle strutture e gestisci la struttura del file.</p>
    </div>
  `;
}

// ==========================================
// CALCOLO KPI
// ==========================================
function recalcKPIs() {
  // Calcolo riassuntivo dei valori di test
  let totalDiffVal = 0;
  rows.forEach(r => {
    const eff = getGlobalRilevato(r.code, r);
    const diff = eff - r.atteso;
    totalDiffVal += diff * (r.standardCost || 0);
  });
  const kpiElem = $("kpiTotalDiffVal");
  if (kpiElem) kpiElem.textContent = "€ " + fmtMoney(totalDiffVal);
}

// ==========================================
// INIZIALIZZAZIONE ALL'AVVIO
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  switchTab();
});
