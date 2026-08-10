let mag = [], size = [], rows = [];
let cinemaName = "TSC Beinasco";
let warehouses = ["Bar Principale", "Deposito Centrale", "Stand Popcorn", "Magazzino Caramelle"]; 
let currentTab = 0; 
let countsData = {}; 
let caramelleData = {}; // Memorizza i dati specifici della griglia caramelle per magazzino/sede

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
  loadCaramelleFromStorage();
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

function loadCaramelleFromStorage() {
  const savedCaramelle = localStorage.getItem("caramelle_grid_data");
  if (savedCaramelle) {
    try { caramelleData = JSON.parse(savedCaramelle); } catch(e){}
  }
}

function saveCaramelleToStorage() {
  localStorage.setItem("caramelle_grid_data", JSON.stringify(caramelleData));
}

function resetCounts() {
  if (confirm("Sei sicuro di voler azzerare tutti i conteggi inseriti per tutti i magazzini?")) {
    countsData = {};
    caramelleData = {};
    saveCountsToStorage();
    saveCaramelleToStorage();
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
    const isCaramelleWh = norm(w).includes("CARAMELLE");
    btn.textContent = isCaramelleWh ? `🍬 ${w}` : `📍 ${w}`;
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

  if (typeof currentTab === 'string') currentTab = 0;

  renderTabs();
  render();
}

/* ---------------- DATA CALCULATIONS ---------------- */
function getCount(whIdx, code) {
  // Se è il magazzino caramelle ed il prodotto è "Caramelle Aermont" (o simile in kg)
  const whName = warehouses[whIdx] || "";
  if (norm(whName).includes("CARAMELLE")) {
    const r = rows.find(x => x.code === code);
    if (r && (norm(r.name).includes("CARAMELLE AERMONT") || r.uom === "KG")) {
      const totalKg = getCaramelleTotalKg(whIdx);
      return { box: [0], sleeve: [0], sfuso: [totalKg] };
    }
  }

  if (!countsData[whIdx]) countsData[whIdx] = {};
  if (!countsData[whIdx][code]) countsData[whIdx][code] = { box: [0], sleeve: [0], sfuso: [0] };
  
  const c = countsData[whIdx][code];
  if (!Array.isArray(c.box)) c.box = [n(c.box)];
  if (!Array.isArray(c.sleeve)) c.sleeve = [n(c.sleeve)];
  if (!Array.isArray(c.sfuso)) c.sfuso = [n(c.sfuso)];
  
  return c;
}

function sumArr(arr) { return arr.reduce((a, b) => a + n(b), 0); }

function getCaramelleTotalKg(whIdx) {
  const key = `${cinemaName}_${whIdx}`;
  const data = caramelleData[key];
  if (!data) return 0;

  let totalNetto = 0;
  // Calcolo griglia sfusi (Lordo - Tara)
  if (data.grid && Array.isArray(data.grid)) {
    data.grid.forEach(row => {
      if (row && Array.isArray(row)) {
        row.forEach(cell => {
          const lordo = n(cell);
          if (lordo > 0) {
            const tareVal = n(data.tare || 0.37);
            const netto = Math.max(0, lordo - tareVal);
            totalNetto += netto;
          }
        });
      }
    });
  }

  // Calcolo caramelle in busta
  if (data.buste && Array.isArray(data.buste)) {
    data.buste.forEach(b => {
      totalNetto += n(b);
    });
  }

  return totalNetto;
}

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
  return basePezzi + getKitContributionDetail(r.name, r.code);
}

/* ---------------- TABLE RENDER & CARAMELLE VIEW ---------------- */
function render() {
  if (currentTab === 'setup') return;

  const isTotTab = (currentTab === 'tot');
  const whName = isTotTab ? "" : (warehouses[currentTab] || "");
  const isCaramelleTab = !isTotTab && norm(whName).includes("CARAMELLE");

  if (isCaramelleTab) {
    renderCaramelleView(currentTab);
    return;
  }

  // Vista standard tabella inventario
  const q = norm($("search").value);
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  $("count").textContent = `${data.length} prodotti`;

  // Ripristina la struttura HTML della tabella se era stata sovrascritta dalla vista caramelle
  const tableContainer = $("tableContainerWrapper") || $("tabContent");
  if (!document.getElementById("thead")) {
    tableContainer.innerHTML = `
      <div class="table-responsive">
        <table class="inventory-table">
          <thead id="thead"></thead>
          <tbody id="tbody"></tbody>
        </table>
      </div>
    `;
  }

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

/* ---------------- GESTIONE MAGAZZINO CARAMELLE (GRIGLIA DINAMICA & TARE) ---------------- */
function renderCaramelleView(whIdx) {
  const whName = warehouses[whIdx];
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key]) {
    caramelleData[key] = {
      rowsCount: 4,
      colsCount: 4,
      tare: 0.37,
      grid: Array(4).fill().map(() => Array(4).fill(0)),
      buste: [0]
    };
  }
  const data = caramelleData[key];

  $("count").textContent = `Magazzino Caramelle (${whName})`;

  const totalKg = getCaramelleTotalKg(whIdx);

  let html = `
    <div class="caramelle-wrapper" style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px;">
      <h3 style="margin-top: 0; color: #333; display: flex; align-items: center; gap: 10px;">
        🍬 Gestione Avanzata Pesi Caramelle — ${esc(whName)}
      </h3>
      <p style="color: #666; font-size: 14px;">Inserisci i pesi lordi dei contenitori sfusi. Il sistema sottrarrà automaticamente la tara selezionata e sommerà le caramelle in busta per determinare il totale in kg da sincronizzare con l'inventario.</p>
      
      <div style="display: flex; flex-wrap: wrap; gap: 20px; align-items: center; background: #f8f9fa; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
        <div>
          <label style="display: block; font-weight: bold; font-size: 13px; margin-bottom: 5px;">Tara Contenitori:</label>
          <select id="caramelleTareSelect" onchange="updateCaramelleTare(event, ${whIdx})" style="padding: 6px 10px; border-radius: 4px; border: 1px solid #ccc;">
            <option value="0.37" ${data.tare == 0.37 ? 'selected' : ''}>0.37 kg (Standard)</option>
            <option value="0.72" ${data.tare == 0.72 ? 'selected' : ''}>0.72 kg (Grande)</option>
            <option value="custom" ${data.tare !== 0.37 && data.tare !== 0.72 ? 'selected' : ''}>Personalizzata</option>
          </select>
          <input type="number" step="0.01" id="caramelleCustomTareInput" value="${data.tare}" onchange="updateCaramelleCustomTare(${whIdx}, this)" style="width: 80px; padding: 6px; margin-left: 8px; border-radius: 4px; border: 1px solid #ccc; display: ${data.tare !== 0.37 && data.tare !== 0.72 ? 'inline-block' : 'none'};">
        </div>

        <div>
          <label style="display: block; font-weight: bold; font-size: 13px; margin-bottom: 5px;">Righe Griglia:</label>
          <input type="number" min="1" max="20" value="${data.rowsCount}" onchange="updateCaramelleGridSize(${whIdx}, this.value, ${data.colsCount})" style="width: 70px; padding: 6px; border-radius: 4px; border: 1px solid #ccc;">
        </div>

        <div>
          <label style="display: block; font-weight: bold; font-size: 13px; margin-bottom: 5px;">Colonne Griglia:</label>
          <input type="number" min="1" max="10" value="${data.colsCount}" onchange="updateCaramelleGridSize(${whIdx}, ${data.rowsCount}, this.value)" style="width: 70px; padding: 6px; border-radius: 4px; border: 1px solid #ccc;">
        </div>

        <div style="margin-left: auto; background: #e3f2fd; padding: 10px 15px; border-radius: 6px; border: 1px solid #90caf9;">
          <span style="font-size: 13px; color: #0d47a1; font-weight: bold;">TOTALE CALCOLATO CARAMELLE:</span>
          <div style="font-size: 20px; color: #0d47a1; font-weight: bold; text-align: right;">${fmt(totalKg)} kg</div>
        </div>
      </div>

      <h4 style="margin-bottom: 10px; color: #444;">1. Pesi Lordi Contenitori Sfusi (kg)</h4>
      <div style="overflow-x: auto; margin-bottom: 25px;">
        <table style="border-collapse: collapse; width: 100%;">
  `;

  // Costruzione griglia dinamica
  for (let r = 0; r < data.rowsCount; r++) {
    html += `<tr>`;
    for (let c = 0; c < data.colsCount; c++) {
      if (!data.grid[r]) data.grid[r] = [];
      const val = data.grid[r][c] || "";
      html += `
        <td style="padding: 4px; border: 1px solid #dee2e6; text-align: center; background: #fff;">
          <div style="font-size: 10px; color: #888; margin-bottom: 2px;">R${r+1} C${c+1}</div>
          <input type="number" step="any" min="0" value="${val}" 
                 oninput="updateCaramelleCell(${whIdx}, ${r}, ${c}, this.value)"
                 style="width: 80px; padding: 6px; text-align: center; border: 1px solid #ccc; border-radius: 4px;">
        </td>
      `;
    }
    html += `</tr>`;
  }

  html += `
        </table>
      </div>

      <h4 style="margin-bottom: 10px; color: #444;">2. Caramelle in Busta (Pesi netti o quantità in kg)</h4>
      <div id="caramelleBusteContainer" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;">
  `;

  if (!data.buste || !Array.isArray(data.buste)) data.buste = [0];
  data.buste.forEach((bVal, bIdx) => {
    html += `
      <div style="display: flex; align-items: center; gap: 5px; background: #f1f3f5; padding: 6px 10px; border-radius: 4px;">
        <span style="font-size: 12px; font-weight: bold; color: #555;">Busta ${bIdx + 1}:</span>
        <input type="number" step="any" min="0" value="${bVal || ''}" 
               oninput="updateCaramelleBusta(${whIdx}, ${bIdx}, this.value)"
               style="width: 80px; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
        <button onclick="removeCaramelleBusta(${whIdx}, ${bIdx})" style="background: #d32f2f; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">×</button>
      </div>
    `;
  });

  if (data.buste.length < 20 && data.buste[data.buste.length - 1] > 0) {
    data.buste.push(0);
  }

  html += `
      </div>
      <button onclick="addCaramelleBusta(${whIdx})" style="background: #1976d2; color: white; border: none; padding: 8px 14px; border-radius: 4px; cursor: pointer; font-size: 13px;">➕ Aggiungi Busta</button>
    </div>
  `;

  // Inietta nel contenitore principale
  const container = $("tableContainerWrapper") || $("tabContent");
  container.innerHTML = html;

  recalcKPIs();
}

function updateCaramelleTare(e, whIdx) {
  const key = `${cinemaName}_${whIdx}`;
  const selVal = e.target.value;
  const customInput = $("caramelleCustomTareInput");

  if (selVal === "custom") {
    customInput.style.display = "inline-block";
  } else {
    customInput.style.display = "none";
    caramelleData[key].tare = parseFloat(selVal);
    saveCaramelleToStorage();
    renderCaramelleView(whIdx);
  }
}

function updateCaramelleCustomTare(whIdx, inputEl) {
  const key = `${cinemaName}_${whIdx}`;
  caramelleData[key].tare = n(inputEl.value);
  saveCaramelleToStorage();
  renderCaramelleView(whIdx);
}

function updateCaramelleGridSize(whIdx, rowsCount, colsCount) {
  const key = `${cinemaName}_${whIdx}`;
  const rNum = parseInt(rowsCount, 10) || 1;
  const cNum = parseInt(colsCount, 10) || 1;

  caramelleData[key].rowsCount = rNum;
  caramelleData[key].colsCount = cNum;

  // Ridimensiona o preserva la matrice esistente
  const oldGrid = caramelleData[key].grid || [];
  const newGrid = [];
  for (let r = 0; r < rNum; r++) {
    newGrid[r] = [];
    for (let c = 0; c < cNum; c++) {
      newGrid[r][c] = (oldGrid[r] && oldGrid[r][c] !== undefined) ? oldGrid[r][c] : 0;
    }
  }
  caramelleData[key].grid = newGrid;
  saveCaramelleToStorage();
  renderCaramelleView(whIdx);
}

function updateCaramelleCell(whIdx, r, c, val) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key].grid[r]) caramelleData[key].grid[r] = [];
  caramelleData[key].grid[r][c] = n(val);
  saveCaramelleToStorage();
  
  // Aggiorna KPI in tempo reale senza perdere il focus
  recalcKPIs();
}

function updateCaramelleBusta(whIdx, bIdx, val) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key].buste) caramelleData[key].buste = [];
  caramelleData[key].buste[bIdx] = n(val);

  // Aggiunge automaticamente un nuovo input se l'ultimo è valorizzato
  if (bIdx === caramelleData[key].buste.length - 1 && n(val) > 0 && caramelleData[key].buste.length < 20) {
    caramelleData[key].buste.push(0);
    renderCaramelleView(whIdx);
    return;
  }
  saveCaramelleToStorage();
  recalcKPIs();
}

function addCaramelleBusta(whIdx) {
  const key = `${cinemaName}_${whIdx}`;
  if (!caramelleData[key].buste) caramelleData[key].buste = [];
  caramelleData[key].buste.push(0);
  saveCaramelleToStorage();
  renderCaramelleView(whIdx);
}

function removeCaramelleBusta(whIdx, bIdx) {
  const key = `${cinemaName}_${whIdx}`;
  if (caramelleData[key].buste) {
    caramelleData[key].buste.splice(bIdx, 1);
    if (caramelleData[key].buste.length === 0) caramelleData[key].buste.push(0);
    saveCaramelleToStorage();
    renderCaramelleView(whIdx);
  }
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
    html += `<input class="qty-input" type="number" step="any" min="0" value="${val || ''}" ${disabledAttr}
             onkeyup="updateCountValue(${whIdx}, '${esc(code)}', '${type}', ${idx}, this)"
             onchange="updateCountValue(${whIdx}, '${esc(code)}', '${type}', ${idx}, this)">`;
  });

  if (!isDisabled && arr.length < MAX_FIELDS && arr[arr.length - 1] > 0) {
    html += `<input class="qty-input" type="number" step="any" min="0" value="" placeholder="+" 
             onkeyup="updateCountValue(${whIdx}, '${esc(code)}', '${type}', ${arr.length}, this)"
             onchange="updateCountValue(${whIdx}, '${esc(code)}', '${type}', ${arr.length}, this)">`;
  }

  html += `</div>`;
  return html;
}

function updateCountValue(whIdx, code, type, idx, inputEl) {
  const c = getCount(whIdx, code);
  const val = inputEl.value;
  c[type][idx] = n(val);

  const r = rows.find(x => x.code === code);
  if (!r) return;

  const container = $(`container-${code}-${type}`);
  if (container && idx === c[type].length - 1 && n(val) > 0 && c[type].length < MAX_FIELDS) {
    const newInput = document.createElement("input");
    newInput.className = "qty-input";
    newInput.type = "number";
    newInput.step = "any";
    newInput.min = "0";
    newInput.value = "";
    newInput.placeholder = "+";
    newInput.onkeyup = function() { updateCountValue(whIdx, code, type, c[type].length, this); };
    newInput.onchange = function() { updateCountValue(whIdx, code, type, c[type].length, this); };
    container.appendChild(newInput);
  }

  const effettivoGlobale = getGlobalRilevato(code, r);
  const diffTotale = effettivoGlobale - r.atteso;
  const diffValore = diffTotale * (r.standardCost || 0);

  const effEl = $(`eff-${code}`);
  const diffEl = $(`diff-${code}`);
  const valEl = $(`val-${code}`);

  if (effEl) effEl.textContent = fmt(effettivoGlobale);
  if (diffEl) {
    diffEl.textContent = fmt(diffTotale);
    diffEl.className = `num cell-diff ${diffTotale === 0 ? 'ok' : 'bad'}`;
  }
  if (valEl) {
    valEl.textContent = "€ " + fmtMoney(diffValore);
    valEl.className = `num grp-valore cell-val ${diffValore >= 0 ? 'ok' : 'bad'}`;
  }

  saveCountsToStorage();
  recalcKPIs();
}

function recalcKPIs() {
  let totalAttesoPezzi = 0;
  let totalRilevatoPezzi = 0;
  let totalDiffPezzi = 0;
  let totalDiffValore = 0;

  rows.forEach(r => {
    const eff = getGlobalRilevato(r.code, r);
    const diff = eff - r.atteso;
    const val = diff * (r.standardCost || 0);

    totalAttesoPezzi += r.atteso;
    totalRilevatoPezzi += eff;
    totalDiffPezzi += diff;
    totalDiffValore += val;
  });

  $("kpiAtteso").textContent = fmt(totalAttesoPezzi);
  $("kpiRilevato").textContent = fmt(totalRilevatoPezzi);
  $("kpiDiffPezzi").textContent = fmt(totalDiffPezzi);
  $("kpiDiffValore").textContent = "€ " + fmtMoney(totalDiffValore);

  $("kpiDiffBox").className = "kpi-card " + (totalDiffPezzi === 0 ? "success" : "warning");
  $("kpiValoreBox").className = "kpi-card " + (totalDiffValore >= 0 ? "success" : "warning");
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
    ["Prodotto", "U.M.", "Iniziale", "Danni", "Venduto", "Atteso Totale", "Effettivo Totale", "Differenza Pezzi", "Costo Standard", "Differenza Valore (€)"]
  ];

  rows.forEach(r => {
    const effettivoTot = getGlobalRilevato(r.code, r);
    const diffTot = effettivoTot - r.atteso;
    const diffVal = diffTot * (r.standardCost || 0);

    totData.push([
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
    const isCaramelleWh = norm(whName).includes("CARAMELLE");
    const whData = [
      [`MAGAZZINO: ${whName.toUpperCase()} — SEDE: ${cinemaName.toUpperCase()}`],
      isCaramelleWh 
        ? ["Prodotto", "U.M.", "Totale Rilevato (kg)"] 
        : ["Prodotto", "U.M.", "Box Size", "Q.tà Box (Tot)", "Sleeve Size", "Q.tà Sleeve (Tot)", "Q.tà Sfuso (Tot)", "Totale Rilevato (Pezzi)"]
    ];

    rows.forEach(r => {
      const c = getCount(idx, r.code);
      if (isCaramelleWh) {
        const sfSum = sumArr(c.sfuso);
        if (sfSum > 0 || norm(r.name).includes("CARAMELLE") || r.uom === "KG") {
          whData.push([r.name, r.uom, sfSum]);
        }
      } else {
        const bSum = sumArr(c.box);
        const sSum = sumArr(c.sleeve);
        const sfSum = sumArr(c.sfuso);
        const effettivoWh = (bSum * r.boxSize) + (sSum * r.sleeveSize) + sfSum;

        whData.push([
          r.name,
          r.uom,
          r.boxSize || 0,
          bSum,
          r.sleeveSize || 0,
          sSum,
          sfSum,
          effettivoWh
        ]);
      }
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
