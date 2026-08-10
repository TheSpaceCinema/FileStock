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

/* --- CONFIGURAZIONE DINAMICA GRIGLIA CARAMELLE PER CINEMA --- */
let candyGridConfigs = JSON.parse(localStorage.getItem("candy_grid_configs")) || {};

function getActiveCinemaCandyConfig() {
  if (!candyGridConfigs[cinemaName]) {
    // Configurazione predefinita di default per ogni cinema
    candyGridConfigs[cinemaName] = {
      columns: 22, 
      rows: 4, 
      taraBins: [0.37, 0.72, 0.50, 0.50],
      gridValues: {}, // [r][c] = peso
      buste: Array(10).fill({kg: 0, sleeve: 0})
    };
  }
  return candyGridConfigs[cinemaName];
}

function saveCandyConfig() {
  localStorage.setItem("candy_grid_configs", JSON.stringify(candyGridConfigs));
}

function getCandyTotalKg() {
  const cfg = getActiveCinemaCandyConfig();
  let total = 0;
  // Calcolo griglia dinamica
  for(let r=0; r<cfg.rows; r++) {
    for(let c=0; c<cfg.columns; c++) {
      let val = n(cfg.gridValues[r]?.[c] || 0);
      let tara = n(cfg.taraBins[r] || 0);
      total += Math.max(0, val - tara);
    }
  }
  // Calcolo buste sciolte / kit
  if (Array.isArray(cfg.buste)) {
    cfg.buste.forEach(b => {
      total += n(b.kg) + (n(b.sleeve) * 0.1);
    });
  }
  return total;
}

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

function showError(msg) {
  alert(msg);
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

  // Aggiungiamo dinamicamente il tab speciale se configurato o gestito
  const candyTabIdx = warehouses.length;
  const btnCandy = document.createElement("button");
  btnCandy.className = `tab-btn ${currentTab === 'candy' ? 'active' : ''}`;
  btnCandy.textContent = `🍬 Magazzino Caramelle`;
  btnCandy.onclick = () => { currentTab = 'candy'; switchTab(); };
  bar.appendChild(btnCandy);

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
function cleanCode(val) {
  if (val === null || val === undefined) return "";
  let s = text(val);
  if (/^\d+$/.test(s)) {
    s = String(parseInt(s, 10));
  }
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

/* PARSER MAGAZZINO */
function parseMag(m) {
  const out = [];

  for (let i = 0; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;

    const uom = text(r[2]).trim().toUpperCase();

    if (!uom || (uom !== "PZ" && uom !== "KG" && uom !== "LT" && uom !== "CL" && uom !== "GR")) {
      continue;
    }

    let name = "";
    if (i + 1 < m.length && m[i + 1]) {
      name = text(m[i + 1][1] || m[i + 1][0]).trim();
    }

    if (!name) {
      name = text(r[1]).trim();
    }

    const rawCode = text(r[1]).trim();
    const code = cleanCode(rawCode);

    const iniziale = n(r[5]);
    const danni = n(r[14]);
    const venduto = n(r[18]);
    
    let atteso = n(r[23]);
    if (atteso === 0 && (iniziale > 0 || venduto > 0)) {
      atteso = iniziale - danni - venduto;
    }

    const standardCost = Math.abs(n(r[29] || r[32] || 0));

    out.push({
      rawCode,
      code,
      name,
      uom,
      iniziale,
      danni,
      venduto,
      atteso,
      standardCost
    });
  }

  if (out.length === 0) {
    throw new Error("Nessun prodotto trovato nel report Magazzino.");
  }

  return out;
}

/* PARSER SIZE & KIT */
function parseSize(m) {
  const out = [];
  let isKitSection = false;

  for (let i = 0; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;

    const firstVal = text(r[0]);
    const normFirst = norm(firstVal);

    if (normFirst === "KIT" || norm(r[1]) === "TIPO" || (normFirst === "" && norm(r[1]) === "TIPO")) {
      isKitSection = true;
      continue;
    }

    if (isKitSection) {
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
          if (norm(textVal) !== "PRODOTTO" && norm(textVal) !== "Q.TA") {
            currentIngName = textVal;
          }
        }
      }

      out.push({
        code: "KIT_" + cleanCode(kitName),
        name: kitName,
        boxSize: 1,
        sleeveSize: 0,
        isKit: true,
        kitType,
        ingredients
      });
    } else {
      const name = firstVal;
      const normName = norm(name);
      if (!name || name === "#N/D" || normName.includes("PRODOTTO") || normName.includes("DESCRIZIONE") || normName.includes("BOX")) continue;

      const boxSize = n(r[1]);
      const sleeveSize = n(r[2]);

      let primaryCode = "";
      for (let c = 4; c < r.length; c++) {
        const valStr = text(r[c]);
        if (valStr && !primaryCode) {
          primaryCode = cleanCode(valStr);
          break;
        }
      }
      if (!primaryCode) primaryCode = cleanCode(name);

      out.push({
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

  if (out.length === 0) {
    throw new Error("Nessuna anagrafica SIZE trovata nel file inserito.");
  }
  return out;
}

/* BUILD E ORDINAMENTO KIT IN FONDO */
function build() {
  if (!mag.length || !size.length) {
    $("mainStatus").style.display = "block";
    $("mainStatus").innerHTML = `Magazzino: <b>${mag.length}</b> · SIZE: <b>${size.length}</b><br>Carica entrambi i file per continuare.`;
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
          rawCode: s.code,
          code: s.code,
          name: s.name,
          uom: s.kitType || "BOX",
          iniziale: 0,
          danni: 0,
          venduto: 0,
          atteso: 0,
          standardCost: 0,
          boxSize: s.boxSize || 1,
          sleeveSize: s.sleeveSize || 0,
          isKit: true,
          ingredients: s.ingredients || []
        });
      }
    }
  });

  rows.sort((a, b) => {
    if (a.isKit && !b.isKit) return 1;
    if (!a.isKit && b.isKit) return -1;
    return a.name.localeCompare(b.name);
  });

  $("filesSection").style.display = "none";
  $("mainStatus").style.display = "none";
  $("setupView").style.display = "none";
  $("tabContent").style.display = "block";

  if (typeof currentTab === 'string' && currentTab !== 'tot' && currentTab !== 'candy') currentTab = 0;

  renderTabs();
  render();
}

/* ---------------- DATA CALCULATIONS ---------------- */
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
  
  // Se il prodotto è Caramelle Aermont, aggiungiamo anche il totale Kg calcolato dal magazzino caramelle dedicato di questo cinema
  if (norm(r.name).includes("CARAMELLE") && norm(r.name).includes("AERMONT")) {
    basePezzi += getCandyTotalKg();
  }

  return basePezzi + getKitContributionDetail(r.name, r.code);
}

/* ---------------- TABLE RENDER & MAG. CARAMELLE ---------------- */
function render() {
  if (currentTab === 'setup') return;

  // Se siamo sul tab del Magazzino Caramelle specifico per questo cinema
  if (currentTab === 'candy') {
    renderCandyView();
    return;
  }

  const q = norm($("search").value);
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  $("count").textContent = `${data.length} prodotti`;

  const isTotTab = (currentTab === 'tot');

  $("thead").innerHTML = `
    <tr style="position: sticky; top: 0; z-index: 20; background: #212529;">
      <th colspan="2" style="background: #212529; color: white;">PRODOTTO</th>
      <th colspan="3" style="background: #343a40; color: white;">REPORT MAGAZZINO</th>
      <th colspan="2" class="grp-box" style="background: #e3f2fd; color: #0d47a1;">BOX</th>
      <th colspan="2" class="grp-sleeve" style="background: #f3e5f5; color: #4a148c;">SLEEVE</th>
      <th class="grp-sfuso" style="background: #fff9c4; color: #f57f17;">SFUSO</th>
      <th colspan="5" style="background: #212529; color: white;">CONFRONTO GLOBALE (TUTTI I MAGAZZINI)</th>
      <th colspan="2" class="grp-valore" style="background: #ffebee; color: #b71c1c;">VALORIZZAZIONE</th>
    </tr>
    <tr style="position: sticky; top: 41px; z-index: 20; background: #343a40; color: white;">
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
      <th class="num" style="background: #e3f2fd; color: #0d47a1;">➕ Da Kit</th>
      <th class="num" style="background: #343a40; color: white;">Effettivo Totale</th>
      <th class="num" style="background: #343a40; color: white;">Diff. Totale</th>
      <th class="num grp-valore" style="background: #ffcdd2; color: #b71c1c;">Costo Unit.</th>
      <th class="num grp-valore" style="background: #ffcdd2; color: #b71c1c;">Diff. Valore</th>
    </tr>
  `;

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
      
      <td class="num grp-sfuso">${isTotTab ? fmt(totSfusoLocal) : renderMultiInput(currentTab, r.code, 'sfuso', 1)}</td>
      
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

  recalcKPIs();
}

function renderCandyView() {
  const cfg = getActiveCinemaCandyConfig();
  $("count").textContent = `Gestione Caramelle (${cinemaName})`;
  
  $("thead").innerHTML = `
    <tr>
      <th style="background: #212529; color: white; padding: 12px;">🍬 Magazzino Caramelle Dedicato — ${esc(cinemaName)}</th>
    </tr>
  `;

  let html = `<tr><td style="padding: 20px; background: #f8f9fa;">
    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 20px;">
      <h3>Parametri Griglia</h3>
      <div style="display: flex; gap: 20px; margin-top: 10px; align-items: center;">
        <div>Colonne: <input type="number" id="candyCols" value="${cfg.columns}" style="width: 70px; padding: 5px;" onchange="updateCandyDim()"></div>
        <div>Righe: <input type="number" id="candyRows" value="${cfg.rows}" style="width: 70px; padding: 5px;" onchange="updateCandyDim()"></div>
        <div style="margin-left: auto; font-size: 1.2rem; font-weight: bold; color: #0d47a1;">Totale Caramelle: ${fmt(getCandyTotalKg())} Kg</div>
      </div>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); overflow-x: auto;">
      <h4>Inserimento Pesi Lordi & Tare per Riga</h4>
      <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
        <thead>
          <tr style="background: #343a40; color: white;">
            <th style="padding: 8px;">Riga / Tara (Kg)</th>`;
  for(let c=0; c<cfg.columns; c++) {
    html += `<th style="padding: 8px; text-align:center;">Col ${c+1}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for(let r=0; r<cfg.rows; r++) {
    let taraVal = cfg.taraBins[r] ?? 0;
    html += `<tr>
      <td style="background: #e9ecef; font-weight: bold; padding: 8px;">
        Riga ${r+1} <br>
        <small>Tara: <input type="number" step="any" value="${taraVal}" style="width:60px;" onchange="updateTara(${r}, this.value)"></small>
      </td>`;
    for(let c=0; c<cfg.columns; c++) {
      let val = cfg.gridValues[r]?.[c] || "";
      html += `<td style="border: 1px solid #dee2e6; padding: 4px; text-align: center;">
        <input type="number" step="any" class="qty-input" value="${val}" style="width: 55px;" onchange="updateCandyCell(${r}, ${c}, this.value)">
      </td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table></div>`;

  // Sezione buste sciolte
  html += `<div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-top: 20px;">
    <h4>Buste / Sacchetti Sciolti</h4>
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; margin-top: 10px;">`;
  
  for(let i=0; i<10; i++) {
    let b = cfg.buste[i] || {kg: 0, sleeve: 0};
    html += `<div style="background: #f1f3f5; padding: 10px; border-radius: 6px;">
      <strong>Elemento ${i+1}</strong><br>
      Kg: <input type="number" step="any" value="${b.kg || ''}" style="width:70px;" onchange="updateCandyBuste(${i}, 'kg', this.value)"><br>
      Sleeve: <input type="number" step="any" value="${b.sleeve || ''}" style="width:70px; margin-top:4px;" onchange="updateCandyBuste(${i}, 'sleeve', this.value)">
    </div>`;
  }
  html += `</div></div></td></tr>`;

  $("tbody").innerHTML = html;
}

function updateCandyDim() {
  const cfg = getActiveCinemaCandyConfig();
  cfg.columns = parseInt($("candyCols").value) || 22;
  cfg.rows = parseInt($("candyRows").value) || 4;
  saveCandyConfig();
  renderCandyView();
}

function updateTara(r, val) {
  const cfg = getActiveCinemaCandyConfig();
  if(!cfg.taraBins) cfg.taraBins = [];
  cfg.taraBins[r] = n(val);
  saveCandyConfig();
}

function updateCandyCell(r, c, val) {
  const cfg = getActiveCinemaCandyConfig();
  if(!cfg.gridValues[r]) cfg.gridValues[r] = {};
  cfg.gridValues[r][c] = n(val);
  saveCandyConfig();
}

function updateCandyBuste(idx, field, val) {
  const cfg = getActiveCinemaCandyConfig();
  if(!cfg.buste) cfg.buste = Array(10).fill({kg: 0, sleeve: 0});
  if(!cfg.buste[idx]) cfg.buste[idx] = {kg: 0, sleeve: 0};
  cfg.buste[idx][field] = n(val);
  saveCandyConfig();
}

function renderMultiInput(whIdx, code, type, sizeVal) {
  const c = getCount(whIdx, code);
  const arr = c[type];
  
  let isDisabled = false;
  if (type === 'box' || type === 'sleeve') {
    isDisabled = !(sizeVal && sizeVal > 0);
  }

  const disabledAttr = isDisabled ? 'disabled style="background-color: #e9ecef !important; color: #adb5bd !important; cursor: not-allowed;"' : '';

  let html = `<div class="input-scroll-cell" id="container-${code}-${type}">`;
  arr.forEach((val, idx) => {
    html += `<input type="number" step="any" min="0" class="qty-input" value="${val ? val : ''}" ${disabledAttr} oninput="handleInput(${whIdx}, '${code}', '${type}', ${idx}, this.value)">`;
  });

  if (!isDisabled && arr.length < MAX_FIELDS) {
    html += `<button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 0.8rem;" onclick="addInputField(${whIdx}, '${code}', '${type}')">＋</button>`;
  }
  html += `</div>`;
  return html;
}

function handleInput(whIdx, code, type, index, val) {
  const c = getCount(whIdx, code);
  c[type][index] = n(val);
  saveCountsToStorage();

  const r = rows.find(x => x.code === code);
  if (r) {
    const newEff = getGlobalRilevato(code, r);
    const newDiff = newEff - r.atteso;
    const newDiffVal = newDiff * (r.standardCost || 0);

    const effEl = $(`eff-${code}`);
    if (effEl) effEl.textContent = fmt(newEff);

    const diffEl = $(`diff-${code}`);
    if (diffEl) {
      diffEl.textContent = fmt(newDiff);
      diffEl.className = `num cell-diff ${newDiff === 0 ? 'ok' : 'bad'}`;
    }

    const valEl = $(`val-${code}`);
    if (valEl) {
      valEl.textContent = `€ ${fmtMoney(newDiffVal)}`;
      valEl.className = `num grp-valore cell-val ${newDiffVal >= 0 ? 'ok' : 'bad'}`;
    }
  }

  recalcKPIs();
}

function addInputField(whIdx, code, type) {
  const c = getCount(whIdx, code);
  if (c[type].length < MAX_FIELDS) {
    c[type].push(0);
    saveCountsToStorage();
    render();
  }
}

function recalcKPIs() {
  let totAtteso = 0;
  let totRilevato = 0;
  let totDiffValore = 0;

  rows.forEach(r => {
    totAtteso += r.atteso;
    const eff = getGlobalRilevato(r.code, r);
    totRilevato += eff;
    totDiffValore += (eff - r.atteso) * (r.standardCost || 0);
  });

  const diffPezzi = totRilevato - totAtteso;

  $("kpiAtteso").textContent = fmt(totAtteso);
  $("kpiRilevato").textContent = fmt(totRilevato);
  $("kpiDiffPezzi").textContent = fmt(diffPezzi);
  $("kpiDiffValore").textContent = `€ ${fmtMoney(totDiffValore)}`;

  const diffBox = $("kpiDiffBox");
  if (diffBox) {
    diffBox.className = `kpi-card ${diffPezzi === 0 ? 'success' : 'warning'}`;
  }
  const valBox = $("kpiValoreBox");
  if (valBox) {
    valBox.className = `kpi-card ${totDiffValore >= 0 ? 'success' : 'warning'}`;
  }
}

/* ---------------- EXPORT EXCEL ---------------- */
function exportToExcel() {
  if (!rows.length) { alert("Nessun dato da esportare."); return; }

  const exportData = [];
  exportData.push([
    "CODICE", "PRODOTTO", "U.M.", "INIZIALE", "DANNI", "VENDUTO", "ATTESO", 
    "RILEVATO GLOBALE", "DIFFERENZA PEZZI", "COSTO UNIT.", "DIFFERENZA VALORE"
  ]);

  rows.forEach(r => {
    const rilevato = getGlobalRilevato(r.code, r);
    const diff = rilevato - r.atteso;
    const diffVal = diff * (r.standardCost || 0);

    exportData.push([
      r.code,
      r.name,
      r.uom,
      r.iniziale,
      r.danni,
      r.venduto,
      r.atteso,
      rilevato,
      diff,
      r.standardCost || 0,
      diffVal
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario Totale");
  
  const safeName = cinemaName.replace(/[^a-zA-Z0-9]/g, "_");
  XLSX.writeFile(wb, `Inventario_${safeName}.xlsx`);
}
