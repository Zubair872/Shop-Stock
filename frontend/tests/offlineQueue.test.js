import test from "node:test";
import assert from "node:assert/strict";
import {
  applyLocalStockDeduction,
  buildOfflineOrderRecord,
  toReceiptOrder,
  syncOrderQueue,
} from "../src/services/offlineQueue.js";

function createMemoryStore(initial = []) {
  const map = new Map(initial.map((item) => [item.idempotencyKey, { ...item }]));
  return {
    async getOrders(accountId) {
      return [...map.values()].filter((o) => o.accountId === accountId);
    },
    async updateOrder(idempotencyKey, patch) {
      const existing = map.get(idempotencyKey);
      if (existing) map.set(idempotencyKey, { ...existing, ...patch });
    },
    async removeOrder(idempotencyKey) {
      map.delete(idempotencyKey);
    },
    size() {
      return map.size;
    },
    get(idempotencyKey) {
      return map.get(idempotencyKey);
    },
  };
}

test("applyLocalStockDeduction deducts sold quantities without going negative", () => {
  const products = [
    { id: "p1", name: "Atta", stock: 10 },
    { id: "p2", name: "Cheeni", stock: 1.5 },
    { id: "p3", name: "Chai", stock: 5 },
  ];
  const updated = applyLocalStockDeduction(products, [
    { id: "p1", qty: 3 },
    { id: "p2", qty: 2 },
  ]);
  assert.equal(updated[0].stock, 7);
  assert.equal(updated[1].stock, 0);
  assert.equal(updated[2].stock, 5);
});

test("buildOfflineOrderRecord and toReceiptOrder compute totals and keep idempotencyKey", () => {
  const record = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [
      { id: "p1", name: "Atta", unit: "kg", price: 150, qty: 2 },
      { id: "p2", name: "Chai", unit: "pcs", price: 200, qty: 1 },
    ],
    details: { paymentMethod: "cash", discount: 50, customerName: "Ali" },
    idempotencyKey: "key-123",
    createdAt: "2026-11-27T00:00:00.000Z",
  });

  assert.equal(record.idempotencyKey, "key-123");
  assert.equal(record.subtotal, 500);
  assert.equal(record.discount, 50);
  assert.equal(record.total, 450);
  assert.equal(record.status, "pending");

  const receipt = toReceiptOrder(record);
  assert.equal(receipt.id, "key-123");
  assert.equal(receipt.offline, true);
  assert.equal(receipt.total, 450);
});

test("syncOrderQueue syncs pending orders in FIFO order with Idempotency-Key", async () => {
  const o1 = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [{ id: "p1", name: "Atta", price: 100, qty: 1 }],
    details: { paymentMethod: "cash" },
    idempotencyKey: "k1",
    createdAt: "2026-11-27T01:00:00.000Z",
  });
  const o2 = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [{ id: "p2", name: "Chai", price: 200, qty: 1 }],
    details: { paymentMethod: "card" },
    idempotencyKey: "k2",
    createdAt: "2026-11-27T02:00:00.000Z",
  });

  const store = createMemoryStore([o2, o1]);
  const sentKeys = [];

  const result = await syncOrderQueue({
    accountId: "acc1",
    store,
    submitOrder: async (_items, _details, key) => {
      sentKeys.push(key);
    },
    extractError: (e) => e.message,
  });

  assert.deepEqual(sentKeys, ["k1", "k2"]);
  assert.equal(result.syncedCount, 2);
  assert.equal(result.conflictCount, 0);
  assert.equal(result.networkStopped, false);
  assert.equal(store.size(), 0);
});

test("syncOrderQueue marks 409 stock conflict and continues syncing remaining orders", async () => {
  const o1 = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [{ id: "p1", name: "Atta", price: 100, qty: 5 }],
    details: { paymentMethod: "cash" },
    idempotencyKey: "k-conflict",
    createdAt: "2026-11-27T01:00:00.000Z",
  });
  const o2 = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [{ id: "p2", name: "Chai", price: 200, qty: 1 }],
    details: { paymentMethod: "cash" },
    idempotencyKey: "k-ok",
    createdAt: "2026-11-27T02:00:00.000Z",
  });

  const store = createMemoryStore([o1, o2]);

  const result = await syncOrderQueue({
    accountId: "acc1",
    store,
    submitOrder: async (_items, _details, key) => {
      if (key === "k-conflict") {
        const err = new Error("Conflict");
        err.response = { status: 409, data: { message: "Atta ka stock kaafi nahi hai" } };
        throw err;
      }
    },
    extractError: (err) => err.response?.data?.message || err.message,
  });

  assert.equal(result.syncedCount, 1);
  assert.equal(result.conflictCount, 1);
  assert.equal(result.networkStopped, false);
  assert.equal(store.get("k-ok"), undefined);
  assert.equal(store.get("k-conflict").status, "conflict");
  assert.equal(store.get("k-conflict").error, "Atta ka stock kaafi nahi hai");
});

test("syncOrderQueue stops on network error and leaves remaining orders pending", async () => {
  const o1 = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [{ id: "p1", name: "Atta", price: 100, qty: 1 }],
    details: { paymentMethod: "cash" },
    idempotencyKey: "k1",
    createdAt: "2026-11-27T01:00:00.000Z",
  });
  const o2 = buildOfflineOrderRecord({
    accountId: "acc1",
    cartItems: [{ id: "p2", name: "Chai", price: 200, qty: 1 }],
    details: { paymentMethod: "cash" },
    idempotencyKey: "k2",
    createdAt: "2026-11-27T02:00:00.000Z",
  });

  const store = createMemoryStore([o1, o2]);

  const result = await syncOrderQueue({
    accountId: "acc1",
    store,
    submitOrder: async (_items, _details, key) => {
      if (key === "k2") {
        throw new Error("Network Error");
      }
    },
    extractError: (err) => err.message,
  });

  assert.equal(result.syncedCount, 1);
  assert.equal(result.conflictCount, 0);
  assert.equal(result.networkStopped, true);
  assert.equal(store.get("k1"), undefined);
  assert.equal(store.get("k2").status, "pending");
});
