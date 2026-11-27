import test from "node:test";
import assert from "node:assert/strict";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { serializeUser } from "../utils/serialize.js";
import { buildDemoProducts, DEMO_TTL_MS } from "../utils/demoSeed.js";
import { createRateLimiter } from "../middleware/rateLimit.js";

test("DEMO_TTL_MS is 24 hours", () => {
  assert.equal(DEMO_TTL_MS, 24 * 60 * 60 * 1000);
});

test("User schema supports isDemo and demoExpiresAt and serializeUser exposes them", () => {
  const expiresAt = new Date(Date.now() + DEMO_TTL_MS);
  const user = new User({
    name: "Demo Dukaandar",
    email: "demo-123@demo.shopstock.pk",
    password: "SecretDemoPassword123",
    shopName: "Bismillah Kiryana Store (Demo)",
    role: "owner",
    isDemo: true,
    demoExpiresAt: expiresAt,
  });
  assert.equal(user.validateSync(), undefined);
  const json = serializeUser(user);
  assert.equal(json.isDemo, true);
  assert.equal(new Date(json.demoExpiresAt).getTime(), expiresAt.getTime());
});

test("buildDemoProducts returns 20 valid kiryana products with low stock and near expiry", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  const list = buildDemoProducts("507f1f77bcf86cd799439011", now);
  assert.equal(list.length, 20);

  let lowStockCount = 0;
  let nearExpiryCount = 0;
  for (const item of list) {
    const doc = new Product(item);
    assert.equal(doc.validateSync(), undefined);
    assert.ok(item.barcode);
    assert.ok(item.price > item.costPrice);
    if (item.stock <= item.lowStockLevel) lowStockCount += 1;
    if (item.expiryDate) nearExpiryCount += 1;
  }

  assert.ok(lowStockCount >= 3);
  assert.ok(nearExpiryCount >= 2);
});

test("demo rate limiter blocks requests exceeding max", () => {
  const limiter = createRateLimiter({
    windowMs: 60000,
    max: 2,
    message: "Too many demo requests",
  });

  const makeRes = () => {
    const res = { statusCode: 200, headers: {}, body: null };
    res.setHeader = (k, v) => { res.headers[k] = v; };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => { res.body = data; return res; };
    return res;
  };

  let nextCount = 0;
  limiter({ ip: "1.2.3.4" }, makeRes(), () => { nextCount += 1; });
  limiter({ ip: "1.2.3.4" }, makeRes(), () => { nextCount += 1; });
  const thirdRes = makeRes();
  limiter({ ip: "1.2.3.4" }, thirdRes, () => { nextCount += 1; });

  assert.equal(nextCount, 2);
  assert.equal(thirdRes.statusCode, 429);
  assert.equal(thirdRes.body.message, "Too many demo requests");
});
