import { serve } from "@hono/node-server";

import { createApp } from "./app.ts";
import { config } from "./config.ts";
import { runMigrations } from "./db/migrate.ts";

async function main() {
  try {
    await runMigrations();
  } catch (err) {
    console.error("[boot] migrations failed; aborting startup", err);
    process.exit(1);
  }

  const app = createApp();
  serve({ fetch: app.fetch, port: config.port }, (info) => {
    console.log(`boson-server listening on http://localhost:${info.port}`);
  });
}

main();
