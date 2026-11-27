import { roundMoney } from "./validate.js";

export function checkCreditLimit(currentBalance, creditLimit, saleAmount) {
  const balance = roundMoney(Number(currentBalance) || 0);
  const limit = roundMoney(Number(creditLimit) || 0);
  const amount = roundMoney(Number(saleAmount) || 0);
  const nextBalance = roundMoney(balance + amount);
  const allowed = nextBalance <= limit;
  const exceededBy = allowed ? 0 : roundMoney(nextBalance - limit);
  return { allowed, nextBalance, exceededBy };
}

export function applyPayment(currentBalance, paymentAmount) {
  const balance = roundMoney(Number(currentBalance) || 0);
  const amount = roundMoney(Number(paymentAmount) || 0);
  if (amount <= 0) {
    return { ok: false, message: "Wapsi raqam 0 se zyada honi chahiye" };
  }
  if (amount > balance) {
    return { ok: false, message: "Wapsi raqam mojooda udhaar se zyada nahi ho sakti" };
  }
  return { ok: true, nextBalance: roundMoney(balance - amount) };
}

export function applyReversal(currentBalance, delta) {
  return roundMoney(Math.max(0, (Number(currentBalance) || 0) + (Number(delta) || 0)));
}
