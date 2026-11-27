import User from "../models/User.js";
import { env } from "../config/env.js";

export async function ensureSuperadminFromEnv() {
  if (!env.superadminEmail || !env.superadminPassword) return null;
  const existing = await User.findOne({ email: env.superadminEmail }).lean();
  if (existing) {
    if (existing.role !== "superadmin") {
      await User.updateOne(
        { _id: existing._id },
        { $set: { role: "superadmin", status: "active", isActive: true, plan: "paid", expiresAt: null } }
      );
    }
    return existing._id;
  }
  const created = await User.create({
    name: env.superadminName || "Super Admin",
    email: env.superadminEmail,
    password: env.superadminPassword,
    shopName: "Shop-Stock Admin",
    role: "superadmin",
    plan: "paid",
    status: "active",
    isActive: true,
    expiresAt: null,
  });
  return created._id;
}
