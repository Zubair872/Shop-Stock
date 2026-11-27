import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    balance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

schema.index({ user: 1, name: 1 });

export default mongoose.model("Supplier", schema);
