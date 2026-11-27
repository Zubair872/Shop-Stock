import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    creditLimit: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.index({ user: 1, phone: 1 }, { unique: true });
customerSchema.index({ user: 1, balance: -1 });

export default mongoose.models.Customer || mongoose.model("Customer", customerSchema);
