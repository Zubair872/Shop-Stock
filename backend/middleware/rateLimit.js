// Chhota in-memory rate limiter. Ek server instance ke andar kaam karta hai.
// Serverless (Vercel) par har instance ki apni memory hoti hai, isliye wahan yeh sirf partial
// hifazat hai; bade pemane par Redis/Upstash based limiter lagayein.
export function createRateLimiter({ windowMs, max, keyFn, message }) {
  const hits = new Map();

  function purge(now) {
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip || "unknown";

    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (hits.size > 5000) purge(now);

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(max - entry.count, 0)));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        message: message || "Bohat zyada requests, thori der baad koshish karein",
      });
    }

    next();
  };
}
