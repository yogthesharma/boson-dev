import { Hono } from "hono";

import { canonicalRoutes } from "./routes/canonical.ts";
import { healthRoutes } from "./routes/health.ts";
import { proxyRoutes } from "./routes/proxy.ts";

export function createApp() {
  const app = new Hono();

  app.get("/", (c) =>
    c.json({
      name: "boson-server",
      docs:
        "GET /health · POST /proxy · POST /v1/canonical · GET /v1/workspace",
    }),
  );

  app.route("/", healthRoutes);
  app.route("/", proxyRoutes);
  app.route("/", canonicalRoutes);

  return app;
}

export type App = ReturnType<typeof createApp>;
