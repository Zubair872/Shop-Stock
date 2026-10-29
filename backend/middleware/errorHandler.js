export function notFound(req, res) {
  res.status(404).json({ message: "Yeh address maujood nahi hai" });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Data ka format ghalat hai" });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Data bohat bara hai" });
  }

  if (err.name === "ValidationError") {
    const first = Object.values(err.errors || {})[0];
    return res
      .status(400)
      .json({ message: first?.message || "Data sahi nahi hai" });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ message: "Data ka format ghalat hai" });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: "Yeh record pehle se maujood hai" });
  }

  console.error(`[error] ${req.id || "-"} ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) return next(err);

  res.status(500).json({
    message: "Server mein masla aa gaya, dobara koshish karein",
    requestId: req.id,
  });
}
