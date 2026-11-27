import { openDB } from "idb";

const DB_NAME = "shopstock_offline";
const DB_VERSION = 1;

function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("products")) {
        db.createObjectStore("products", { keyPath: "accountId" });
      }
      if (!db.objectStoreNames.contains("orderQueue")) {
        const store = db.createObjectStore("orderQueue", { keyPath: "idempotencyKey" });
        store.createIndex("byAccount", "accountId");
      }
    },
  });
}

export async function saveCachedProducts(accountId, items) {
  if (!accountId) return;
  const db = await getDb();
  const plainItems = JSON.parse(JSON.stringify(items || []));
  await db.put("products", {
    accountId,
    items: plainItems,
    updatedAt: new Date().toISOString(),
  });
}

export async function getCachedProducts(accountId) {
  if (!accountId) return [];
  const db = await getDb();
  const record = await db.get("products", accountId);
  return record?.items || [];
}

export async function enqueueOrder(record) {
  const db = await getDb();
  const plain = JSON.parse(JSON.stringify(record));
  await db.put("orderQueue", plain);
}

export async function getOrders(accountId) {
  if (!accountId) return [];
  const db = await getDb();
  const list = await db.getAllFromIndex("orderQueue", "byAccount", accountId);
  return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function updateOrder(idempotencyKey, patch) {
  const db = await getDb();
  const existing = await db.get("orderQueue", idempotencyKey);
  if (!existing) return;
  await db.put("orderQueue", { ...existing, ...patch });
}

export async function removeOrder(idempotencyKey) {
  const db = await getDb();
  await db.delete("orderQueue", idempotencyKey);
}

export const offlineDbStore = {
  getOrders,
  updateOrder,
  removeOrder,
};
