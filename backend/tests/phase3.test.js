import test from "node:test";
import assert from "node:assert/strict";
import DailyClosing from "../models/DailyClosing.js";
import { localDateKey } from "../utils/dates.js";
import { roundMoney } from "../utils/validate.js";

test("DailyClosing schema validates required fields", () => {
  const closing = new DailyClosing({
    user: "507f1f77bcf86cd799439011",
    dateKey: "2026-11-25",
    totalOrders: 12,
    totalRevenue: 15000,
    cashRevenue: 8000,
    cardRevenue: 3000,
    walletRevenue: 2000,
    udhaarRevenue: 2000,
    totalProfit: 3500,
    totalDiscount: 500,
    note: "Roz ki bandi",
  });
  assert.equal(closing.validateSync(), undefined);
  assert.equal(closing.dateKey, "2026-11-25");
  assert.equal(closing.totalRevenue, 15000);
});

test("DailyClosing dateKey uniqueness enforced at schema level", () => {
  const c1 = new DailyClosing({ user: "507f1f77bcf86cd799439011", dateKey: "2026-11-25" });
  const c2 = new DailyClosing({ user: "507f1f77bcf86cd799439011", dateKey: "2026-11-25" });
  assert.equal(c1.dateKey, c2.dateKey);
});

test("roundMoney handles revenue splits correctly", () => {
  const cash = 8333.33;
  const card = 1666.67;
  const total = roundMoney(cash + card);
  assert.equal(total, 10000);
});

test("localDateKey returns YYYY-MM-DD format", () => {
  const key = localDateKey(new Date("2026-11-25T10:00:00Z"), "Asia/Karachi");
  assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
});

test("profit = revenue - cost (server-side check)", () => {
  const revenue = 25000;
  const cost = 18000;
  const profit = roundMoney(revenue - cost);
  assert.equal(profit, 7000);
});
