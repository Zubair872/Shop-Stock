import mongoose from "mongoose";

const ledgerEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["udhaar_sale", "payment", "reversal"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    delta: { type: Number, required: true },
    balanceAfter: { type: Number, required: true, min: 0 },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    reversedEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LedgerEntry",
      default: null,
    },
    isReversed: { type: Boolean, default: false },
    note: { type: String, trim: true, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ user: 1, customer: 1, createdAt: -1 });

export default mongoose.models.LedgerEntry || mongoose.model("LedgerEntry", ledgerEntrySchema);
