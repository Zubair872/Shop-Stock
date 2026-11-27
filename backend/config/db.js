import dns from "node:dns";
import mongoose from "mongoose";

const cache = globalThis.mongooseCache || { conn: null, promise: null };
globalThis.mongooseCache = cache;

async function openConnection() {
  return mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
  });
}

export async function connectDB() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  if (!cache.promise) {
    cache.promise = openConnection().catch(async (error) => {
      if (String(error?.message || "").includes("querySrv")) {
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        return openConnection();
      }
      throw error;
    });
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;

    console.error("Mongo error:", error.message);

    // har shard server ka asli error
    const servers = error.reason?.servers;
    if (servers) {
      for (const [host, desc] of servers) {
        console.error(host, "=>", desc.error?.message || desc.error || "koi error nahi");
      }
    }

    throw error;
  }

  return cache.conn;
}