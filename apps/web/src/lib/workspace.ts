/**
 * Workspace data fetched from the server.
 * Mirrors `WorkspacePayload` in `apps/server/src/lib/canonical.ts`. Keep them
 * in sync — the doc in `docs/sync-and-overrides.md` is the source of truth.
 */
import { apiPrefix } from "./api";

export const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const RAW_BODY_TYPES = ["json", "xml", "text", "sparql"] as const;
export type RawBodyType = (typeof RAW_BODY_TYPES)[number];

export type RequestBody =
  | { type: "none" }
  | { type: RawBodyType; content: string }
  | { type: "form-urlencoded"; content: Record<string, string> };

export type CanonicalRequest = {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: RequestBody;
};

export type Environment = {
  name: string;
  baseUrl: string;
  vars: Record<string, string>;
};

export type WorkspacePayload = {
  workspace: string;
  environments: Environment[];
  requests: CanonicalRequest[];
};

type WorkspaceResponse = {
  ok: boolean;
  workspace: WorkspacePayload | null;
};

export async function getWorkspace(
  signal?: AbortSignal,
): Promise<WorkspacePayload | null> {
  const res = await fetch(`${apiPrefix}/v1/workspace`, { signal });
  if (!res.ok) {
    throw new Error(`GET /v1/workspace failed: ${res.status}`);
  }
  const data = (await res.json()) as WorkspaceResponse;
  return data.workspace ?? null;
}
