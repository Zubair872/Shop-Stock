import { env } from "../config/env.js";
import { roundQty } from "./units.js";
import { roundMoney } from "./validate.js";
import { stockStatus, expiryStatus } from "./inventory.js";

export function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    shopName: user.shopName || "",
    role: user.role || "owner",
    accountId: String(user.accountId || user._id),
    plan: user.plan || "paid",
    status: user.status || "active",
    trialEndsAt: user.trialEndsAt || null,
    expiresAt: user.expiresAt || null,
    isDemo: Boolean(user.isDemo),
    demoExpiresAt: user.demoExpiresAt || null,
  };
}

export function serializeProduct(product) {
  return {
    id: String(product._id),
    name: product.name,
    category: product.category,
    price: product.price,
    costPrice: product.costPrice ?? 0,
    stock: roundQty(product.stock ?? 0),
    lowStockLevel: product.lowStockLevel ?? 5,
    unit: product.unit || "pcs",
    expiryDate: product.expiryDate || null,
    barcode: product.barcode || "",
    stockStatus: stockStatus(product),
    expiryStatus: expiryStatus(product, new Date(), env.expiryWarningDays),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function serializeOrder(order) {
  const subtotal = order.subtotal ?? order.total;
  return {
    id: String(order._id),
    items: order.items.map((item) => ({
      id: String(item.product),
      name: item.name,
      category: item.category || "",
      unit: item.unit || "pcs",
      price: item.price,
      qty: item.qty,
    })),
    subtotal,
    discount: order.discount ?? 0,
    total: order.total,
    paymentMethod: order.paymentMethod || "cash",
    customerId: order.customer ? String(order.customer) : null,
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    note: order.note || "",
    status: order.status,
    cancelledAt: order.cancelledAt || null,
    cancelReason: order.cancelReason || "",
    date: order.createdAt,
  };
}

export function serializeMovement(movement) {
  return {
    id: String(movement._id),
    type: movement.type,
    quantity: roundQty(movement.quantity),
    stockAfter: roundQty(movement.stockAfter),
    note: movement.note || "",
    orderId: movement.order ? String(movement.order) : null,
    date: movement.createdAt,
  };
}

export function serializeCustomer(customer) {
  return {
    id: String(customer._id),
    name: customer.name,
    phone: customer.phone,
    creditLimit: roundMoney(customer.creditLimit ?? 0),
    balance: roundMoney(customer.balance ?? 0),
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

export function serializeLedgerEntry(entry) {
  return {
    id: String(entry._id),
    customerId: String(entry.customer),
    type: entry.type,
    amount: roundMoney(entry.amount),
    delta: roundMoney(entry.delta),
    balanceAfter: roundMoney(entry.balanceAfter),
    orderId: entry.order ? String(entry.order) : null,
    reversedEntryId: entry.reversedEntry ? String(entry.reversedEntry) : null,
    isReversed: Boolean(entry.isReversed),
    note: entry.note || "",
    date: entry.createdAt,
  };
}

export function serializeSupplier(supplier) {
  return {
    id: String(supplier._id),
    name: supplier.name,
    phone: supplier.phone || "",
    address: supplier.address || "",
    balance: roundMoney(supplier.balance ?? 0),
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  };
}

export function serializeSupplierLedgerEntry(entry) {
  return {
    id: String(entry._id),
    supplierId: String(entry.supplier),
    type: entry.type,
    amount: roundMoney(entry.amount),
    delta: roundMoney(entry.delta),
    balanceAfter: roundMoney(entry.balanceAfter),
    purchaseId: entry.purchase ? String(entry.purchase) : null,
    note: entry.note || "",
    date: entry.createdAt,
  };
}

export function serializePurchase(purchase) {
  return {
    id: String(purchase._id),
    supplierId: String(purchase.supplier),
    supplierName: purchase.supplierName || "",
    items: (purchase.items || []).map((item) => ({
      productId: item.product ? String(item.product) : null,
      name: item.name,
      unit: item.unit || "pcs",
      qty: roundQty(item.qty),
      costPrice: roundMoney(item.costPrice),
    })),
    total: roundMoney(purchase.total),
    paid: roundMoney(purchase.paid ?? 0),
    due: roundMoney(Math.max(0, purchase.total - (purchase.paid ?? 0))),
    note: purchase.note || "",
    addToStock: Boolean(purchase.addToStock),
    date: purchase.createdAt,
  };
}

export function serializeExpense(expense) {
  return {
    id: String(expense._id),
    category: expense.category,
    amount: roundMoney(expense.amount),
    note: expense.note || "",
    dateKey: expense.dateKey,
    date: expense.createdAt,
  };
}
