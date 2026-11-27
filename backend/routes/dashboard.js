import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import Expense from "../models/Expense.js";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { roundMoney } from "../utils/validate.js";
import { roundQty } from "../utils/units.js";
import { startOfDaysAgo, dayKeys, localDateKey } from "../utils/dates.js";
import { serializeProduct } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const RANGES = { today: 1, "7d": 7, "30d": 30, "90d": 90, all: null };

function summaryStage() {
  return {
    $group: {
      _id: null,
      orders: { $sum: 1 },
      revenue: { $sum: "$total" },
      discount: { $sum: { $ifNull: ["$discount", 0] } },
      cost: { $sum: { $ifNull: ["$costTotal", 0] } },
    },
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const range = Object.hasOwn(RANGES, req.query.range) ? req.query.range : "7d";
    const days = RANGES[range];
    const userId = new mongoose.Types.ObjectId(req.accountId);
    const now = new Date();

    const rangeStart = days ? startOfDaysAgo(days, env.timezone, now) : null;
    const todayStart = startOfDaysAgo(1, env.timezone, now);

    // Chart hamesha kam az kam 7 din (aur zyada se zyada 90) dikhata hai
    const chartDays = Math.min(Math.max(days || 30, 7), 90);
    const chartStart = startOfDaysAgo(chartDays, env.timezone, now);

    const baseMatch = { user: userId, status: "completed" };
    const rangeMatch = rangeStart ? { ...baseMatch, createdAt: { $gte: rangeStart } } : baseMatch;
    const todayKey = localDateKey(now, env.timezone);
    const rangeStartKey = rangeStart ? localDateKey(rangeStart, env.timezone) : null;
    const expenseRangeMatch = rangeStartKey
      ? { user: userId, dateKey: { $gte: rangeStartKey } }
      : { user: userId };

    const [rangeFacet, todayAgg, dailyAgg, products, rangeExpenseAgg, todayExpenseAgg] = await Promise.all([
      Order.aggregate([
        { $match: rangeMatch },
        {
          $facet: {
            summary: [summaryStage()],
            payments: [
              {
                $group: {
                  _id: { $ifNull: ["$paymentMethod", "cash"] },
                  orders: { $sum: 1 },
                  revenue: { $sum: "$total" },
                },
              },
              { $sort: { revenue: -1 } },
            ],
            top: [
              { $unwind: "$items" },
              {
                $group: {
                  _id: "$items.product",
                  name: { $last: "$items.name" },
                  unit: { $last: { $ifNull: ["$items.unit", "pcs"] } },
                  qty: { $sum: "$items.qty" },
                  sales: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
                },
              },
              { $sort: { sales: -1 } },
              { $limit: 20 },
            ],
          },
        },
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, createdAt: { $gte: todayStart } } },
        summaryStage(),
      ]),
      Order.aggregate([
        { $match: { ...baseMatch, createdAt: { $gte: chartStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: env.timezone },
            },
            orders: { $sum: 1 },
            revenue: { $sum: "$total" },
            cost: { $sum: { $ifNull: ["$costTotal", 0] } },
          },
        },
      ]),
      Product.find({ user: req.accountId, isActive: true }).lean(),
      Expense.aggregate([
        { $match: expenseRangeMatch },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Expense.aggregate([
        { $match: { user: userId, dateKey: todayKey } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const facet = rangeFacet[0] || { summary: [], payments: [], top: [] };
    const s = facet.summary[0] || { orders: 0, revenue: 0, discount: 0, cost: 0 };
    const t = todayAgg[0] || { orders: 0, revenue: 0, cost: 0 };
    const rangeExpenses = roundMoney(rangeExpenseAgg[0]?.total || 0);
    const todayExpenses = roundMoney(todayExpenseAgg[0]?.total || 0);

    const dailyMap = new Map(dailyAgg.map((row) => [row._id, row]));
    const daily = dayKeys(chartDays, env.timezone, now).map((date) => {
      const row = dailyMap.get(date);
      return {
        date,
        orders: row?.orders || 0,
        revenue: roundMoney(row?.revenue || 0),
        profit: roundMoney((row?.revenue || 0) - (row?.cost || 0)),
      };
    });

    const topProducts = facet.top.slice(0, 5).map((row) => ({
      id: String(row._id),
      name: row.name,
      unit: row.unit,
      qty: roundQty(row.qty),
      sales: roundMoney(row.sales),
    }));

    let bestSeller = null;
    for (const row of facet.top) {
      if (!bestSeller || row.qty > bestSeller.qty) {
        bestSeller = { name: row.name, qty: roundQty(row.qty), unit: row.unit };
      }
    }

    const serialized = products.map(serializeProduct);
    const lowStockItems = serialized.filter((p) => p.stockStatus === "low");
    const outOfStockItems = serialized.filter((p) => p.stockStatus === "out");
    const expiringItems = serialized.filter(
      (p) => p.expiryStatus === "soon" || p.expiryStatus === "expired"
    );

    let stockCostValue = 0;
    let stockRetailValue = 0;
    for (const p of serialized) {
      stockCostValue += p.stock * p.costPrice;
      stockRetailValue += p.stock * p.price;
    }

    res.json({
      range,
      timezone: env.timezone,
      today: {
        orders: t.orders,
        revenue: roundMoney(t.revenue),
        profit: roundMoney(t.revenue - t.cost),
        expenses: todayExpenses,
        netProfit: roundMoney(t.revenue - t.cost - todayExpenses),
      },
      summary: {
        orders: s.orders,
        revenue: roundMoney(s.revenue),
        discount: roundMoney(s.discount),
        profit: roundMoney(s.revenue - s.cost),
        expenses: rangeExpenses,
        netProfit: roundMoney(s.revenue - s.cost - rangeExpenses),
        averageOrder: s.orders > 0 ? roundMoney(s.revenue / s.orders) : 0,
      },
      daily,
      topProducts,
      bestSeller,
      payments: facet.payments.map((row) => ({
        method: row._id,
        orders: row.orders,
        revenue: roundMoney(row.revenue),
      })),
      inventory: {
        products: serialized.length,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
        stockCostValue: roundMoney(stockCostValue),
        stockRetailValue: roundMoney(stockRetailValue),
        missingCostCount: serialized.filter((p) => !p.costPrice).length,
      },
      lowStockItems,
      outOfStockItems,
      expiringItems,
    });
  })
);

export default router;
