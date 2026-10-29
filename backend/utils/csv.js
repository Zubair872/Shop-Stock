// CSV banana. Excel mein formula chalne (CSV injection) se bachne ke liye khatarnak shuruaat ko roka jata hai.
const DANGEROUS_START = /^[=+\-@\t\r]/;

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === "string" && DANGEROUS_START.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// columns: [{ header, value: (row) => ... }]
export function toCsv(rows, columns) {
  const lines = [columns.map((column) => escapeCell(column.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))).join(","));
  }
  // BOM: Excel UTF-8 (Urdu naam) sahi dikhaye
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
