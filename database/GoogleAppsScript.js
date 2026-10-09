/**
 * Backend RIPU26 sur Google Sheets (à coller dans Extensions > Apps Script)
 * 1. Renommer la première feuille en "Data".
 * 2. Déployer > Nouvelle lisière (Web App) > "Exécuter en tant que : Moi" > "Qui a accès : Tous".
 * 3. Copier l'URL Web App générée.
 */
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Data") || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const postData = JSON.parse(e.postData.contents);
    const key = postData.key;
    const d = postData.data;
    
    // Initialiser les entêtes si vide
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["_key", "date", "email", ...Object.keys(d)]);
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const emailIndex = headers.indexOf("email");
    const keyIndex = headers.indexOf("_key");
    
    let isUpdate = false;
    let targetRow = -1;
    
    if (sheet.getLastRow() > 1) {
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
      // Recherche de l'e-mail pour mise à jour ou de la clé unique pour doublon
      for (let i = 0; i < dataRange.length; i++) {
        const row = dataRange[i];
        if (keyIndex !== -1 && row[keyIndex] === key) {
          // Doublon strict de soumission
          return ContentService.createTextOutput(JSON.stringify({ok: true, duplicate: true, updated: false})).setMimeType(ContentService.MimeType.JSON);
        }
        if (emailIndex !== -1 && d.email && row[emailIndex].toString().toLowerCase() === d.email.toLowerCase()) {
          targetRow = i + 2;
          isUpdate = true;
          break;
        }
      }
    }
    
    const newRow = [];
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i];
      if (h === "_key") newRow.push(key);
      else if (h === "date") newRow.push(new Date().toISOString());
      else if (d[h] !== undefined) {
        newRow.push(Array.isArray(d[h]) ? d[h].join(" | ") : d[h]);
      } else {
        newRow.push(isUpdate ? sheet.getRange(targetRow, i + 1).getValue() : "");
      }
    }
    
    if (isUpdate) {
      sheet.getRange(targetRow, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ok: true, duplicate: false, updated: isUpdate, total: sheet.getLastRow() - 1}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ok: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Option Handling for CORS
function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT);
}
