import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!token) {
    return res.status(401).json({ message: "Pehle login karein" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    const user = await User.findById(payload.sub).lean();
    if (!user || user.isActive === false) {
      return res.status(401).json({ message: "Account nahi mila ya band hai" });
    }
    req.userId = String(user._id);
    req.accountId = String(user.accountId || user._id);
    req.userRole = user.role || "owner";
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
