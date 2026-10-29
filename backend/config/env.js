// Saari environment settings ek hi jagah. Baqi code process.env ko seedha nahi chhoota.
// Yeh file import hone par kabhi throw nahi karti (migrate script ko JWT_SECRET nahi chahiye);
// asli check assertEnv() mein hota hai jo app.js shuru mein chalata hai.

const isProduction = process.env.NODE_ENV === "production";

function list(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseTrustProxy(value) {
  if (value === undefined || value === "") return isProduction ? 1 : false;
  if (value === "true") return true;
  if (value === "false") return false;
  const hops = Number(value);
  return Number.isInteger(hops) && hops >= 0 ? hops : value;
}

function clampInt(value, fallback, min, max) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(number, min), max);
}

export const env = {
  isProduction,
  isTest: process.env.NODE_ENV === "test",
  port: clampInt(process.env.PORT, 3001, 1, 65535),
  mongoUri: process.env.MONGO_URI || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  corsOrigins: list(process.env.CORS_ORIGIN),
  allowRegistration: process.env.ALLOW_REGISTRATION !== "false",
  timezone: process.env.SHOP_TIMEZONE || "Asia/Karachi",
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  bcryptRounds: clampInt(process.env.BCRYPT_ROUNDS, 10, 8, 14),
  expiryWarningDays: clampInt(process.env.EXPIRY_WARNING_DAYS, 3, 1, 60),
};

export function assertEnv() {
  const problems = [];

  if (!env.jwtSecret) {
    problems.push("JWT_SECRET missing hai");
  } else if (env.isProduction && env.jwtSecret.length < 32) {
    problems.push(
      "JWT_SECRET production mein kam az kam 32 characters ka hona chahiye " +
        '(naya banane ke liye: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")'
    );
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: env.timezone });
  } catch {
    problems.push(`SHOP_TIMEZONE sahi nahi hai: ${env.timezone}`);
  }

  if (problems.length > 0) {
    throw new Error(`Environment settings theek nahi:\n- ${problems.join("\n- ")}`);
  }

  if (env.isProduction && env.corsOrigins.length === 0) {
    console.warn(
      "[warn] CORS_ORIGIN set nahi hai. Sirf same-origin requests chalengi. " +
        "Agar frontend alag domain par hai to CORS_ORIGIN zaroor set karein."
    );
  }
}
