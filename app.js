let mag = [], size = [], rows = [];

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  $("magFile").addEventListener("change", e => {
    const f = e.target.files[0];
    if (!f) return;
    $("magStatus").textContent = "Lettura del report in corso...";
    readMatrix(f).then(m => {
      mag = parseMag(m);
      $("magStatus").textContent = `${f.name} — ${mag.length} prodotti letti`;
      build();
    }).catch(err => {
      $("magStatus").textContent = "Errore nel caricamento del file";
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
      $("sizeStatus").textContent = "Errore nel caricamento del file";
      showError("Errore file SIZE: " + err.message);
    });
  });

  $("search").addEventListener("input", render);
});

// Lettura dinamica dei fogli Excel con ricerca per nome scheda
function readMatrix(file, preferredSheetName = "") {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        if (typeof XLSX === "undefined") {
          throw new Error("Libreria Excel non caricata. Verifica la connessione a internet.");
        }
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        if (!wb.SheetNames.length) throw new Error("Nessun foglio trovato.");

        let sheetName = wb.SheetNames[0];
        if (preferredSheetName) {
          const found = wb.SheetNames.find(s => norm(s).includes(norm(preferredSheetName)));
          if (found) sheetName = found;
        }

        const sheet = wb.Sheets[sheetName];
        resolve(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }));
      } catch (x) { reject(x); }
    };
    r.onerror = () => reject(new Error("Impossibile leggere il file."));
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

function norm(v) {
  return text(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toUpperCase();
}

// Lettura File Magazzino
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

// Lettura File SIZE basata sulla struttura reale dell'Excel
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

  if (pCol < 0) pCol = 1;      // Colonna B
  if (boxCol < 0) boxCol = 2;  // Colonna C
  if (sleeveCol < 0) sleeveCol = 3; // Colonna D

  const out = [];

  for (let i = h + 1; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;

    const name = text(r[pCol]);
    if (!name || name === "#N/D" || norm(name) === "PRODOTTO") continue;

    const boxVal = n(r[boxCol]);       
    const sleeveVal = n(r[sleeveCol]); 

    out.push({
      name,
      boxSize: boxVal,
      sleeveSize: sleeveVal
    });
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
      sleeveSize: s.sleeveSize || 0,
      inputBox: 0,
      inputSleeve: 0,
      inputSfuso: 0
    };
  });
  const matched = rows.filter(x => x.boxSize || x.sleeveSize).length;
  $("mainStatus").innerHTML = `Magazzino: <b>${mag.length}</b> prodotti · SIZE: <b>${size.length}</b> prodotti · Corrispondenze: <b>${matched}/${rows.length}</b>`;
  render();
}

function render() {
  const q = norm($("search").value);
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  $("count").textContent = `${data.length} prodotti`;
  $("body").innerHTML = "";
  
  data.forEach(r => {
    const tr = document.createElement("tr");
    
    const effettivo = (r.inputBox * r.boxSize) + (r.inputSleeve * r.sleeveSize) + r.inputSfuso;
    const diff = effettivo - r.atteso;

    tr.innerHTML = `
      <td>${esc(r.code)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.uom)}</td>
      <td class="num">${fmt(r.iniziale)}</td>
      <td class="num">${fmt(r.danni)}</td>
      <td class="num">${fmt(r.venduto)}</td>
      
      <td class="num grp-box">${r.boxSize ? fmt(r.boxSize) : '-'}</td>
      <td class="num grp-box"><input class="qty-input in-box" type="number" step="any" min="0" value="${r.inputBox || ''}"></td>
      
      <td class="num grp-sleeve">${r.sleeveSize ? fmt(r.sleeveSize) : '-'}</td>
      <td class="num grp-sleeve"><input class="qty-input in-sleeve" type="number" step="any" min="0" value="${r.inputSleeve || ''}"></td>
      
      <td class="num grp-sfuso"><input class="qty-input in-sfuso" type="number" step="any" min="0" value="${r.inputSfuso || ''}"></td>
      
      <td class="num">${fmt(r.atteso)}</td>
      <td class="num cell-eff">${fmt(effettivo)}</td>
      <td class="num cell-diff ${diff === 0 ? 'ok' : 'bad'}">${fmt(diff)}</td>
    `;
    
    const inBox = tr.querySelector(".in-box");
    const inSleeve = tr.querySelector(".in-sleeve");
    const inSfuso = tr.querySelector(".in-sfuso");
    const cellEff = tr.querySelector(".cell-eff");
    const cellDiff = tr.querySelector(".cell-diff");

    function updateCalculations() {
      r.inputBox = n(inBox.value);
      r.inputSleeve = n(inSleeve.value);
      r.inputSfuso = n(inSfuso.value);

      const tot = (r.inputBox * r.boxSize) + (r.inputSleeve * r.sleeveSize) + r.inputSfuso;
      const d = tot - r.atteso;

      cellEff.textContent = fmt(tot);
      cellDiff.textContent = fmt(d);
      cellDiff.className = "num cell-diff " + (d === 0 ? "ok" : "bad");
    }

    inBox.addEventListener("input", updateCalculations);
    inSleeve.addEventListener("input", updateCalculations);
    inSfuso.addEventListener("input", updateCalculations);

    $("body").appendChild(tr);
  });
}

function fmt(v) { return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))); }
function esc(v) { return text(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function showError(msg) { $("mainStatus").innerHTML = `<span class="error">${esc(msg)}</span>`; }
