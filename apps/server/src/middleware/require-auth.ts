import type { MiddlewareHandler } from "hono";

import { config } from "../config.ts";
import { verifyUserToken } from "../lib/jwt.ts";

export type AuthedVariables = { userId: number };

export const requireAuth: MiddlewareHandler<{
  Variables: AuthedVariables;
}> = async (c, next) => {
  if (config.authDisabled) {
    c.set("userId", 1);
    await next();
    return;
  }

  const header = c.req.header("Authorization") ?? "";
  const m = /^Bearer\s+(\S+)/i.exec(header);
  if (!m) {
    return c.json({ ok: false, error: "Missing or invalid Authorization header" }, 401);
  }

  try {
    const { sub } = await verifyUserToken(config.jwtSecret, m[1]!);
    const id = Number(sub);
    if (!Number.isFinite(id) || id < 1) {
      return c.json({ ok: false, error: "Invalid token subject" }, 401);
    }
    c.set("userId", id);
    await next();
  } catch {
    return c.json({ ok: false, error: "Invalid or expired token" }, 401);
  }
};
