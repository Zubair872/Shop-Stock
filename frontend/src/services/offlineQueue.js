export function applyLocalStockDeduction(products, cartItems) {
  const qtyById = new Map();
  for (const item of cartItems) {
    qtyById.set(item.id, (qtyById.get(item.id) || 0) + Number(item.qty || 0));
  }
  return products.map((p) => {
    const sold = qtyById.get(p.id);
    if (!sold) return p;
    const nextStock = Math.max(0, Math.round((Number(p.stock) - sold) * 1000) / 1000);
    return { ...p, stock: nextStock };
  });
}

export function buildOfflineOrderRecord({
  accountId,
  cartItems,
  details,
  idempotencyKey,
  createdAt = new Date().toISOString(),
}) {
  const items = cartItems.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category || "",
    unit: item.unit || "pcs",
    price: Number(item.price),
    qty: Number(item.qty),
  }));
  const subtotal = Math.round(
    items.reduce((sum, item) => sum + item.price * item.qty, 0) * 100
  ) / 100;
  const discount = Math.max(Number(details?.discount) || 0, 0);
  const total = Math.max(subtotal - discount, 0);

  return {
    idempotencyKey,
    accountId,
    items,
    details: {
      customerId: details?.customerId || "",
      customerName: details?.customerName || "",
      customerPhone: details?.customerPhone || "",
      paymentMethod: details?.paymentMethod || "cash",
      discount,
    },
    subtotal,
    discount,
    total,
    status: "pending",
    error: "",
    createdAt,
  };
}

export function toReceiptOrder(record) {
  return {
    id: record.idempotencyKey,
    items: record.items,
    subtotal: record.subtotal,
    discount: record.discount,
    total: record.total,
    paymentMethod: record.details.paymentMethod,
    customerName: record.details.customerName,
    customerPhone: record.details.customerPhone,
    createdAt: record.createdAt,
    offline: true,
  };
}

export async function syncOrderQueue({
  accountId,
  store,
  submitOrder,
  extractError,
}) {
  const all = await store.getOrders(accountId);
  const pending = all
    .filter((o) => o.status === "pending")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let syncedCount = 0;
  let conflictCount = 0;
  let networkStopped = false;

  for (const entry of pending) {
    try {
      await submitOrder(entry.items, entry.details, entry.idempotencyKey);
      await store.removeOrder(entry.idempotencyKey);
      syncedCount += 1;
    } catch (err) {
      const status = err?.response?.status;
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        status !== 401 &&
        status !== 408 &&
        status !== 429
      ) {
        await store.updateOrder(entry.idempotencyKey, {
          status: "conflict",
          error: extractError(err),
        });
        conflictCount += 1;
        continue;
      }
      networkStopped = true;
      break;
    }
  }

  return { syncedCount, conflictCount, networkStopped };
}
