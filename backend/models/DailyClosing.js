import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true },
    totalOrders: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    cashRevenue: { type: Number, default: 0 },
    cardRevenue: { type: Number, default: 0 },
    walletRevenue: { type: Number, default: 0 },
    udhaarRevenue: { type: Number, default: 0 },
    totalProfit: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    note: { type: String, default: "", maxlength: 500 },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

schema.index({ user: 1, dateKey: 1 }, { unique: true });

export default mongoose.model("DailyClosing", schema);
