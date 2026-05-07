import type { OverrideField } from "./canonical.ts";
import { sql } from "./postgres.ts";

export async function listOverridePatches(
  userId: number,
  workspaceId: number,
): Promise<Map<string, Record<string, unknown>>> {
  const rows = await sql<{ request_id: string; patch: Record<string, unknown> }[]>`
    SELECT request_id, patch
    FROM request_override
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
  `;
  const m = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    m.set(r.request_id, (r.patch ?? {}) as Record<string, unknown>);
  }
  return m;
}

export async function mergeOverridePatch(
  userId: number,
  workspaceId: number,
  requestId: string,
  partial: Record<string, unknown>,
): Promise<void> {
  const existing = await listOverridePatches(userId, workspaceId);
  const prev = { ...(existing.get(requestId) ?? {}) };
  const merged = { ...prev, ...partial };
  await sql`
    INSERT INTO request_override (user_id, workspace_id, request_id, patch)
    VALUES (${userId}, ${workspaceId}, ${requestId}, ${sql.json(merged as never)})
    ON CONFLICT (user_id, workspace_id, request_id)
    DO UPDATE SET patch = ${sql.json(merged as never)}, updated_at = NOW()
  `;
}

export async function deleteOverride(
  userId: number,
  workspaceId: number,
  requestId: string,
): Promise<void> {
  await sql`
    DELETE FROM request_override
    WHERE user_id = ${userId}
      AND workspace_id = ${workspaceId}
      AND request_id = ${requestId}
  `;
}

export async function deleteOverrideField(
  userId: number,
  workspaceId: number,
  requestId: string,
  field: OverrideField,
): Promise<void> {
  const existing = await listOverridePatches(userId, workspaceId);
  const prev = { ...(existing.get(requestId) ?? {}) };
  if (!(field in prev)) return;
  const { [field]: _removed, ...rest } = prev;
  if (Object.keys(rest).length === 0) {
    await deleteOverride(userId, workspaceId, requestId);
    return;
  }
  await sql`
    INSERT INTO request_override (user_id, workspace_id, request_id, patch)
    VALUES (${userId}, ${workspaceId}, ${requestId}, ${sql.json(rest as never)})
    ON CONFLICT (user_id, workspace_id, request_id)
    DO UPDATE SET patch = ${sql.json(rest as never)}, updated_at = NOW()
  `;
}
