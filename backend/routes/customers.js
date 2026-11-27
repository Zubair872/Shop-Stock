import { Router } from "express";
import mongoose from "mongoose";
import Customer from "../models/Customer.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText, parseNumber, roundMoney, escapeRegex } from "../utils/validate.js";
import { applyPayment, applyReversal } from "../utils/khata.js";
import { serializeCustomer, serializeLedgerEntry } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const MAX_LIMIT = 10_000_000;

function checkId(id, res, label = "Customer") {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: `${label} ki id sahi nahi hai` });
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
    if (req.query.onlyUdhaar === "true") {
      filter.balance = { $gt: 0 };
    }

    const customers = await Customer.find(filter)
      .sort({ balance: -1, name: 1 })
      .lean();

    res.json(customers.map(serializeCustomer));
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager", "cashier"),
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body.name, 100);
    const phone = cleanText(req.body.phone, 30);
    const limitRaw = req.body.creditLimit === undefined || req.body.creditLimit === "" ? 0 : req.body.creditLimit;
    const creditLimit = parseNumber(limitRaw, { min: 0, max: MAX_LIMIT });

    if (!name) {
      return res.status(400).json({ message: "Customer ka naam likhein" });
    }
    if (!phone) {
      return res.status(400).json({ message: "Customer ka phone likhein" });
    }
    if (creditLimit === null) {
      return res.status(400).json({ message: "Udhaar ki hadd sahi likhein" });
    }

    const existing = await Customer.findOne({ user: req.accountId, phone });
    if (existing) {
      return res.status(409).json({ message: "Is phone number ka customer pehle se maujood hai" });
    }

    const customer = await Customer.create({
      user: req.accountId,
      name,
      phone,
      creditLimit: roundMoney(creditLimit),
      balance: 0,
    });

    res.status(201).json(serializeCustomer(customer));
  })
);

router.put(
  "/:id",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;

    const updates = {};
    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name, 100);
      if (!name) return res.status(400).json({ message: "Customer ka naam likhein" });
      updates.name = name;
    }
    if (req.body.phone !== undefined) {
      const phone = cleanText(req.body.phone, 30);
      if (!phone) return res.status(400).json({ message: "Customer ka phone likhein" });
      const duplicate = await Customer.exists({
        user: req.accountId,
        phone,
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        return res.status(409).json({ message: "Is phone number ka customer pehle se maujood hai" });
      }
      updates.phone = phone;
    }
    if (req.body.creditLimit !== undefined) {
      const creditLimit = parseNumber(req.body.creditLimit, { min: 0, max: MAX_LIMIT });
      if (creditLimit === null) {
        return res.status(400).json({ message: "Udhaar ki hadd sahi likhein" });
      }
      updates.creditLimit = roundMoney(creditLimit);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Badalne ke liye kuch nahi mila" });
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, user: req.accountId, isActive: true },
      { $set: updates },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: "Customer nahi mila" });
    }

    res.json(serializeCustomer(customer));
  })
);

router.get(
  "/:id/ledger",
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;

    const customer = await Customer.findOne({
      _id: req.params.id,
      user: req.accountId,
      isActive: true,
    }).lean();

    if (!customer) {
      return res.status(404).json({ message: "Customer nahi mila" });
    }

    const entries = await LedgerEntry.find({
      user: req.accountId,
      customer: customer._id,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({
      customer: serializeCustomer(customer),
      entries: entries.map(serializeLedgerEntry),
    });
  })
);

router.post(
  "/:id/payments",
  requireRole("owner", "admin", "manager", "cashier"),
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;

    const amount = parseNumber(req.body.amount, { min: 0.01, max: MAX_LIMIT });
    if (amount === null) {
      return res.status(400).json({ message: "Wapsi raqam 0 se zyada likhein" });
    }

    const cleanAmount = roundMoney(amount);
    const note = cleanText(req.body.note, 200) || "Udhaar wapsi";

    const session = await mongoose.startSession();
    let result = null;
    let errorStatus = null;
    let errorMsg = null;

    try {
      await session.withTransaction(async () => {
        const customer = await Customer.findOne({
          _id: req.params.id,
          user: req.accountId,
          isActive: true,
        }).session(session);

        if (!customer) {
          errorStatus = 404;
          errorMsg = "Customer nahi mila";
          return;
        }

        const check = applyPayment(customer.balance, cleanAmount);
        if (!check.ok) {
          errorStatus = 400;
          errorMsg = check.message;
          return;
        }

        customer.balance = check.nextBalance;
        await customer.save({ session });

        const [entry] = await LedgerEntry.create(
          [
            {
              user: req.accountId,
              customer: customer._id,
              type: "payment",
              amount: cleanAmount,
              delta: -cleanAmount,
              balanceAfter: customer.balance,
              note,
              createdBy: req.userId,
            },
          ],
          { session }
        );

        result = {
          customer: serializeCustomer(customer),
          entry: serializeLedgerEntry(entry),
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

router.post(
  "/:id/ledger/:entryId/reverse",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req.params.id, res)) return;
    if (!checkId(req.params.entryId, res, "Entry")) return;

    const note = cleanText(req.body.note, 200) || "Ghalti ki wapsi (reversal)";

    const session = await mongoose.startSession();
    let result = null;
    let errorStatus = null;
    let errorMsg = null;

    try {
      await session.withTransaction(async () => {
        const customer = await Customer.findOne({
          _id: req.params.id,
          user: req.accountId,
          isActive: true,
        }).session(session);

        if (!customer) {
          errorStatus = 404;
          errorMsg = "Customer nahi mila";
          return;
        }

        const original = await LedgerEntry.findOne({
          _id: req.params.entryId,
          user: req.accountId,
          customer: customer._id,
        }).session(session);

        if (!original) {
          errorStatus = 404;
          errorMsg = "Ledger entry nahi mili";
          return;
        }

        if (original.type !== "payment") {
          errorStatus = 400;
          errorMsg = "Sirf payment entry reverse ho sakti hai";
          return;
        }

        if (original.isReversed) {
          errorStatus = 409;
          errorMsg = "Yeh payment pehle hi reverse ho chuki hai";
          return;
        }

        original.isReversed = true;
        await original.save({ session });

        const reverseDelta = roundMoney(original.amount);
        customer.balance = applyReversal(customer.balance, reverseDelta);
        await customer.save({ session });

        const [reversalEntry] = await LedgerEntry.create(
          [
            {
              user: req.accountId,
              customer: customer._id,
              type: "reversal",
              amount: original.amount,
              delta: reverseDelta,
              balanceAfter: customer.balance,
              reversedEntry: original._id,
              note,
              createdBy: req.userId,
            },
          ],
          { session }
        );

        result = {
          customer: serializeCustomer(customer),
          entry: serializeLedgerEntry(reversalEntry),
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
