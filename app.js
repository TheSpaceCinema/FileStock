/* ==========================================================================
   APP STOCK MAGAZZINO CINEMA - FILE COMPLETO APP.JS
   ========================================================================== */

let mag = [], size = [], rows = [], postMixProducts = [];
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

/* --- CONFIGURAZIONE DINAMICA BLOCCHI CARAMELLE --- */
let candyGridConfigs = JSON.parse(localStorage.getItem("candy_grid_configs")) || {};
function getActiveCinemaCandyConfig() {
  if (!candyGridConfigs[cinemaName]) {
    candyGridConfigs[cinemaName] = {
      blocksCount: 2,
      orientation: "vertical",
      tares: [0.37, 0.72, 0.50, 1.00],
      blocks: [
        { id: "block_0", name: "🍬 Espositore Principale", columns: 22, rows: 2, gridValues: {} },
        { id: "block_1", name: "📦 Scorte / Magazzino", columns: 10, rows: 2, gridValues: {} }
      ],
      buste: Array(10).fill({kg: 0, sleeve: 0})
    };
  }
  let cfg = candyGridConfigs[cinemaName];
  if (cfg.blocksCount === undefined) cfg.blocksCount = cfg.blocks ? cfg.blocks.length : 2;
  if (!cfg.orientation) cfg.orientation = "vertical";
  if (!cfg.tares || !Array.isArray(cfg.tares)) cfg.tares = [0.37, 0.72, 0.50, 1.00];
  if (!cfg.blocks || !Array.isArray(cfg.blocks)) {
    cfg.blocks = [
      { id: "block_0", name: "🍬 Espositore Principale", columns: 22, rows: 2, gridValues: {} },
      { id: "block_1", name: "📦 Scorte / Magazzino", columns: 10, rows: 2, gridValues: {} }
    ];
  }
  if (!cfg.buste || !Array.isArray(cfg.buste)) cfg.buste = Array(10).fill({kg: 0, sleeve: 0});
  return cfg;
}
function saveCandyConfig() {
  localStorage.setItem("candy_grid_configs", JSON.stringify(candyGridConfigs));
}
function getCandyTotalKg() {
  const cfg = getActiveCinemaCandyConfig();
  let total = 0;
  if (cfg.blocks && Array.isArray(cfg.blocks)) {
    cfg.blocks.forEach(block => {
      if (block.gridValues) {
        Object.values(block.gridValues).forEach(rowObj => {
          if (rowObj) {
            Object.values(rowObj.cells || rowObj).forEach(cell => {
              if (cell && cell.weight) total += parseFloat(cell.weight) || 0;
            });
          }
        });
      }
    });
  }
  if (cfg.buste && Array.isArray(cfg.buste)) {
    cfg.buste.forEach(b => {
      let kg = parseFloat(b.kg) || 0;
      let sl = parseFloat(b.sleeve) || 0;
      total += kg + (sl * 0.1);
    });
  }
  return total;
}

/* --- CONFIGURAZIONE POST MIX --- */
let postMixGridConfigs = JSON.parse(localStorage.getItem("postmix_grid_configs")) || {};
function getActiveCinemaPostMixConfig() {
  if (!postMixGridConfigs[cinemaName]) {
    postMixGridConfigs[cinemaName] = {
      blocks: [
        { id: "pm_block_0", name: "🥤 Post-Mix Principale", columns: 5, rows: 2, gridValues: {} }
      ]
    };
  }
  let cfg = postMixGridConfigs[cinemaName];
  if (!cfg.blocks || !Array.isArray(cfg.blocks)) {
    cfg.blocks = [{ id: "pm_block_0", name: "🥤 Post-Mix Principale", columns: 5, rows: 2, gridValues: {} }];
  }
  return cfg;
}
function savePostMixConfig() {
  localStorage.setItem("postmix_grid_configs", JSON.stringify(postMixGridConfigs));
}
function getPostMixTotalKg() {
  const cfg = getActiveCinemaPostMixConfig();
  let total = 0;
  cfg.blocks.forEach(block => {
    if (block.gridValues) {
      Object.values(block.gridValues).forEach(rowObj => {
        if (rowObj) {
          Object.values(rowObj).forEach(cell => {
            if (cell && cell.weight) total += parseFloat(cell.weight) || 0;
          });
        }
      });
    }
  });
  return total;
}

/* --- CONFIGURAZIONE DISTRIBUTORI --- */
let distributorConfigs = JSON.parse(localStorage.getItem("distributor_configs")) || {};
function getActiveCinemaDistributorConfig() {
  if (!distributorConfigs[cinemaName]) {
    distributorConfigs[cinemaName] = {
      distributors: [
        { name: "Distributore 1", date: "", fondoResti: 0, rows: Array(10).fill({ product: "", stockIniziale: 0, ins: [0,0,0,0,0], contaFinale: 0, prezzoVendita: 0 }) }
      ]
    };
  }
  return distributorConfigs[cinemaName];
}
function saveDistributorConfig() {
  localStorage.setItem("distributor_configs", JSON.stringify(distributorConfigs));
}

/* --- FUNZIONI DI SUPPORTO --- */
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function n(val) {
  let parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
}

/* --- GESTIONE ESPORTAZIONE EXCEL CORRETTA E PULITA --- */

/* 1. ESPORTAZIONE SPECIFICA CARAMELLE */
function exportCandyGridExcel(isEmpty) {
  const cfg = getActiveCinemaCandyConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
        .title-row { background-color: #D35400; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 10px; text-align: center; }
        .block-title { background-color: #E67E22; color: #FFFFFF; font-size: 11pt; font-weight: bold; padding: 8px; }
        th, td { border: 1px solid #CCCCCC; text-align: center; padding: 6px; font-size: 9pt; }
        .header-cell { background-color: #F5CBA7; font-weight: bold; }
        .val-cell { background-color: #FFFFFF; }
        .tara-info { font-size: 8pt; color: #555555; }
        .total-row { background-color: #FCF3CF; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="12" class="title-row">SCHEDA CARAMELLE — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;

  cfg.blocks.forEach(b => {
    let cols = parseInt(b.columns) || 10;
    html += `<table><tr><td colspan="${cols}" class="block-title">${esc(b.name)} (Righe: ${b.rows}, Colonne: ${cols})</td></tr>`;
    for (let r = 0; r < b.rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < cols; c++) {
        let cellData = b.gridValues?.[r]?.[c] || b.gridValues?.[r]?.[String(c)];
        let valStr = "";
        if (!isEmpty && cellData) {
          let w = n(cellData.weight || 0);
          let tIdx = parseInt(cellData.taraIdx) || 0;
          let tVal = n(cfg.tares[tIdx] || 0);
          valStr = `${w > 0 ? w + ' kg' : ''}<br/><span class="tara-info">Tara: ${tVal}</span>`;
        }
        html += `<td class="val-cell">${valStr}</td>`;
      }
      html += `</tr>`;
    }
    html += `</table><br/>`;
  });

  // Sezione Buste e Scorte Sfuse
  html += `
    <table>
      <tr><td colspan="4" class="block-title">📦 BUSTE E SCORTE SFUSE</td></tr>
      <tr class="header-cell"><th>N° Busta</th><th>Kg Lordi</th><th>Sleeve (Pz)</th><th>Totale Netto Kg</th></tr>
  `;
  cfg.buste.forEach((b, idx) => {
    let kg = isEmpty ? "" : (b.kg || 0);
    let sl = isEmpty ? "" : (b.sleeve || 0);
    let tot = isEmpty ? "" : (n(b.kg) + n(b.sleeve)*0.1).toFixed(2);
    html += `<tr><td>Busta ${idx + 1}</td><td>${kg}</td><td>${sl}</td><td>${tot}</td></tr>`;
  });
  
  if (!isEmpty) {
    html += `<tr class="total-row"><td colspan="3" style="text-align:right;">TOTALE COMPLESSIVO CARAMELLE:</td><td>${getCandyTotalKg().toFixed(2)} kg</td></tr>`;
  }
  html += `</table></body></html>`;

  downloadExcelBlob(html, `Caramelle_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

/* 2. ESPORTAZIONE SPECIFICA POST MIX */
function exportPostMixGridExcel(isEmpty) {
  const cfg = getActiveCinemaPostMixConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 20px; width: 100%; }
        .title-row { background-color: #2980B9; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 10px; text-align: center; }
        .block-title { background-color: #3498DB; color: #FFFFFF; font-size: 11pt; font-weight: bold; padding: 8px; }
        th, td { border: 1px solid #CCCCCC; text-align: center; padding: 6px; font-size: 9pt; }
        .header-cell { background-color: #AED6F1; font-weight: bold; }
        .total-row { background-color: #EBF5FB; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="6" class="title-row">SCHEDA POST MIX — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;

  cfg.blocks.forEach(b => {
    let cols = parseInt(b.columns) || 5;
    html += `<table><tr><td colspan="${cols}" class="block-title">${esc(b.name)} (Righe: ${b.rows}, Colonne: ${cols})</td></tr>`;
    for (let r = 0; r < b.rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < cols; c++) {
        let cellData = b.gridValues?.[r]?.[c] || b.gridValues?.[r]?.[String(c)];
        let valStr = "";
        if (!isEmpty && cellData) {
          let pName = cellData.prodName || '';
          let w = n(cellData.weight || 0);
          valStr = `${pName ? pName + ': ' : ''}${w > 0 ? w + ' kg' : ''}`;
        }
        html += `<td>${valStr}</td>`;
      }
      html += `</tr>`;
    }
    html += `</table><br/>`;
  });

  if (!isEmpty) {
    html += `<table><tr class="total-row"><td style="text-align:right; padding:8px;">TOTALE CHILI POST-MIX:</td><td style="padding:8px;">${getPostMixTotalKg().toFixed(2)} kg</td></tr></table>`;
  }
  html += `</body></html>`;

  downloadExcelBlob(html, `PostMix_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

/* 3. ESPORTAZIONE SPECIFICA DISTRIBUTORI */
function exportDistributorsExcel(isEmpty) {
  const cfg = getActiveCinemaDistributorConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 25px; width: 100%; }
        .title-row { background-color: #8E44AD; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 10px; text-align: center; }
        .dist-header { background-color: #9B59B6; color: #FFFFFF; font-weight: bold; font-size: 11pt; padding: 8px; }
        th { background-color: #D2B4DE; border: 1px solid #BB8FCE; padding: 6px; font-size: 9pt; }
        td { border: 1px solid #D5D8DC; text-align: center; padding: 6px; font-size: 9pt; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="10" class="title-row">SCHEDA DISTRIBUTORI AUTOMATICI — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;

  cfg.distributors.forEach(d => {
    html += `
      <table>
        <tr><td colspan="9" class="dist-header">${esc(d.name)} — Data: ${d.date || ''} — Fondo Resti: €${d.fondoResti || 0}</td></tr>
        <tr>
          <th>Prodotto</th><th>Stock Iniziale</th><th>Ins 1</th><th>Ins 2</th><th>Ins 3</th><th>Ins 4</th><th>Ins 5</th><th>Conta Finale</th><th>Prezzo Vendita</th>
        </tr>
    `;
    d.rows.forEach(r => {
      html += `
        <tr>
          <td style="text-align:left; font-weight:bold;">${esc(r.product)}</td>
          <td>${isEmpty ? '' : (r.stockIniziale || '')}</td>
          ${Array(5).fill(0).map((_, i) => `<td>${isEmpty ? '' : (r.ins?.[i] || '')}</td>`).join('')}
          <td style="font-weight:bold; background:#F5EEF8;">${isEmpty ? '' : (r.contaFinale || '')}</td>
          <td>${isEmpty ? '' : (r.prezzoVendita ? '€ ' + r.prezzoVendita : '')}</td>
        </tr>
      `;
    });
    html += `</table><br/>`;
  });

  html += `</body></html>`;
  downloadExcelBlob(html, `Distributori_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

function downloadExcelBlob(htmlContent, fileName) {
  const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
