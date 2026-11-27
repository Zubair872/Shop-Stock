import test from "node:test";
import assert from "node:assert/strict";
import Customer from "../models/Customer.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { checkCreditLimit, applyPayment, applyReversal } from "../utils/khata.js";
import { serializeCustomer, serializeLedgerEntry } from "../utils/serialize.js";

test("checkCreditLimit blocks udhaar when limit is crossed", () => {
  const ok = checkCreditLimit(2000, 5000, 3000);
  assert.equal(ok.allowed, true);
  assert.equal(ok.nextBalance, 5000);
  assert.equal(ok.exceededBy, 0);

  const over = checkCreditLimit(2000, 5000, 3001);
  assert.equal(over.allowed, false);
  assert.equal(over.nextBalance, 5001);
  assert.equal(over.exceededBy, 1);
});

test("applyPayment validates wapsi amount and computes remaining balance", () => {
  const zero = applyPayment(1500, 0);
  assert.equal(zero.ok, false);

  const over = applyPayment(1500, 1600);
  assert.equal(over.ok, false);

  const valid = applyPayment(1500, 500);
  assert.equal(valid.ok, true);
  assert.equal(valid.nextBalance, 1000);
});

test("applyReversal restores or reduces balance safely", () => {
  assert.equal(applyReversal(1000, 500), 1500);
  assert.equal(applyReversal(300, -500), 0);
});

test("Customer and LedgerEntry schemas serialize cleanly", () => {
  const customer = new Customer({
    user: "507f1f77bcf86cd799439011",
    name: "Bilal Ahmed",
    phone: "03001234567",
    creditLimit: 10000,
    balance: 2500,
  });
  assert.equal(customer.validateSync(), undefined);
  const cJson = serializeCustomer(customer);
  assert.equal(cJson.balance, 2500);
  assert.equal(cJson.creditLimit, 10000);

  const entry = new LedgerEntry({
    user: "507f1f77bcf86cd799439011",
    customer: customer._id,
    type: "payment",
    amount: 500,
    delta: -500,
    balanceAfter: 2000,
    note: "Cash wapsi",
  });
  assert.equal(entry.validateSync(), undefined);
  const eJson = serializeLedgerEntry(entry);
  assert.equal(eJson.type, "payment");
  assert.equal(eJson.delta, -500);
  assert.equal(eJson.balanceAfter, 2000);
});
