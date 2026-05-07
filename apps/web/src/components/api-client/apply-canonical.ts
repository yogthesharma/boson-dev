/**
 * Helpers for mapping a server-side `CanonicalRequest` into the local
 * `ApiClient` UI state. Keeping this in one place makes it easy to extend
 * once overrides (Slice C) and drafts (Slice E) layer in.
 */
import type { BodyMode } from "@/lib/http";
import { newKvRow, type KvRow } from "@/lib/kv";
import type { CanonicalRequest, RequestBody } from "@/lib/workspace";

export function headersFromMap(map: Record<string, string>): KvRow[] {
  const rows = Object.entries(map).map(([key, value]) =>
    newKvRow({ key, value }),
  );
  rows.push(newKvRow());
  return rows;
}

export type BodyState = {
  bodyMode: BodyMode;
  rawBody: string;
  formBody: KvRow[];
};

export function bodyFromCanonical(body: RequestBody): BodyState {
  if (body.type === "none") {
    return { bodyMode: "none", rawBody: "", formBody: [newKvRow()] };
  }
  if (body.type === "form-urlencoded") {
    return {
      bodyMode: "form-urlencoded",
      rawBody: "",
      formBody: headersFromMap(body.content),
    };
  }
  return {
    bodyMode: body.type,
    rawBody: body.content,
    formBody: [newKvRow()],
  };
}

export type ApiClientSnapshot = {
  method: CanonicalRequest["method"];
  url: string;
  headers: KvRow[];
  params: KvRow[];
  body: BodyState;
};

export function snapshotFromCanonical(req: CanonicalRequest): ApiClientSnapshot {
  return {
    method: req.method,
    url: req.url,
    headers: headersFromMap(req.headers),
    params: [newKvRow()],
    body: bodyFromCanonical(req.body),
  };
}
