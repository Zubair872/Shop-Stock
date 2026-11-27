import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: "" },
    unit: { type: String, default: "pcs" },
    price: { type: Number, required: true, min: 0 },
    // Bechne ke waqt ki cost (profit nikalne ke liye). Purane orders mein 0 hoti hai.
    costPrice: { type: Number, default: 0, min: 0 },
    qty: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must have at least one item",
      },
    },
    subtotal: { type: Number, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    costTotal: { type: Number, default: 0, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "wallet", "udhaar"],
      default: "cash",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    customerName: { type: String, trim: true, default: "" },
    customerPhone: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true, default: "" },
    // Double-click / network retry se do baar order na bane
    idempotencyKey: { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ user: 1, status: 1, createdAt: -1 });
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.models.Order || mongoose.model("Order", orderSchema);
