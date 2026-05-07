import {
  validateWorkspacePayload,
  type WorkspacePayload,
} from "./canonical.ts";
import { sql } from "./postgres.ts";

export async function getDraftPayload(
  userId: number,
  workspaceId: number,
): Promise<WorkspacePayload | null> {
  const rows = await sql<{ payload: unknown }[]>`
    SELECT payload
    FROM request_draft
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  try {
    return validateWorkspacePayload(rows[0]!.payload);
  } catch {
    return null;
  }
}

export async function getDraftMeta(
  userId: number,
  workspaceId: number,
): Promise<{ content_hash: string } | null> {
  const rows = await sql<{ content_hash: string }[]>`
    SELECT content_hash
    FROM request_draft
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function upsertDraft(
  userId: number,
  workspaceId: number,
  payload: WorkspacePayload,
  contentHash: string,
): Promise<void> {
  await sql`
    INSERT INTO request_draft (user_id, workspace_id, payload, content_hash, updated_at)
    VALUES (
      ${userId},
      ${workspaceId},
      ${sql.json(payload)},
      ${contentHash},
      NOW()
    )
    ON CONFLICT (user_id, workspace_id)
    DO UPDATE SET
      payload = EXCLUDED.payload,
      content_hash = EXCLUDED.content_hash,
      updated_at = NOW()
  `;
}

export async function deleteDraft(
  userId: number,
  workspaceId: number,
): Promise<void> {
  await sql`
    DELETE FROM request_draft
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
  `;
}
