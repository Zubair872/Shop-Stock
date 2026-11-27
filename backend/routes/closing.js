import { Router } from "express";
import mongoose from "mongoose";
import Order from "../models/Order.js";
import DailyClosing from "../models/DailyClosing.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { roundMoney } from "../utils/validate.js";
import { parseDayBoundary, localDateKey } from "../utils/dates.js";
import { cleanText } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const dateKey = req.query.date || localDateKey(new Date(), env.timezone);

    const dayStart = parseDayBoundary(dateKey, env.timezone);
    const dayEnd = parseDayBoundary(dateKey, env.timezone, { end: true });

    const userId = new mongoose.Types.ObjectId(req.accountId);

    const [agg, existing] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            user: userId,
            status: "completed",
            createdAt: { $gte: dayStart, $lt: dayEnd },
          },
        },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            totalRevenue: { $sum: "$total" },
            cashRevenue: {
              $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$total", 0] },
            },
            cardRevenue: {
              $sum: { $cond: [{ $eq: ["$paymentMethod", "card"] }, "$total", 0] },
            },
            walletRevenue: {
              $sum: { $cond: [{ $eq: ["$paymentMethod", "wallet"] }, "$total", 0] },
            },
            udhaarRevenue: {
              $sum: { $cond: [{ $eq: ["$paymentMethod", "udhaar"] }, "$total", 0] },
            },
            totalCost: { $sum: { $ifNull: ["$costTotal", 0] } },
            totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
          },
        },
      ]),
      DailyClosing.findOne({ user: req.accountId, dateKey }).lean(),
    ]);

    const s = agg[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      cashRevenue: 0,
      cardRevenue: 0,
      walletRevenue: 0,
      udhaarRevenue: 0,
      totalCost: 0,
      totalDiscount: 0,
    };

    res.json({
      dateKey,
      isClosed: !!existing,
      closedAt: existing?.createdAt || null,
      note: existing?.note || "",
      summary: {
        totalOrders: s.totalOrders,
        totalRevenue: roundMoney(s.totalRevenue),
        cashRevenue: roundMoney(s.cashRevenue),
        cardRevenue: roundMoney(s.cardRevenue),
        walletRevenue: roundMoney(s.walletRevenue),
        udhaarRevenue: roundMoney(s.udhaarRevenue),
        totalProfit: roundMoney(s.totalRevenue - s.totalCost),
        totalDiscount: roundMoney(s.totalDiscount),
      },
    });
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    const dateKey = req.body.dateKey || localDateKey(new Date(), env.timezone);
    const note = cleanText(req.body.note, 500) || "";

    const dayStart = parseDayBoundary(dateKey, env.timezone);
    const dayEnd = parseDayBoundary(dateKey, env.timezone, { end: true });

    const userId = new mongoose.Types.ObjectId(req.accountId);

    const agg = await Order.aggregate([
      {
        $match: {
          user: userId,
          status: "completed",
          createdAt: { $gte: dayStart, $lt: dayEnd },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          cashRevenue: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "cash"] }, "$total", 0] },
          },
          cardRevenue: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "card"] }, "$total", 0] },
          },
          walletRevenue: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "wallet"] }, "$total", 0] },
          },
          udhaarRevenue: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "udhaar"] }, "$total", 0] },
          },
          totalCost: { $sum: { $ifNull: ["$costTotal", 0] } },
          totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
        },
      },
    ]);

    const s = agg[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      cashRevenue: 0,
      cardRevenue: 0,
      walletRevenue: 0,
      udhaarRevenue: 0,
      totalCost: 0,
      totalDiscount: 0,
    };

    const closing = await DailyClosing.findOneAndUpdate(
      { user: req.accountId, dateKey },
      {
        $set: {
          totalOrders: s.totalOrders,
          totalRevenue: roundMoney(s.totalRevenue),
          cashRevenue: roundMoney(s.cashRevenue),
          cardRevenue: roundMoney(s.cardRevenue),
          walletRevenue: roundMoney(s.walletRevenue),
          udhaarRevenue: roundMoney(s.udhaarRevenue),
          totalProfit: roundMoney(s.totalRevenue - s.totalCost),
          totalDiscount: roundMoney(s.totalDiscount),
          note,
          closedBy: req.userId,
        },
      },
      { upsert: true, new: true }
    );

    res.status(201).json({
      dateKey: closing.dateKey,
      isClosed: true,
      closedAt: closing.createdAt,
      note: closing.note,
      summary: {
        totalOrders: closing.totalOrders,
        totalRevenue: closing.totalRevenue,
        cashRevenue: closing.cashRevenue,
        cardRevenue: closing.cardRevenue,
        walletRevenue: closing.walletRevenue,
        udhaarRevenue: closing.udhaarRevenue,
        totalProfit: closing.totalProfit,
        totalDiscount: closing.totalDiscount,
      },
    });
  })
);

router.get(
  "/history",
  asyncHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 30, 90);
    const closings = await DailyClosing.find({ user: req.accountId })
      .sort({ dateKey: -1 })
      .limit(limit)
      .lean();

    res.json(
      closings.map((c) => ({
        dateKey: c.dateKey,
        isClosed: true,
        closedAt: c.createdAt,
        note: c.note,
        summary: {
          totalOrders: c.totalOrders,
          totalRevenue: c.totalRevenue,
          cashRevenue: c.cashRevenue,
          cardRevenue: c.cardRevenue,
          walletRevenue: c.walletRevenue,
          udhaarRevenue: c.udhaarRevenue,
          totalProfit: c.totalProfit,
          totalDiscount: c.totalDiscount,
        },
      }))
    );
  })
);

export default router;
