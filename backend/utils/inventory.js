// Stock aur expiry ki halat ek hi jagah tay hoti hai taake backend aur frontend mein farq na aaye.

const DAY_MS = 24 * 60 * 60 * 1000;

export function stockStatus(product) {
  const stock = product.stock ?? 0;
  const level = product.lowStockLevel ?? 5;
  if (stock <= 0) return "out";
  if (stock < level) return "low";
  return "ok";
}

export function expiryStatus(product, now = new Date(), warningDays = 3) {
  if (!product.expiryDate) return null;
  const expiry = new Date(product.expiryDate).getTime();
  if (Number.isNaN(expiry)) return null;

  const diff = expiry - now.getTime();
  if (diff < 0) return "expired";
  if (diff <= warningDays * DAY_MS) return "soon";
  return "ok";
}
