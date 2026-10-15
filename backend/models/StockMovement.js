import mongoose from "mongoose";

const stockMovementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    type: {
      type: String,
      enum: ["in", "sale", "adjust", "wastage"],
      required: true,
    },
    quantity: { type: Number, required: true },
    stockAfter: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true, default: "" },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  },
  { timestamps: true }
);

stockMovementSchema.index({ user: 1, product: 1, createdAt: -1 });

export default
  mongoose.models.StockMovement ||
  mongoose.model("StockMovement", stockMovementSchema);
