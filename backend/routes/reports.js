import { Router } from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseDayBoundary, localDateTime, localDateKey } from "../utils/dates.js";
import { toCsv } from "../utils/csv.js";
import { serializeProduct } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const MAX_ROWS = 20000;

function sendCsv(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get(
  "/orders.csv",
  asyncHandler(async (req, res) => {
    const filter = { user: req.accountId };

    const from = parseDayBoundary(req.query.from, env.timezone);
    const to = parseDayBoundary(req.query.to, env.timezone, { end: true });
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lt = to;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();

    const csv = toCsv(orders, [
      { header: "Order ID", value: (o) => String(o._id) },
      { header: "Date", value: (o) => localDateTime(o.createdAt, env.timezone) },
      { header: "Status", value: (o) => o.status },
      { header: "Customer", value: (o) => o.customerName || "" },
      { header: "Phone", value: (o) => o.customerPhone || "" },
      { header: "Payment", value: (o) => o.paymentMethod || "cash" },
      {
        header: "Items",
        value: (o) => o.items.map((i) => `${i.name} x${i.qty} ${i.unit || "pcs"}`).join("; "),
      },
      { header: "Subtotal", value: (o) => o.subtotal ?? o.total },
      { header: "Discount", value: (o) => o.discount ?? 0 },
      { header: "Total", value: (o) => o.total },
      { header: "Cost", value: (o) => o.costTotal ?? 0 },
      {
        header: "Profit",
        value: (o) => (o.status === "completed" ? o.total - (o.costTotal ?? 0) : 0),
      },
    ]);

    sendCsv(res, `orders-${localDateKey(new Date(), env.timezone)}.csv`, csv);
  })
);

router.get(
  "/products.csv",
  asyncHandler(async (req, res) => {
    const products = await Product.find({ user: req.accountId, isActive: true })
      .sort({ name: 1 })
      .limit(MAX_ROWS)
      .lean();

    const csv = toCsv(products.map(serializeProduct), [
      { header: "Name", value: (p) => p.name },
      { header: "Category", value: (p) => p.category },
      { header: "Unit", value: (p) => p.unit },
      { header: "Price", value: (p) => p.price },
      { header: "Cost price", value: (p) => p.costPrice },
      { header: "Stock", value: (p) => p.stock },
      { header: "Low stock level", value: (p) => p.lowStockLevel },
      { header: "Stock status", value: (p) => p.stockStatus },
      { header: "Expiry", value: (p) => (p.expiryDate ? localDateKey(new Date(p.expiryDate), env.timezone) : "") },
      { header: "Stock value (cost)", value: (p) => Math.round(p.stock * p.costPrice * 100) / 100 },
    ]);

    sendCsv(res, `products-${localDateKey(new Date(), env.timezone)}.csv`, csv);
  })
);

export default router;
