import type { BodyMode, HttpMethod } from "@/lib/http";
import { bodyModeIsRaw } from "@/lib/http";
import type { KvRow } from "@/lib/kv";
import { rowsToHeaders } from "@/lib/kv";
import type { MergedRequest, RawBodyType, RequestBody } from "@/lib/workspace";

function uiToRequestBody(
  mode: BodyMode,
  raw: string,
  form: KvRow[],
): RequestBody {
  if (mode === "none" || mode === "multipart" || mode === "file") {
    return { type: "none" };
  }
  if (bodyModeIsRaw(mode)) {
    return { type: mode as RawBodyType, content: raw };
  }
  if (mode === "form-urlencoded") {
    const map: Record<string, string> = {};
    for (const r of form) {
      if (!r.enabled) continue;
      const k = r.key.trim();
      if (!k) continue;
      map[k] = r.value;
    }
    return { type: "form-urlencoded", content: map };
  }
  return { type: "none" };
}

export function buildOverridePatch(
  baseline: MergedRequest,
  method: HttpMethod,
  url: string,
  headers: KvRow[],
  bodyMode: BodyMode,
  rawBody: string,
  formBody: KvRow[],
): Record<string, unknown> | null {
  const hdr = rowsToHeaders(headers);
  const body = uiToRequestBody(bodyMode, rawBody, formBody);
  const patch: Record<string, unknown> = {};
  if (method !== baseline.method) patch.method = method;
  if (url.trim() !== baseline.url) patch.url = url.trim();
  if (JSON.stringify(hdr) !== JSON.stringify(baseline.headers)) {
    patch.headers = hdr;
  }
  if (JSON.stringify(body) !== JSON.stringify(baseline.body)) {
    patch.body = body;
  }
  if (Object.keys(patch).length === 0) return null;
  return patch;
}
