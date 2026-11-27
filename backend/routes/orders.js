import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";
import Customer from "../models/Customer.js";
import LedgerEntry from "../models/LedgerEntry.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  parseNumber,
  cleanText,
  escapeRegex,
  readIdempotencyKey,
} from "../utils/validate.js";
import { parseQuantity, roundQty, stockAtLeast } from "../utils/units.js";
import { computeTotals } from "../utils/pricing.js";
import { checkCreditLimit, applyReversal } from "../utils/khata.js";
import { parseDayBoundary } from "../utils/dates.js";
import { serializeOrder } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const PAYMENT_METHODS = ["cash", "card", "wallet", "udhaar"];

// Reserve kiya hua stock wapas karo (jab sale beech mein fail ho jaye)
async function restoreStock(userId, reserved) {
  for (const entry of reserved) {
    await Product.updateOne(
      { _id: entry.product._id, user: userId },
      { $inc: { stock: entry.qty } }
    );
  }
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { user: req.accountId };

    const status = String(req.query.status || "all");
    if (status === "completed" || status === "cancelled") filter.status = status;

    const from = parseDayBoundary(req.query.from, env.timezone);
    const to = parseDayBoundary(req.query.to, env.timezone, { end: true });
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lt = to;
    }

    const search = cleanText(req.query.q, 60);
    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ customerName: pattern }, { customerPhone: pattern }];
    }

    const limit = Math.min(parseNumber(req.query.limit, { min: 1, integer: true }) || 20, 100);
    const requestedPage = parseNumber(req.query.page, { min: 1, integer: true }) || 1;

    const total = await Order.countDocuments(filter);
    const pages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(requestedPage, pages);

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ items: orders.map(serializeOrder), page, pages, total, limit });
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Order ki id sahi nahi hai" });
    }

    const order = await Order.findOne({ _id: req.params.id, user: req.accountId }).lean();
    if (!order) return res.status(404).json({ message: "Order nahi mila" });

    res.json(serializeOrder(order));
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager", "cashier"),
  asyncHandler(async (req, res) => {
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (rawItems.length === 0) {
      return res.status(400).json({ message: "Cart khaali hai" });
    }

    if (rawItems.length > 100) {
      return res.status(400).json({ message: "Cart mein bohat zyada items hain" });
    }

    const paymentMethod = req.body.paymentMethod === undefined ? "cash" : req.body.paymentMethod;
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ message: "Payment ka tareeqa sahi nahi hai" });
    }

    const customerId = req.body.customerId ? String(req.body.customerId) : "";
    const customerName = cleanText(req.body.customerName);
    const customerPhone = cleanText(req.body.customerPhone, 30);
    if (paymentMethod === "udhaar" && !mongoose.isValidObjectId(customerId)) {
      return res.status(400).json({ message: "Udhaar sale ke liye customer select karna lazmi hai" });
    }

    let discountInput = 0;
    if (req.body.discount !== undefined && req.body.discount !== "") {
      discountInput = parseNumber(req.body.discount, { max: 10_000_000 });
      if (discountInput === null) {
        return res.status(400).json({ message: "Discount sahi likhein" });
      }
    }

    const idempotencyKey = readIdempotencyKey(req.get("Idempotency-Key"));

    // Pehle hi ho chuka order ho to wahi wapas do (double click / network retry)
    if (idempotencyKey) {
      const previous = await Order.findOne({ user: req.accountId, idempotencyKey }).lean();
      if (previous) {
        res.setHeader("Idempotent-Replay", "true");
        return res.status(200).json(serializeOrder(previous));
      }
    }

    const wanted = new Map();

    for (const item of rawItems) {
      const id = String(item?.id ?? item?.product ?? "");
      const qty = parseNumber(item?.qty, { min: 0.001, max: 1_000_000 });

      if (!mongoose.isValidObjectId(id) || qty === null) {
        return res.status(400).json({ message: "Cart ka koi item sahi nahi hai" });
      }

      wanted.set(id, roundQty((wanted.get(id) || 0) + qty));
    }

    const products = await Product.find({
      _id: { $in: [...wanted.keys()] },
      user: req.accountId,
      isActive: true,
    }).lean();

    if (products.length !== wanted.size) {
      return res
        .status(404)
        .json({ message: "Cart ka koi product nahi mila (shayad delete ho gaya)" });
    }

    // Quantity ko har product ki unit ke hisab se check karo (pcs mein 1.5 nahi chalega)
    const lines = [];
    for (const product of products) {
      const unit = product.unit || "pcs";
      const qty = parseQuantity(wanted.get(String(product._id)), unit);

      if (qty === null) {
        return res
          .status(400)
          .json({ message: `${product.name}: quantity sahi nahi (unit: ${unit})` });
      }

      lines.push({ product, qty, price: product.price, costPrice: product.costPrice ?? 0 });
    }

    const totals = computeTotals(lines, discountInput);
    if (totals.discountTooHigh) {
      return res.status(400).json({ message: "Discount total se zyada nahi ho sakta" });
    }

    const items = lines.map((line) => ({
      product: line.product._id,
      name: line.product.name,
      category: line.product.category,
      unit: line.product.unit || "pcs",
      price: line.price,
      costPrice: line.costPrice,
      qty: line.qty,
    }));

    if (paymentMethod === "udhaar") {
      const session = await mongoose.startSession();
      let createdOrder = null;
      let errStatus = null;
      let errMsg = null;

      try {
        await session.withTransaction(async () => {
          const customer = await Customer.findOne({
            _id: customerId,
            user: req.accountId,
            isActive: true,
          }).session(session);

          if (!customer) {
            errStatus = 404;
            errMsg = "Customer nahi mila";
            return;
          }

          const limitCheck = checkCreditLimit(customer.balance, customer.creditLimit, totals.total);
          if (!limitCheck.allowed) {
            errStatus = 409;
            errMsg = `Udhaar hadd (Rs. ${customer.creditLimit}) cross ho rahi hai. Mojooda udhaar: Rs. ${customer.balance}`;
            return;
          }

          const txReserved = [];
          for (const line of lines) {
            const updated = await Product.findOneAndUpdate(
              {
                _id: line.product._id,
                user: req.accountId,
                isActive: true,
                stock: stockAtLeast(line.qty),
              },
              { $inc: { stock: -line.qty } },
              { new: true, session }
            ).lean();

            if (!updated) {
              errStatus = 409;
              errMsg = `${line.product.name} ka stock kaafi nahi hai`;
              throw new Error("ABORT_TX");
            }

            txReserved.push({
              product: line.product,
              qty: line.qty,
              stockAfter: roundQty(updated.stock),
            });
          }

          customer.balance = limitCheck.nextBalance;
          await customer.save({ session });

          const [orderDoc] = await Order.create(
            [
              {
                user: req.accountId,
                items,
                subtotal: totals.subtotal,
                discount: totals.discount,
                total: totals.total,
                costTotal: totals.costTotal,
                paymentMethod: "udhaar",
                customer: customer._id,
                customerName: customer.name,
                customerPhone: customer.phone,
                note: cleanText(req.body.note, 200),
                ...(idempotencyKey ? { idempotencyKey } : {}),
              },
            ],
            { session }
          );

          await LedgerEntry.create(
            [
              {
                user: req.accountId,
                customer: customer._id,
                type: "udhaar_sale",
                amount: totals.total,
                delta: totals.total,
                balanceAfter: customer.balance,
                order: orderDoc._id,
                note: `Order #${String(orderDoc._id).slice(-6).toUpperCase()}`,
                createdBy: req.userId,
              },
            ],
            { session }
          );

          await StockMovement.insertMany(
            txReserved.map((entry) => ({
              user: req.accountId,
              product: entry.product._id,
              type: "sale",
              quantity: -entry.qty,
              stockAfter: entry.stockAfter,
              order: orderDoc._id,
            })),
            { session }
          );

          createdOrder = orderDoc;
        });
      } catch (error) {
        if (error.message !== "ABORT_TX") {
          if (error.code === 11000 && idempotencyKey) {
            const previous = await Order.findOne({ user: req.accountId, idempotencyKey }).lean();
            if (previous) {
              res.setHeader("Idempotent-Replay", "true");
              return res.status(200).json(serializeOrder(previous));
            }
          }
          throw error;
        }
      } finally {
        await session.endSession();
      }

      if (errStatus) {
        return res.status(errStatus).json({ message: errMsg });
      }

      return res.status(201).json(serializeOrder(createdOrder));
    }

    // Stock reserve: har product par ek atomic "agar stock kaafi hai to ghatao"
    const reserved = [];
    let shortName = null;

    for (const line of lines) {
      const updated = await Product.findOneAndUpdate(
        {
          _id: line.product._id,
          user: req.accountId,
          isActive: true,
          stock: stockAtLeast(line.qty),
        },
        { $inc: { stock: -line.qty } },
        { new: true }
      ).lean();

      if (!updated) {
        shortName = line.product.name;
        break;
      }

      reserved.push({ product: line.product, qty: line.qty, stockAfter: roundQty(updated.stock) });
    }

    if (shortName) {
      await restoreStock(req.accountId, reserved);
      return res
        .status(409)
        .json({ message: `${shortName} ka stock kaafi nahi hai` });
    }

    let order;

    try {
      order = await Order.create({
        user: req.accountId,
        items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        total: totals.total,
        costTotal: totals.costTotal,
        paymentMethod,
        customerName,
        customerPhone,
        note: cleanText(req.body.note, 200),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
    } catch (error) {
      await restoreStock(req.accountId, reserved);

      // Do ek jaisi requests ek saath aayi thin: doosri ne order bana diya, hum uska hi jawab dete hain
      if (error.code === 11000 && idempotencyKey) {
        const previous = await Order.findOne({ user: req.accountId, idempotencyKey }).lean();
        if (previous) {
          res.setHeader("Idempotent-Replay", "true");
          return res.status(200).json(serializeOrder(previous));
        }
      }

      throw error;
    }

    // Sale ho chuki hai. History likhne mein masla aaye to customer ko error na dikhayein
    // (warna woh dobara order karega aur doosri baar stock kategi).
    try {
      await StockMovement.insertMany(
        reserved.map((entry) => ({
          user: req.accountId,
          product: entry.product._id,
          type: "sale",
          quantity: -entry.qty,
          stockAfter: entry.stockAfter,
          order: order._id,
        }))
      );
    } catch (error) {
      console.error(`[error] ${req.id} stock history save nahi hui, order ${order._id}`, error);
    }

    res.status(201).json(serializeOrder(order));
  })
);

// Order cancel: status badlo, phir stock wapas. Status ka badlna atomic hai, isliye do baar cancel nahi ho sakta.
router.post(
  "/:id/cancel",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Order ki id sahi nahi hai" });
    }

    const reason = cleanText(req.body.reason, 200);
    const existingOrder = await Order.findOne({
      _id: req.params.id,
      user: req.accountId,
    }).lean();

    if (!existingOrder) {
      return res.status(404).json({ message: "Order nahi mila" });
    }
    if (existingOrder.status !== "completed") {
      return res.status(409).json({ message: "Yeh order pehle hi cancel ho chuka hai" });
    }

    if (existingOrder.paymentMethod === "udhaar" && existingOrder.customer) {
      const session = await mongoose.startSession();
      let cancelledOrder = null;
      let errStatus = null;
      let errMsg = null;

      try {
        await session.withTransaction(async () => {
          const updatedOrder = await Order.findOneAndUpdate(
            { _id: req.params.id, user: req.accountId, status: "completed" },
            {
              $set: {
                status: "cancelled",
                cancelledAt: new Date(),
                cancelReason: reason,
              },
            },
            { new: true, session }
          ).lean();

          if (!updatedOrder) {
            errStatus = 409;
            errMsg = "Yeh order pehle hi cancel ho chuka hai";
            return;
          }

          const movements = [];
          for (const item of updatedOrder.items) {
            const product = await Product.findOneAndUpdate(
              { _id: item.product, user: req.accountId },
              { $inc: { stock: item.qty } },
              { new: true, session }
            ).lean();
            if (!product) continue;
            movements.push({
              user: req.accountId,
              product: item.product,
              type: "return",
              quantity: item.qty,
              stockAfter: roundQty(product.stock),
              note: "Order cancel",
              order: updatedOrder._id,
            });
          }

          if (movements.length > 0) {
            await StockMovement.insertMany(movements, { session });
          }

          const customer = await Customer.findOne({
            _id: updatedOrder.customer,
            user: req.accountId,
          }).session(session);

          if (customer) {
            const reverseAmount = updatedOrder.total;
            customer.balance = applyReversal(customer.balance, -reverseAmount);
            await customer.save({ session });

            await LedgerEntry.create(
              [
                {
                  user: req.accountId,
                  customer: customer._id,
                  type: "reversal",
                  amount: reverseAmount,
                  delta: -reverseAmount,
                  balanceAfter: customer.balance,
                  order: updatedOrder._id,
                  note: `Order #${String(updatedOrder._id).slice(-6).toUpperCase()} cancel`,
                  createdBy: req.userId,
                },
              ],
              { session }
            );
          }

          cancelledOrder = updatedOrder;
        });
      } finally {
        await session.endSession();
      }

      if (errStatus) {
        return res.status(errStatus).json({ message: errMsg });
      }
      return res.json(serializeOrder(cancelledOrder));
    }

    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.accountId, status: "completed" },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      },
      { new: true }
    ).lean();

    if (!order) {
      return res.status(409).json({ message: "Yeh order pehle hi cancel ho chuka hai" });
    }

    const movements = [];

    for (const item of order.items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, user: req.accountId },
        { $inc: { stock: item.qty } },
        { new: true }
      ).lean();

      if (!product) continue; // product hamesha ke liye hat chuka ho to wapas karne ko kuch nahi

      movements.push({
        user: req.accountId,
        product: item.product,
        type: "return",
        quantity: item.qty,
        stockAfter: roundQty(product.stock),
        note: "Order cancel",
        order: order._id,
      });
    }

    try {
      if (movements.length > 0) await StockMovement.insertMany(movements);
    } catch (error) {
      console.error(`[error] ${req.id} cancel history save nahi hui, order ${order._id}`, error);
    }

    res.json(serializeOrder(order));
  })
);

export default router;
