// Dukaan ke timezone (default Asia/Karachi) ke hisab se din ki hadein.
// Server UTC mein chalta hai, lekin "aaj" dukaan ka aaj hona chahiye.

const DAY_MS = 24 * 60 * 60 * 1000;

function partsIn(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value])
  );
}

function offsetMs(date, timeZone) {
  const p = partsIn(date, timeZone);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function startOfDay(date, timeZone) {
  const p = partsIn(date, timeZone);
  const guess = Date.UTC(+p.year, +p.month - 1, +p.day);
  let utc = guess - offsetMs(new Date(guess), timeZone);
  utc = guess - offsetMs(new Date(utc), timeZone); // DST wale din ke liye dobara theek karo
  return new Date(utc);
}

// "YYYY-MM-DD" (dukaan ke timezone mein)
export function localDateKey(date, timeZone) {
  const p = partsIn(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

// "YYYY-MM-DD HH:mm"
export function localDateTime(date, timeZone) {
  const p = partsIn(date, timeZone);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

// Aaj samet pichhle `days` din ki shuruaat (days=1 matlab sirf aaj)
export function startOfDaysAgo(days, timeZone, now = new Date()) {
  const todayStart = startOfDay(now, timeZone);
  const target = new Date(todayStart.getTime() - (days - 1) * DAY_MS + DAY_MS / 2);
  return startOfDay(target, timeZone);
}

// Shuru se aaj tak ke har din ki "YYYY-MM-DD" list
export function dayKeys(days, timeZone, now = new Date()) {
  const start = startOfDaysAgo(days, timeZone, now);
  const keys = [];
  for (let i = 0; i < days; i += 1) {
    keys.push(localDateKey(new Date(start.getTime() + i * DAY_MS + DAY_MS / 2), timeZone));
  }
  return keys;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Query se aayi "YYYY-MM-DD" ko din ki shuruaat (ya aakhir) mein badalta hai. Ghalat ho to null.
export function parseDayBoundary(value, timeZone, { end = false } = {}) {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day, 12));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;

  const start = startOfDay(probe, timeZone);
  return end ? new Date(start.getTime() + DAY_MS) : start; // end = agle din ki shuruaat (exclusive)
}
