import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { env, assertEnv } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { securityHeaders, requestContext } from "./middleware/security.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

assertEnv();

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", env.trustProxy);

app.use(requestContext);
app.use(securityHeaders);

// CORS_ORIGIN khaali ho to production mein koi doosra domain allowed nahi (same-origin hi chalega)
if (env.corsOrigins.length > 0) {
  app.use(cors({ origin: env.corsOrigins }));
} else if (!env.isProduction) {
  app.use(cors());
}

app.use(express.json({ limit: "100kb" }));

// Liveness: sirf batata hai ke process zinda hai
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

// Readiness: database se rabta bhi theek hai?
app.get("/api/health/ready", async (req, res) => {
  try {
    await connectDB();
    const ok = mongoose.connection.readyState === 1;
    res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not-ready" });
  } catch {
    res.status(503).json({ status: "not-ready" });
  }
});

app.use(
  "/api",
  createRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
    message: "Bohat zyada requests, ek minute baad koshish karein",
  })
);

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
