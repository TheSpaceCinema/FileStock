function parseMag(m) {
  let headerRow = -1;
  
  // 1. Cerca la riga di intestazione
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue;
    const rowStr = m[i].map(v => norm(v)).join(" ");
    if (rowStr.includes("OPENING BALANCE") || rowStr.includes("CLOSING BALANCE") || rowStr.includes("HISTORICAL")) {
      headerRow = i;
      break;
    }
  }

  const startRow = headerRow >= 0 ? headerRow + 1 : 10;
  const out = [];

  for (let i = startRow; i < m.length; i++) {
    const r = m[i];
    if (!r || !r.length) continue;

    // I dati sono in Colonna B (indice 1), non in Colonna A (indice 0)!
    const cellCode = text(r[1] || r[0]);
    const normCode = norm(cellCode);

    // Salta intestazioni, totali, righe vuote e categorie
    if (!cellCode || 
        normCode.includes("STOCK LOCATION") || 
        normCode.includes("STOCKTAKE") || 
        normCode.includes("HISTORICAL") || 
        normCode.includes("PLEASE TAKE") || 
        normCode.includes("OPENING BALANCE") || 
        normCode.includes("CLOSING BALANCE") || 
        normCode.includes("TOTAL") || 
        normCode.includes("CONCESSIONS STORE") ||
        normCode.includes("PAGE ") ||
        normCode === "FOOD" || normCode === "BEVERAGE" || normCode === "PACKAGING") {
      continue;
    }

    const rawCode = cellCode;
    const code = cleanCode(rawCode);

    // Il NOME del prodotto risiede nella riga IMMEDIATAMENTE SOTTO (i+1) sempre in Colonna B (indice 1)
    let name = "";
    if (i + 1 < m.length && m[i + 1]) {
      const nextCell = text(m[i + 1][1] || m[i + 1][0]);
      if (nextCell && !norm(nextCell).includes("TOTAL")) {
        name = nextCell;
      }
    }

    if (!name) {
      name = text(r[2]) || ("Prodotto " + code);
    }

    // Mappatura esatta colonne del report Historical - Stock Variance:
    // Colonna C (2)  -> UOM
    // Colonna F (5)  -> Opening Balance
    // Colonna O (14) -> Less Wastage
    // Colonna S (18) -> Less Sales
    // Colonna X (23) -> Closing Balance
    // Colonna AD (29)-> Std Cost
    const uom = text(r[2] || "PZ");
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
      uom: uom.toUpperCase(),
      iniziale,
      danni,
      venduto,
      atteso,
      standardCost
    });
  }

  if (out.length === 0) {
    throw new Error("Nessun prodotto trovato. Assicurati che sia il file Stock Variance Report.");
  }

  return out;
}
