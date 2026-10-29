// Number ko parse karta hai. Ghalat ho to null deta hai (error nahi phenkta).
export function parseNumber(
  value,
  { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {}
) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  if (integer && !Number.isInteger(number)) return null;
  return number;
}

export function cleanText(value, maxLength = 100) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return String(value).trim().slice(0, maxLength);
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// bcrypt sirf pehle 72 *bytes* dekhta hai, characters nahi (Urdu/emoji zyada bytes lete hain)
export function isPasswordLengthOk(password) {
  const bytes = Buffer.byteLength(password, "utf8");
  return password.length >= 8 && bytes <= 72;
}

export function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9_.:-]{8,100}$/;

export function readIdempotencyKey(value) {
  if (typeof value !== "string") return null;
  return IDEMPOTENCY_PATTERN.test(value) ? value : null;
}
