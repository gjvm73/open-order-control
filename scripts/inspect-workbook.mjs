import fs from "node:fs";
import * as XLSX from "xlsx";

const filePath = process.argv[2];
if (!filePath) throw new Error("Informe o caminho da planilha");
const workbook = XLSX.read(fs.readFileSync(filePath), { type: "buffer", cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
console.log(JSON.stringify({
  filePath,
  sheetName,
  rowCount: rows.length,
  headers: rows[0] ? Object.keys(rows[0]) : [],
  samples: rows.slice(0, 3),
}, null, 2));

const predictionKeys = Object.keys(rows[0] ?? {}).filter((key) => /previs|entrega|delivery|prazo/i.test(key));
console.log(JSON.stringify({ predictionKeys, predictionSamples: rows.slice(0, 10).map((row) => Object.fromEntries(predictionKeys.map((key) => [key, row[key]]))) }, null, 2));

const keyFields = Object.keys(rows[0] ?? {}).filter((key) => /ship|end|filial|item|po|pedido/i.test(key));
console.log(JSON.stringify({ keyFields, keySamples: rows.slice(0, 3).map((row) => Object.fromEntries(keyFields.map((key) => [key, row[key]]))) }, null, 2));

const workbookRaw = XLSX.read(fs.readFileSync(filePath), { type: "buffer", cellDates: false });
const rawRows = XLSX.utils.sheet_to_json(workbookRaw.Sheets[workbookRaw.SheetNames[0]], { defval: null });
console.log(JSON.stringify({ rawPredictionValues: rawRows.slice(0, 10).map((row) => Object.fromEntries(predictionKeys.map((key) => [key, row[key]]))) }, null, 2));
