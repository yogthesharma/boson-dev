import { apiPrefix } from "./api";
import type { MergedWorkspaceView } from "./workspace";

type HeadersInit = Record<string, string>;

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export async function patchRequestOverride(
  requestId: string,
  patch: Record<string, unknown>,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${apiPrefix}/v1/requests/${encodeURIComponent(requestId)}/override`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ patch }),
      signal,
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`override failed: ${res.status} ${err}`);
  }
}

export async function deleteRequestOverride(
  requestId: string,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${apiPrefix}/v1/requests/${encodeURIComponent(requestId)}/override`,
    {
      method: "DELETE",
      headers: { ...headers },
      signal,
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`reset override failed: ${res.status} ${err}`);
  }
}

export async function deleteOverrideField(
  requestId: string,
  field: string,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${apiPrefix}/v1/requests/${encodeURIComponent(requestId)}/override/${encodeURIComponent(field)}`,
    {
      method: "DELETE",
      headers: { ...headers },
      signal,
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`revert field failed: ${res.status} ${err}`);
  }
}

export async function createUserRequest(
  body: {
    name: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: unknown;
  },
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${apiPrefix}/v1/user-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  const data = await parseJson<{ ok?: boolean; id?: string; error?: string }>(
    res,
  );
  if (!res.ok || !data.ok || !data.id) {
    throw new Error(data.error ?? `create user request failed (${res.status})`);
  }
  return data.id;
}

export async function patchUserRequest(
  id: string,
  patch: Record<string, unknown>,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${apiPrefix}/v1/user-requests/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(patch),
      signal,
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`update user request failed: ${res.status} ${err}`);
  }
}

export async function deleteUserRequest(
  id: string,
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(
    `${apiPrefix}/v1/user-requests/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { ...headers },
      signal,
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`delete user request failed: ${res.status} ${err}`);
  }
}

export async function getWorkspaceMerged(
  headers: HeadersInit,
  signal?: AbortSignal,
): Promise<MergedWorkspaceView | null> {
  const res = await fetch(`${apiPrefix}/v1/workspace`, {
    headers: { ...headers },
    signal,
  });
  if (res.status === 401) {
    const err = new Error("Unauthorized (401)");
    (err as Error & { status: number }).status = 401;
    throw err;
  }
  if (!res.ok) {
    throw new Error(`GET /v1/workspace failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    ok: boolean;
    workspace: MergedWorkspaceView | null;
  };
  return data.workspace ?? null;
}
