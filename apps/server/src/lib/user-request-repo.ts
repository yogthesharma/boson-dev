import type { CanonicalRequest, HttpMethod, RequestBody } from "./canonical.ts";
import { sql } from "./postgres.ts";

export async function listUserRequests(
  userId: number,
  workspaceId: number,
): Promise<CanonicalRequest[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      method: string;
      url: string;
      headers: Record<string, string>;
      body: RequestBody;
    }[]
  >`
    SELECT id, name, method, url, headers, body
    FROM request_user
    WHERE user_id = ${userId} AND workspace_id = ${workspaceId}
    ORDER BY sort_index ASC, created_at ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    method: r.method as HttpMethod,
    url: r.url,
    headers: r.headers ?? {},
    body: r.body ?? { type: "none" },
  }));
}

export async function insertUserRequest(
  userId: number,
  workspaceId: number,
  req: Omit<CanonicalRequest, "id"> & { id?: string },
  sortIndex: number,
): Promise<string> {
  const id = req.id?.trim() || crypto.randomUUID();
  await sql`
    INSERT INTO request_user (
      id, user_id, workspace_id, name, method, url, headers, body, sort_index
    ) VALUES (
      ${id},
      ${userId},
      ${workspaceId},
      ${req.name},
      ${req.method},
      ${req.url},
      ${sql.json(req.headers)},
      ${sql.json(req.body)},
      ${sortIndex}
    )
  `;
  return id;
}

export async function updateUserRequest(
  userId: number,
  workspaceId: number,
  requestId: string,
  patch: Partial<
    Pick<CanonicalRequest, "name" | "method" | "url" | "headers" | "body">
  >,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM request_user
    WHERE id = ${requestId}
      AND user_id = ${userId}
      AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return false;

  const current = await sql<
    {
      name: string;
      method: string;
      url: string;
      headers: Record<string, string>;
      body: RequestBody;
    }[]
  >`
    SELECT name, method, url, headers, body
    FROM request_user
    WHERE id = ${requestId} AND user_id = ${userId}
    LIMIT 1
  `;
  const c = current[0]!;
  const name = patch.name ?? c.name;
  const method = patch.method ?? (c.method as HttpMethod);
  const url = patch.url ?? c.url;
  const headers = patch.headers ?? c.headers;
  const body = patch.body ?? c.body;

  await sql`
    UPDATE request_user
    SET
      name = ${name},
      method = ${method},
      url = ${url},
      headers = ${sql.json(headers)},
      body = ${sql.json(body)}
    WHERE id = ${requestId}
      AND user_id = ${userId}
      AND workspace_id = ${workspaceId}
  `;
  return true;
}

export async function deleteUserRequest(
  userId: number,
  workspaceId: number,
  requestId: string,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM request_user
    WHERE id = ${requestId}
      AND user_id = ${userId}
      AND workspace_id = ${workspaceId}
    RETURNING id
  `;
  return rows.length > 0;
}
