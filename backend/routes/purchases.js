import { Router } from "express";
import mongoose from "mongoose";
import Supplier from "../models/Supplier.js";
import SupplierLedgerEntry from "../models/SupplierLedgerEntry.js";
import Purchase from "../models/Purchase.js";
import Product from "../models/Product.js";
import StockMovement from "../models/StockMovement.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText, parseNumber, roundMoney } from "../utils/validate.js";
import { parseQuantity, roundQty } from "../utils/units.js";
import { serializePurchase } from "../utils/serialize.js";

const router = Router();

router.use(requireAuth);

const MAX_PRICE = 10_000_000;

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const filter = { user: req.accountId };
    if (req.query.supplierId && mongoose.isValidObjectId(req.query.supplierId)) {
      filter.supplier = req.query.supplierId;
    }

    const purchases = await Purchase.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(purchases.map(serializePurchase));
  })
);

router.post(
  "/",
  requireRole("owner", "admin", "manager"),
  asyncHandler(async (req, res) => {
    const { supplierId, items, paid: paidRaw, note: noteRaw, addToStock = true } = req.body;

    if (!supplierId || !mongoose.isValidObjectId(supplierId)) {
      return res.status(400).json({ message: "Sahi supplier chunein" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Kam az kam ek item shamil karein" });
    }

    const paid = paidRaw === undefined || paidRaw === "" ? 0 : parseNumber(paidRaw, { min: 0, max: 100_000_000 });
    if (paid === null) {
      return res.status(400).json({ message: "Ada shuda raqam sahi likhein" });
    }

    const note = cleanText(noteRaw, 500);
    const shouldAddToStock = addToStock !== false;

    const session = await mongoose.startSession();
    let createdPurchase = null;
    let errorStatus = null;
    let errorMsg = null;

    try {
      await session.withTransaction(async () => {
        const supplier = await Supplier.findOne({
          _id: supplierId,
          user: req.accountId,
          isActive: true,
        }).session(session);

        if (!supplier) {
          errorStatus = 404;
          errorMsg = "Supplier nahi mila";
          return;
        }

        const builtItems = [];
        let serverTotal = 0;

        for (const raw of items) {
          const costPrice = parseNumber(raw.costPrice, { min: 0, max: MAX_PRICE });
          if (costPrice === null) {
            errorStatus = 400;
            errorMsg = "Khareed qeemat sahi likhein";
            return;
          }

          if (raw.productId) {
            if (!mongoose.isValidObjectId(raw.productId)) {
              errorStatus = 400;
              errorMsg = "Product id sahi nahi hai";
              return;
            }
            const product = await Product.findOne({
              _id: raw.productId,
              user: req.accountId,
              isActive: true,
            }).session(session);

            if (!product) {
              errorStatus = 404;
              errorMsg = "Product nahi mila";
              return;
            }

            const qty = parseQuantity(raw.qty, product.unit);
            if (qty === null) {
              errorStatus = 400;
              errorMsg = `${product.name} ki miqdar sahi likhein`;
              return;
            }

            const cleanCost = roundMoney(costPrice);
            serverTotal = roundMoney(serverTotal + qty * cleanCost);

            builtItems.push({
              product: product._id,
              name: product.name,
              unit: product.unit,
              qty,
              costPrice: cleanCost,
            });

            if (shouldAddToStock) {
              product.stock = roundQty(product.stock + qty);
              if (cleanCost > 0) {
                product.costPrice = cleanCost;
              }
              await product.save({ session });

              await StockMovement.create(
                [
                  {
                    user: req.accountId,
                    product: product._id,
                    type: "in",
                    quantity: qty,
                    stockAfter: product.stock,
                    note: `Maal khareed (${supplier.name})`,
                  },
                ],
                { session }
              );
            }
          } else {
            const name = cleanText(raw.name, 120);
            const unit = cleanText(raw.unit, 20) || "pcs";
            const qty = parseQuantity(raw.qty, unit);
            if (!name || qty === null) {
              errorStatus = 400;
              errorMsg = "Item ka naam aur miqdar sahi likhein";
              return;
            }
            const cleanCost = roundMoney(costPrice);
            serverTotal = roundMoney(serverTotal + qty * cleanCost);
            builtItems.push({
              name,
              unit,
              qty,
              costPrice: cleanCost,
            });
          }
        }

        const cleanPaid = roundMoney(paid);
        if (cleanPaid > serverTotal + 0.001) {
          errorStatus = 400;
          errorMsg = `Ada shuda raqam kul bill Rs. ${serverTotal} se zyada nahi ho sakti`;
          return;
        }

        const [purchase] = await Purchase.create(
          [
            {
              user: req.accountId,
              supplier: supplier._id,
              supplierName: supplier.name,
              items: builtItems,
              total: serverTotal,
              paid: cleanPaid,
              note,
              addToStock: shouldAddToStock,
            },
          ],
          { session }
        );

        const due = roundMoney(serverTotal - cleanPaid);
        if (due > 0) {
          supplier.balance = roundMoney(supplier.balance + due);
          await supplier.save({ session });
        }

        await SupplierLedgerEntry.create(
          [
            {
              user: req.accountId,
              supplier: supplier._id,
              type: "purchase",
              amount: serverTotal,
              delta: due,
              balanceAfter: supplier.balance,
              purchase: purchase._id,
              note: note || `Maal khareed (Kul: Rs. ${serverTotal}, Ada: Rs. ${cleanPaid})`,
              createdBy: req.userId,
            },
          ],
          { session }
        );

        createdPurchase = purchase;
      });
    } finally {
      await session.endSession();
    }

    if (errorStatus) {
      return res.status(errorStatus).json({ message: errorMsg });
    }

    res.status(201).json(serializePurchase(createdPurchase));
  })
);

export default router;
