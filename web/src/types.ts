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

export interface ApiRequest {
  id: string;
  name: string;
  folder?: string | null;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
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
  error?: string | null;
  created_at: string;
}
