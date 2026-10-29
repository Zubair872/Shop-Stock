// Kuch units (kg, litre) mein adha/aadha quantity banti hai (1.5 kg), baqi mein sirf poore number.
export const UNITS = ["pcs", "kg", "g", "litre", "dozen", "packet", "box"];

const FRACTIONAL_UNITS = new Set(["kg", "litre"]);

// Float ki chhoti ghalatiyon (0.1 + 0.2) se bachne ke liye 3 decimals tak rakhte hain.
const QTY_EPSILON = 1e-9;

export function isFractionalUnit(unit) {
  return FRACTIONAL_UNITS.has(unit);
}

export function roundQty(value) {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return rounded === 0 ? 0 : rounded; // -0 ko 0 bana do
}

// Quantity ko unit ke hisab se check karta hai. Ghalat ho to null.
export function parseQuantity(value, unit, { allowZero = false } = {}) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;

  const number = Number(value);
  if (!Number.isFinite(number) || number > 1_000_000) return null;
  if (number < 0 || (!allowZero && number <= 0)) return null;

  if (isFractionalUnit(unit)) {
    const rounded = roundQty(number);
    if (Math.abs(number - rounded) > QTY_EPSILON) return null; // 3 decimals se zyada
    if (!allowZero && rounded <= 0) return null;
    return rounded;
  }

  return Number.isInteger(number) ? number : null;
}

// Stock condition ke liye: "stock kam az kam qty ho", float ghalati ke saath
export function stockAtLeast(qty) {
  return { $gte: roundQty(qty) - QTY_EPSILON };
}

export function sameQty(a, b) {
  return Math.abs(a - b) <= QTY_EPSILON;
}
