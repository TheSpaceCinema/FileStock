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
      let rowsCount = parseInt(block.rows) || 0;
      let colsCount = parseInt(block.columns) || 0;
      for(let r=0; r<rowsCount; r++) {
        for(let c=0; c<colsCount; c++) {
          let cellData = block.gridValues?.[r]?.[c];
          if (cellData) {
            let weight = n(cellData.weight || 0);
            let taraIdx = parseInt(cellData.taraIdx) || 0;
            let taraVal = n(cfg.tares[taraIdx] || 0);
            total += Math.max(0, weight - taraVal);
          }
        }
      }
    });
  }
  if (Array.isArray(cfg.buste)) {
    cfg.buste.forEach(b => { total += n(b.kg) + (n(b.sleeve) * 0.1); });
  }
  return total;
}

/* --- CONFIGURAZIONE DINAMICA POST MIX --- */
let postMixGridConfigs = JSON.parse(localStorage.getItem("postmix_grid_configs")) || {};
function getActiveCinemaPostMixConfig() {
  if (!postMixGridConfigs[cinemaName]) {
    postMixGridConfigs[cinemaName] = {
      blocksCount: 1,
      orientation: "vertical",
      blocks: [
        { id: "pm_block_0", name: "🥤 Post Mix Principale", columns: 6, rows: 4, gridValues: {} }
      ]
    };
  }
  let cfg = postMixGridConfigs[cinemaName];
  if (cfg.blocksCount === undefined) cfg.blocksCount = cfg.blocks ? cfg.blocks.length : 1;
  if (!cfg.orientation) cfg.orientation = "vertical";
  if (!cfg.blocks || !Array.isArray(cfg.blocks)) {
    cfg.blocks = [{ id: "pm_block_0", name: "🥤 Post Mix Principale", columns: 6, rows: 4, gridValues: {} }];
  }
  return cfg;
}
function savePostMixConfig() {
  localStorage.setItem("postmix_grid_configs", JSON.stringify(postMixGridConfigs));
}
function getPostMixProductTotals() {
  const cfg = getActiveCinemaPostMixConfig();
  let totals = {}; 
  if (cfg.blocks && Array.isArray(cfg.blocks)) {
    cfg.blocks.forEach(block => {
      let rowsCount = parseInt(block.rows) || 0;
      let colsCount = parseInt(block.columns) || 0;
      for(let r=0; r<rowsCount; r++) {
        for(let c=0; c<colsCount; c++) {
          let cellData = block.gridValues?.[r]?.[c];
          if (cellData && cellData.prodName) {
            let weight = n(cellData.weight || 0);
            let prodName = cellData.prodName;
            let pmItem = postMixProducts.find(p => p.name === prodName);
            let taraVal = pmItem ? n(pmItem.tara) : 0;
            let netKg = Math.max(0, weight - taraVal);
            totals[prodName] = (totals[prodName] || 0) + netKg;
          }
        }
      }
    });
  }
  return totals;
}

/* --- CONFIGURAZIONE DISTRIBUTORI --- */
let distributorGridConfigs = JSON.parse(localStorage.getItem("distributor_grid_configs")) || {};
function getActiveCinemaDistributorConfig() {
  if (!distributorGridConfigs[cinemaName]) {
    distributorGridConfigs[cinemaName] = {
      distributorsCount: 2,
      distributors: [
        { id: "dist_0", name: "MARS 1-9", date: "13/08/2026", fondoResti: 35, rows: Array(20).fill().map(() => ({ product: "", stockIniziale: "", ins: ["", "", "", "", ""], contaFinale: "", prezzoVendita: "" })) },
        { id: "dist_1", name: "MARS 10-18", date: "13/08/2026", fondoResti: 35, rows: Array(20).fill().map(() => ({ product: "", stockIniziale: "", ins: ["", "", "", "", ""], contaFinale: "", prezzoVendita: "" })) }
      ]
    };
  }
  let cfg = distributorGridConfigs[cinemaName];
  if (cfg.distributorsCount === undefined) cfg.distributorsCount = cfg.distributors ? cfg.distributors.length : 2;
  if (!cfg.distributors || !Array.isArray(cfg.distributors)) {
    cfg.distributors = [];
  }
  return cfg;
}
function saveDistributorConfig() {
  localStorage.setItem("distributor_grid_configs", JSON.stringify(distributorGridConfigs));
}
function getDistributorsContaFinaleTotals() {
  const cfg = getActiveCinemaDistributorConfig();
  let totals = {};
  if (cfg.distributors && Array.isArray(cfg.distributors)) {
    cfg.distributors.forEach(d => {
      if (d.rows && Array.isArray(d.rows)) {
        d.rows.forEach(r => {
          if (r.product && r.contaFinale !== "" && !isNaN(n(r.contaFinale))) {
            let prodNameNorm = norm(r.product);
            totals[prodNameNorm] = (totals[prodNameNorm] || 0) + n(r.contaFinale);
          }
        });
      }
    });
  }
  return totals;
}

const $ = id => document.getElementById(id);
document.addEventListener("DOMContentLoaded", () => {
  loadSetupFromStorage();
  loadCountsFromStorage();
  updateHeaderTitle();
  injectExcelTemplateButton();

  // Rimozione di eventuali duplicati in basso
  const bottomExportBtns = document.querySelectorAll("button[onclick*='export'], .btn-export");
  bottomExportBtns.forEach(btn => btn.remove());

  if ($("magFile")) {
    $("magFile").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if ($("magStatus")) $("magStatus").textContent = "Lettura del report in corso...";
      readMatrix(f).then(m => {
        mag = parseMag(m);
        if ($("magStatus")) $("magStatus").textContent = `✓ ${f.name} (${mag.length} articoli)`;
        build();
      }).catch(err => {
        if ($("magStatus")) $("magStatus").textContent = "❌ Errore file Magazzino";
        showError("Errore file Magazzino: " + err.message);
      });
    });
  }
  if ($("sizeFile")) {
    $("sizeFile").addEventListener("change", e => {
      const f = e.target.files[0];
      if (!f) return;
      if ($("sizeStatus")) $("sizeStatus").textContent = "Lettura anagrafica in corso...";
      readMatrix(f).then(m => {
        let parsedSizeResult = parseSize(m);
        size = parsedSizeResult.size;
        postMixProducts = parsedSizeResult.postMix;
        if ($("sizeStatus")) $("sizeStatus").textContent = `✓ ${f.name} (${size.length} articoli, ${postMixProducts.length} post-mix)`;
        build();
      }).catch(err => {
        if ($("sizeStatus")) $("sizeStatus").textContent = "❌ Errore file SIZE";
        showError("Errore file SIZE: " + err.message);
      });
    });
  }
  if ($("search")) {
    $("search").addEventListener("input", render);
  }
});

/* --- BARRA PULSANTI UNIFICATA IN ALTO --- */
function injectExcelTemplateButton() {
  const headerContainer = document.querySelector("header") || document.querySelector(".header") || document.body;
  if ($("exportTemplateBtnContainer")) return;

  const btnContainer = document.createElement("div");
  btnContainer.id = "exportTemplateBtnContainer";
  btnContainer.className = "no-print";
  btnContainer.style.cssText = "display: flex; gap: 12px; margin: 10px 0; align-items: center; flex-wrap: wrap;";

  // 1. Pulsante Blu
  const exportTemplateBtn = document.createElement("button");
  exportTemplateBtn.id = "btnExportExcelTemplate";
  exportTemplateBtn.className = "btn btn-secondary";
  exportTemplateBtn.innerHTML = "📋 Esporta Excel (Template Vuoto)";
  exportTemplateBtn.style.cssText = "background: #005a9e; color: white; border: none; padding: 9px 16px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(0,0,0,0.15);";
  exportTemplateBtn.onclick = () => handleDynamicExport(true);

  // 2. Pulsante Verde Unico
  const exportCountsBtn = document.createElement("button");
  exportCountsBtn.id = "btnExportExcelCounts";
  exportCountsBtn.className = "btn btn-success";
  exportCountsBtn.innerHTML = "📊 Esporta Report (Conteggi Rilevati)";
  exportCountsBtn.style.cssText = "background: #27ae60; color: white; border: none; padding: 9px 16px; border-radius: 5px; cursor: pointer; font-weight: bold; font-size: 0.9rem; box-shadow: 0 2px 4px rgba(0,0,0,0.15);";
  exportCountsBtn.onclick = () => handleDynamicExport(false);

  btnContainer.appendChild(exportTemplateBtn);
  btnContainer.appendChild(exportCountsBtn);

  const titleEl = $("appTitle") || headerContainer;
  if (titleEl && titleEl.parentNode) {
    titleEl.parentNode.insertBefore(btnContainer, titleEl.nextSibling);
  } else {
    document.body.insertBefore(btnContainer, document.body.firstChild);
  }
}

/* --- GESTORE DINAMICO ESPORTAZIONE IN BASE AL TAB ATTIVO --- */
function handleDynamicExport(isEmptyTemplate) {
  if (currentTab === 'candy') {
    exportCandyGridExcel(isEmptyTemplate);
  } else if (currentTab === 'postmix') {
    exportPostMixGridExcel(isEmptyTemplate);
  } else if (currentTab === 'distributors') {
    exportDistributorsExcel(isEmptyTemplate);
  } else {
    if (isEmptyTemplate) {
      exportEmptyTemplateToExcel();
    } else {
      exportCurrentInventoryToExcel();
    }
  }
}

/* --- ESPORTAZIONE SPECIFICA CARAMELLE (GRIGLIE + BUSTE) --- */
function exportCandyGridExcel(isEmpty) {
  const cfg = getActiveCinemaCandyConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 20px; }
        .title-row { background-color: #D35400; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 8px; }
        .block-title { background-color: #E67E22; color: #FFFFFF; font-size: 11pt; font-weight: bold; padding: 5px; }
        th, td { border: 1px solid #CCCCCC; text-align: center; padding: 6px; font-size: 9pt; }
        .header-cell { background-color: #F5CBA7; font-weight: bold; }
        .val-cell { background-color: #FFFFFF; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="15" class="title-row">SCHEDA CARAMELLE — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;

  cfg.blocks.forEach(b => {
    html += `<table><tr><td colspan="${b.columns}" class="block-title">${esc(b.name)}</td></tr>`;
    for (let r = 0; r < b.rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < b.columns; c++) {
        let cellData = b.gridValues?.[r]?.[c];
        let valStr = "";
        if (!isEmpty && cellData) {
          let w = n(cellData.weight || 0);
          let tIdx = parseInt(cellData.taraIdx) || 0;
          let tVal = n(cfg.tares[tIdx] || 0);
          valStr = `${w} kg (Tara ${tVal})`;
        }
        html += `<td class="val-cell">${valStr}</td>`;
      }
      html += `</tr>`;
    }
    html += `</table><br/>`;
  });

  html += `
    <table>
      <tr><td colspan="4" class="block-title">📦 BUSTE E SCORTE SFUSE</td></tr>
      <tr class="header-cell"><th>N° Busta</th><th>Kg Lordi</th><th>Sleeve (Pz)</th><th>Totale Netto Kg</th></tr>
  `;
  cfg.buste.forEach((b, idx) => {
    let kg = isEmpty ? "" : b.kg;
    let sl = isEmpty ? "" : b.sleeve;
    let tot = isEmpty ? "" : (n(b.kg) + n(b.sleeve)*0.1).toFixed(2);
    html += `<tr><td>Busta ${idx + 1}</td><td>${kg}</td><td>${sl}</td><td>${tot}</td></tr>`;
  });
  html += `</table></body></html>`;

  downloadExcelBlob(html, `Caramelle_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

/* --- ESPORTAZIONE SPECIFICA POST MIX --- */
function exportPostMixGridExcel(isEmpty) {
  const cfg = getActiveCinemaPostMixConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 20px; }
        .title-row { background-color: #2980B9; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 8px; }
        .block-title { background-color: #3498DB; color: #FFFFFF; font-size: 11pt; font-weight: bold; padding: 5px; }
        th, td { border: 1px solid #CCCCCC; text-align: center; padding: 6px; font-size: 9pt; }
        .header-cell { background-color: #AED6F1; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="10" class="title-row">SCHEDA POST MIX — ${esc(cinemaName)} ${isEmpty ? '(TEMPLATE VUOTO)' : '(CONTEGGI)'}</td></tr>
      </table>
  `;

  cfg.blocks.forEach(b => {
    html += `<table><tr><td colspan="${b.columns}" class="block-title">${esc(b.name)}</td></tr>`;
    for (let r = 0; r < b.rows; r++) {
      html += `<tr>`;
      for (let c = 0; c < b.columns; c++) {
        let cellData = b.gridValues?.[r]?.[c];
        let valStr = "";
        if (!isEmpty && cellData && cellData.prodName) {
          valStr = `${cellData.prodName}: ${cellData.weight} kg`;
        }
        html += `<td>${valStr}</td>`;
      }
      html += `</tr>`;
    }
    html += `</table><br/>`;
  });
  html += `</body></html>`;

  downloadExcelBlob(html, `PostMix_${cinemaName}_${isEmpty ? 'Template' : 'Report'}.xls`);
}

/* --- ESPORTAZIONE SPECIFICA DISTRIBUTORI --- */
function exportDistributorsExcel(isEmpty) {
  const cfg = getActiveCinemaDistributorConfig();
  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; margin-bottom: 25px; width: 100%; }
        .title-row { background-color: #8E44AD; color: #FFFFFF; font-size: 14pt; font-weight: bold; padding: 8px; }
        .dist-header { background-color: #9B59B6; color: #FFFFFF; font-weight: bold; font-size: 11pt; }
        th { background-color: #D2B4DE; border: 1px solid #BB8FCE; padding: 5px; font-size: 9pt; }
        td { border: 1px solid #D5D8DC; text-align: center; padding: 5px; font-size: 9pt; }
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
        <tr><td colspan="10" class="dist-header">${esc(d.name)} — Data: ${d.date || ''} — Fondo Resti: €${d.fondoResti || 0}</td></tr>
        <tr>
          <th>Prodotto</th><th>Stock Iniziale</th><th>Ins 1</th><th>Ins 2</th><th>Ins 3</th><th>Ins 4</th><th>Ins 5</th><th>Conta Finale</th><th>Prezzo Vendita</th>
        </tr>
    `;
    d.rows.forEach(r => {
      if (r.product || isEmpty) {
        html += `
          <tr>
            <td style="text-align:left; font-weight:bold;">${esc(r.product)}</td>
            <td>${isEmpty ? '' : r.stockIniziale}</td>
            ${Array(5).fill(0).map((_, i) => `<td>${isEmpty ? '' : (r.ins?.[i] || '')}</td>`).join('')}
            <td style="font-weight:bold; background:#F5EEF8;">${isEmpty ? '' : r.contaFinale}</td>
            <td>${isEmpty ? '' : (r.prezzoVendita ? '€ ' + r.prezzoVendita : '')}</td>
          </tr>
        `;
      }
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

/* --- ESPORTAZIONE INVENTARIO REALE COMPLETO CON CONTEGGI ( MAGAZZINO CLASSICO ) --- */
function exportCurrentInventoryToExcel() {
  if (!rows || rows.length === 0) {
    alert("Nessun dato prodotto caricato da esportare!");
    return;
  }

  let activeMagName = cinemaName;
  if (currentTab === 'tot') {
    activeMagName = `${cinemaName} - RIEPILOGO TOTALE`;
  } else if (typeof currentTab === 'number' && warehouses[currentTab]) {
    activeMagName = `${cinemaName} - ${warehouses[currentTab]}`;
  }

  let totalItems = rows.length;
  let totalAtteso = 0;
  let totalRilevato = 0;
  let totalDiffValore = 0;

  rows.forEach(r => {
    totalAtteso += (r.atteso || 0);
    const eff = getGlobalRilevato(r.code, r);
    totalRilevato += eff;
    totalDiffValore += (eff - (r.atteso || 0)) * (r.standardCost || 0);
  });

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        .title-row { background-color: #1F4E78; color: #FFFFFF; font-size: 16pt; font-weight: bold; text-align: left; padding: 10px; }
        .kpi-header { background-color: #F2F4F7; font-weight: bold; font-size: 9pt; color: #555555; text-align: center; border: 1px solid #D9D9D9; }
        .kpi-value { background-color: #FFFFFF; font-weight: bold; font-size: 11pt; color: #1F4E78; text-align: center; border: 1px solid #D9D9D9; }
        th { background-color: #ED7D31; color: #FFFFFF; font-size: 10pt; font-weight: bold; text-align: center; border: 1px solid #C55A11; padding: 6px; }
        td { font-size: 9.5pt; border: 1px solid #E0E0E0; padding: 5px; vertical-align: middle; }
        .row-even { background-color: #FFFDF9; }
        .row-odd { background-color: #FFFFFF; }
        .col-qta { background-color: #4472C4; color: #FFFFFF; font-weight: bold; text-align: center; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .num-bold { font-weight: bold; }
        .val-positive { color: #27AE60; font-weight: bold; }
        .val-negative { color: #C0392B; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="17" class="title-row">INVENTARIO MAGAZZINO — ${esc(activeMagName)}</td></tr>
        <tr><td colspan="17" style="height:10px; border:none;"></td></tr>
        <tr>
          <td colspan="3" class="kpi-header">N° ARTICOLI PRESENTI</td>
          <td colspan="3" class="kpi-header">PEZZI ATTESI</td>
          <td colspan="3" class="kpi-header">PEZZI RILEVATI</td>
          <td colspan="4" class="kpi-header">DIFFERENZA TOTALE VALORE</td>
          <td colspan="4" style="border:none;"></td>
        </tr>
        <tr>
          <td colspan="3" class="kpi-value">${fmt(totalItems)}</td>
          <td colspan="3" class="kpi-value">${fmt(totalAtteso)}</td>
          <td colspan="3" class="kpi-value">${fmt(totalRilevato)}</td>
          <td colspan="4" class="kpi-value ${totalDiffValore >= 0 ? 'val-positive' : 'val-negative'}">€ ${fmtMoney(totalDiffValore)}</td>
          <td colspan="4" style="border:none;"></td>
        </tr>
        <tr><td colspan="17" style="height:15px; border:none;"></td></tr>
        <tr>
          <th>Prodotto</th>
          <th>U.M.</th>
          <th>Iniziale</th>
          <th>Danni</th>
          <th>Venduto</th>
          <th>Size Box</th>
          <th>Q.tà Box</th>
          <th>Size Sleeve</th>
          <th>Q.tà Sleeve</th>
          <th>Q.tà Sfuso</th>
          <th>Atteso</th>
          <th>Rilevato Base</th>
          <th>Da Kit/Spec.</th>
          <th style="background-color: #2F5597;">EFFETTIVO TOTALE</th>
          <th>Diff. Totale</th>
          <th>Costo Unit.</th>
          <th>Diff. Valore</th>
        </tr>
  `;

  rows.forEach((r, idx) => {
    let totBoxLocal = 0, totSleeveLocal = 0, totSfusoLocal = 0;
    if (currentTab === 'tot') {
      warehouses.forEach((_, wIdx) => {
        const cWh = getCount(wIdx, r.code);
        totBoxLocal += sumArr(cWh.box);
        totSleeveLocal += sumArr(cWh.sleeve);
        totSfusoLocal += sumArr(cWh.sfuso);
      });
    } else if (typeof currentTab === 'number') {
      const c = getCount(currentTab, r.code);
      totBoxLocal = sumArr(c.box);
      totSleeveLocal = sumArr(c.sleeve);
      totSfusoLocal = sumArr(c.sfuso);
    }

    const baseRilevato = (totBoxLocal * (r.boxSize || 0)) + (totSleeveLocal * (r.sleeveSize || 0)) + totSfusoLocal;
    const kitPart = getKitContributionDetail(r.name, r.code);
    const effettivoTotaleComplesso = getGlobalRilevato(r.code, r);
    const diffTotale = effettivoTotaleComplesso - (r.atteso || 0);
    const diffValore = diffTotale * (r.standardCost || 0);

    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';

    html += `
      <tr class="${rowClass}">
        <td class="text-left num-bold">${esc(r.name)}</td>
        <td class="text-center">${esc(r.uom)}</td>
        <td class="text-right">${fmt(r.iniziale)}</td>
        <td class="text-right">${fmt(r.danni)}</td>
        <td class="text-right">${fmt(r.venduto)}</td>
        <td class="text-center">${r.boxSize || '-'}</td>
        <td class="text-right">${fmt(totBoxLocal)}</td>
        <td class="text-center">${r.sleeveSize || '-'}</td>
        <td class="text-right">${fmt(totSleeveLocal)}</td>
        <td class="text-right">${fmt(totSfusoLocal)}</td>
        <td class="text-right">${fmt(r.atteso)}</td>
        <td class="text-right">${fmt(baseRilevato)}</td>
        <td class="text-right">${fmt(kitPart)}</td>
        <td class="col-qta">${fmt(effettivoTotaleComplesso)}</td>
        <td class="text-right ${diffTotale < 0 ? 'val-negative' : ''}">${fmt(diffTotale)}</td>
        <td class="text-right">€ ${fmtMoney(r.standardCost || 0)}</td>
        <td class="text-right ${diffValore < 0 ? 'val-negative' : 'val-positive'}">€ ${fmtMoney(diffValore)}</td>
      </tr>
    `;
  });

  html += `</table></body></html>`;
  downloadExcelBlob(html, `Report_Inventario_${activeMagName.replace(/[^a-zA-Z0-9-_]/g, "_")}.xls`);
}

/* --- ESPORTAZIONE TEMPLATE CONTEGGIO VUOTO IN EXCEL ( MAGAZZINO CLASSICO ) --- */
function exportEmptyTemplateToExcel() {
  if (!rows || rows.length === 0) {
    alert("Nessun prodotto caricato!");
    return;
  }

  let activeMagName = cinemaName;
  if (typeof currentTab === 'number' && warehouses[currentTab]) {
    activeMagName = `${cinemaName} - ${warehouses[currentTab]}`;
  } else {
    activeMagName = `${cinemaName} - Template Conteggio`;
  }

  let html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; }
        table { border-collapse: collapse; width: 100%; }
        .title-row { background-color: #1F4E78; color: #FFFFFF; font-size: 15pt; font-weight: bold; text-align: left; padding: 8px; }
        th { background-color: #ED7D31; color: #FFFFFF; font-size: 10pt; font-weight: bold; text-align: center; border: 1px solid #C55A11; padding: 6px; }
        td { font-size: 9.5pt; border: 1px solid #D9D9D9; padding: 5px; }
        .row-even { background-color: #FFFDF9; }
        .row-odd { background-color: #FFFFFF; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .empty-cell { background-color: #FFFFFF; }
        .nd-cell { background-color: #F2F2F2; color: #999999; text-align: center; font-style: italic; }
      </style>
    </head>
    <body>
      <table>
        <tr><td colspan="20" class="title-row">SCHEDA DI CONTEGGIO MANUALI — ${esc(activeMagName)}</td></tr>
        <tr><td colspan="20" style="height:10px; border:none;"></td></tr>
        <tr>
          <th>Prodotto</th>
          <th>U.M.</th>
          <th>Size Box</th>
          <th>Box 1</th><th>Box 2</th><th>Box 3</th><th>Box 4</th><th>Box 5</th>
          <th>Size Sleeve</th>
          <th>Sleeve 1</th><th>Sleeve 2</th><th>Sleeve 3</th><th>Sleeve 4</th><th>Sleeve 5</th>
          <th>Sfuso 1</th><th>Sfuso 2</th><th>Sfuso 3</th><th>Sfuso 4</th><th>Sfuso 5</th>
          <th>Valore Atteso</th>
        </tr>
  `;

  rows.forEach((r, idx) => {
    const rowClass = idx % 2 === 0 ? 'row-even' : 'row-odd';
    const hasBox = r.boxSize > 0;
    const hasSleeve = r.sleeveSize > 0;

    html += `
      <tr class="${rowClass}">
        <td class="text-left" style="font-weight:bold;">${esc(r.name)}</td>
        <td class="text-center">${esc(r.uom)}</td>
        <td class="text-center">${r.boxSize || '-'}</td>
        ${Array(5).fill(0).map(() => hasBox ? `<td class="empty-cell"></td>` : `<td class="nd-cell">N/D</td>`).join('')}
        <td class="text-center">${r.sleeveSize || '-'}</td>
        ${Array(5).fill(0).map(() => hasSleeve ? `<td class="empty-cell"></td>` : `<td class="nd-cell">N/D</td>`).join('')}
        ${Array(5).fill(0).map(() => `<td class="empty-cell"></td>`).join('')}
        <td class="text-right" style="font-weight:bold;">${fmt(r.atteso)}</td>
      </tr>
    `;
  });

  html += `</table></body></html>`;
  downloadExcelBlob(html, `Template_Conteggio_${activeMagName.replace(/[^a-zA-Z0-9-_]/g, "_")}.xls`);
}

function toggleFilesSection() {
  const sec = $("filesSection");
  if (sec) sec.style.display = (sec.style.display === "none") ? "grid" : "none";
}
function updateHeaderTitle() {
  if ($("appTitle")) $("appTitle").textContent = `📊 Gestione Inventario — ${cinemaName}`;
}
function showError(msg) { alert(msg); }
function loadSetupFromStorage() {
  const savedCinema = localStorage.getItem("cinema_info_name");
  if (savedCinema) cinemaName = savedCinema;
  const savedWh = localStorage.getItem("cinema_warehouses");
  if (savedWh) { try { warehouses = JSON.parse(savedWh); } catch(e){} }
}
function loadCountsFromStorage() {
  const savedCounts = localStorage.getItem("inventory_counts");
  if (savedCounts) { try { countsData = JSON.parse(savedCounts); } catch(e){} }
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
  if ($("customCinemaDiv")) $("customCinemaDiv").style.display = (sel === "__CUSTOM__") ? "block" : "none";
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
  if ($("tabContent")) $("tabContent").style.display = "none";
  if ($("setupView")) $("setupView").style.display = "block";
  
  const select = $("cinemaSelect");
  if (select) {
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
      if ($("customCinemaDiv")) $("customCinemaDiv").style.display = "block";
      if ($("customCinemaInput")) $("customCinemaInput").value = cinemaName;
    } else {
      if ($("customCinemaDiv")) $("customCinemaDiv").style.display = "none";
    }
    select.appendChild(customOpt);
  }
  
  const container = $("whList");
  if (container) {
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
}
function addWarehouseInput() {
  const container = $("whList");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "wh-item";
  div.style.cssText = "display: flex; gap: 10px; margin-bottom: 8px;";
  div.innerHTML = `
    <input class="wh-input-item" value="Magazzino ${container.children.length + 1}" placeholder="Nome Magazzino" style="flex:1; padding: 6px 10px;">
    <button class="btn btn-danger" onclick="this.parentElement.remove()" style="background:#d32f2f; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Elimina</button>
  `;
  container.appendChild(div);
}
function renderTabs() {
  const bar = $("tabsBar");
  if (!bar) return;
  bar.innerHTML = "";
  warehouses.forEach((w, idx) => {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${currentTab === idx ? 'active' : ''}`;
    btn.textContent = `📍 ${w}`;
    btn.onclick = () => { currentTab = idx; switchTab(); };
    bar.appendChild(btn);
  });
  const btnCandy = document.createElement("button");
  btnCandy.className = `tab-btn ${currentTab === 'candy' ? 'active' : ''}`;
  btnCandy.textContent = `🍬 Caramelle`;
  btnCandy.onclick = () => { currentTab = 'candy'; switchTab(); };
  bar.appendChild(btnCandy);
  const btnPostMix = document.createElement("button");
  btnPostMix.className = `tab-btn ${currentTab === 'postmix' ? 'active' : ''}`;
  btnPostMix.textContent = `🥤 Post Mix`;
  btnPostMix.onclick = () => { currentTab = 'postmix'; switchTab(); };
  bar.appendChild(btnPostMix);
  const btnDist = document.createElement("button");
  btnDist.className = `tab-btn ${currentTab === 'distributors' ? 'active' : ''}`;
  btnDist.textContent = `🍫 Distributori`;
  btnDist.onclick = () => { currentTab = 'distributors'; switchTab(); };
  bar.appendChild(btnDist);
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
    if ($("setupView")) $("setupView").style.display = "none";
    if ($("tabContent")) $("tabContent").style.display = "block";
    render();
  }
}
function readMatrix(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => {
      try {
        if (typeof XLSX === "undefined") throw new Error("Libreria XLSX non presente.");
        const wb = XLSX.read(e.target.result, { type: "array", cellDates: false });
        if (!wb.SheetNames || !wb.SheetNames.length) throw new Error("Nessun foglio trovato.");
        let combinedMatrix = [];
        wb.SheetNames.forEach(sheetName => {
          const sheetData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "", raw: true });
          if (sheetData && sheetData.length > 0) combinedMatrix = combinedMatrix.concat(sheetData);
        });
        resolve(combinedMatrix);
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
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
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
function parseMag(m) {
  const out = [];
  for (let i = 0; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;
    const uom = text(r[2]).trim().toUpperCase();
    if (!uom || (uom !== "PZ" && uom !== "KG" && uom !== "LT" && uom !== "CL" && uom !== "GR")) continue;
    let name = "";
    if (i + 1 < m.length && m[i + 1]) name = text(m[i + 1][1] || m[i + 1][0]).trim();
    if (!name) name = text(r[1]).trim();
    const rawCode = text(r[1]).trim();
    const code = cleanCode(rawCode);
    const iniziale = n(r[5]);
    const danni = n(r[14]);
    const venduto = n(r[18]);
    let atteso = n(r[23]);
    if (atteso === 0 && (iniziale > 0 || venduto > 0)) atteso = iniziale - danni - venduto;
    const standardCost = Math.abs(n(r[29] || r[32] || 0));
    out.push({ rawCode, code, name, uom, iniziale, danni, venduto, atteso, standardCost });
  }
  if (out.length === 0) throw new Error("Nessun prodotto trovato nel report Magazzino.");
  return out;
}
function parseSize(m) {
  const sizeOut = [];
  const postMixOut = [];
  let section = "SIZE"; 
  for (let i = 0; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;
    const firstVal = text(r[0]);
    const normFirst = norm(firstVal);
    if (normFirst === "KIT" || norm(r[1]) === "TIPO" || (normFirst === "" && norm(r[1]) === "TIPO")) {
      section = "KIT";
      continue;
    }
    if (normFirst === "POSTMIX" || normFirst === "POST MIX" || norm(r[1]) === "TARA" || norm(r[2]) === "TARA") {
      section = "POSTMIX";
      continue;
    }
    if (section === "KIT") {
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
          if (norm(textVal) !== "PRODOTTO" && norm(textVal) !== "Q.TA") currentIngName = textVal;
        }
      }
      sizeOut.push({
        code: "KIT_" + cleanCode(kitName),
        name: kitName,
        boxSize: 1,
        sleeveSize: 0,
        isKit: true,
        kitType,
        ingredients
      });
    } else if (section === "POSTMIX") {
      const prodName = firstVal;
      const taraVal = n(r[2] !== undefined && r[2] !== "" ? r[2] : r[1]);
      if (!prodName || normFirst === "PRODOTTO" || normFirst === "TARA") continue;
      postMixOut.push({ name: prodName, tara: taraVal });
    } else {
      const name = firstVal;
      const normName = norm(name);
      if (!name || name === "#N/D" || normName.includes("PRODOTTO") || normName.includes("DESCRIZIONE") || normName.includes("BOX")) continue;
      const boxSize = n(r[1]);
      const sleeveSize = n(r[2]);
      let primaryCode = "";
      for (let c = 4; c < r.length; c++) {
        const valStr = text(r[c]);
        if (valStr && !primaryCode) { primaryCode = cleanCode(valStr); break; }
      }
      if (!primaryCode) primaryCode = cleanCode(name);
      sizeOut.push({
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
  return { size: sizeOut, postMix: postMixOut };
}
function build() {
  if (!mag.length || !size.length) {
    if ($("mainStatus")) {
      $("mainStatus").style.display = "block";
      $("mainStatus").innerHTML = `Magazzino: <b>${mag.length}</b> · SIZE: <b>${size.length}</b><br>Carica entrambi i file per continuare.`;
    }
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
          rawCode: s.code, code: s.code, name: s.name, uom: s.kitType || "BOX",
          iniziale: 0, danni: 0, venduto: 0, atteso: 0, standardCost: 0,
          boxSize: s.boxSize || 1, sleeveSize: s.sleeveSize || 0, isKit: true, ingredients: s.ingredients || []
        });
      }
    }
  });
  rows.sort((a, b) => {
    if (a.isKit && !b.isKit) return 1;
    if (!a.isKit && b.isKit) return -1;
    return a.name.localeCompare(b.name);
  });
  if ($("filesSection")) $("filesSection").style.display = "none";
  if ($("mainStatus")) $("mainStatus").style.display = "none";
  if ($("setupView")) $("setupView").style.display = "none";
  if ($("tabContent")) $("tabContent").style.display = "block";
  if (typeof currentTab === 'string' && currentTab !== 'tot' && currentTab !== 'candy' && currentTab !== 'postmix' && currentTab !== 'distributors') currentTab = 0;
  renderTabs();
  render();
}
function getCount(whIdx, code) {
  if (!countsData[whIdx]) countsData[whIdx] = {};
  if (!countsData[whIdx][code]) countsData[whIdx][code] = { box: [0], sleeve: [0], sfuso: [0] };
  const c = countsData[whIdx][code];
  if (!Array.isArray(c.box)) c.box = [n(c.box)];
  if (!Array.isArray(c.sleeve)) c.sleeve = [n(c.sleeve)];
  if (!Array.isArray(c.sfuso)) c.sfuso = [n(c.sfuso)];
  return c;
}
function sumArr(arr) { if (!Array.isArray(arr)) return 0; return arr.reduce((a, b) => a + n(b), 0); }
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
  
  if (norm(r.name).includes("CARAMELLE") && norm(r.name).includes("AERMONT")) {
    basePezzi += getCandyTotalKg();
  }
  const postMixTotals = getPostMixProductTotals();
  const cleanStr = str => norm(str).replace(/[^A-Z0-9]/g, "");
  const rNameClean = cleanStr(r.name);
  
  for (let [pmName, pmKg] of Object.entries(postMixTotals)) {
    const pmClean = cleanStr(pmName);
    if (rNameClean === pmClean || rNameClean.includes(pmClean) || pmClean.includes(rNameClean)) {
      basePezzi += pmKg;
    }
  }
  const distTotals = getDistributorsContaFinaleTotals();
  if (distTotals[rNameClean]) {
    basePezzi += distTotals[rNameClean];
  } else {
    for (let [dName, dVal] of Object.entries(distTotals)) {
      if (rNameClean.includes(dName) || dName.includes(rNameClean)) {
        basePezzi += dVal;
        break;
      }
    }
  }
  return basePezzi + getKitContributionDetail(r.name, r.code);
}
function render() {
  if (currentTab === 'setup') return;
  if (currentTab === 'candy') { if (typeof renderCandyView === 'function') renderCandyView(); return; }
  if (currentTab === 'postmix') { if (typeof renderPostMixView === 'function') renderPostMixView(); return; }
  if (currentTab === 'distributors') { if (typeof renderDistributorsView === 'function') renderDistributorsView(); return; }
  
  const q = $("search") ? norm($("search").value) : "";
  const data = rows.filter(x => norm(x.name).includes(q) || norm(x.code).includes(q));
  if ($("count")) $("count").textContent = `${data.length} prodotti`;
  const isTotTab = (currentTab === 'tot');
  
  if ($("thead")) {
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
        <th class="num" style="background: #e3f2fd; color: #0d47a1;">➕ Da Kit/Spec.</th>
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
  }
  recalcKPIs();
}
function renderMultiInput(whIdx, code, fieldType, unitSize) {
  const c = getCount(whIdx, code);
  const arr = c[fieldType] || [0];
  
  const isDisabled = (fieldType === 'box' && (!unitSize || unitSize <= 0)) || 
                     (fieldType === 'sleeve' && (!unitSize || unitSize <= 0));
  if (isDisabled) {
    return `<span style="color: #adb5bd; font-size: 0.8rem; font-style: italic;">N/D</span>`;
  }
  
  return arr.map((val, idx) => `
    <div style="display: inline-flex; align-items: center; gap: 4px; margin: 2px;">
      <input type="number" step="any" value="${val || ''}" style="width: 60px; padding: 3px; text-align: center;" 
             oninput="updateCountField(${whIdx}, '${code}', '${fieldType}', ${idx}, this.value)">
    </div>
  `).join('') + `
    <button onclick="addCountField(${whIdx}, '${code}', '${fieldType}')" style="padding: 2px 6px; font-size: 0.75rem; cursor:pointer;" title="Aggiungi campo" class="no-print">+</button>
  `;
}
function updateCountField(whIdx, code, fieldType, idx, val) {
  const c = getCount(whIdx, code);
  c[fieldType][idx] = n(val);
  saveCountsToStorage();
  
  const r = rows.find(x => x.code === code);
  if (r) {
    const eff = getGlobalRilevato(code, r);
    const diff = eff - r.atteso;
    const diffVal = diff * (r.standardCost || 0);
    
    const effEl = document.getElementById(`eff-${code}`);
    const diffEl = document.getElementById(`diff-${code}`);
    const valEl = document.getElementById(`val-${code}`);
    
    if (effEl) effEl.textContent = fmt(eff);
    if (diffEl) {
      diffEl.textContent = fmt(diff);
      diffEl.className = `num cell-diff ${diff === 0 ? 'ok' : 'bad'}`;
    }
    if (valEl) {
      valEl.textContent = `€ ${fmtMoney(diffVal)}`;
      valEl.className = `num grp-valore cell-val ${diffVal >= 0 ? 'ok' : 'bad'}`;
    }
  }
  recalcKPIs();
}
function addCountField(whIdx, code, fieldType) {
  const c = getCount(whIdx, code);
  c[fieldType].push(0);
  saveCountsToStorage();
  render();
}
function recalcKPIs() {
  let totAtteso = 0, totRilevato = 0, totDiffValore = 0;
  rows.forEach(r => {
    totAtteso += r.atteso;
    const eff = getGlobalRilevato(r.code, r);
    totRilevato += eff;
    totDiffValore += (eff - r.atteso) * (r.standardCost || 0);
  });
  if ($("kpiAtteso")) $("kpiAtteso").textContent = fmt(totAtteso);
  if ($("kpiRilevato")) $("kpiRilevato").textContent = fmt(totRilevato);
  if ($("kpiValore")) $("kpiValore").textContent = `€ ${fmtMoney(totDiffValore)}`;
}
