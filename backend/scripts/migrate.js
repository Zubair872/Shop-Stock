import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

function readJson(fileName) {
  const filePath = path.join(dataDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

async function run() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  const name = process.env.OWNER_NAME || "Shop Owner";
  const shopName = process.env.OWNER_SHOP_NAME || "";

  if (!email || !password) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD are required in .env");
  }

  await connectDB();

  let owner = await User.findOne({ email: email.toLowerCase() });
  if (!owner) {
    owner = await User.create({ name, email, password, shopName });
    console.log(`User created: ${owner.email}`);
  } else {
    console.log(`User found: ${owner.email}`);
  }

  const existingProducts = await Product.countDocuments({ user: owner._id });
  if (existingProducts > 0) {
    console.log("This user already has products. Migration skipped.");
    return;
  }

  const oldProducts = readJson("products.json");
  const oldOrders = readJson("orders.json");

  const idMap = new Map();
  const productDocs = [];

  for (const old of oldProducts) {
    const _id = new mongoose.Types.ObjectId();
    idMap.set(old.id, _id);
    productDocs.push({
      _id,
      user: owner._id,
      name: old.name,
      category: old.category || "General",
      price: Number(old.price) || 0,
      stock: Math.max(0, Number(old.stock) || 0),
    });
  }

  const createdProducts = await Product.insertMany(productDocs);

  const movementDocs = createdProducts
    .filter((p) => p.stock > 0)
    .map((p) => ({
      user: owner._id,
      product: p._id,
      type: "in",
      quantity: p.stock,
      stockAfter: p.stock,
      note: "Opening stock (migrated)",
    }));

  if (movementDocs.length > 0) {
    await StockMovement.insertMany(movementDocs);
  }

  const orderDocs = [];
  let skippedOrders = 0;

  for (const old of oldOrders) {
    const items = [];
    for (const item of old.items || []) {
      const productId = idMap.get(item.id);
      if (!productId) continue;
      items.push({
        product: productId,
        name: item.name,
        category: item.category || "",
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 1,
      });
    }

    if (items.length === 0) {
      skippedOrders += 1;
      continue;
    }

    const date = old.date ? new Date(old.date) : new Date();
    orderDocs.push({
      user: owner._id,
      items,
      total: Number(old.total) || items.reduce((s, i) => s + i.price * i.qty, 0),
      createdAt: date,
      updatedAt: date,
    });
  }

  if (orderDocs.length > 0) {
    await Order.insertMany(orderDocs);
  }

  console.log(`Products migrated: ${createdProducts.length}`);
  console.log(`Orders migrated: ${orderDocs.length}`);
  if (skippedOrders > 0) {
    console.log(`Orders skipped (product not found): ${skippedOrders}`);
  }
}

run()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
