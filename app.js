let mag = [], size = [], rows = [];
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

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  loadSetupFromStorage();
  loadCountsFromStorage();
  updateHeaderTitle();

  $("magFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    $("magStatus").textContent = "Lettura del report in corso...";
    readMatrix(f).then(m => {
      mag = parseMag(m);
      $("magStatus").textContent = `✓ ${f.name} (${mag.length} articoli)`;
      build();
    }).catch(err => {
      $("magStatus").textContent = "❌ Errore file Magazzino";
      showError("Errore file Magazzino: " + err.message);
    });
  });

  $("sizeFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    $("sizeStatus").textContent = "Lettura anagrafica in corso...";
    readMatrix(f, "SIZE").then(m => {
      size = parseSize(m);
      $("sizeStatus").textContent = `✓ ${f.name} (${size.length} articoli)`;
      build();
    }).catch(err => {
      $("sizeStatus").textContent = "❌ Errore file SIZE";
      showError("Errore file SIZE: " + err.message);
    });
  });

  $("search").addEventListener("input", render);
});

function toggleFilesSection() {
  const sec = $("filesSection");
  sec.style.display = (sec.style.display === "none") ? "grid" : "none";
}

function updateHeaderTitle() {
  $("appTitle").textContent = `📊 Gestione Inventario — ${cinemaName}`;
}

/* ---------------- SETUP & STORAGE ---------------- */
function loadSetupFromStorage() {
  const savedCinema = localStorage.getItem("cinema_info_name");
  if (savedCinema) cinemaName = savedCinema;
  const savedWh = localStorage.getItem("cinema_warehouses");
  if (savedWh) {
    try { warehouses = JSON.parse(savedWh); } catch(e){}
  }
}

function loadCountsFromStorage() {
  const savedCounts = localStorage.getItem("inventory_counts");
  if (savedCounts) {
    try { countsData = JSON.parse(savedCounts); } catch(e){}
  }
}

function saveCountsToStorage() {
  localStorage.setItem("inventory_counts", JSON.stringify(countsData));
}

function resetCounts() {
  if (confirm("Sei sicuro di voler azzerare tutti i conteggi inseriti per tutti i magazzini?")) {
    countsData = {};
    saveCountsToStorage();
    render();
  }
}

function handleCinemaSelectChange() {
  const sel = $("cinemaSelect").value;
  $("customCinemaDiv").style.display = (sel === "__CUSTOM__") ? "block" : "none";
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
  $("tabContent").style.display = "none";
  $("setupView").style.display = "block";
  
  const select = $("cinemaSelect");
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
    $("customCinemaDiv").style.display = "block";
    $("customCinemaInput").value = cinemaName;
  } else {
    $("customCinemaDiv").style.display = "none";
  }
  select.appendChild(customOpt);
  
  const container = $("whList");
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

function addWarehouseInput() {
  const container = $("whList");
  const div = document.createElement("div");
  div.className = "wh-item";
  div.style.cssText = "display: flex; gap: 10px; margin-bottom: 8px;";
  div.innerHTML = `
    <input class="wh-input-item" value="Magazzino ${container.children.length + 1}" placeholder="Nome Magazzino" style="flex:1; padding: 6px 10px;">
    <button class="btn btn-danger" onclick="this.parentElement.remove()" style="background:#d32f2f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Elimina</button>
  `;
  container.appendChild(div);
}

/* ---------------- TABS RENDER ---------------- */
function renderTabs() {
  const bar = $("tabsBar");
  bar.innerHTML = "";

  warehouses.forEach((w, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${currentTab === idx ? 'active' : ''}`;
    btn.textContent = `📍 ${w}`;
    btn.onclick = () => { currentTab = idx; switchTab(); };
    bar.appendChild(btn);
  });

  const totBtn = document.createElement("button");
  totBtn.className = `tab-btn ${currentTab === 'tot' ? 'active' : ''}`;
  totBtn.textContent = `📊 RIEPILOGO TOTALE`;
  totBtn.onclick = () => { currentTab = 'tot'; switchTab(); };
  bar.appendChild(totBtn);
}

function switchTab() {
  renderTabs();
  if (currentTab === 'setup') {
    renderSetupView();
  } else {
    $("setupView").style.display = "none";
    $("tabContent").style.display = "block";
    render();
  }
}

/* ---------------- EXCEL PARSING ---------------- */
function readMatrix(file, preferredSheetName = "") {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        if (typeof XLSX === "undefined") throw new Error("Libreria XLSX non presente.");
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error("Nessun foglio trovato.");
        
        let sheetName = wb.SheetNames[0];
        if (preferredSheetName) {
          const found = wb.SheetNames.find(s => norm(s).includes(norm(preferredSheetName)));
          if (found) sheetName = found;
        }
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: true }));
      } catch (x) { reject(x); }
    };
    r.onerror = () => reject(new Error("Errore nella lettura fisica del file."));
    r.readAsArrayBuffer(file);
  });
}

function text(v) { return String(v ?? "").trim(); }
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

/* PARSING CORRETTO MAGAZZINO (Pulisce categorie e accoppiamenti errati) */
function parseMag(m) {
  let startRow = -1;
  let costCol = -1;

  for (let i = 0; i < m.length; i++) {
    if (m[i] && m[i].some(v => norm(v).includes("OPENING BALANCE") || norm(v).includes("INIZIALE"))) { 
      startRow = i + 1; 
      costCol = m[i].findIndex(v => norm(v).includes("COST") || norm(v).includes("COSTO") || norm(v).includes("PREZZO"));
      break; 
    }
  }
  
  if (startRow < 0) startRow = 1;

  const out = [];

  for (let i = startRow; i < m.length; i++) {
    const r = m[i];
    if (!r || r.length < 3) continue;
    
    const code = text(r[1]);
    const name = text(r[2]);

    // Ignora righe vuote, intestazioni, sezioni di categoria (es. FOOD, Concessions Store room) o totali
    if (!code || !name) continue;
    if (norm(code) === norm(name)) continue; // Filtra le righe di categoria dove codice e nome coincidono
    if (norm(code).includes("CODICE") || norm(code).includes("TOTAL") || norm(code).includes("STORE ROOM")) continue;

    const uom = text(r[3]) || "PZ";
    const iniziale = n(r[5]), ricevuti = n(r[8]), trasferimenti = n(r[10]), rettifiche = n(r[12]);
    const danni = n(r[14]), venduto = n(r[18]), uso = n(r[21]);
    
    const standardCost = costCol >= 0 ? n(r[costCol]) : (r[22] !== undefined ? n(r[22]) : 0);

    let atteso = iniziale + ricevuti + trasferimenti + rettifiche - danni - venduto - uso;
    if (isNaN(atteso) || (iniziale === 0 && venduto === 0 && atteso === 0)) {
      atteso = n(r[4]) || 0;
    }

    out.push({ code, name, uom, iniziale, danni, venduto, atteso, standardCost });
  }

  if (out.length === 0) {
    throw new Error("Impossibile leggere i prodotti. Verifica la struttura del report Magazzino.");
  }
  return out;
}

function parseSize(m) {
  let h = -1;
  for (let i = 0; i < m.length; i++) {
    if (m[i] && m[i].some(v => ["PRODOTTO", "DESCRIZIONE", "ARTICOLO", "NOME"].includes(norm(v)))) { 
      h = i; 
      break; 
    }
  }

  let pCol = 0, boxCol = 1, sleeveCol = 2;
  if (h >= 0) {
    const head = m[h];
    pCol = head.findIndex(v => ["PRODOTTO", "DESCRIZIONE", "ARTICOLO"].includes(norm(v)));
    boxCol = head.findIndex(v => norm(v).includes("BOX"));
    sleeveCol = head.findIndex(v => norm(v).includes("SLEEVE"));

    if (pCol < 0) pCol = 0;
    if (boxCol < 0) boxCol = 1;
    if (sleeveCol < 0) sleeveCol = 2;
  }

  const out = [];
  const startRow = h >= 0 ? h + 1 : 1;

  for (let i = startRow; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;

    const name = text(r[pCol]);
    if (!name || name === "#N/D" || ["PRODOTTO", "DESCRIZIONE"].includes(norm(name))) continue;

    out.push({
      name,
      boxSize: n(r[boxCol]),
      sleeveSize: n(r[sleeveCol])
    });
  }

  if (out.length === 0) {
    throw new Error("Nessuna anagrafica SIZE trovata nel file inserito.");
  }
  return out;
}

function build() {
  if (!mag.length || !size.length) {
    $("mainStatus").style.display = "block";
    $("mainStatus").innerHTML = `Magazzino: <b>${mag.length}</b> · SIZE: <b>${size.length}</b><br>Carica entrambi i file per continuare.`;
    return;
  }

  const sm = new Map(size.map(x => [norm(x.name), x]));
  rows = mag.map(x => {
    const s = sm.get(norm(x.name)) || {};
    return { 
      ...x, 
      boxSize: s.boxSize || 0, 
      sleeveSize: s.sleeveSize || 0
    };
  });

  // NASCONDE UPLOAD E MOSTRA TABELLA AUTOMATICAMENTE
  $("filesSection").style.display = "none";
  $("mainStatus").style.display = "none";
  $("setupView").style.display = "none";
  $("tabContent").style.display = "block";

  if (typeof currentTab === 'string') currentTab = 0;

  renderTabs();
  render();
}

/* ---------------- TABLE & DATA RENDER ---------------- */
function getCount(whIdx, code) {
  if (!countsData[whIdx]) countsData[whIdx] = {};
  if (!countsData[whIdx][code]) countsData[whIdx][code] = { box: [0], sleeve: [0], sfuso: [0] };
  
  const c = countsData[whIdx][code];
  if (!Array.isArray(c.box)) c.box = [n(c.box)];
  if (!Array.isArray(c.sleeve)) c.sleeve = [n(c.sleeve)];
  if (!Array.isArray(c.sfuso)) c.sfuso = [n(c.sfuso)];
  
  return c;
}

function sumArr(arr) { return arr.reduce((a, b) => a + n(b), 0); }

function render() {
  if (currentTab === 'setup') return;

  const q = norm($("search").value);
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  $("count").textContent = `${data.length} prodotti`;

  const isTotTab = (currentTab === 'tot');

  $("thead").innerHTML = `
    <tr>
      <th colspan="3">PRODOTTO</th>
      <th colspan="3">REPORT MAGAZZINO</th>
      <th colspan="2" class="grp-box">BOX</th>
      <th colspan="2" class="grp-sleeve">SLEEVE</th>
      <th class="grp-sfuso">SFUSO</th>
      <th colspan="3">${isTotTab ? 'CONFRONTO GLOBALE' : 'TOTALE ' + (warehouses[currentTab] || '').toUpperCase()}</th>
      <th colspan="2" class="grp-valore">VALORIZZAZIONE</th>
    </tr>
    <tr>
      <th>Codice</th><th>Prodotto</th><th>U.M.</th>
      <th class="num">Iniziale</th><th class="num">Danni</th><th class="num">Venduto</th>
      <th class="num grp-box">Size</th><th class="grp-box">Q.tà Box</th>
      <th class="num grp-sleeve">Size</th><th class="grp-sleeve">Q.tà Sleeve</th>
      <th class="grp-sfuso">Q.tà Sfuso</th>
      <th class="num">Atteso</th><th class="num">Effettivo</th><th class="num">Diff.</th>
      <th class="num grp-valore">Costo Unit.</th><th class="num grp-valore">Diff. Valore</th>
    </tr>
  `;

  $("tbody").innerHTML = "";

  let totalAttesoPezzi = 0;
  let totalRilevatoPezzi = 0;
  let totalDiffPezzi = 0;
  let totalDiffValore = 0;

  data.forEach(r => {
    const tr = document.createElement("tr");

    let totBox = 0, totSleeve = 0, totSfuso = 0;

    if (isTotTab) {
      warehouses.forEach((_, idx) => {
        const c = getCount(idx, r.code);
        totBox += sumArr(c.box);
        totSleeve += sumArr(c.sleeve);
        totSfuso += sumArr(c.sfuso);
      });
    } else {
      const c = getCount(currentTab, r.code);
      totBox = sumArr(c.box);
      totSleeve = sumArr(c.sleeve);
      totSfuso = sumArr(c.sfuso);
    }

    const effettivo = (totBox * r.boxSize) + (totSleeve * r.sleeveSize) + totSfuso;
    const diff = effettivo - r.atteso;
    const diffValore = diff * (r.standardCost || 0);

    totalAttesoPezzi += r.atteso;
    totalRilevatoPezzi += effettivo;
    totalDiffPezzi += diff;
    totalDiffValore += diffValore;

    tr.innerHTML = `
      <td>${esc(r.code)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.uom)}</td>
      <td class="num">${fmt(r.iniziale)}</td>
      <td class="num">${fmt(r.danni)}</td>
      <td class="num">${fmt(r.venduto)}</td>
      
      <td class="num grp-box">${r.boxSize ? fmt(r.boxSize) : '-'}</td>
      <td class="grp-box">${isTotTab ? fmt(totBox) : renderMultiInput(currentTab, r.code, 'box')}</td>
      
      <td class="num grp-sleeve">${r.sleeveSize ? fmt(r.sleeveSize) : '-'}</td>
      <td class="grp-sleeve">${isTotTab ? fmt(totSleeve) : renderMultiInput(currentTab, r.code, 'sleeve')}</td>
      
      <td class="grp-sfuso">${isTotTab ? fmt(totSfuso) : renderMultiInput(currentTab, r.code, 'sfuso')}</td>
      
      <td class="num">${fmt(r.atteso)}</td>
      <td class="num cell-eff">${fmt(effettivo)}</td>
      <td class="num cell-diff ${diff === 0 ? 'ok' : 'bad'}">${fmt(diff)}</td>
      <td class="num grp-valore">€ ${fmtMoney(r.standardCost || 0)}</td>
      <td class="num grp-valore cell-val ${diffValore >= 0 ? 'ok' : 'bad'}">€ ${fmtMoney(diffValore)}</td>
    `;

    $("tbody").appendChild(tr);
  });

  $("kpiAtteso").textContent = fmt(totalAttesoPezzi);
  $("kpiRilevato").textContent = fmt(totalRilevatoPezzi);
  $("kpiDiffPezzi").textContent = fmt(totalDiffPezzi);
  $("kpiDiffValore").textContent = "€ " + fmtMoney(totalDiffValore);

  $("kpiDiffBox").className = "kpi-card " + (totalDiffPezzi === 0 ? "success" : "warning");
  $("kpiValoreBox").className = "kpi-card " + (totalDiffValore >= 0 ? "success" : "warning");
}

function renderMultiInput(whIdx, code, type) {
  const c = getCount(whIdx, code);
  const arr = c[type];
  let html = `<div class="input-scroll-cell">`;

  arr.forEach((val, idx) => {
    html += `<input class="qty-input" type="number" min="0" value="${val || ''}" 
              oninput="updateCountValue(${whIdx}, '${esc(code)}', '${type}', ${idx}, this.value)">`;
  });

  if (arr.length < MAX_FIELDS && arr[arr.length - 1] > 0) {
    html += `<input class="qty-input" type="number" min="0" value="" placeholder="+" 
              oninput="updateCountValue(${whIdx}, '${esc(code)}', '${type}', ${arr.length}, this.value)">`;
  }

  html += `</div>`;
  return html;
}

function updateCountValue(whIdx, code, type, idx, val) {
  const c = getCount(whIdx, code);
  c[type][idx] = n(val);

  while (c[type].length > 1 && n(c[type][c[type].length - 1]) === 0 && n(c[type][c[type].length - 2]) === 0) {
    c[type].pop();
  }

  saveCountsToStorage();
  render();
}

/* ---------------- ESPORTAZIONE EXCEL ---------------- */
function exportToExcel() {
  if (!rows || rows.length === 0) {
    alert("Nessun dato da esportare. Carica prima i file di magazzino.");
    return;
  }

  if (typeof XLSX === "undefined") {
    alert("Libreria XLSX non presente.");
    return;
  }

  const wb = XLSX.utils.book_new();

  const totData = [
    [`CINEMA / SEDE: ${cinemaName.toUpperCase()}`],
    ["Codice", "Prodotto", "U.M.", "Iniziale", "Danni", "Venduto", "Atteso Totale", "Effettivo Totale", "Differenza Pezzi", "Costo Standard", "Differenza Valore (€)"]
  ];

  rows.forEach(r => {
    let totBox = 0, totSleeve = 0, totSfuso = 0;
    warehouses.forEach((_, idx) => {
      const c = getCount(idx, r.code);
      totBox += sumArr(c.box);
      totSleeve += sumArr(c.sleeve);
      totSfuso += sumArr(c.sfuso);
    });

    const effettivoTot = (totBox * r.boxSize) + (totSleeve * r.sleeveSize) + totSfuso;
    const diffTot = effettivoTot - r.atteso;
    const diffVal = diffTot * (r.standardCost || 0);

    totData.push([
      r.code,
      r.name,
      r.uom,
      r.iniziale,
      r.danni,
      r.venduto,
      r.atteso,
      effettivoTot,
      diffTot,
      r.standardCost || 0,
      diffVal
    ]);
  });

  const wsTot = XLSX.utils.aoa_to_sheet(totData);
  XLSX.utils.book_append_sheet(wb, wsTot, "Riepilogo Totale");

  warehouses.forEach((whName, idx) => {
    const whData = [
      [`MAGAZZINO: ${whName.toUpperCase()} — SEDE: ${cinemaName.toUpperCase()}`],
      ["Codice", "Prodotto", "U.M.", "Box Size", "Q.tà Box (Tot)", "Sleeve Size", "Q.tà Sleeve (Tot)", "Q.tà Sfuso (Tot)", "Totale Rilevato (Pezzi)"]
    ];

    rows.forEach(r => {
      const c = getCount(idx, r.code);
      const bSum = sumArr(c.box);
      const sSum = sumArr(c.sleeve);
      const sfSum = sumArr(c.sfuso);
      const effettivoWh = (bSum * r.boxSize) + (sSum * r.sleeveSize) + sfSum;

      whData.push([
        r.code,
        r.name,
        r.uom,
        r.boxSize || 0,
        bSum,
        r.sleeveSize || 0,
        sSum,
        sfSum,
        effettivoWh
      ]);
    });

    const cleanSheetName = whName.replace(/[\\/?*:[\]]/g, "").substring(0, 31) || `Magazzino ${idx + 1}`;
    const wsWh = XLSX.utils.aoa_to_sheet(whData);
    XLSX.utils.book_append_sheet(wb, wsWh, cleanSheetName);
  });

  const today = new Date().toISOString().split('T')[0];
  const cleanCinemaName = cinemaName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Inventario_${cleanCinemaName}_${today}.xlsx`;

  XLSX.writeFile(wb, fileName);
}

function fmt(v) { return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))); }
function fmtMoney(v) { return (Number(v) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function esc(v) { return text(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function showError(msg) { 
  $("mainStatus").style.display = "block";
  $("mainStatus").innerHTML = `<span style="color:#b00020;font-weight:bold">${esc(msg)}</span>`; 
}
