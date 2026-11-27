import crypto from "node:crypto";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import LedgerEntry from "../models/LedgerEntry.js";
import Order from "../models/Order.js";
import StockMovement from "../models/StockMovement.js";
import Supplier from "../models/Supplier.js";
import SupplierLedgerEntry from "../models/SupplierLedgerEntry.js";
import Purchase from "../models/Purchase.js";
import Expense from "../models/Expense.js";
import DailyClosing from "../models/DailyClosing.js";
import { env } from "../config/env.js";
import { localDateKey } from "./dates.js";

export const DEMO_TTL_MS = 24 * 60 * 60 * 1000;

export function buildDemoProducts(userId, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
  return [
    { user: userId, name: "Chakki Atta (10kg)", category: "Atta & Daal", unit: "packet", costPrice: 1250, price: 1400, stock: 24, lowStockLevel: 5, barcode: "896100100101" },
    { user: userId, name: "Super Kernel Basmati Chawal", category: "Atta & Daal", unit: "kg", costPrice: 280, price: 330, stock: 45, lowStockLevel: 10, barcode: "896100100102" },
    { user: userId, name: "Cheeni (Sugar)", category: "Ration", unit: "kg", costPrice: 132, price: 150, stock: 60, lowStockLevel: 15, barcode: "896100100103" },
    { user: userId, name: "Tapal Danedar Chai (430g)", category: "Chai & Mashroob", unit: "packet", costPrice: 680, price: 760, stock: 18, lowStockLevel: 5, barcode: "896100100104" },
    { user: userId, name: "Dalda Cooking Oil (1 Litre)", category: "Oil & Ghee", unit: "litre", costPrice: 495, price: 540, stock: 3, lowStockLevel: 6, barcode: "896100100105" },
    { user: userId, name: "Sufi Banaspati Ghee (1kg)", category: "Oil & Ghee", unit: "packet", costPrice: 480, price: 525, stock: 14, lowStockLevel: 5, barcode: "896100100106" },
    { user: userId, name: "Olpers Milk (1 Litre)", category: "Dairy", unit: "litre", costPrice: 265, price: 295, stock: 12, lowStockLevel: 6, barcode: "896100100107", expiryDate: new Date(now.getTime() + 2 * dayMs) },
    { user: userId, name: "Dawn Milky Bread (Large)", category: "Bakery", unit: "packet", costPrice: 135, price: 160, stock: 4, lowStockLevel: 5, barcode: "896100100108", expiryDate: new Date(now.getTime() + 1 * dayMs) },
    { user: userId, name: "Farm Fresh Eggs", category: "Dairy", unit: "dozen", costPrice: 280, price: 320, stock: 10, lowStockLevel: 4, barcode: "896100100109", expiryDate: new Date(now.getTime() + 2 * dayMs) },
    { user: userId, name: "Lux Soap (130g)", category: "Safai & Soap", unit: "pcs", costPrice: 110, price: 135, stock: 30, lowStockLevel: 8, barcode: "896100100110" },
    { user: userId, name: "Safeguard Soap (Large)", category: "Safai & Soap", unit: "pcs", costPrice: 130, price: 155, stock: 22, lowStockLevel: 6, barcode: "896100100111" },
    { user: userId, name: "Surf Excel (500g)", category: "Safai & Soap", unit: "packet", costPrice: 270, price: 310, stock: 2, lowStockLevel: 5, barcode: "896100100112" },
    { user: userId, name: "Colgate Toothpaste (100g)", category: "Safai & Soap", unit: "pcs", costPrice: 185, price: 220, stock: 16, lowStockLevel: 4, barcode: "896100100113" },
    { user: userId, name: "Peek Freans Sooper Biscuit", category: "Snacks", unit: "packet", costPrice: 38, price: 50, stock: 40, lowStockLevel: 10, barcode: "896100100114" },
    { user: userId, name: "Lays Masala (Medium)", category: "Snacks", unit: "packet", costPrice: 40, price: 50, stock: 35, lowStockLevel: 10, barcode: "896100100115" },
    { user: userId, name: "Pepsi Bottle (1.5 Litre)", category: "Chai & Mashroob", unit: "pcs", costPrice: 165, price: 195, stock: 20, lowStockLevel: 6, barcode: "896100100116" },
    { user: userId, name: "National Lal Mirch (200g)", category: "Masalay", unit: "packet", costPrice: 210, price: 250, stock: 15, lowStockLevel: 4, barcode: "896100100117" },
    { user: userId, name: "Shan Biryani Masala", category: "Masalay", unit: "box", costPrice: 95, price: 120, stock: 25, lowStockLevel: 6, barcode: "896100100118" },
    { user: userId, name: "Daal Chana", category: "Atta & Daal", unit: "kg", costPrice: 255, price: 300, stock: 32, lowStockLevel: 8, barcode: "896100100119" },
    { user: userId, name: "Rooh Afza (800ml)", category: "Chai & Mashroob", unit: "pcs", costPrice: 420, price: 480, stock: 3, lowStockLevel: 5, barcode: "896100100120" },
  ];
}

export async function cleanupExpiredDemos(now = new Date()) {
  const expiredUsers = await User.find({
    isDemo: true,
    demoExpiresAt: { $lte: now },
  })
    .select("_id")
    .lean();

  if (expiredUsers.length === 0) return 0;

  const ids = expiredUsers.map((u) => u._id);
  await Promise.all([
    Product.deleteMany({ user: { $in: ids } }),
    Customer.deleteMany({ user: { $in: ids } }),
    LedgerEntry.deleteMany({ user: { $in: ids } }),
    Order.deleteMany({ user: { $in: ids } }),
    StockMovement.deleteMany({ user: { $in: ids } }),
    Supplier.deleteMany({ user: { $in: ids } }),
    SupplierLedgerEntry.deleteMany({ user: { $in: ids } }),
    Purchase.deleteMany({ user: { $in: ids } }),
    Expense.deleteMany({ user: { $in: ids } }),
    DailyClosing.deleteMany({ user: { $in: ids } }),
  ]);
  await User.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

export async function createDemoShop(now = new Date()) {
  const idSuffix = crypto.randomBytes(6).toString("hex");
  const demoExpiresAt = new Date(now.getTime() + DEMO_TTL_MS);

  const user = await User.create({
    name: "Demo Dukaandar",
    shopName: "Bismillah Kiryana Store (Demo)",
    email: `demo-${idSuffix}@demo.shopstock.pk`,
    password: crypto.randomBytes(24).toString("hex"),
    role: "owner",
    isDemo: true,
    demoExpiresAt,
  });
  user.accountId = user._id;
  await user.save();

  const products = await Product.insertMany(buildDemoProducts(user._id, now));

  const customers = await Customer.insertMany([
    { user: user._id, name: "Haji Muhammad Ashraf", phone: "03001234501", creditLimit: 15000, balance: 6200 },
    { user: user._id, name: "Tariq Mehmood", phone: "03214567802", creditLimit: 10000, balance: 3450 },
    { user: user._id, name: "Sajid Ali", phone: "03339876503", creditLimit: 8000, balance: 1850 },
    { user: user._id, name: "Nadia Bibi", phone: "03451122304", creditLimit: 5000, balance: 0 },
    { user: user._id, name: "Kamran Rasheed", phone: "03125566705", creditLimit: 12000, balance: 4900 },
  ]);

  const dayMs = 24 * 60 * 60 * 1000;
  const ago = (days, hours = 14) => new Date(now.getTime() - days * dayMs - hours * 60 * 60 * 1000);

  const orderSpecs = [
    { daysAgo: 6, method: "cash", items: [0, 3, 2], qtys: [2, 1, 3] },
    { daysAgo: 5, method: "udhaar", customerIdx: 0, items: [0, 4, 1], qtys: [3, 4, 5] },
    { daysAgo: 4, method: "wallet", items: [5, 10, 13], qtys: [2, 4, 6] },
    { daysAgo: 3, method: "cash", items: [1, 18, 16], qtys: [4, 2, 2] },
    { daysAgo: 3, method: "udhaar", customerIdx: 1, items: [3, 5, 6], qtys: [2, 3, 4] },
    { daysAgo: 2, method: "card", items: [0, 11, 12], qtys: [2, 3, 2] },
    { daysAgo: 2, method: "udhaar", customerIdx: 2, items: [2, 7, 8], qtys: [5, 3, 2] },
    { daysAgo: 1, method: "cash", items: [15, 14, 17], qtys: [4, 6, 3] },
    { daysAgo: 1, method: "udhaar", customerIdx: 4, items: [0, 1, 3], qtys: [2, 4, 1] },
    { daysAgo: 0, method: "cash", items: [6, 7, 13], qtys: [3, 2, 5] },
    { daysAgo: 0, method: "wallet", items: [4, 9, 19], qtys: [2, 3, 1] },
  ];

  const orderDocs = orderSpecs.map((spec) => {
    const builtItems = spec.items.map((pIdx, i) => {
      const p = products[pIdx];
      return {
        product: p._id,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price: p.price,
        costPrice: p.costPrice,
        qty: spec.qtys[i],
      };
    });
    const subtotal = builtItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const costTotal = builtItems.reduce((sum, item) => sum + item.costPrice * item.qty, 0);
    const cust = spec.customerIdx !== undefined ? customers[spec.customerIdx] : null;
    const createdAt = spec.daysAgo === 0 ? new Date(now.getTime() - 2 * 60 * 60 * 1000) : ago(spec.daysAgo, 3);
    return {
      user: user._id,
      items: builtItems,
      subtotal,
      discount: 0,
      total: subtotal,
      costTotal,
      paymentMethod: spec.method,
      customer: cust ? cust._id : null,
      customerName: cust ? cust.name : "",
      customerPhone: cust ? cust.phone : "",
      status: "completed",
      createdAt,
      updatedAt: createdAt,
    };
  });

  const orders = await Order.insertMany(orderDocs);

  await LedgerEntry.insertMany([
    {
      user: user._id,
      customer: customers[0]._id,
      type: "udhaar_sale",
      amount: 8010,
      delta: 8010,
      balanceAfter: 8010,
      order: orders[1]._id,
      note: "Ration udhaar",
      createdBy: user._id,
      createdAt: ago(5, 3),
    },
    {
      user: user._id,
      customer: customers[0]._id,
      type: "payment",
      amount: 1810,
      delta: -1810,
      balanceAfter: 6200,
      note: "Cash wasooli",
      createdBy: user._id,
      createdAt: ago(2, 5),
    },
    {
      user: user._id,
      customer: customers[1]._id,
      type: "udhaar_sale",
      amount: 4275,
      delta: 4275,
      balanceAfter: 4275,
      order: orders[4]._id,
      note: "Chai & Ghee udhaar",
      createdBy: user._id,
      createdAt: ago(3, 3),
    },
    {
      user: user._id,
      customer: customers[1]._id,
      type: "payment",
      amount: 825,
      delta: -825,
      balanceAfter: 3450,
      note: "Partial wasooli",
      createdBy: user._id,
      createdAt: ago(1, 4),
    },
    {
      user: user._id,
      customer: customers[2]._id,
      type: "udhaar_sale",
      amount: 1850,
      delta: 1850,
      balanceAfter: 1850,
      order: orders[6]._id,
      note: "Ghar ka samaan",
      createdBy: user._id,
      createdAt: ago(2, 3),
    },
    {
      user: user._id,
      customer: customers[3]._id,
      type: "udhaar_sale",
      amount: 1500,
      delta: 1500,
      balanceAfter: 1500,
      note: "Purana khata",
      createdBy: user._id,
      createdAt: ago(6, 4),
    },
    {
      user: user._id,
      customer: customers[3]._id,
      type: "payment",
      amount: 1500,
      delta: -1500,
      balanceAfter: 0,
      note: "Poori wasooli",
      createdBy: user._id,
      createdAt: ago(2, 2),
    },
    {
      user: user._id,
      customer: customers[4]._id,
      type: "udhaar_sale",
      amount: 4900,
      delta: 4900,
      balanceAfter: 4900,
      order: orders[8]._id,
      note: "Atta & Chawal udhaar",
      createdBy: user._id,
      createdAt: ago(1, 3),
    },
  ]);

  const suppliers = await Supplier.insertMany([
    { user: user._id, name: "Al-Madina Wholesale", phone: "03008899001", address: "Akbari Mandi, Lahore", balance: 18500 },
    { user: user._id, name: "Karachi Oil & Ghee Traders", phone: "03217766502", address: "Jodia Bazar", balance: 9200 },
  ]);

  const purchases = await Purchase.insertMany([
    {
      user: user._id,
      supplier: suppliers[0]._id,
      supplierName: suppliers[0].name,
      items: [
        { product: products[0]._id, name: products[0].name, unit: "packet", qty: 20, costPrice: 1250 },
        { product: products[1]._id, name: products[1].name, unit: "kg", qty: 40, costPrice: 280 },
      ],
      total: 36200,
      paid: 17700,
      note: "Bill #AM-402",
      addToStock: true,
      createdAt: ago(4, 2),
    },
    {
      user: user._id,
      supplier: suppliers[1]._id,
      supplierName: suppliers[1].name,
      items: [
        { product: products[4]._id, name: products[4].name, unit: "litre", qty: 20, costPrice: 495 },
        { product: products[5]._id, name: products[5].name, unit: "packet", qty: 20, costPrice: 480 },
      ],
      total: 19500,
      paid: 10300,
      note: "Bill #KO-119",
      addToStock: true,
      createdAt: ago(2, 6),
    },
  ]);

  await SupplierLedgerEntry.insertMany([
    {
      user: user._id,
      supplier: suppliers[0]._id,
      type: "purchase",
      amount: 36200,
      delta: 18500,
      balanceAfter: 18500,
      purchase: purchases[0]._id,
      note: "Bill #AM-402",
      createdBy: user._id,
      createdAt: ago(4, 2),
    },
    {
      user: user._id,
      supplier: suppliers[1]._id,
      type: "purchase",
      amount: 19500,
      delta: 9200,
      balanceAfter: 9200,
      purchase: purchases[1]._id,
      note: "Bill #KO-119",
      createdBy: user._id,
      createdAt: ago(2, 6),
    },
  ]);

  await Expense.insertMany([
    {
      user: user._id,
      category: "kiraya",
      amount: 3500,
      note: "Haftawar kiraya hissa",
      dateKey: localDateKey(ago(3, 0), env.timezone),
      recordedBy: user._id,
    },
    {
      user: user._id,
      category: "bijli",
      amount: 1200,
      note: "Bijli bill",
      dateKey: localDateKey(ago(1, 0), env.timezone),
      recordedBy: user._id,
    },
    {
      user: user._id,
      category: "transport",
      amount: 450,
      note: "Mandi se rickshaw kiraya",
      dateKey: localDateKey(now, env.timezone),
      recordedBy: user._id,
    },
  ]);

  return user;
}
