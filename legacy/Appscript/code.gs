/**
 * Code.gs - Backend phuc vu da file HTML cho Stock Mind
 * Version 5.4 - Them cache, giu nguyen logic cu
 */

const CACHE_KEY = 'stock_data_cache';
const CACHE_DURATION = 300;

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Stock Mind AI - HFOS v5.4')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    return `<!-- Error including ${filename}: ${e.message} -->`;
  }
}

function getStockData() {
  try {
    const cached = CacheService.getScriptCache().get(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('MASTER');
    if (!sheet) return { error: 'Khong tim thay sheet "MASTER"' };
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) return { error: 'Sheet rong' };
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    
    const stocks = data.filter(row => row[0]).map(row => {
      const obj = {};
      headers.forEach((h, i) => {
        const key = h.toString().trim().toUpperCase();
        let val = row[i];
        if (val === '—' || val === '') {
          val = 0;
        } else if (!isNaN(val) && typeof val !== 'boolean' && val !== null) {
          val = parseFloat(val);
        }
        obj[key] = val;
      });
      return obj;
    });
    
    const result = { stocks: stocks };
    CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(result), CACHE_DURATION);
    
    return result;
  } catch (e) {
    return { error: e.message };
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Stock Mind')
    .addItem('Xoa Cache', 'clearCache')
    .addToUi();
}

function clearCache() {
  CacheService.getScriptCache().remove(CACHE_KEY);
  SpreadsheetApp.getUi().alert('Cache da duoc xoa');
}
