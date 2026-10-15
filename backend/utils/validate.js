export function parseNumber(value, { min = 0, integer = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min) return null;
  if (integer && !Number.isInteger(number)) return null;
  return number;
}

export function cleanText(value, maxLength = 100) {
  return String(value ?? "").trim().slice(0, maxLength);
}
