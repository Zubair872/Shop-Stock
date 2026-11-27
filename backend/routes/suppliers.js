import { Router } from "express";
import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";
import SupplierLedgerEntry from "../models/SupplierLedgerEntry.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText, parseNumber, roundMoney, escapeRegex } from "../utils/validate.js";
import { serializeSupplier, serializeSupplierLedgerEntry } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const MAX_AMOUNT = 50_000_000;

function checkId(id, res) {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Supplier ki id sahi nahi hai" });
    return false;
  }
  return true;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { user: req.accountId, isActive: true };
    const q = cleanText(req.query.q, 60);
    if (q) {
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: pattern }, { phone: pattern }];
    }
    if (req.query.onlyDue === "true") {
      filter.balance = { $gt: 0 };
    }

    const suppliers = await Supplier.find(filter)
      .sort({ balance: -1, name: 1 })
      .lean();

    res.json(suppliers.map(serializeSupplier));
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body.name, 150);
    const phone = cleanText(req.body.phone, 30);
    const address = cleanText(req.body.address, 200);

    if (!name) {
      return res.status(400).json({ message: "Supplier ka naam likhein" });
    }

    const supplier = await Supplier.create({
      user: req.accountId,
      name,
      phone,
      address,
      balance: 0,
    });

    res.status(201).json(serializeSupplier(supplier));
  })
);

router.put(
  "/:id",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;

    const updates = {};
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 150);
      if (!name) return res.status(400).json({ message: "Supplier ka naam likhein" });
      updates.name = name;
    }
    if (req.body.phone !== undefined) {
      updates.phone = cleanText(req.body.phone, 30);
    }
    if (req.body.address !== undefined) {
      updates.address = cleanText(req.body.address, 200);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Badalne ke liye kuch nahi mila" });
    }

    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, user: req.accountId, isActive: true },
      { $set: updates },
      { new: true }
    );

    if (!supplier) {
      return res.status(404).json({ message: "Supplier nahi mila" });
    }

    res.json(serializeSupplier(supplier));
  })
);

router.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;

    const supplier = await Supplier.findOne({
      _id: req.params.id,
      user: req.accountId,
      isActive: true,
    }).lean();

    if (!supplier) {
      return res.status(404).json({ message: "Supplier nahi mila" });
    }

    const entries = await SupplierLedgerEntry.find({
      user: req.accountId,
      supplier: supplier._id,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({
      supplier: serializeSupplier(supplier),
      entries: entries.map(serializeSupplierLedgerEntry),
    });
  })
);

router.post(
  "/:id/payments",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;

    const amount = parseNumber(req.body.amount, { min: 0.01, max: MAX_AMOUNT });
    if (amount === null) {
      return res.status(400).json({ message: "Payment raqam 0 se zyada likhein" });
    }

    const cleanAmount = roundMoney(amount);
    const note = cleanText(req.body.note, 300) || "Supplier ko adaigi";

    const session = await mongoose.startSession();
    let result = null;
    let errorStatus = null;
    let errorMsg = null;

    try {
      await session.withTransaction(async () => {
        const supplier = await Supplier.findOne({
          _id: req.params.id,
          user: req.accountId,
          isActive: true,
        }).session(session);

        if (!supplier) {
          errorStatus = 404;
          errorMsg = "Supplier nahi mila";
          return;
        }

        if (cleanAmount > roundMoney(supplier.balance) + 0.001) {
          errorStatus = 400;
          errorMsg = `Baqi raqam Rs. ${roundMoney(supplier.balance)} se zyada adaigi nahi ho sakti`;
          return;
        }

        supplier.balance = Math.max(0, roundMoney(supplier.balance - cleanAmount));
        await supplier.save({ session });

        const [entry] = await SupplierLedgerEntry.create(
          [
            {
              user: req.accountId,
              supplier: supplier._id,
              type: "payment",
              amount: cleanAmount,
              delta: -cleanAmount,
              balanceAfter: supplier.balance,
              note,
              createdBy: req.userId,
            },
          ],
          { session }
        );

        result = {
          supplier: serializeSupplier(supplier),
          entry: serializeSupplierLedgerEntry(entry),
        };
      });
    } finally {
      await session.endSession();
    }

    if (errorStatus) {
      return res.status(errorStatus).json({ message: errorMsg });
    }

    res.status(201).json(result);
  })
);

export default router;
