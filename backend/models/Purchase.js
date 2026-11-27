import mongoose from "mongoose";

const itemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    name: { type: String, required: true, trim: true },
    unit: { type: String, default: "pcs" },
    qty: { type: Number, required: true, min: 0.001 },
    costPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierName: { type: String, trim: true, default: "" },
    items: {
      type: [itemSchema],
      validate: { validator: (a) => a.length > 0, message: "Purchase mein kam az kam ek item hona chahiye" },
    },
    total: { type: Number, required: true, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    note: { type: String, trim: true, default: "", maxlength: 500 },
    addToStock: { type: Boolean, default: true },
  },
  { timestamps: true }
);

schema.index({ user: 1, createdAt: -1 });
schema.index({ user: 1, supplier: 1 });

export default mongoose.model("Purchase", schema);
