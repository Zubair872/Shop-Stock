import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseNumber,
  cleanText,
  roundMoney,
  isPasswordLengthOk,
  escapeRegex,
  readIdempotencyKey,
} from "../utils/validate.js";
import {
  parseQuantity,
  roundQty,
  stockAtLeast,
  isFractionalUnit,
} from "../utils/units.js";
import { computeTotals } from "../utils/pricing.js";
import { stockStatus, expiryStatus } from "../utils/inventory.js";
import {
  startOfDay,
  startOfDaysAgo,
  dayKeys,
  localDateKey,
  localDateTime,
  parseDayBoundary,
} from "../utils/dates.js";
import { toCsv } from "../utils/csv.js";

test("parseNumber: sahi aur ghalat values", () => {
  assert.equal(parseNumber("12.5"), 12.5);
  assert.equal(parseNumber(0), 0);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber(null), null);
  assert.equal(parseNumber(-1), null);
  assert.equal(parseNumber("abc"), null);
  assert.equal(parseNumber({ $gt: 1 }), null);
  assert.equal(parseNumber([5]), null);
  assert.equal(parseNumber(2.5, { integer: true }), null);
  assert.equal(parseNumber(11, { max: 10 }), null);
});

test("cleanText: sirf string/number, trim aur kaat", () => {
  assert.equal(cleanText("  hello  "), "hello");
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText({ a: 1 }), "");
  assert.equal(cleanText(undefined), "");
});

test("roundMoney", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
});

test("password length: bytes ka khayal", () => {
  assert.equal(isPasswordLengthOk("short"), false);
  assert.equal(isPasswordLengthOk("12345678"), true);
  assert.equal(isPasswordLengthOk("a".repeat(72)), true);
  assert.equal(isPasswordLengthOk("a".repeat(73)), false);
  // 30 Urdu characters ~ 60 bytes ok, 40 characters ~ 80 bytes reject
  assert.equal(isPasswordLengthOk("پ".repeat(30)), true);
  assert.equal(isPasswordLengthOk("پ".repeat(40)), false);
});

test("escapeRegex aur idempotency key", () => {
  assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
  assert.equal(readIdempotencyKey("abc12345-xyz"), "abc12345-xyz");
  assert.equal(readIdempotencyKey("short"), null);
  assert.equal(readIdempotencyKey("bad key with spaces"), null);
  assert.equal(readIdempotencyKey(undefined), null);
});

test("parseQuantity: integer units", () => {
  assert.equal(parseQuantity("3", "pcs"), 3);
  assert.equal(parseQuantity(1.5, "pcs"), null);
  assert.equal(parseQuantity(0, "pcs"), null);
  assert.equal(parseQuantity(0, "pcs", { allowZero: true }), 0);
  assert.equal(parseQuantity(-2, "box"), null);
  assert.equal(parseQuantity("", "pcs"), null);
});

test("parseQuantity: kg/litre mein 3 decimals tak", () => {
  assert.ok(isFractionalUnit("kg"));
  assert.ok(!isFractionalUnit("g"));
  assert.equal(parseQuantity("1.5", "kg"), 1.5);
  assert.equal(parseQuantity(0.25, "litre"), 0.25);
  assert.equal(parseQuantity(0.0004, "kg"), null);
  assert.equal(parseQuantity(1.2345, "kg"), null);
  assert.equal(parseQuantity(0, "kg"), null);
});

test("roundQty aur stockAtLeast float ghalati se bachate hain", () => {
  assert.equal(roundQty(0.1 + 0.2), 0.3);
  assert.equal(Object.is(roundQty(-1e-12), 0), true);
  const condition = stockAtLeast(0.2);
  assert.ok(0.3 - 0.1 >= condition.$gte); // 0.19999999999999998 phir bhi pass
});

test("computeTotals: subtotal, discount, cost", () => {
  const items = [
    { price: 250, costPrice: 150, qty: 2 },
    { price: 99.9, costPrice: 60, qty: 1.5 },
  ];
  const t = computeTotals(items, 50);
  assert.equal(t.subtotal, 649.85);
  assert.equal(t.discount, 50);
  assert.equal(t.total, 599.85);
  assert.equal(t.costTotal, 390);
  assert.equal(t.discountTooHigh, false);
});

test("computeTotals: discount subtotal se zyada ho to flag", () => {
  const t = computeTotals([{ price: 100, costPrice: 0, qty: 1 }], 150);
  assert.equal(t.discountTooHigh, true);
  assert.equal(t.total, 0);
  assert.equal(computeTotals([{ price: 10, qty: 1 }]).total, 10);
});

test("stockStatus aur expiryStatus", () => {
  assert.equal(stockStatus({ stock: 0, lowStockLevel: 5 }), "out");
  assert.equal(stockStatus({ stock: 3, lowStockLevel: 5 }), "low");
  assert.equal(stockStatus({ stock: 5, lowStockLevel: 5 }), "ok");
  assert.equal(stockStatus({ stock: 1, lowStockLevel: 0 }), "ok");

  const now = new Date("2026-10-26T10:00:00Z");
  assert.equal(expiryStatus({}, now), null);
  assert.equal(expiryStatus({ expiryDate: "2026-10-25T00:00:00Z" }, now), "expired");
  assert.equal(expiryStatus({ expiryDate: "2026-10-28T10:00:00Z" }, now, 3), "soon");
  assert.equal(expiryStatus({ expiryDate: "2026-11-30T00:00:00Z" }, now, 3), "ok");
});

test("dates: Karachi (UTC+5) mein din ki shuruaat", () => {
  // 26 Oct 20:00 UTC = 27 Oct 01:00 PKT -> din 27 Oct ka hai
  const now = new Date("2026-10-26T20:00:00Z");
  assert.equal(startOfDay(now, "Asia/Karachi").toISOString(), "2026-10-26T19:00:00.000Z");
  assert.equal(localDateKey(now, "Asia/Karachi"), "2026-10-27");
  assert.equal(localDateTime(now, "Asia/Karachi"), "2026-10-27 01:00");

  // 26 Oct 10:00 UTC = 26 Oct 15:00 PKT
  const noon = new Date("2026-10-26T10:00:00Z");
  assert.equal(startOfDay(noon, "Asia/Karachi").toISOString(), "2026-10-25T19:00:00.000Z");
});

test("dates: pichhle din aur DST wala timezone", () => {
  const now = new Date("2026-10-26T10:00:00Z");
  assert.equal(
    startOfDaysAgo(7, "Asia/Karachi", now).toISOString(),
    "2026-10-19T19:00:00.000Z"
  );
  assert.deepEqual(dayKeys(3, "Asia/Karachi", now), ["2026-10-24", "2026-10-25", "2026-10-26"]);

  // New York: 1 Nov 2026 ko DST khatam (EDT -4 -> EST -5)
  const ny = new Date("2026-11-01T18:00:00Z");
  assert.equal(startOfDay(ny, "America/New_York").toISOString(), "2026-11-01T04:00:00.000Z");
  const after = new Date("2026-11-02T18:00:00Z");
  assert.equal(startOfDay(after, "America/New_York").toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal(dayKeys(3, "America/New_York", after).length, 3);
  assert.deepEqual(dayKeys(3, "America/New_York", after), ["2026-10-31", "2026-11-01", "2026-11-02"]);
});

test("parseDayBoundary", () => {
  assert.equal(
    parseDayBoundary("2026-10-26", "Asia/Karachi").toISOString(),
    "2026-10-25T19:00:00.000Z"
  );
  assert.equal(
    parseDayBoundary("2026-10-26", "Asia/Karachi", { end: true }).toISOString(),
    "2026-10-26T19:00:00.000Z"
  );
  assert.equal(parseDayBoundary("2026-02-31", "Asia/Karachi"), null);
  assert.equal(parseDayBoundary("26-10-2026", "Asia/Karachi"), null);
  assert.equal(parseDayBoundary(undefined, "Asia/Karachi"), null);
});

test("toCsv: escape, BOM, formula injection", () => {
  const csv = toCsv(
    [
      { name: 'Cake, "Choco"', note: "=SUM(A1:A2)", qty: -2 },
      { name: "Line\nbreak", note: "ok", qty: 3 },
    ],
    [
      { header: "Name", value: (r) => r.name },
      { header: "Note", value: (r) => r.note },
      { header: "Qty", value: (r) => r.qty },
    ]
  );
  assert.ok(csv.startsWith("\uFEFFName,Note,Qty\r\n"));
  assert.ok(csv.includes(`"Cake, ""Choco""",'=SUM(A1:A2),-2`));
  assert.ok(csv.includes('"Line\nbreak",ok,3'));
});
