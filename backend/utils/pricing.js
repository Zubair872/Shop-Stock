import { roundMoney } from "./validate.js";

export function lineTotal(price, qty) {
  return roundMoney(price * qty);
}

// items: [{ price, costPrice, qty }]. Price hamesha database se aati hai, client se nahi.
export function computeTotals(items, discount = 0) {
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + lineTotal(item.price, item.qty), 0)
  );
  const costTotal = roundMoney(
    items.reduce((sum, item) => sum + lineTotal(item.costPrice || 0, item.qty), 0)
  );

  const requested = Math.max(Number(discount) || 0, 0);
  const applied = Math.min(requested, subtotal);

  return {
    subtotal,
    discount: roundMoney(applied),
    total: roundMoney(subtotal - applied),
    costTotal,
    discountTooHigh: requested > subtotal,
  };
}
