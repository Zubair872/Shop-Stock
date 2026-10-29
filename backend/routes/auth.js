import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText, isPasswordLengthOk } from "../utils/validate.js";
import { serializeUser } from "../utils/serialize.js";
import mongoose from "mongoose";

const router = Router();

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const PASSWORD_MESSAGE = "Password kam az kam 8 characters ka ho (zyada se zyada 72 bytes)";

// Email na milne par bhi bcrypt chalta hai, taake jawab ke waqt se pata na chale ke email maujood hai ya nahi
const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", env.bcryptRounds);

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${cleanText(req.body?.email, 200).toLowerCase()}`,
  message: "Login ki bohat koshishein hui hain, 15 minute baad dobara try karein",
});

const loginIpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: "Login ki bohat koshishein hui hain, 15 minute baad dobara try karein",
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Is hafte bohat accounts ban chuke hain, baad mein koshish karein",
});

function signToken(userId) {
  return jwt.sign({}, env.jwtSecret, {
    subject: String(userId),
    expiresIn: env.jwtExpiresIn,
    algorithm: "HS256",
  });
}

// Frontend yeh dekh kar register ka link dikhata ya chhupata hai
router.get("/config", (req, res) => {
  res.json({ registrationOpen: env.allowRegistration });
});

router.post(
  "/register",
  registerLimiter,
  asyncHandler(async (req, res) => {
    if (!env.allowRegistration) {
      return res.status(403).json({ message: "Naye accounts abhi band hain" });
    }

    const name = cleanText(req.body.name);
    const shopName = cleanText(req.body.shopName);
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!name) {
      return res.status(400).json({ message: "Apna naam likhein" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Sahi email likhein" });
    }

    if (!isPasswordLengthOk(password)) {
      return res.status(400).json({ message: PASSWORD_MESSAGE });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Is email se account pehle se bana hua hai" });
    }

    const user = await User.create({ name, email, password, shopName, role: "owner" });
    if (!user.accountId) {
      user.accountId = user._id;
      await user.save();
    }

    res.status(201).json({
      token: signToken(user._id),
      user: serializeUser(user),
    });
  })
);

router.post(
  "/login",
  loginIpLimiter,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";

    const user = await User.findOne({ email }).select("+password");
    const valid = user
      ? await user.comparePassword(password)
      : await bcrypt.compare(password, DUMMY_HASH).then(() => false);

    if (!valid) {
      return res.status(401).json({ message: "Email ya password ghalat hai" });
    }

    res.json({
      token: signToken(user._id),
      user: serializeUser(user),
    });
  })
);

router.get(
  "/team",
  requireAuth,
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    const members = await User.find({
      $or: [{ accountId: req.accountId }, { _id: req.accountId }],
    })
      .select("name email shopName role isActive createdAt")
      .sort({ createdAt: 1 })
      .lean();
    res.json(members.map(serializeUser));
  })
);

router.post(
  "/team",
  requireAuth,
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    if (!["owner", "admin"].includes(req.userRole)) {
      return res.status(403).json({ message: "Team members banane ki ijazat nahi hai" });
    }

    const name = cleanText(req.body.name);
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = typeof req.body.password === "string" ? req.body.password : "";
    const role = req.body.role;
    const allowedRoles = req.userRole === "owner"
      ? ["admin", "manager", "cashier", "viewer"]
      : ["manager", "cashier", "viewer"];

    if (!name || !EMAIL_PATTERN.test(email) || !isPasswordLengthOk(password)) {
      return res.status(400).json({ message: "Naam, email aur mazboot password sahi likhein" });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Role sahi nahi hai" });
    }
    if (await User.exists({ email })) {
      return res.status(409).json({ message: "Is email se account pehle se bana hua hai" });
    }

    const member = await User.create({
      name,
      email,
      password,
      shopName: req.body.shopName ? cleanText(req.body.shopName) : "",
      accountId: new mongoose.Types.ObjectId(req.accountId),
      role,
    });
    res.status(201).json(serializeUser(member));
  })
);

router.patch(
  "/team/:id",
  requireAuth,
  requireRole("owner", "admin"),
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Team member ki id sahi nahi hai" });
    }
    const member = await User.findOne({ _id: req.params.id, accountId: req.accountId });
    if (!member) return res.status(404).json({ message: "Team member nahi mila" });
    if (member.role === "owner") return res.status(400).json({ message: "Owner ka role nahi badal sakte" });
    const allowedRoles = req.userRole === "owner"
      ? ["admin", "manager", "cashier", "viewer"]
      : ["manager", "cashier", "viewer"];
    if (req.body.role !== undefined && !allowedRoles.includes(req.body.role)) {
      return res.status(400).json({ message: "Role sahi nahi hai" });
    }
    if (req.body.role !== undefined) member.role = req.body.role;
    if (req.body.isActive !== undefined) member.isActive = Boolean(req.body.isActive);
    await member.save();
    res.json(serializeUser(member));
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(401).json({ message: "Account nahi mila" });
    }

    res.json({ user: serializeUser(user) });
  })
);

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const updates = {};

    if (req.body.name !== undefined) {
      const name = cleanText(req.body.name);
      if (!name) return res.status(400).json({ message: "Naam khaali nahi ho sakta" });
      updates.name = name;
    }

    if (req.body.shopName !== undefined) {
      updates.shopName = cleanText(req.body.shopName);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "Badalne ke liye kuch nahi mila" });
    }

    const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true });
    if (!user) return res.status(401).json({ message: "Account nahi mila" });

    res.json({ user: serializeUser(user) });
  })
);

// Galat purana password 401 nahi 400 deta hai, warna frontend ise "session khatam" samajh kar logout kar deta
router.post(
  "/change-password",
  requireAuth,
  loginLimiter,
  asyncHandler(async (req, res) => {
    const currentPassword =
      typeof req.body.currentPassword === "string" ? req.body.currentPassword : "";
    const newPassword = typeof req.body.newPassword === "string" ? req.body.newPassword : "";

    if (!isPasswordLengthOk(newPassword)) {
      return res.status(400).json({ message: PASSWORD_MESSAGE });
    }

    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(401).json({ message: "Account nahi mila" });

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Purana password ghalat hai" });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: "Password badal gaya" });
  })
);

export default router;
