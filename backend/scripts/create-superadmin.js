import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import { env } from "../config/env.js";

async function run() {
  const email = (process.argv[2] || env.superadminEmail || "").trim().toLowerCase();
  const password = process.argv[3] || env.superadminPassword || "";
  const name = process.argv[4] || env.superadminName || "Super Admin";

  if (!email || !password) {
    throw new Error("SUPERADMIN_EMAIL aur SUPERADMIN_PASSWORD .env ya args mein dein");
  }

  await connectDB();

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      name,
      email,
      password,
      shopName: "Shop-Stock Admin",
      role: "superadmin",
      plan: "paid",
      status: "active",
      isActive: true,
      expiresAt: null,
    });
    console.log(`Superadmin created: ${user.email}`);
  } else {
    user.role = "superadmin";
    user.plan = "paid";
    user.status = "active";
    user.isActive = true;
    user.expiresAt = null;
    user.password = password;
    await user.save();
    console.log(`Superadmin updated: ${user.email}`);
  }
}

run()
  .catch((error) => {
    console.error("Superadmin script failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
