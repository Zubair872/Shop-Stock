import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    shopName: { type: String, trim: true, default: "" },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    role: {
      type: String,
      enum: ["owner", "admin", "manager", "cashier", "viewer"],
      default: "owner",
      index: true,
    },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

userSchema.pre("validate", function () {
  if (!this.accountId && this._id) this.accountId = this._id;
});

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, env.bcryptRounds);
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

export default mongoose.models.User || mongoose.model("User", userSchema);
