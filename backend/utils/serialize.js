export function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    shopName: user.shopName || "",
  };
}

export function serializeProduct(product) {
  return {
    id: String(product._id),
    name: product.name,
    category: product.category,
    price: product.price,
    costPrice: product.costPrice ?? 0,
    stock: product.stock,
    lowStockLevel: product.lowStockLevel ?? 5,
    unit: product.unit || "pcs",
    expiryDate: product.expiryDate || null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

export function serializeOrder(order) {
  return {
    id: String(order._id),
    items: order.items.map((item) => ({
      id: String(item.product),
      name: item.name,
      category: item.category || "",
      price: item.price,
      qty: item.qty,
    })),
    total: order.total,
    customerName: order.customerName || "",
    customerPhone: order.customerPhone || "",
    status: order.status,
    date: order.createdAt,
  };
}
