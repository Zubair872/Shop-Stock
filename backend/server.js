import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import { env } from "./config/env.js";

if (!process.env.VERCEL) {
  const server = app.listen(env.port, () => {
    console.log(`Backend chal raha hai: http://localhost:${env.port}`);
  });

  // Band hone se pehle chalti requests poori hone do (deploy / docker stop par)
  const shutdown = (signal) => {
    console.log(`${signal} mila, band ho raha hai...`);
    server.close(async () => {
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});

export default app;
