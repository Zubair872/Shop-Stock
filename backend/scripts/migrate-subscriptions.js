import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

async function run() {
  await connectDB();

  const result = await User.updateMany(
    {
      isDemo: { $ne: true },
      role: { $ne: "superadmin" },
      $or: [
        { plan: { $exists: false } },
        { status: { $exists: false } },
      ],
    },
    {
      $set: {
        plan: "paid",
        status: "active",
        expiresAt: null,
      },
    }
  );

  console.log(`Accounts migrated: ${result.modifiedCount}`);
}

run()
  .catch((error) => {
    console.error("Subscription migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
