import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    type: { type: String, enum: ["purchase", "payment"], required: true },
    amount: { type: Number, required: true, min: 0 },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    purchase: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", default: null },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

schema.index({ user: 1, supplier: 1, createdAt: -1 });

export default mongoose.models.SupplierLedgerEntry ||
  mongoose.model("SupplierLedgerEntry", schema);
