function cleanAllFinancialData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("RAW_DATA");
  const range = sheet.getDataRange();
  let values = range.getValues();

  for (let i = 1; i < values.length; i++) { // bỏ header
    for (let j = 0; j < values[i].length; j++) {

      let val = values[i][j];

      if (typeof val === "string") {

        // 1. Trim
        val = val.trim();

        // 2. Fix dấu âm unicode (− → -)
        val = val.replace(/−/g, "-");

        // 3. Nếu là %
        if (val.includes("%")) {
          let num = parseFloat(val.replace("%", "").replace(",", "."));
          if (!isNaN(num)) {
            values[i][j] = num / 100; // convert % → decimal
            continue;
          }
        }

        // 4. Nếu là số có dấu phẩy (1,234 hoặc 1.234)
        let cleaned = val.replace(/,/g, "");

        let num = parseFloat(cleaned);

        if (!isNaN(num)) {
          values[i][j] = num;
        }

      }

    }
  }

  range.setValues(values);

  Logger.log("✅ Cleaned all data successfully");
}
function onEdit(e) {
  cleanAllFinancialData();
}