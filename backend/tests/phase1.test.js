import test from "node:test";
import assert from "node:assert/strict";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { serializeProduct, serializeOrder } from "../utils/serialize.js";
import { computeTotals } from "../utils/pricing.js";
import { parseQuantity, stockAtLeast } from "../utils/units.js";

test("Product model supports optional barcode", () => {
  const product = new Product({
    user: "507f1f77bcf86cd799439011",
    name: "Tapal Danedar",
    category: "Chai",
    price: 450,
    costPrice: 400,
    stock: 20,
    unit: "packet",
    barcode: "8961014000123",
  });
  const err = product.validateSync();
  assert.equal(err, undefined);
  const serialized = serializeProduct(product);
  assert.equal(serialized.barcode, "8961014000123");
});

test("Order model allows cash, card, wallet, and udhaar payment methods", () => {
  for (const paymentMethod of ["cash", "card", "wallet", "udhaar"]) {
    const order = new Order({
      user: "507f1f77bcf86cd799439011",
      items: [
        {
          product: "507f1f77bcf86cd799439012",
          name: "Atta",
          price: 150,
          qty: 2,
        },
      ],
      total: 300,
      paymentMethod,
    });
    assert.equal(order.validateSync(), undefined);
    assert.equal(serializeOrder(order).paymentMethod, paymentMethod);
  }
});

test("Order model rejects invalid payment method", () => {
  const order = new Order({
    user: "507f1f77bcf86cd799439011",
    items: [
      {
        product: "507f1f77bcf86cd799439012",
        name: "Atta",
        price: 150,
        qty: 1,
      },
    ],
    total: 150,
    paymentMethod: "crypto",
  });
  assert.ok(order.validateSync());
});

test("Server-side totals and stock quantity checks", () => {
  const qty = parseQuantity("1.25", "kg");
  assert.equal(qty, 1.25);
  assert.equal(parseQuantity("1.5", "pcs"), null);
  assert.deepEqual(stockAtLeast(1.25), { $gte: 1.249999999 });

  const totals = computeTotals(
    [
      { price: 200, costPrice: 160, qty: 1.5 },
      { price: 50, costPrice: 35, qty: 2 },
    ],
    20
  );
  assert.equal(totals.subtotal, 400);
  assert.equal(totals.discount, 20);
  assert.equal(totals.total, 380);
  assert.equal(totals.costTotal, 310);
  assert.equal(totals.discountTooHigh, false);
});
