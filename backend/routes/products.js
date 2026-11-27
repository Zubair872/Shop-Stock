import { Router } from "express";
import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseNumber, cleanText, roundMoney } from "../utils/validate.js";
import { UNITS, parseQuantity, roundQty, stockAtLeast, sameQty, isFractionalUnit } from "../utils/units.js";
import { serializeProduct, serializeMovement } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const MAX_PRICE = 10_000_000;

// current: update ke waqt maujooda product (unit/stock ka hisab rakhne ke liye)
function readFields(body, { partial, current }) {
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
    const price = parseNumber(body.price, { max: MAX_PRICE });
    if (price === null) {
      errors.push("Price sahi likhein");
    } else {
      data.price = roundMoney(price);
    }
  }

  if (body.costPrice !== undefined && body.costPrice !== "") {
    const costPrice = parseNumber(body.costPrice, { max: MAX_PRICE });
    if (costPrice === null) {
      errors.push("Cost price sahi likhein");
    } else {
      data.costPrice = roundMoney(costPrice);
    }
  }

  let unit = current?.unit || "pcs";
  if (body.unit !== undefined) {
    if (!UNITS.includes(body.unit)) {
      errors.push("Unit sahi nahi hai");
    } else {
      unit = body.unit;
      data.unit = body.unit;
    }
  }

  if (!partial || body.stock !== undefined) {
    const raw = body.stock === undefined || body.stock === "" ? 0 : body.stock;
    const stock = parseQuantity(raw, unit, { allowZero: true });
    if (stock === null) {
      errors.push(
        isFractionalUnit(unit)
          ? "Stock 3 decimals tak ka number hona chahiye"
          : "Stock poora number hona chahiye"
      );
    } else {
      data.stock = stock;
    }
  } else if (data.unit && current && !isFractionalUnit(unit) && !Number.isInteger(current.stock)) {
    errors.push("Is unit mein stock poora number hona chahiye, pehle stock theek karein");
  }

  if (body.lowStockLevel !== undefined && body.lowStockLevel !== "") {
    const level = parseNumber(body.lowStockLevel, { max: 1_000_000 });
    if (level === null) {
      errors.push("Kam stock ki hadd sahi likhein");
    } else {
      data.lowStockLevel = roundQty(level);
    }
  }

  if (body.expiryDate !== undefined) {
    if (body.expiryDate === "" || body.expiryDate === null) {
      data.expiryDate = null;
    } else if (typeof body.expiryDate !== "string") {
      errors.push("Expiry date sahi nahi hai");
    } else {
      const date = new Date(body.expiryDate);
      if (Number.isNaN(date.getTime())) {
        errors.push("Expiry date sahi nahi hai");
      } else {
        data.expiryDate = date;
      }
    }
  }

  if (body.barcode !== undefined) {
    data.barcode = cleanText(body.barcode, 60);
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

// Naam ka farq (Cake / cake) nahi dekha jata
function nameTaken(userId, name, exceptId) {
  const filter = { user: userId, isActive: true, name };
  if (exceptId) filter._id = { $ne: exceptId };
  return Product.exists(filter).collation({ locale: "en", strength: 2 });
}

function barcodeTaken(userId, barcode, exceptId) {
  if (!barcode) return Promise.resolve(false);
  const filter = { user: userId, isActive: true, barcode };
  if (exceptId) filter._id = { $ne: exceptId };
  return Product.exists(filter);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const products = await Product.find({ user: req.accountId, isActive: true })
      .sort({ createdAt: 1 })
      .lean();

    res.json(products.map(serializeProduct));
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    const { data, errors } = readFields(req.body, { partial: false });

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0] });
    }

    if (await nameTaken(req.accountId, data.name)) {
      return res.status(409).json({ message: "Is naam ka product pehle se maujood hai" });
    }

    if (await barcodeTaken(req.accountId, data.barcode)) {
      return res.status(409).json({ message: "Yeh barcode kisi aur product par laga hai" });
    }

    const product = await Product.create({ ...data, user: req.accountId });

    if (product.stock > 0) {
      await StockMovement.create({
        user: req.accountId,
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
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const existing = await Product.findOne({
      _id: req.params.id,
      user: req.accountId,
      isActive: true,
    }).lean();

    if (!existing) {
      return res.status(404).json({ message: "Product nahi mila" });
    }

    const { data, errors } = readFields(req.body, { partial: true, current: existing });

    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0] });
    }

    // Stock wahi hai jo pehle tha to usay chhoote hi nahi (warna chalti sale ke saath takrao hota hai)
    const stockChanging = data.stock !== undefined && !sameQty(data.stock, existing.stock);
    if (!stockChanging) delete data.stock;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "Badalne ke liye kuch nahi mila" });
    }

    if (data.name && (await nameTaken(req.accountId, data.name, existing._id))) {
      return res.status(409).json({ message: "Is naam ka product pehle se maujood hai" });
    }

    if (data.barcode && (await barcodeTaken(req.accountId, data.barcode, existing._id))) {
      return res.status(409).json({ message: "Yeh barcode kisi aur product par laga hai" });
    }

    // Optimistic concurrency: sirf tab update jab stock abhi bhi wahi ho jo humne parha tha
    const filter = { _id: existing._id, user: req.accountId, isActive: true };
    if (stockChanging) filter.stock = existing.stock;

    const product = await Product.findOneAndUpdate(
      filter,
      { $set: data },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(409).json({
        message: "Is dauran stock badal gaya (shayad sale hui). Dobara dekh kar try karein",
      });
    }

    if (stockChanging) {
      await StockMovement.create({
        user: req.accountId,
        product: product._id,
        type: "adjust",
        quantity: roundQty(product.stock - existing.stock),
        stockAfter: product.stock,
        note: cleanText(req.body.note, 200) || "Manual change",
      });
    }

    res.json(serializeProduct(product));
  })
);

// Maal aaya: stock barhao (aur chahein to nayi cost price)
router.post(
  "/:id/restock",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const existing = await Product.findOne({
      _id: req.params.id,
      user: req.accountId,
      isActive: true,
    }).lean();

    if (!existing) return res.status(404).json({ message: "Product nahi mila" });

    const quantity = parseQuantity(req.body.quantity, existing.unit || "pcs");
    if (quantity === null) {
      return res.status(400).json({ message: "Quantity sahi likhein" });
    }

    const update = { $inc: { stock: quantity } };

    if (req.body.costPrice !== undefined && req.body.costPrice !== "") {
      const costPrice = parseNumber(req.body.costPrice, { max: MAX_PRICE });
      if (costPrice === null) {
        return res.status(400).json({ message: "Cost price sahi likhein" });
      }
      update.$set = { costPrice: roundMoney(costPrice) };
    }

    const previousCostPrice = existing.costPrice ?? 0;
    const product = await Product.findOneAndUpdate(
      { _id: existing._id, user: req.accountId, isActive: true },
      update,
      { new: true }
    );

    if (!product) return res.status(404).json({ message: "Product nahi mila" });

    try {
      await StockMovement.create({
        user: req.accountId,
        product: product._id,
        type: "in",
        quantity,
        stockAfter: roundQty(product.stock),
        note: cleanText(req.body.note, 200) || "Restock",
      });
    } catch (error) {
      await Product.updateOne(
        { _id: product._id, user: req.accountId, stock: product.stock },
        { $inc: { stock: -quantity }, $set: { costPrice: previousCostPrice } }
      );
      throw error;
    }

    res.json(serializeProduct(product));
  })
);

// Kharab / expire / gir gaya maal: stock ghatao
router.post(
  "/:id/wastage",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const existing = await Product.findOne({
      _id: req.params.id,
      user: req.accountId,
      isActive: true,
    }).lean();

    if (!existing) return res.status(404).json({ message: "Product nahi mila" });

    const quantity = parseQuantity(req.body.quantity, existing.unit || "pcs");
    if (quantity === null) {
      return res.status(400).json({ message: "Quantity sahi likhein" });
    }

    const product = await Product.findOneAndUpdate(
      { _id: existing._id, user: req.accountId, isActive: true, stock: stockAtLeast(quantity) },
      { $inc: { stock: -quantity } },
      { new: true }
    );

    if (!product) {
      return res.status(409).json({ message: "Itna stock maujood nahi hai" });
    }

    try {
      await StockMovement.create({
        user: req.accountId,
        product: product._id,
        type: "wastage",
        quantity: -quantity,
        stockAfter: roundQty(product.stock),
        note: cleanText(req.body.note, 200) || "Wastage",
      });
    } catch (error) {
      await Product.updateOne(
        { _id: product._id, user: req.accountId, stock: product.stock },
        { $inc: { stock: quantity } }
      );
      throw error;
    }

    res.json(serializeProduct(product));
  })
);

// Stock ki poori history (kab kitna aaya/gaya)
router.get(
  "/:id/movements",
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const exists = await Product.exists({ _id: req.params.id, user: req.accountId });
    if (!exists) return res.status(404).json({ message: "Product nahi mila" });

    const limit = Math.min(parseNumber(req.query.limit, { min: 1, integer: true }) || 50, 200);

    const movements = await StockMovement.find({ user: req.accountId, product: req.params.id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(movements.map(serializeMovement));
  })
);

router.delete(
  "/:id",
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    if (!checkId(req, res)) return;

    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, user: req.accountId, isActive: true },
      { isActive: false }
    );

    if (!product) {
      return res.status(404).json({ message: "Product nahi mila" });
    }

    res.json({ message: "Product delete ho gaya" });
  })
);

export default router;
