let mag = [], size = [], rows = [];
let warehouses = ["Magazzino 1", "Bar Principale", "Deposito"]; // Lista magazzini predefinita
let currentTab = 0; // 0..N-1 = Magazzini, N = Totale Rilevato, 'setup' = Setup

// Struttura dati per memorizzare i conteggi di ciascun magazzino
// { [whIndex]: { [prodCode]: { box: 0, sleeve: 0, sfuso: 0 } } }
let countsData = {}; 

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  loadSetupFromStorage();

  $("magFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    $("magStatus").textContent = "Lettura del report in corso...";
    readMatrix(f).then(m => {
      mag = parseMag(m);
      $("magStatus").textContent = `${f.name} — ${mag.length} prodotti letti`;
      build();
    }).catch(err => {
      showError("Errore file Magazzino: " + err.message);
    });
  });

  $("sizeFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    $("sizeStatus").textContent = "Lettura anagrafica in corso...";
    readMatrix(f, "SIZE").then(m => {
      size = parseSize(m);
      $("sizeStatus").textContent = `${f.name} — ${size.length} prodotti letti`;
      build();
    }).catch(err => {
      showError("Errore file SIZE: " + err.message);
    });
  });

  $("search").addEventListener("input", render);
});

function toggleFilesSection() {
  const sec = $("filesSection");
  sec.style.display = sec.style.display === "none" ? "grid" : "none";
}

/* ---------------- SETUP & STORAGE ---------------- */
function loadSetupFromStorage() {
  const saved = localStorage.getItem("cinema_warehouses");
  if (saved) {
    try { warehouses = JSON.parse(saved); } catch(e){}
  }
}

function saveWarehousesSetup() {
  const inputs = document.querySelectorAll(".wh-input");
  const newWh = [];
  inputs.forEach(inp => {
    const val = inp.value.trim();
    if (val) newWh.push(val);
  });
  if (newWh.length === 0) {
    alert("Inserisci almeno un magazzino!");
    return;
  }
  warehouses = newWh;
  localStorage.setItem("cinema_warehouses", JSON.stringify(warehouses));
  currentTab = 0;
  renderTabs();
  render();
}

function renderSetupView() {
  $("tabContent").style.display = "none";
  $("setupView").style.display = "block";
  const container = $("whList");
  container.innerHTML = "";
  warehouses.forEach((w, idx) => {
    const div = document.createElement("div");
    div.className = "wh-item";
    div.innerHTML = `
      <input class="wh-input" value="${esc(w)}" placeholder="Nome Magazzino">
      <button class="btn btn-danger" onclick="this.parentElement.remove()">Elimina</button>
    `;
    container.appendChild(div);
  });
}

function addWarehouseInput() {
  const container = $("whList");
  const div = document.createElement("div");
  div.className = "wh-item";
  div.innerHTML = `
    <input class="wh-input" value="Magazzino ${container.children.length + 1}" placeholder="Nome Magazzino">
    <button class="btn btn-danger" onclick="this.parentElement.remove()">Elimina</button>
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

  // Tab Totale Consolidato
  const totBtn = document.createElement("button");
  totBtn.className = `tab-btn ${currentTab === 'tot' ? 'active' : ''}`;
  totBtn.textContent = `📊 RIEPILOGO TOTALE`;
  totBtn.onclick = () => { currentTab = 'tot'; switchTab(); };
  bar.appendChild(totBtn);

  // Tab Setup
  const setupBtn = document.createElement("button");
  setupBtn.className = `tab-btn setup-btn ${currentTab === 'setup' ? 'active' : ''}`;
  setupBtn.textContent = `⚙️ Setup Magazzini`;
  setupBtn.onclick = () => { currentTab = 'setup'; switchTab(); };
  bar.appendChild(setupBtn);
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
        let sheetName = wb.SheetNames[0];
        if (preferredSheetName) {
          const found = wb.SheetNames.find(s => norm(s).includes(norm(preferredSheetName)));
          if (found) sheetName = found;
        }
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: true }));
      } catch (x) { reject(x); }
    };
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

function parseMag(m) {
  let header = -1;
  for (let i = 0; i < m.length; i++) {
    if (m[i] && m[i].some(v => norm(v) === "OPENING BALANCE")) { header = i; break; }
  }
  if (header < 0) throw new Error("Intestazione 'Opening Balance' non trovata.");
  
  const out = [];
  for (let i = header + 1; i < m.length; i++) {
    const r = m[i];
    if (!r) continue;
    const code = text(r[1]), uom = text(r[2]);
    if (!code || !uom) continue;
    if (i + 1 >= m.length || !m[i + 1]) continue;
    const name = text(m[i + 1][1]);
    if (!name) continue;
    
    const iniziale = n(r[5]), ricevuti = n(r[8]), trasferimenti = n(r[10]), rettifiche = n(r[12]);
    const danni = n(r[14]), venduto = n(r[18]), uso = n(r[21]);
    const atteso = iniziale + ricevuti + trasferimenti + rettifiche - danni - venduto - uso;
    
    out.push({ code, name, uom, iniziale, danni, venduto, atteso });
  }
  return out;
}

function parseSize(m) {
  let h = -1;
  for (let i = 0; i < m.length; i++) {
    if (m[i] && m[i].some(v => norm(v) === "PRODOTTO")) { h = i; break; }
  }
  if (h < 0) throw new Error("Intestazione 'PRODOTTO' non trovata nel file SIZE.");

  const head = m[h];
  let pCol = head.findIndex(v => norm(v) === "PRODOTTO");
  let boxCol = head.findIndex(v => norm(v) === "BOX");
  let sleeveCol = head.findIndex(v => norm(v) === "SLEEVE");

  if (pCol < 0) pCol = 0;      
  if (boxCol < 0) boxCol = 1;  
  if (sleeveCol < 0) sleeveCol = 2; 

  const out = [];
  for (let i = h + 1; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;
    const name = text(r[pCol]);
    if (!name || name === "#N/D" || norm(name) === "PRODOTTO") continue;

    out.push({ name, boxSize: n(r[boxCol]), sleeveSize: n(r[sleeveCol]) });
  }
  return out;
}

function build() {
  if (!mag.length || !size.length) {
    $("mainStatus").innerHTML = `Magazzino: <b>${mag.length}</b> · SIZE: <b>${size.length}</b><br>Carica entrambi i file.`;
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

  // Nasconde automaticamente il pannello file quando i dati sono pronti
  $("filesSection").style.display = "none";
  $("mainStatus").style.display = "none";

  renderTabs();
  render();
}

/* ---------------- TABLE RENDER ---------------- */
function getCount(whIdx, code) {
  if (!countsData[whIdx]) countsData[whIdx] = {};
  if (!countsData[whIdx][code]) countsData[whIdx][code] = { box: 0, sleeve: 0, sfuso: 0 };
  return countsData[whIdx][code];
}

function render() {
  if (currentTab === 'setup') return;

  const q = norm($("search").value);
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  $("count").textContent = `${data.length} prodotti`;

  const isTotTab = currentTab === 'tot';

  // Costruzione Intestazione
  $("thead").innerHTML = `
    <tr>
      <th colspan="3">PRODOTTO</th>
      <th colspan="3">REPORT MAGAZZINO</th>
      <th colspan="2" class="grp-box">BOX</th>
      <th colspan="2" class="grp-sleeve">SLEEVE</th>
      <th class="grp-sfuso">SFUSO</th>
      <th colspan="3">${isTotTab ? 'CONFRONTO GLOBALE' : 'TOTALE ' + warehouses[currentTab].toUpperCase()}</th>
    </tr>
    <tr>
      <th>Codice</th><th>Prodotto</th><th>U.M.</th>
      <th class="num">Iniziale</th><th class="num">Danni</th><th class="num">Venduto</th>
      <th class="num grp-box">Size</th><th class="num grp-box">Q.tà Box</th>
      <th class="num grp-sleeve">Size</th><th class="num grp-sleeve">Q.tà Sleeve</th>
      <th class="num grp-sfuso">Q.tà Sfuso</th>
      <th class="num">Atteso</th><th class="num">Effettivo</th><th class="num">Diff.</th>
    </tr>
  `;

  $("tbody").innerHTML = "";

  data.forEach(r => {
    const tr = document.createElement("tr");

    let boxQty = 0, sleeveQty = 0, sfusoQty = 0;

    if (isTotTab) {
      // Somma i valori di tutti i magazzini per la vista Riepilogo
      warehouses.forEach((_, idx) => {
        const c = getCount(idx, r.code);
        boxQty += c.box;
        sleeveQty += c.sleeve;
        sfusoQty += c.sfuso;
      });
    } else {
      const c = getCount(currentTab, r.code);
      boxQty = c.box;
      sleeveQty = c.sleeve;
      sfusoQty = c.sfuso;
    }

    const effettivo = (boxQty * r.boxSize) + (sleeveQty * r.sleeveSize) + sfusoQty;
    const diff = effettivo - r.atteso;

    tr.innerHTML = `
      <td>${esc(r.code)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.uom)}</td>
      <td class="num">${fmt(r.iniziale)}</td>
      <td class="num">${fmt(r.danni)}</td>
      <td class="num">${fmt(r.venduto)}</td>
      
      <td class="num grp-box">${r.boxSize ? fmt(r.boxSize) : '-'}</td>
      <td class="num grp-box">${isTotTab ? fmt(boxQty) : `<input class="qty-input in-box" type="number" min="0" value="${boxQty || ''}">`}</td>
      
      <td class="num grp-sleeve">${r.sleeveSize ? fmt(r.sleeveSize) : '-'}</td>
      <td class="num grp-sleeve">${isTotTab ? fmt(sleeveQty) : `<input class="qty-input in-sleeve" type="number" min="0" value="${sleeveQty || ''}">`}</td>
      
      <td class="num grp-sfuso">${isTotTab ? fmt(sfusoQty) : `<input class="qty-input in-sfuso" type="number" min="0" value="${sfusoQty || ''}">`}</td>
      
      <td class="num">${fmt(r.atteso)}</td>
      <td class="num cell-eff">${fmt(effettivo)}</td>
      <td class="num cell-diff ${diff === 0 ? 'ok' : 'bad'}">${fmt(diff)}</td>
    `;

    if (!isTotTab) {
      const inBox = tr.querySelector(".in-box");
      const inSleeve = tr.querySelector(".in-sleeve");
      const inSfuso = tr.querySelector(".in-sfuso");
      const cellEff = tr.querySelector(".cell-eff");
      const cellDiff = tr.querySelector(".cell-diff");

      function updateVal() {
        const c = getCount(currentTab, r.code);
        c.box = n(inBox.value);
        c.sleeve = n(inSleeve.value);
        c.sfuso = n(inSfuso.value);

        const tot = (c.box * r.boxSize) + (c.sleeve * r.sleeveSize) + c.sfuso;
        const d = tot - r.atteso;

        cellEff.textContent = fmt(tot);
        cellDiff.textContent = fmt(d);
        cellDiff.className = "num cell-diff " + (d === 0 ? "ok" : "bad");
      }

      inBox.addEventListener("input", updateVal);
      inSleeve.addEventListener("input", updateVal);
      inSfuso.addEventListener("input", updateVal);
    }

    $("tbody").appendChild(tr);
  });
}

function fmt(v) { return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))); }
function esc(v) { return text(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function showError(msg) { $("mainStatus").innerHTML = `<span style="color:#b00020;font-weight:bold">${esc(msg)}</span>`; }
