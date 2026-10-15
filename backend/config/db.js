import mongoose from "mongoose";

const cache = globalThis.mongooseCache || { conn: null, promise: null };
globalThis.mongooseCache = cache;

export async function connectDB() {
  if (cache.conn) {
    return cache.conn;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing in environment variables");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(process.env.MONGO_URI);
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }

  return cache.conn;
}
