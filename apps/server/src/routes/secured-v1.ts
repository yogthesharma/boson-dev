import { createHash } from "node:crypto";

import { Hono } from "hono";

import type { AuthedVariables } from "../middleware/require-auth.ts";
import {
  readWorkspaceWithId,
  replaceWorkspaceCanonical,
  validateOverridePatch,
  validateUserRequestCreate,
  validateWorkspacePayload,
  ValidationError,
} from "../lib/canonical.ts";
import {
  deleteDraft,
  getDraftMeta,
  upsertDraft,
} from "../lib/draft-repo.ts";
import { buildMergedWorkspaceView, isOverrideField } from "../lib/merge-workspace.ts";
import {
  deleteOverride,
  deleteOverrideField,
  mergeOverridePatch,
} from "../lib/override-repo.ts";
import {
  deleteUserRequest,
  insertUserRequest,
  listUserRequests,
  updateUserRequest,
} from "../lib/user-request-repo.ts";

export const securedV1Routes = new Hono<{ Variables: AuthedVariables }>();

securedV1Routes.post("/canonical", async (c) => {
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

securedV1Routes.get("/workspace", async (c) => {
  const userId = c.get("userId");
  const merged = await buildMergedWorkspaceView(userId);
  return c.json({ ok: true, workspace: merged });
});

securedV1Routes.patch("/requests/:requestId/override", async (c) => {
  const userId = c.get("userId");
  const requestId = c.req.param("requestId");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }
  if (!row.payload.requests.some((r) => r.id === requestId)) {
    return c.json({ ok: false, error: "Unknown request id" }, 404);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }

  const patchInput =
    raw && typeof raw === "object" && raw !== null && "patch" in raw
      ? (raw as { patch: unknown }).patch
      : raw;

  let validated;
  try {
    validated = validateOverridePatch(patchInput);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ ok: false, error: err.message, path: err.path }, 400);
    }
    throw err;
  }

  await mergeOverridePatch(
    userId,
    row.workspaceId,
    requestId,
    validated as Record<string, unknown>,
  );
  return c.json({ ok: true });
});

securedV1Routes.delete("/requests/:requestId/override", async (c) => {
  const userId = c.get("userId");
  const requestId = c.req.param("requestId");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }
  await deleteOverride(userId, row.workspaceId, requestId);
  return c.json({ ok: true });
});

securedV1Routes.delete("/requests/:requestId/override/:field", async (c) => {
  const userId = c.get("userId");
  const requestId = c.req.param("requestId");
  const field = c.req.param("field");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }
  if (!isOverrideField(field)) {
    return c.json({ ok: false, error: `Unknown override field: ${field}` }, 400);
  }
  await deleteOverrideField(userId, row.workspaceId, requestId, field);
  return c.json({ ok: true });
});

securedV1Routes.post("/user-requests", async (c) => {
  const userId = c.get("userId");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }

  let body;
  try {
    body = validateUserRequestCreate(raw);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ ok: false, error: err.message, path: err.path }, 400);
    }
    throw err;
  }

  const existing = await listUserRequests(userId, row.workspaceId);
  const id = await insertUserRequest(
    userId,
    row.workspaceId,
    body,
    existing.length,
  );
  return c.json({ ok: true, id });
});

securedV1Routes.patch("/user-requests/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }

  let patch;
  try {
    patch = validateOverridePatch(raw);
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ ok: false, error: err.message, path: err.path }, 400);
    }
    throw err;
  }

  const ok = await updateUserRequest(
    userId,
    row.workspaceId,
    id,
    patch,
  );
  if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true });
});

securedV1Routes.delete("/user-requests/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }
  const ok = await deleteUserRequest(userId, row.workspaceId, id);
  if (!ok) return c.json({ ok: false, error: "Not found" }, 404);
  return c.json({ ok: true });
});

securedV1Routes.post("/drafts", async (c) => {
  const userId = c.get("userId");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Body must be valid JSON" }, 400);
  }

  if (!raw || typeof raw !== "object" || !("payload" in raw)) {
    return c.json({ ok: false, error: "Expected { payload, hash? }" }, 400);
  }

  let payload;
  try {
    payload = validateWorkspacePayload(
      (raw as { payload: unknown }).payload,
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      return c.json({ ok: false, error: err.message, path: err.path }, 400);
    }
    throw err;
  }

  const body = raw as { payload: unknown; hash?: unknown };
  const clientHash = typeof body.hash === "string" ? body.hash : "";

  const meta = await getDraftMeta(userId, row.workspaceId);
  if (meta && clientHash && meta.content_hash === clientHash) {
    return c.json({ ok: true, unchanged: true });
  }

  const hash =
    clientHash ||
    createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  await upsertDraft(userId, row.workspaceId, payload, hash);
  return c.json({ ok: true, unchanged: false });
});

securedV1Routes.delete("/drafts", async (c) => {
  const userId = c.get("userId");
  const row = await readWorkspaceWithId();
  if (!row) {
    return c.json({ ok: false, error: "No workspace has been pushed yet" }, 404);
  }
  await deleteDraft(userId, row.workspaceId);
  return c.json({ ok: true });
});
