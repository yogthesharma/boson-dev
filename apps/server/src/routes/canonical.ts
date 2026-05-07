import { Hono } from "hono";

import {
  readWorkspace,
  replaceWorkspaceCanonical,
  validateWorkspacePayload,
  ValidationError,
} from "../lib/canonical.ts";

export const canonicalRoutes = new Hono();

/**
 * `POST /v1/canonical`
 * Replace the entire canonical state for a workspace.
 *
 * Body shape: see `WorkspacePayload`. The CLI sends this after parsing the
 * local `boson.yml`. Validation runs before any DB writes.
 */
canonicalRoutes.post("/v1/canonical", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }

  let payload;
  try {
    payload = validateWorkspacePayload(raw);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ ok: false, error: err.message, path: err.path }, 400);
    }
    throw err;
  }

  await replaceWorkspaceCanonical(payload);

  return c.json({
    ok: true,
    workspace: payload.workspace,
    requests: payload.requests.length,
    environments: payload.environments.length,
  });
});

/**
 * `GET /v1/workspace`
 * Read the canonical workspace. Returns `null` payload if nothing has been
 * pushed yet (rather than 404, so the web client can render an empty state).
 */
canonicalRoutes.get("/v1/workspace", async (c) => {
  const ws = await readWorkspace();
  return c.json({ ok: true, workspace: ws });
});
