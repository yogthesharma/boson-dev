import { Hono } from "hono";

import { runProxy } from "../lib/proxy.ts";

export const proxyRoutes = new Hono().post("/proxy", async (c) => {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const result = await runProxy(payload);
  if (result.httpStatus === 200) return c.json(result.body, 200);
  if (result.httpStatus === 400) return c.json(result.body, 400);
  return c.json(result.body, 502);
});
