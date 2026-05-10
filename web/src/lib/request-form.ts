// UI state model for the request editor. The wire types in `@/types` are
// optimised for terse YAML / JSON; the editor keeps a richer view (stable
// row ids, opt-in rows, the JSON body kept as raw editor text) and converts
// to/from the wire shape only at the boundary.

import type {
  ApiRequest,
  Auth,
  MultipartField,
  RequestBody,
  RequestOptions,
} from "@/types";

export interface KvRow {
  id: string;
  enabled: boolean;
  key: string;
  value: string;
}

export type BodyKind = "none" | "text" | "json" | "form" | "multipart";

export type AuthKind = "none" | "bearer" | "basic" | "api_key" | "oauth2";

export interface BodyForm {
  kind: BodyKind;
  text: { contentType: string; value: string };
  json: { rawText: string };
  form: KvRow[];
  multipart: MultipartUiField[];
}

export interface MultipartUiField {
  id: string;
  enabled: boolean;
  name: string;
  kind: "text" | "file";
  value: string;
  path: string;
  contentType: string;
  fileName: string;
}

export interface AuthForm {
  kind: AuthKind;
  bearer: { token: string };
  basic: { username: string; password: string };
  apiKey: { name: string; value: string; location: "header" | "query" };
  oauth2: { token: string };
}

export interface OptionsForm {
  timeoutMs: number;
  followRedirects: boolean;
  maxRedirects: number;
  maxResponseBytes: number;
  cookies: boolean;
}

export interface RequestForm {
  id: string;
  name: string;
  folder: string;
  method: string;
  url: string;
  headers: KvRow[];
  query: KvRow[];
  body: BodyForm;
  auth: AuthForm;
  options: OptionsForm;
}

const DEFAULT_OPTIONS: OptionsForm = {
  timeoutMs: 30_000,
  followRedirects: true,
  maxRedirects: 10,
  maxResponseBytes: 5 * 1024 * 1024,
  cookies: false,
};

export const EMPTY_FORM: RequestForm = {
  id: "",
  name: "",
  folder: "",
  method: "GET",
  url: "",
  headers: [],
  query: [],
  body: emptyBody(),
  auth: emptyAuth(),
  options: { ...DEFAULT_OPTIONS },
};

export function emptyBody(): BodyForm {
  return {
    kind: "none",
    text: { contentType: "text/plain", value: "" },
    json: { rawText: "" },
    form: [],
    multipart: [],
  };
}

export function emptyAuth(): AuthForm {
  return {
    kind: "none",
    bearer: { token: "" },
    basic: { username: "", password: "" },
    apiKey: { name: "", value: "", location: "header" },
    oauth2: { token: "" },
  };
}

function rowId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export function newKvRow(initial?: Partial<KvRow>): KvRow {
  return {
    id: rowId(),
    enabled: true,
    key: "",
    value: "",
    ...initial,
  };
}

export function objectToRows(record: Record<string, string> | undefined): KvRow[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) =>
    newKvRow({ key, value }),
  );
}

export function rowsToObject(rows: KvRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    if (!row.enabled) continue;
    if (!row.key.trim()) continue;
    out[row.key] = row.value;
  }
  return out;
}

export function activeRowCount(rows: KvRow[]): number {
  return rows.reduce(
    (acc, row) => (row.enabled && row.key.trim() ? acc + 1 : acc),
    0,
  );
}

// ───────── api → form ─────────

export function requestToForm(request: ApiRequest): RequestForm {
  return {
    id: request.id,
    name: request.name,
    folder: request.folder ?? "",
    method: request.method || "GET",
    url: request.url,
    headers: objectToRows(request.headers),
    query: objectToRows(request.query),
    body: bodyToForm(request.body ?? null),
    auth: authToForm(request.auth ?? null),
    options: optionsToForm(request.options),
  };
}

function bodyToForm(body: RequestBody): BodyForm {
  const base = emptyBody();
  if (body == null) return base;
  if (typeof body === "string") {
    return {
      ...base,
      kind: body.length > 0 ? "text" : "none",
      text: { contentType: "", value: body },
    };
  }
  switch (body.kind) {
    case "text":
      return {
        ...base,
        kind: "text",
        text: {
          contentType: body.content_type ?? "",
          value: body.value,
        },
      };
    case "json":
      return {
        ...base,
        kind: "json",
        json: { rawText: stringifyJson(body.value) },
      };
    case "form":
      return {
        ...base,
        kind: "form",
        form: objectToRows(body.fields),
      };
    case "multipart":
      return {
        ...base,
        kind: "multipart",
        multipart: body.fields.map(multipartFieldToUi),
      };
    default:
      return base;
  }
}

function multipartFieldToUi(field: MultipartField): MultipartUiField {
  if (field.kind === "text") {
    return {
      id: rowId(),
      enabled: true,
      name: field.name,
      kind: "text",
      value: field.value,
      path: "",
      contentType: "",
      fileName: "",
    };
  }
  return {
    id: rowId(),
    enabled: true,
    name: field.name,
    kind: "file",
    value: "",
    path: field.path,
    contentType: field.content_type ?? "",
    fileName: field.file_name ?? "",
  };
}

function authToForm(auth: Auth | null): AuthForm {
  const base = emptyAuth();
  if (!auth) return base;
  switch (auth.kind) {
    case "bearer":
      return { ...base, kind: "bearer", bearer: { token: auth.token } };
    case "basic":
      return {
        ...base,
        kind: "basic",
        basic: { username: auth.username, password: auth.password },
      };
    case "api_key":
      return {
        ...base,
        kind: "api_key",
        apiKey: {
          name: auth.name,
          value: auth.value,
          location: auth.location ?? "header",
        },
      };
    case "oauth2":
      return {
        ...base,
        kind: "oauth2",
        oauth2: { token: auth.token ?? "" },
      };
    default:
      return base;
  }
}

function optionsToForm(options?: RequestOptions): OptionsForm {
  return {
    timeoutMs: options?.timeout_ms ?? DEFAULT_OPTIONS.timeoutMs,
    followRedirects:
      options?.follow_redirects ?? DEFAULT_OPTIONS.followRedirects,
    maxRedirects: options?.max_redirects ?? DEFAULT_OPTIONS.maxRedirects,
    maxResponseBytes:
      options?.max_response_bytes ?? DEFAULT_OPTIONS.maxResponseBytes,
    cookies: options?.cookies ?? DEFAULT_OPTIONS.cookies,
  };
}

// ───────── form → api ─────────

export function formToRequest(form: RequestForm): ApiRequest {
  const out: ApiRequest = {
    id: form.id,
    name: form.name,
    method: (form.method || "GET").toUpperCase(),
    url: form.url,
    headers: rowsToObject(form.headers),
  };
  if (form.folder.trim()) out.folder = form.folder.trim();
  const query = rowsToObject(form.query);
  if (Object.keys(query).length > 0) out.query = query;
  const body = formToBody(form.body);
  if (body !== null) out.body = body;
  const auth = formToAuth(form.auth);
  if (auth) out.auth = auth;
  const options = formToOptions(form.options);
  if (options) out.options = options;
  return out;
}

function formToBody(body: BodyForm): RequestBody {
  switch (body.kind) {
    case "none":
      return null;
    case "text":
      if (!body.text.value && !body.text.contentType) return null;
      if (!body.text.contentType) return body.text.value;
      return {
        kind: "text",
        content_type: body.text.contentType,
        value: body.text.value,
      };
    case "json": {
      const trimmed = body.json.rawText.trim();
      if (!trimmed) return null;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        // Send invalid JSON through as a text/plain payload so the user
        // gets a server-side error rather than a silent loss.
        return {
          kind: "text",
          content_type: "application/json",
          value: trimmed,
        };
      }
      return { kind: "json", value: parsed };
    }
    case "form": {
      const fields = rowsToObject(body.form);
      if (Object.keys(fields).length === 0) return null;
      return { kind: "form", fields };
    }
    case "multipart": {
      const fields: MultipartField[] = [];
      for (const field of body.multipart) {
        if (!field.enabled || !field.name.trim()) continue;
        if (field.kind === "text") {
          fields.push({
            name: field.name,
            kind: "text",
            value: field.value,
          });
        } else if (field.path.trim()) {
          fields.push({
            name: field.name,
            kind: "file",
            path: field.path,
            ...(field.contentType.trim()
              ? { content_type: field.contentType }
              : {}),
            ...(field.fileName.trim() ? { file_name: field.fileName } : {}),
          });
        }
      }
      if (fields.length === 0) return null;
      return { kind: "multipart", fields };
    }
    default:
      return null;
  }
}

function formToAuth(auth: AuthForm): Auth | null {
  switch (auth.kind) {
    case "none":
      return null;
    case "bearer":
      return auth.bearer.token
        ? { kind: "bearer", token: auth.bearer.token }
        : null;
    case "basic":
      if (!auth.basic.username && !auth.basic.password) return null;
      return {
        kind: "basic",
        username: auth.basic.username,
        password: auth.basic.password,
      };
    case "api_key":
      if (!auth.apiKey.name) return null;
      return {
        kind: "api_key",
        name: auth.apiKey.name,
        value: auth.apiKey.value,
        location: auth.apiKey.location,
      };
    case "oauth2":
      return { kind: "oauth2", token: auth.oauth2.token };
    default:
      return null;
  }
}

function formToOptions(options: OptionsForm): RequestOptions | null {
  const isDefault =
    options.timeoutMs === DEFAULT_OPTIONS.timeoutMs &&
    options.followRedirects === DEFAULT_OPTIONS.followRedirects &&
    options.maxRedirects === DEFAULT_OPTIONS.maxRedirects &&
    options.maxResponseBytes === DEFAULT_OPTIONS.maxResponseBytes &&
    options.cookies === DEFAULT_OPTIONS.cookies;
  if (isDefault) return null;
  return {
    timeout_ms: options.timeoutMs,
    follow_redirects: options.followRedirects,
    max_redirects: options.maxRedirects,
    max_response_bytes: options.maxResponseBytes,
    cookies: options.cookies,
  };
}

function stringifyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const REQUEST_FORM_DEFAULTS = DEFAULT_OPTIONS;
