// API-shaped types. These mirror the Rust schema in src/config and src/db.

export interface ProjectView {
  name: string;
  schema_version: number;
  environments: Environment[];
  requests: ApiRequest[];
  drafts: Draft[];
  secret_names?: string[];
  stale_drafts?: string[];
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export type ApiKeyLocation = "header" | "query";

export type Auth =
  | { kind: "bearer"; token: string }
  | { kind: "basic"; username: string; password: string }
  | { kind: "api_key"; name: string; value: string; location?: ApiKeyLocation }
  | { kind: "oauth2"; token?: string | null };

export interface MultipartFieldText {
  name: string;
  kind: "text";
  value: string;
}

export interface MultipartFieldFile {
  name: string;
  kind: "file";
  path: string;
  content_type?: string | null;
  file_name?: string | null;
}

export type MultipartField = MultipartFieldText | MultipartFieldFile;

/**
 * The wire shape of a request body. Matches the custom serde in
 * `src/config/body.rs`: a plain string is shorthand for a `text` body
 * with no content-type override.
 */
export type RequestBody =
  | null
  | string
  | { kind: "text"; content_type?: string | null; value: string }
  | { kind: "json"; value: unknown }
  | { kind: "form"; fields: Record<string, string> }
  | { kind: "multipart"; fields: MultipartField[] };

export interface RequestOptions {
  timeout_ms?: number;
  follow_redirects?: boolean;
  max_redirects?: number;
  max_response_bytes?: number;
  cookies?: boolean;
}

export interface ApiRequest {
  id: string;
  name: string;
  folder?: string | null;
  method: string;
  url: string;
  headers: Record<string, string>;
  query?: Record<string, string>;
  auth?: Auth | null;
  body?: RequestBody;
  options?: RequestOptions;
}

export interface Draft {
  request_id: string;
  request: ApiRequest;
  updated_at: string;
}

export interface HistoryItem {
  id: number;
  request_id: string;
  environment_id?: string | null;
  method: string;
  url: string;
  status?: number | null;
  duration_ms: number;
  response_headers: Record<string, string>;
  response_body: string;
  response_truncated?: boolean;
  error?: string | null;
  created_at: string;
}
