import { createClient } from "redis";

import { config } from "../config.ts";

export const redis = createClient({ url: config.redisUrl });

async function ensureRedis(): Promise<void> {
  if (!redis.isOpen) await redis.connect();
}

export async function pingRedis(): Promise<boolean> {
  try {
    await ensureRedis();
    const pong = await redis.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
