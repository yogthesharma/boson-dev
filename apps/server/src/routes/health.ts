import { Hono } from "hono";

import { pingPostgres } from "../lib/postgres.ts";
import { pingRedis } from "../lib/redis.ts";

export const healthRoutes = new Hono().get("/health", async (c) => {
  const [postgresOk, redisOk] = await Promise.all([pingPostgres(), pingRedis()]);
  const ok = postgresOk && redisOk;
  return c.json(
    {
      status: ok ? "ok" : "degraded",
      postgres: postgresOk,
      redis: redisOk,
      service: "boson-server",
    },
    ok ? 200 : 503,
  );
});
