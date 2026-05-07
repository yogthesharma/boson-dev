import { Hono } from "hono";

import type { AuthedVariables } from "./middleware/require-auth.ts";
import { requireAuth } from "./middleware/require-auth.ts";
import { authPublicRoutes } from "./routes/auth-public.ts";
import { healthRoutes } from "./routes/health.ts";
import { proxyRoutes } from "./routes/proxy.ts";
import { securedV1Routes } from "./routes/secured-v1.ts";

export function createApp() {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "boson-server",
      docs:
        "GET /health · POST /proxy · POST /v1/auth/login · POST /v1/auth/register · " +
        "POST /v1/canonical (auth) · GET /v1/workspace (auth) · …",
    }),
  );

  app.route("/", healthRoutes);
  app.route("/", proxyRoutes);

  app.route("/v1", authPublicRoutes);

  const secured = new Hono<{ Variables: AuthedVariables }>();
  secured.use("*", requireAuth);
  secured.route("/", securedV1Routes);
  app.route("/v1", secured);

  return app;
}

export type App = ReturnType<typeof createApp>;
