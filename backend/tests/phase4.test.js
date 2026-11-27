import test from "node:test";
import assert from "node:assert/strict";
import Supplier from "../models/Supplier.js";
import SupplierLedgerEntry from "../models/SupplierLedgerEntry.js";
import Purchase from "../models/Purchase.js";
import Expense from "../models/Expense.js";
import { roundMoney } from "../utils/validate.js";
import { serializeSupplier, serializePurchase, serializeExpense } from "../utils/serialize.js";

test("Supplier and SupplierLedgerEntry schemas validate and serialize cleanly", () => {
  const supplier = new Supplier({
    user: "507f1f77bcf86cd799439011",
    name: "Al-Madina Wholesale",
    phone: "03001112233",
    address: "Akbari Mandi",
    balance: 15000,
  });
  assert.equal(supplier.validateSync(), undefined);
  const sJson = serializeSupplier(supplier);
  assert.equal(sJson.name, "Al-Madina Wholesale");
  assert.equal(sJson.balance, 15000);

  const entry = new SupplierLedgerEntry({
    user: "507f1f77bcf86cd799439011",
    supplier: supplier._id,
    type: "payment",
    amount: 5000,
    delta: -5000,
    balanceAfter: 10000,
    note: "Cash adaigi",
  });
  assert.equal(entry.validateSync(), undefined);
  assert.equal(entry.balanceAfter, 10000);
});

test("Purchase schema validates items and computes due correctly", () => {
  const purchase = new Purchase({
    user: "507f1f77bcf86cd799439011",
    supplier: "507f1f77bcf86cd799439012",
    supplierName: "Al-Madina Wholesale",
    items: [
      { name: "Chawal Basmati", unit: "kg", qty: 50, costPrice: 280 },
      { name: "Cheeni", unit: "kg", qty: 25, costPrice: 140 },
    ],
    total: 17500,
    paid: 10000,
  });
  assert.equal(purchase.validateSync(), undefined);
  const pJson = serializePurchase(purchase);
  assert.equal(pJson.total, 17500);
  assert.equal(pJson.paid, 10000);
  assert.equal(pJson.due, 7500);
});

test("Expense schema validates allowed categories and rejects invalid category", () => {
  const valid = new Expense({
    user: "507f1f77bcf86cd799439011",
    category: "kiraya",
    amount: 25000,
    note: "Dukaan kiraya",
    dateKey: "2026-11-25",
  });
  assert.equal(valid.validateSync(), undefined);
  const eJson = serializeExpense(valid);
  assert.equal(eJson.category, "kiraya");
  assert.equal(eJson.amount, 25000);

  const invalid = new Expense({
    user: "507f1f77bcf86cd799439011",
    category: "invalid_cat",
    amount: 100,
    dateKey: "2026-11-25",
  });
  assert.ok(invalid.validateSync());
});

test("Asli profit (netProfit) subtracts expenses from gross profit", () => {
  const revenue = 50000;
  const cost = 38000;
  const expenses = 4500;
  const grossProfit = roundMoney(revenue - cost);
  const netProfit = roundMoney(grossProfit - expenses);
  assert.equal(grossProfit, 12000);
  assert.equal(netProfit, 7500);
});
