import { env } from "../config/env.js";
import { roundQty } from "./units.js";
import { stockStatus, expiryStatus } from "./inventory.js";

export function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    shopName: user.shopName || "",
    role: user.role || "owner",
    accountId: String(user.accountId || user._id),
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
