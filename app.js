let mag = [], size = [], rows = [];

// Helper per selezionare elementi dal DOM
const $ = id => document.getElementById(id);

// Inizializzazione degli eventi al caricamento del DOM
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
          throw new Error("Libreria Excel non caricata. Controlla la connessione Internet di GitHub Pages.");
        }
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        if (!wb.SheetNames.length) throw new Error("Nessun foglio trovato.");
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true }));
      } catch (x) {
        reject(x);
      }
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

function findCol(row, name) {
  const target = norm(name);
  return row.findIndex(v => norm(v) === target);
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
  for (let i = 0; i < m.length; i++) {
    if (m[i].some(v => norm(v) === "PRODOTTO")) { h = i; break; }
  }
  if (h < 0) throw new Error("Colonna PRODOTTO non trovata nel file SIZE.");
  
  const head = m[h];
  const p = findCol(head, "PRODOTTO");
  const box = findCol(head, "BOX");
  const sl = findCol(head, "SLEEVE");
  const sg = findCol(head, "C.B. SINGOLO P.");
  
  const out = [];
  for (let i = h + 1; i < m.length; i++) {
    const r = m[i], name = text(r[p]);
    if (!name) continue;
    out.push({ name, box: box >= 0 ? r[box] : "", sleeve: sl >= 0 ? r[sl] : "", sing: sg >= 0 ? r[sg] : "" });
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
    return { ...x, box: s.box ?? "", sleeve: s.sleeve ?? "", sing: s.sing ?? "", matched: !!s.name };
  });
  const matched = rows.filter(x => x.matched).length;
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
    tr.innerHTML = `<td>${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.uom)}</td>
    <td class="num">${fmt(r.iniziale)}</td><td class="num">${fmt(r.danni)}</td><td class="num">${fmt(r.venduto)}</td>
    <td class="num">${esc(r.box)}</td><td class="num">${esc(r.sleeve)}</td><td class="num">${esc(r.sing)}</td>
    <td class="num">${fmt(r.atteso)}</td><td class="num"><input class="qty" type="number" step="any" value="${r.atteso}"></td><td class="num diff ok">0</td>`;
    
    const inp = tr.querySelector("input"), d = tr.querySelector(".diff");
    inp.addEventListener("input", () => {
      const v = n(inp.value), x = v - r.atteso;
      d.textContent = fmt(x);
      d.className = "num diff " + (x === 0 ? "ok" : "bad");
    });
    $("body").appendChild(tr);
  });
}

function fmt(v) { return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3))); }
function esc(v) { return text(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function showError(msg) { $("mainStatus").innerHTML = `<span class="error">${esc(msg)}</span>`; }
