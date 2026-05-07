/**
 * Canonical workspace types + validators + repository.
 *
 * `WorkspacePayload` is the wire shape used by both `POST /v1/canonical` and
 * `GET /v1/workspace`. The CLI sends it; the web client reads it.
 */
import { sql } from "./postgres.ts";

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

/* -------------------------------------------------------------------------- */
/* validation                                                                 */
/* -------------------------------------------------------------------------- */

export class ValidationError extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ValidationError";
    this.path = path;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, path: string): string {
  if (typeof v !== "string") {
    throw new ValidationError(path, `expected string, got ${typeof v}`);
  }
  return v;
}

function asStringMap(v: unknown, path: string): Record<string, string> {
  if (v == null) return {};
  if (!isObject(v)) {
    throw new ValidationError(path, "expected object<string,string>");
  }
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof val !== "string") {
      throw new ValidationError(`${path}.${k}`, "value must be a string");
    }
    out[k] = val;
  }
  return out;
}

function parseBody(v: unknown, path: string): RequestBody {
  if (v == null) return { type: "none" };
  if (!isObject(v)) {
    throw new ValidationError(path, "expected an object with a `type` field");
  }
  const type = asString(v.type, `${path}.type`);
  if (type === "none") return { type: "none" };
  if ((RAW_BODY_TYPES as readonly string[]).includes(type)) {
    const content = typeof v.content === "string" ? v.content : "";
    return { type: type as RawBodyType, content };
  }
  if (type === "form-urlencoded") {
    return {
      type: "form-urlencoded",
      content: asStringMap(v.content, `${path}.content`),
    };
  }
  throw new ValidationError(`${path}.type`, `unsupported body type "${type}"`);
}

function parseRequest(v: unknown, path: string): CanonicalRequest {
  if (!isObject(v)) {
    throw new ValidationError(path, "expected an object");
  }
  const id = asString(v.id, `${path}.id`).trim();
  if (!id) throw new ValidationError(`${path}.id`, "must be non-empty");

  const method = asString(v.method, `${path}.method`).toUpperCase();
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    throw new ValidationError(
      `${path}.method`,
      `must be one of ${HTTP_METHODS.join("|")}`,
    );
  }

  return {
    id,
    name: asString(v.name ?? id, `${path}.name`),
    method: method as HttpMethod,
    url: asString(v.url, `${path}.url`),
    headers: asStringMap(v.headers, `${path}.headers`),
    body: parseBody(v.body, `${path}.body`),
  };
}

function parseEnvironment(v: unknown, path: string): Environment {
  if (!isObject(v)) {
    throw new ValidationError(path, "expected an object");
  }
  return {
    name: asString(v.name, `${path}.name`),
    baseUrl: asString(v.baseUrl, `${path}.baseUrl`),
    vars: asStringMap(v.vars, `${path}.vars`),
  };
}

export function validateWorkspacePayload(input: unknown): WorkspacePayload {
  if (!isObject(input)) {
    throw new ValidationError("$", "payload must be an object");
  }
  const workspace = asString(input.workspace, "$.workspace").trim();
  if (!workspace) throw new ValidationError("$.workspace", "must be non-empty");

  const envsRaw = input.environments;
  if (!Array.isArray(envsRaw) || envsRaw.length === 0) {
    throw new ValidationError(
      "$.environments",
      "must be a non-empty array",
    );
  }
  const environments = envsRaw.map((e, i) =>
    parseEnvironment(e, `$.environments[${i}]`),
  );

  const reqsRaw = input.requests ?? [];
  if (!Array.isArray(reqsRaw)) {
    throw new ValidationError("$.requests", "must be an array");
  }
  const requests = reqsRaw.map((r, i) =>
    parseRequest(r, `$.requests[${i}]`),
  );

  const seen = new Set<string>();
  for (const r of requests) {
    if (seen.has(r.id)) {
      throw new ValidationError("$.requests", `duplicate request id "${r.id}"`);
    }
    seen.add(r.id);
  }

  return { workspace, environments, requests };
}

export const OVERRIDE_FIELDS = [
  "name",
  "method",
  "url",
  "headers",
  "body",
] as const satisfies readonly (keyof CanonicalRequest)[];

export type OverrideField = (typeof OVERRIDE_FIELDS)[number];

/** Validate a partial request object used as an override patch (top-level keys only). */
export function validateOverridePatch(input: unknown): Partial<CanonicalRequest> {
  if (!isObject(input)) {
    throw new ValidationError("$", "patch must be an object");
  }
  const out: Partial<CanonicalRequest> = {};
  for (const key of OVERRIDE_FIELDS) {
    if (!(key in input)) continue;
    const v = input[key];
    if (key === "name") {
      const s = asString(v, `$.${key}`).trim();
      if (!s) throw new ValidationError(`$.${key}`, "must be non-empty");
      out.name = s;
    } else if (key === "method") {
      const method = asString(v, `$.${key}`).toUpperCase();
      if (!(HTTP_METHODS as readonly string[]).includes(method)) {
        throw new ValidationError(
          `$.${key}`,
          `must be one of ${HTTP_METHODS.join("|")}`,
        );
      }
      out.method = method as HttpMethod;
    } else if (key === "url") {
      out.url = asString(v, `$.${key}`);
    } else if (key === "headers") {
      out.headers = asStringMap(v, `$.${key}`);
    } else if (key === "body") {
      out.body = parseBody(v, `$.${key}`);
    }
  }
  if (Object.keys(out).length === 0) {
    throw new ValidationError("$", "patch must include at least one known field");
  }
  return out;
}

/** Create-body validation for `POST /v1/user-requests` (no `id` required). */
export function validateUserRequestCreate(
  input: unknown,
): Omit<CanonicalRequest, "id"> {
  if (!isObject(input)) {
    throw new ValidationError("$", "expected an object");
  }
  const name = asString(input.name, "$.name").trim();
  if (!name) throw new ValidationError("$.name", "must be non-empty");
  const method = asString(input.method, "$.method").toUpperCase();
  if (!(HTTP_METHODS as readonly string[]).includes(method)) {
    throw new ValidationError(
      "$.method",
      `must be one of ${HTTP_METHODS.join("|")}`,
    );
  }
  const url = asString(input.url, "$.url");
  const headers = asStringMap(input.headers, "$.headers");
  const body = parseBody(input.body, "$.body");
  return { name, method: method as HttpMethod, url, headers, body };
}

/* -------------------------------------------------------------------------- */
/* repository                                                                 */
/* -------------------------------------------------------------------------- */

/** Replace the entire canonical state for a workspace (transactional). */
export async function replaceWorkspaceCanonical(
  payload: WorkspacePayload,
): Promise<void> {
  await sql.begin(async (tx) => {
    const [ws] = await tx<{ id: number }[]>`
      INSERT INTO workspace (slug)
      VALUES (${payload.workspace})
      ON CONFLICT (slug)
      DO UPDATE SET updated_at = NOW()
      RETURNING id
    `;

    await tx`DELETE FROM environment WHERE workspace_id = ${ws.id}`;
    await tx`DELETE FROM request_canonical WHERE workspace_id = ${ws.id}`;

    for (let i = 0; i < payload.environments.length; i++) {
      const env = payload.environments[i];
      await tx`
        INSERT INTO environment (workspace_id, name, base_url, vars, sort_index)
        VALUES (
          ${ws.id},
          ${env.name},
          ${env.baseUrl},
          ${tx.json(env.vars)},
          ${i}
        )
      `;
    }

    for (let i = 0; i < payload.requests.length; i++) {
      const req = payload.requests[i];
      await tx`
        INSERT INTO request_canonical (
          workspace_id, request_id, name, method, url, headers, body, sort_index
        ) VALUES (
          ${ws.id},
          ${req.id},
          ${req.name},
          ${req.method},
          ${req.url},
          ${tx.json(req.headers)},
          ${tx.json(req.body)},
          ${i}
        )
      `;
    }
  });
}

export type WorkspaceRow = {
  workspaceId: number;
  payload: WorkspacePayload;
};

/**
 * Read the (currently single) workspace plus its DB id. Returns `null` when
 * no workspace has been pushed yet.
 */
export async function readWorkspaceWithId(): Promise<WorkspaceRow | null> {
  const workspaces = await sql<{ id: number; slug: string }[]>`
    SELECT id, slug FROM workspace
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (workspaces.length === 0) return null;
  const ws = workspaces[0];

  const envs = await sql<
    { name: string; base_url: string; vars: Record<string, string> }[]
  >`
    SELECT name, base_url, vars
    FROM environment
    WHERE workspace_id = ${ws.id}
    ORDER BY sort_index ASC, name ASC
  `;

  const reqs = await sql<
    {
      request_id: string;
      name: string;
      method: string;
      url: string;
      headers: Record<string, string>;
      body: RequestBody;
    }[]
  >`
    SELECT request_id, name, method, url, headers, body
    FROM request_canonical
    WHERE workspace_id = ${ws.id}
    ORDER BY sort_index ASC, name ASC
  `;

  const payload: WorkspacePayload = {
    workspace: ws.slug,
    environments: envs.map((e) => ({
      name: e.name,
      baseUrl: e.base_url,
      vars: e.vars ?? {},
    })),
    requests: reqs.map((r) => ({
      id: r.request_id,
      name: r.name,
      method: r.method as HttpMethod,
      url: r.url,
      headers: r.headers ?? {},
      body: r.body ?? { type: "none" },
    })),
  };

  return { workspaceId: ws.id, payload };
}

/**
 * Read the (currently single) workspace. Returns `null` when no workspace
 * has been pushed yet.
 */
export async function readWorkspace(): Promise<WorkspacePayload | null> {
  const row = await readWorkspaceWithId();
  return row?.payload ?? null;
}
