let magRows = [];
let sizeRows = [];
let mergedRows = [];

const $ = id => document.getElementById(id);

$("magFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  $("magStatus").textContent = "Lettura in corso...";
  readExcel(file, rows => {
    magRows = rows;
    $("magStatus").textContent = `${file.name} — ${rows.length} righe lette`;
    update();
  });
});

$("sizeFile").addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  $("sizeStatus").textContent = "Lettura in corso...";
  readExcel(file, rows => {
    sizeRows = rows;
    $("sizeStatus").textContent = `${file.name} — ${rows.length} righe lette`;
    update();
  });
});

function readExcel(file, callback) {
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const wb = XLSX.read(ev.target.result, {type:"array", cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:"", raw:true});
      callback(rows);
    } catch(err) {
      console.error(err);
      $("stato").textContent = "Errore nella lettura del file Excel.";
    }
  };
  reader.readAsArrayBuffer(file);
}

function norm(v) {
  return String(v ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ").trim().toUpperCase();
}

function keyOf(row) {
  const keys = Object.keys(row);
  const preferred = ["PRODOTTO","PRODOTTI","PRODUCT","DESCRIZIONE","DESCRIPTION","ARTICOLO","ITEM"];
  for (const p of preferred) {
    const k = keys.find(x => norm(x) === p);
    if (k && String(row[k]).trim()) return String(row[k]).trim();
  }
  const k = keys.find(x => /prodott|descriz|articol|product|item/i.test(x) && String(row[x]).trim());
  return k ? String(row[k]).trim() : "";
}

function num(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const k = keys.find(x => norm(x) === norm(name));
    if (k) {
      const v = String(row[k]).replace(",", ".").replace(/[^\d.-]/g,"");
      const n = parseFloat(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
}

function sizeValue(row, names) {
  const keys = Object.keys(row);
  for (const name of names) {
    const k = keys.find(x => norm(x) === norm(name));
    if (k && row[k] !== "") return row[k];
  }
  return "";
}

function update() {
  if (!magRows.length || !sizeRows.length) {
    $("stato").innerHTML = `Magazzino: <b>${magRows.length}</b> righe · SIZE: <b>${sizeRows.length}</b> righe`;
    return;
  }

  const sizeMap = new Map();
  sizeRows.forEach(r => {
    const p = keyOf(r);
    if (p) sizeMap.set(norm(p), r);
  });

  mergedRows = magRows.map((r, index) => {
    const name = keyOf(r) || `Riga ${index + 1}`;
    const s = sizeMap.get(norm(name)) || {};

    const iniziale = num(r, ["CONTEGGIO INIZIALE","INIZIALE","GIACENZA INIZIALE","INITIAL STOCK","STOCK INIZIALE"]);
    const danni = num(r, ["DANNI","DANNEGGIATO","DAMAGE"]);
    const venduto = num(r, ["VENDUTO","VENDITE","SOLD","SALES"]);
    const atteso = iniziale - danni - venduto;

    return {
      name,
      iniziale,
      danni,
      venduto,
      box: sizeValue(s, ["BOX"]),
      sleeve: sizeValue(s, ["SLEEVE"]),
      sing: sizeValue(s, ["C.B. SINGOLO P.","SINGOLO P.","SINGOLO"]),
      atteso
    };
  });

  $("stato").innerHTML =
    `Magazzino: <b>${magRows.length}</b> righe · ` +
    `SIZE: <b>${sizeRows.length}</b> righe · ` +
    `Prodotti visualizzati: <b>${mergedRows.length}</b>`;

  render();
}

function render() {
  const q = norm($("search").value);
  const rows = mergedRows.filter(r => norm(r.name).includes(q));
  const tbody = $("body");
  tbody.innerHTML = "";

  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td class="num">${r.iniziale}</td>
      <td class="num">${r.danni}</td>
      <td class="num">${r.venduto}</td>
      <td class="num">${escapeHtml(r.box)}</td>
      <td class="num">${escapeHtml(r.sleeve)}</td>
      <td class="num">${escapeHtml(r.sing)}</td>
      <td class="num">${r.atteso}</td>
      <td class="num"><input class="qty" type="number" step="1" value="${r.atteso}"></td>
      <td class="num diff">0</td>
    `;
    const input = tr.querySelector(".qty");
    const diff = tr.querySelector(".diff");
    input.addEventListener("input", () => {
      const d = (parseFloat(input.value) || 0) - r.atteso;
      diff.textContent = d;
      diff.className = "num diff " + (d === 0 ? "ok" : "bad");
    });
    tbody.appendChild(tr);
  });
}

$("search").addEventListener("input", render);

function escapeHtml(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}