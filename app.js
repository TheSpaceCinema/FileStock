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
    readMatrix(f).then(m => {
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

function readMatrix(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        if (typeof XLSX === "undefined") {
          throw new Error("Libreria Excel non caricata. Controlla la connessione Internet.");
        }
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        if (!wb.SheetNames.length) throw new Error("Nessun foglio trovato.");
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true }));
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

function parseMag(m) {
  let header = -1;
  for (let i = 0; i < m.length; i++) {
    if (m[i].some(v => norm(v) === "OPENING BALANCE")) { header = i; break; }
  }
  if (header < 0) throw new Error("Intestazione 'Opening Balance' non trovata.");
  
  const out = [];
  for (let i = header + 1; i < m.length; i++) {
    const r = m[i];
    const code = text(r[1]), uom = text(r[2]);
    if (!code || !uom) continue;
    if (i + 1 >= m.length) continue;
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
  // Trova la riga d'intestazione "PRODOTTO"
  for (let i = 0; i < m.length; i++) {
    if (m[i].some(v => norm(v) === "PRODOTTO")) { h = i; break; }
  }
  if (h < 0) throw new Error("Intestazione 'PRODOTTO' non trovata nel file SIZE.");

  // Trova la riga con le sotto-intestazioni (Nome, Size, ecc.)
  let subH = h + 1;
  let nameCol = -1, boxCol = -1, sleeveCol = -1;

  // Cerchiamo le colonne basandoci sulle etichette se presenti
  for (let col = 0; col < m[subH].length; col++) {
    const label = norm(m[subH][col]);
    if (label === "NOME" || label === "PRODOTTO") nameCol = col;
  }

  // Se non trova l'etichetta "NOME", usa la prima colonna (0) di default
  if (nameCol < 0) nameCol = 0;

  // Indici fissi basati sulla struttura del file SIZE:
  // Colonna Nome: 0 (o nameCol)
  // Colonna BOX Size: 2
  // Colonna SLEEVE Size: 5
  boxCol = 2;
  sleeveCol = 5;

  const out = [];
  // Partiamo da due righe sotto l'intestazione "PRODOTTO"
  for (let i = h + 2; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;

    const name = text(r[nameCol]);
    if (!name || name === "#N/D") continue;

    const boxVal = n(r[boxCol]);       // Dimensione BOX
    const sleeveVal = n(r[sleeveCol]); // Dimensione SLEEVE

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
    
    // Calcolo iniziale effettivo
    const effettivo = (r.inputBox * r.boxSize) + (r.inputSleeve * r.sleeveSize) + r.inputSfuso;
    const diff = effettivo - r.atteso;

    tr.innerHTML = `
      <td>${esc(r.code)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.uom)}</td>
      <td class="num">${fmt(r.iniziale)}</td>
      <td class="num">${fmt(r.danni)}</td>
      <td class="num">${fmt(r.venduto)}</td>
      
      <!-- BOX -->
      <td class="num grp-box">${r.boxSize ? fmt(r.boxSize) : '-'}</td>
      <td class="num grp-box"><input class="qty-input in-box" type="number" step="any" min="0" value="${r.inputBox || ''}"></td>
      
      <!-- SLEEVE -->
      <td class="num grp-sleeve">${r.sleeveSize ? fmt(r.sleeveSize) : '-'}</td>
      <td class="num grp-sleeve"><input class="qty-input in-sleeve" type="number" step="any" min="0" value="${r.inputSleeve || ''}"></td>
      
      <!-- SFUSO -->
      <td class="num grp-sfuso"><input class="qty-input in-sfuso" type="number" step="any" min="0" value="${r.inputSfuso || ''}"></td>
      
      <!-- TOTALE E DIFFERENZA -->
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
