import {
  OVERRIDE_FIELDS,
  readWorkspaceWithId,
  type CanonicalRequest,
  type Environment,
  type OverrideField,
} from "./canonical.ts";
import { getDraftPayload } from "./draft-repo.ts";
import { listOverridePatches } from "./override-repo.ts";
import { listUserRequests } from "./user-request-repo.ts";

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

function diffShallowKeys(a: CanonicalRequest, b: CanonicalRequest): string[] {
  const keys = ["name", "method", "url", "headers", "body"] as const;
  const out: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.push(k);
  }
  return out;
}

function applyDraftToRequest(
  base: CanonicalRequest,
  draftReq: CanonicalRequest | undefined,
): { merged: CanonicalRequest; draft_fields: string[] } {
  if (!draftReq) return { merged: base, draft_fields: [] };
  const merged: CanonicalRequest = {
    ...base,
    name: draftReq.name,
    method: draftReq.method,
    url: draftReq.url,
    headers: draftReq.headers,
    body: draftReq.body,
  };
  return { merged, draft_fields: diffShallowKeys(base, merged) };
}

function applyStoredPatch(
  base: CanonicalRequest,
  patch: Record<string, unknown>,
): CanonicalRequest {
  const m: CanonicalRequest = { ...base };
  for (const k of OVERRIDE_FIELDS) {
    if (k in patch && patch[k] !== undefined) {
      // Patch rows were validated on write; trust shape at runtime.
      (m as Record<string, unknown>)[k] = patch[k];
    }
  }
  return m;
}

export async function buildMergedWorkspaceView(
  userId: number,
): Promise<MergedWorkspaceView | null> {
  const row = await readWorkspaceWithId();
  if (!row) return null;
  const { workspaceId, payload } = row;

  const draft = await getDraftPayload(userId, workspaceId);
  const overrides = await listOverridePatches(userId, workspaceId);
  const userRows = await listUserRequests(userId, workspaceId);

  const requests: MergedRequest[] = payload.requests.map((base) => {
    const draftReq = draft?.requests.find((r) => r.id === base.id);
    const { merged: afterDraft, draft_fields } = applyDraftToRequest(
      base,
      draftReq,
    );
    const patch = overrides.get(base.id) ?? {};
    const merged = applyStoredPatch(afterDraft, patch);
    const overridden_fields = Object.keys(patch).filter((k) =>
      (OVERRIDE_FIELDS as readonly string[]).includes(k),
    ) as string[];
    const source: RequestSource =
      draft_fields.length > 0 ? "draft" : "canonical";
    return {
      ...merged,
      source,
      overridden_fields,
      draft_fields,
    };
  });

  const userRequests: MergedRequest[] = userRows.map((r) => ({
    ...r,
    source: "user" as const,
    overridden_fields: [] as string[],
    draft_fields: [] as string[],
  }));

  return {
    workspace: payload.workspace,
    environments: payload.environments,
    requests,
    userRequests,
  };
}

export function isOverrideField(s: string): s is OverrideField {
  return (OVERRIDE_FIELDS as readonly string[]).includes(s);
}
