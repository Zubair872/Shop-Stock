import mongoose from "mongoose";
import { UNITS } from "../utils/units.js";

const productSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockLevel: { type: Number, default: 5, min: 0 },
    unit: {
      type: String,
      enum: UNITS,
      default: "pcs",
    },
    expiryDate: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ user: 1, name: 1 });
productSchema.index({ user: 1, category: 1 });

export default mongoose.models.Product || mongoose.model("Product", productSchema);
