import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: {
      type: String,
      enum: ["kiraya", "bijli", "tankhwah", "transport", "other"],
      default: "other",
    },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, trim: true, default: "", maxlength: 300 },
    dateKey: { type: String, required: true },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

schema.index({ user: 1, createdAt: -1 });
schema.index({ user: 1, dateKey: 1 });

export default mongoose.model("Expense", schema);
