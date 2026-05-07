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

/**
 * All body kinds the request pane can present. The set mirrors Bruno's
 * grouped picker (FORM / RAW / OTHER). `multipart` and `file` are present in
 * the picker for completeness; the proxy currently only ships raw + url-encoded.
 */
export type BodyMode =
  | "none"
  | "multipart"
  | "form-urlencoded"
  | "json"
  | "xml"
  | "text"
  | "sparql"
  | "file";

export const BODY_MODE_LABELS: Record<BodyMode, string> = {
  none: "No Body",
  multipart: "Multipart Form",
  "form-urlencoded": "Form URL Encoded",
  json: "JSON",
  xml: "XML",
  text: "TEXT",
  sparql: "SPARQL",
  file: "File / Binary",
};

/** Raw text modes drive the Monaco editor. */
export function bodyModeIsRaw(mode: BodyMode): boolean {
  return mode === "json" || mode === "xml" || mode === "text" || mode === "sparql";
}

/** Default Content-Type for a mode, or `null` to leave alone. */
export function bodyModeContentType(mode: BodyMode): string | null {
  switch (mode) {
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "text":
      return "text/plain";
    case "sparql":
      return "application/sparql-query";
    case "form-urlencoded":
      return "application/x-www-form-urlencoded";
    default:
      return null;
  }
}

/** Monaco language for a raw body mode. */
export function bodyModeLanguage(
  mode: BodyMode,
): "json" | "xml" | "plaintext" {
  if (mode === "json") return "json";
  if (mode === "xml") return "xml";
  return "plaintext";
}

export function methodHasBody(method: HttpMethod): boolean {
  return method !== "GET" && method !== "HEAD";
}

/**
 * Canonical color for each HTTP method.
 * Used in the method dropdown, the response status, and any UI
 * that surfaces a request's method.
 */
export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-400",
  POST: "text-amber-400",
  PUT: "text-sky-400",
  PATCH: "text-violet-400",
  DELETE: "text-rose-400",
  HEAD: "text-cyan-400",
  OPTIONS: "text-pink-400",
};

export const METHOD_BG_COLORS: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/15 text-emerald-400",
  POST: "bg-amber-500/15 text-amber-400",
  PUT: "bg-sky-500/15 text-sky-400",
  PATCH: "bg-violet-500/15 text-violet-400",
  DELETE: "bg-rose-500/15 text-rose-400",
  HEAD: "bg-cyan-500/15 text-cyan-400",
  OPTIONS: "bg-pink-500/15 text-pink-400",
};

/**
 * UI tone for an HTTP response status code.
 * Used to color the response status pill.
 */
export type StatusTone = "info" | "success" | "redirect" | "client" | "server" | "neutral";

export function statusTone(status: number): StatusTone {
  if (status >= 100 && status < 200) return "info";
  if (status >= 200 && status < 300) return "success";
  if (status >= 300 && status < 400) return "redirect";
  if (status >= 400 && status < 500) return "client";
  if (status >= 500 && status < 600) return "server";
  return "neutral";
}

export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  info: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  redirect: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  client: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  server: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export const STATUS_DOT_CLASSES: Record<StatusTone, string> = {
  info: "bg-sky-400",
  success: "bg-emerald-400",
  redirect: "bg-amber-400",
  client: "bg-orange-400",
  server: "bg-rose-400",
  neutral: "bg-muted-foreground",
};
