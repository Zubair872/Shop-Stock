import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

// Helmet jaisi basic headers. API sirf JSON deti hai, isliye CSP bilkul band rakhi hai.
export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("Cache-Control", "no-store");
  if (env.isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}

// Har request ko ek id milti hai; 500 error par user ko yahi id dikhti hai taake log mein dhoondh sakein.
export function requestContext(req, res, next) {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);

  if (!env.isTest) {
    const started = Date.now();
    res.on("finish", () => {
      if (req.path === "/api/health") return;
      console.log(`${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - started}ms ${req.id}`);
    });
  }
  next();
}
