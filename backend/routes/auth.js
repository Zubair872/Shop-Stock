import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanText } from "../utils/validate.js";
import { serializeUser } from "../utils/serialize.js";

const router = Router();

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function signToken(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: "7d",
  });
}

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const name = cleanText(req.body.name);
    const shopName = cleanText(req.body.shopName);
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = String(req.body.password ?? "");

    if (!name) {
      return res.status(400).json({ message: "Apna naam likhein" });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Sahi email likhein" });
    }

    if (password.length < 8 || password.length > 72) {
      return res
        .status(400)
        .json({ message: "Password 8 se 72 characters ka hona chahiye" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Is email se account pehle se bana hua hai" });
    }

    const user = await User.create({ name, email, password, shopName });

    res.status(201).json({
      token: signToken(user._id),
      user: serializeUser(user),
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const email = cleanText(req.body.email, 200).toLowerCase();
    const password = String(req.body.password ?? "");

    const user = await User.findOne({ email }).select("+password");
    const valid = user ? await user.comparePassword(password) : false;

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

export default router;
