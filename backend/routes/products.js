import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseNumber, cleanText } from "../utils/validate.js";
import { serializeProduct } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const UNITS = ["pcs", "kg", "g", "litre", "dozen", "packet", "box"];

function readFields(body, partial) {
  const data = {};
  const errors = [];

  if (!partial || body.name !== undefined) {
    const name = cleanText(body.name, 120);
    if (!name) {
      errors.push("Product ka naam likhein");
    } else {
      data.name = name;
    }
  }

  if (!partial || body.category !== undefined) {
    data.category = cleanText(body.category, 60) || "General";
  }

  if (!partial || body.price !== undefined) {
    const price = parseNumber(body.price);
    if (price === null) {
      errors.push("Price sahi likhein");
    } else {
      data.price = price;
    }
  }

  if (body.costPrice !== undefined) {
    const costPrice = parseNumber(body.costPrice);
    if (costPrice === null) {
      errors.push("Cost price sahi likhein");
    } else {
      data.costPrice = costPrice;
    }
  }

  if (!partial || body.stock !== undefined) {
    const raw = body.stock === undefined || body.stock === "" ? 0 : body.stock;
    const stock = parseNumber(raw, { integer: true });
    if (stock === null) {
      errors.push("Stock poora number hona chahiye");
    } else {
      data.stock = stock;
    }
  }

  if (body.lowStockLevel !== undefined) {
    const level = parseNumber(body.lowStockLevel, { integer: true });
    if (level === null) {
      errors.push("Kam stock ki hadd sahi likhein");
    } else {
      data.lowStockLevel = level;
    }
  }

  if (body.unit !== undefined) {
    if (!UNITS.includes(body.unit)) {
      errors.push("Unit sahi nahi hai");
    } else {
      data.unit = body.unit;
    }
  }

  if (body.expiryDate !== undefined) {
    if (body.expiryDate === "" || body.expiryDate === null) {
      data.expiryDate = null;
    } else {
      const date = new Date(body.expiryDate);
      if (Number.isNaN(date.getTime())) {
        errors.push("Expiry date sahi nahi hai");
      } else {
        data.expiryDate = date;
      }
    }
  }

  return { data, errors };
}

function checkId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "Product ki id sahi nahi hai" });
    return false;
  }
  return true;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const products = await Product.find({
      user: req.userId,
      isActive: true,
    })
      .sort({ createdAt: 1 })
      .lean();

    res.json(products.map(serializeProduct));
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { data, errors } = readFields(req.body, false);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0] });
    }

    const product = await Product.create({ ...data, user: req.userId });

    if (product.stock > 0) {
      await StockMovement.create({
        user: req.userId,
        product: product._id,
        type: "in",
        quantity: product.stock,
        stockAfter: product.stock,
        note: "Opening stock",
      });
    }

    res.status(201).json(serializeProduct(product));
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const { data, errors } = readFields(req.body, true);

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0] });
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Badalne ke liye kuch nahi mila" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
      user: req.userId,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product nahi mila" });
    }

    const previousStock = product.stock;

    Object.assign(product, data);
    await product.save();

    if (data.stock !== undefined && data.stock !== previousStock) {
      await StockMovement.create({
        user: req.userId,
        product: product._id,
        type: "adjust",
        quantity: data.stock - previousStock,
        stockAfter: product.stock,
        note: "Manual change",
      });
    }

    res.json(serializeProduct(product));
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, user: req.userId, isActive: true },
      { isActive: false }
    );

    if (!product) {
      return res.status(404).json({ message: "Product nahi mila" });
    }

    res.json({ message: "Product delete ho gaya" });
  })
);

export default router;
