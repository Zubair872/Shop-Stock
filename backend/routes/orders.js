import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseNumber, cleanText } from "../utils/validate.js";
import { serializeOrder } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

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
    const orders = await Order.find({ user: req.userId })
      .sort({ createdAt: 1 })
      .lean();

    res.json(orders.map(serializeOrder));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const rawItems = Array.isArray(req.body.items) ? req.body.items : [];

    if (rawItems.length === 0) {
      return res.status(400).json({ message: "Cart khaali hai" });
    }

    if (rawItems.length > 100) {
      return res.status(400).json({ message: "Cart mein bohat zyada items hain" });
    }

    const wanted = new Map();

    for (const item of rawItems) {
      const id = String(item?.id ?? item?.product ?? "");
      const qty = parseNumber(item?.qty, { min: 1, integer: true });

      if (!mongoose.isValidObjectId(id) || qty === null) {
        return res.status(400).json({ message: "Cart ka koi item sahi nahi hai" });
      }

      wanted.set(id, (wanted.get(id) || 0) + qty);
    }

    const products = await Product.find({
      _id: { $in: [...wanted.keys()] },
      user: req.userId,
      isActive: true,
    }).lean();

    if (products.length !== wanted.size) {
      return res.status(404).json({ message: "Cart ka koi product nahi mila" });
    }

    const reserved = [];
    let shortName = null;

    for (const product of products) {
      const qty = wanted.get(String(product._id));

      const updated = await Product.findOneAndUpdate(
        {
          _id: product._id,
          user: req.userId,
          isActive: true,
          stock: { $gte: qty },
        },
        { $inc: { stock: -qty } },
        { new: true }
      ).lean();

      if (!updated) {
        shortName = product.name;
        break;
      }

      reserved.push({ product, qty, stockAfter: updated.stock });
    }

    if (shortName) {
      await restoreStock(req.userId, reserved);
      return res
        .status(409)
        .json({ message: `${shortName} ka stock kaafi nahi hai` });
    }

    const items = reserved.map((entry) => ({
      product: entry.product._id,
      name: entry.product.name,
      category: entry.product.category,
      price: entry.product.price,
      qty: entry.qty,
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    let order;

    try {
      order = await Order.create({
        user: req.userId,
        items,
        total,
        customerName: cleanText(req.body.customerName),
        customerPhone: cleanText(req.body.customerPhone, 30),
      });
    } catch (error) {
      await restoreStock(req.userId, reserved);
      throw error;
    }

    await StockMovement.insertMany(
      reserved.map((entry) => ({
        user: req.userId,
        product: entry.product._id,
        type: "sale",
        quantity: -entry.qty,
        stockAfter: entry.stockAfter,
        order: order._id,
      }))
    );

    res.status(201).json(serializeOrder(order));
  })
);

export default router;
