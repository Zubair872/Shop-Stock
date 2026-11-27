import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";
import { evaluateAccountAccess } from "../utils/subscription.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Pehle login karein" });
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
  } catch {
    return res
      .status(401)
      .json({ message: "Session khatam ho gaya, dobara login karein" });
  }

  try {
    const user = await User.findById(payload.sub).lean();
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "Account nahi mila ya band hai" });
    }
    if (user.isDemo && user.demoExpiresAt && user.demoExpiresAt <= new Date()) {
      return res.status(401).json({ message: "Demo session khatam ho gaya" });
    }

    const accountId = String(user.accountId || user._id);
    if (user.role !== "superadmin" && !user.isDemo) {
      const owner =
        accountId === String(user._id)
          ? user
          : await User.findById(accountId).lean();
      const access = evaluateAccountAccess(owner, new Date(), env.supportWhatsapp);
      if (!access.allowed) {
        return res.status(access.status || 403).json({
          message: access.message,
          code: access.code,
        });
      }
    }

    req.userId = String(user._id);
    req.userEmail = user.email;
    req.accountId = accountId;
    req.userRole = user.role || "owner";
    req.isDemo = Boolean(user.isDemo);
    next();
  } catch {
    res
      .status(401)
      .json({ message: "Session khatam ho gaya, dobara login karein" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: "Is kaam ki ijazat nahi hai" });
    }
    next();
  };
}
