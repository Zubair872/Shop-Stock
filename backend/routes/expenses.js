import { Router } from "express";
import mongoose from "mongoose";
import Expense from "../models/Expense.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText, parseNumber, roundMoney } from "../utils/validate.js";
import { localDateKey } from "../utils/dates.js";
import { serializeExpense } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const CATEGORIES = new Set(["kiraya", "bijli", "tankhwah", "transport", "other"]);
const MAX_EXPENSE = 50_000_000;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { user: req.accountId };
    if (req.query.category && CATEGORIES.has(req.query.category)) {
      filter.category = req.query.category;
    }
    const from = cleanText(req.query.from, 10);
    const to = cleanText(req.query.to, 10);
    if (from || to) {
      filter.dateKey = {};
      if (from) filter.dateKey.$gte = from;
      if (to) filter.dateKey.$lte = to;
    }

    const expenses = await Expense.find(filter)
      .sort({ dateKey: -1, createdAt: -1 })
      .limit(300)
      .lean();

    let total = 0;
    for (const e of expenses) {
      total += e.amount;
    }

    res.json({
      total: roundMoney(total),
      expenses: expenses.map(serializeExpense),
    });
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    const category = CATEGORIES.has(req.body.category) ? req.body.category : "other";
    const amount = parseNumber(req.body.amount, { min: 0.01, max: MAX_EXPENSE });
    const note = cleanText(req.body.note, 300);
    const rawDate = cleanText(req.body.dateKey, 10);
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : localDateKey(new Date(), env.timezone);

    if (amount === null) {
      return res.status(400).json({ message: "Kharche ki raqam 0 se zyada likhein" });
    }

    const expense = await Expense.create({
      user: req.accountId,
      category,
      amount: roundMoney(amount),
      note,
      dateKey,
      recordedBy: req.userId,
    });

    res.status(201).json(serializeExpense(expense));
  })
);

router.delete(
  "/:id",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Kharcha id sahi nahi hai" });
    }

    const deleted = await Expense.findOneAndDelete({
      _id: req.params.id,
      user: req.accountId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Kharcha nahi mila" });
    }

    res.json({ ok: true });
  })
);

export default router;
