import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import AdminLog from "../models/AdminLog.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText, isPasswordLengthOk, parseNumber } from "../utils/validate.js";
import { getEffectiveExpiry, isAccountExpired } from "../utils/subscription.js";

const router = Router();

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const adminLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: "Admin API par bohat zyada requests hain, thori der baad koshish karein",
});

router.use(adminLimiter, requireAuth, requireRole("superadmin"));

function serializeAdminShop(owner, counts, now = new Date()) {
  const effectiveExpiry = getEffectiveExpiry(owner);
  const expired = isAccountExpired(owner, now);
  return {
    id: String(owner._id),
    name: owner.name,
    email: owner.email,
    shopName: owner.shopName || "",
    plan: owner.plan || "paid",
    status: owner.status || "active",
    trialEndsAt: owner.trialEndsAt || null,
    expiresAt: effectiveExpiry,
    notes: owner.notes || "",
    createdAt: owner.createdAt,
    lastLoginAt: owner.lastLoginAt || null,
    ordersCount: counts.ordersCount || 0,
    productsCount: counts.productsCount || 0,
    isExpired: expired,
  };
}

async function recordAdminLog(req, targetAccount, action, details = {}) {
  await AdminLog.create({
    admin: req.userId,
    adminEmail: req.userEmail || "",
    targetAccount,
    action,
    details,
  });
}

router.get(
  "/shops",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const q = cleanText(req.query.q, 100).toLowerCase();
    const filter = String(req.query.filter || "all");

    const owners = await User.find({
      role: "owner",
      isDemo: { $ne: true },
    })
      .select("name email shopName plan status trialEndsAt expiresAt notes createdAt lastLoginAt isActive")
      .sort({ createdAt: -1 })
      .lean();

    const ownerIds = owners.map((o) => o._id);

    const [orderAgg, productAgg] = await Promise.all([
      Order.aggregate([
        { $match: { user: { $in: ownerIds } } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
      ]),
      Product.aggregate([
        { $match: { user: { $in: ownerIds }, isActive: true } },
        { $group: { _id: "$user", count: { $sum: 1 } } },
      ]),
    ]);

    const orderMap = new Map(orderAgg.map((r) => [String(r._id), r.count]));
    const productMap = new Map(productAgg.map((r) => [String(r._id), r.count]));

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const summary = {
      total: owners.length,
      active: 0,
      trial: 0,
      expired: 0,
      suspended: 0,
      newToday: 0,
      newYesterday: 0,
    };

    const mapped = owners.map((owner) => {
      const id = String(owner._id);
      const item = serializeAdminShop(
        owner,
        {
          ordersCount: orderMap.get(id) || 0,
          productsCount: productMap.get(id) || 0,
        },
        now
      );

      if (item.status === "suspended") {
        summary.suspended += 1;
      } else if (item.isExpired) {
        summary.expired += 1;
      } else {
        summary.active += 1;
      }

      if (item.plan === "trial" && item.status !== "suspended" && !item.isExpired) {
        summary.trial += 1;
      }

      const created = new Date(item.createdAt);
      if (created >= startOfToday) summary.newToday += 1;
      else if (created >= startOfYesterday && created < startOfToday) summary.newYesterday += 1;

      return item;
    });

    const filtered = mapped.filter((item) => {
      if (q) {
        const hay = `${item.name} ${item.email} ${item.shopName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter === "active") return item.status === "active" && !item.isExpired;
      if (filter === "trial") return item.plan === "trial" && item.status === "active" && !item.isExpired;
      if (filter === "expired") return item.isExpired && item.status !== "suspended";
      if (filter === "suspended") return item.status === "suspended";
      return true;
    });

    res.json({ summary, shops: filtered });
  })
);

router.post(
  "/shops",
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body.name);
    const shopName = cleanText(req.body.shopName);
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const plan = req.body.plan === "paid" ? "paid" : "trial";
    const notes = cleanText(req.body.notes, 500);

    if (!name) return res.status(400).json({ message: "Naam likhein" });
    if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ message: "Sahi email likhein" });
    if (!isPasswordLengthOk(password)) {
      return res.status(400).json({ message: "Password kam az kam 8 characters ka ho" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Is email se account pehle se maujood hai" });
    }

    const days = parseNumber(req.body.days, { min: 1, max: 3650, integer: true });
    let trialEndsAt = null;
    let expiresAt = null;

    if (plan === "trial") {
      const trialLen = days || env.trialDays;
      trialEndsAt = new Date(Date.now() + trialLen * 24 * 60 * 60 * 1000);
      expiresAt = trialEndsAt;
    } else if (days) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    const created = await User.create({
      name,
      shopName,
      email,
      password,
      role: "owner",
      plan,
      status: "active",
      isActive: true,
      trialEndsAt,
      expiresAt,
      notes,
    });

    if (!created.accountId) {
      created.accountId = created._id;
      await created.save();
    }

    await recordAdminLog(req, created._id, "create_shop", { email, plan, days: days || null });

    res.status(201).json(
      serializeAdminShop(created, { ordersCount: 0, productsCount: 0 })
    );
  })
);

router.patch(
  "/shops/:id",
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Shop ID sahi nahi hai" });
    }

    const owner = await User.findOne({
      _id: req.params.id,
      role: "owner",
      isDemo: { $ne: true },
    });

    if (!owner) {
      return res.status(404).json({ message: "Dukaan nahi mili" });
    }

    const changes = {};
    let action = "update_shop";

    if (req.body.status === "active" || req.body.status === "suspended") {
      owner.status = req.body.status;
      changes.status = req.body.status;
      action = req.body.status === "suspended" ? "suspend" : "activate";
    }

    if (req.body.plan === "trial" || req.body.plan === "paid") {
      owner.plan = req.body.plan;
      changes.plan = req.body.plan;
      if (req.body.plan === "paid" && req.body.expiresAt === null) {
        owner.expiresAt = null;
        changes.expiresAt = null;
      }
      if (action === "update_shop") action = "update_plan";
    }

    if (req.body.extendDays !== undefined) {
      const extendDays = parseNumber(req.body.extendDays, { min: 1, max: 3650, integer: true });
      if (!extendDays) {
        return res.status(400).json({ message: "Din sahi likhein" });
      }
      const now = new Date();
      const current = getEffectiveExpiry(owner);
      const base = current && current > now ? current : now;
      const nextExpiry = new Date(base.getTime() + extendDays * 24 * 60 * 60 * 1000);
      owner.expiresAt = nextExpiry;
      if (owner.plan === "trial") {
        owner.trialEndsAt = nextExpiry;
      }
      changes.extendDays = extendDays;
      changes.expiresAt = nextExpiry;
      action = "extend_expiry";
    } else if (req.body.expiresAt === null) {
      owner.expiresAt = null;
      changes.expiresAt = null;
    } else if (typeof req.body.expiresAt === "string" && req.body.expiresAt.trim()) {
      const parsed = new Date(req.body.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Expiry date sahi nahi hai" });
      }
      owner.expiresAt = parsed;
      changes.expiresAt = parsed;
    }

    if (typeof req.body.notes === "string") {
      owner.notes = cleanText(req.body.notes, 500);
      changes.notes = owner.notes;
      if (action === "update_shop") action = "update_notes";
    }

    await owner.save();
    await recordAdminLog(req, owner._id, action, changes);

    const [ordersCount, productsCount] = await Promise.all([
      Order.countDocuments({ user: owner._id }),
      Product.countDocuments({ user: owner._id, isActive: true }),
    ]);

    res.json(serializeAdminShop(owner, { ordersCount, productsCount }));
  })
);

router.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const logs = await AdminLog.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json(
      logs.map((l) => ({
        id: String(l._id),
        adminEmail: l.adminEmail,
        targetAccount: String(l.targetAccount),
        action: l.action,
        details: l.details || {},
        createdAt: l.createdAt,
      }))
    );
  })
);

export default router;
