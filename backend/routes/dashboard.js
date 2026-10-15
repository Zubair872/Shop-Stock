import { Router } from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { serializeProduct } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [orders, products] = await Promise.all([
      Order.find({ user: req.userId, status: "completed" }).lean(),
      Product.find({ user: req.userId, isActive: true }).lean(),
    ]);

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);

    const salesCount = new Map();
    for (const order of orders) {
      for (const item of order.items) {
        salesCount.set(item.name, (salesCount.get(item.name) || 0) + item.qty);
      }
    }

    let bestSeller = null;
    for (const [name, qty] of salesCount) {
      if (!bestSeller || qty > bestSeller.qty) {
        bestSeller = { name, qty };
      }
    }

    const lowStockItems = products
      .filter((product) => product.stock < (product.lowStockLevel ?? 5))
      .map(serializeProduct);

    res.json({
      totalOrders: orders.length,
      totalRevenue,
      bestSeller,
      lowStockItems,
    });
  })
);

export default router;
