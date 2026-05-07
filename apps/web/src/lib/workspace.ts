/**
 * Workspace data from the server.
 * Mirrors merged types on the server (`merge-workspace.ts`). See
 * `docs/sync-and-overrides.md`.
 */

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

export type RequestSource = "canonical" | "draft" | "user";

export type MergedRequest = CanonicalRequest & {
  source: RequestSource;
  overridden_fields: string[];
  draft_fields: string[];
};

export type MergedWorkspaceView = {
  workspace: string;
  environments: Environment[];
  requests: MergedRequest[];
  userRequests: MergedRequest[];
};

/** @deprecated Prefer `MergedWorkspaceView`; kept for older imports. */
export type WorkspacePayload = MergedWorkspaceView;
