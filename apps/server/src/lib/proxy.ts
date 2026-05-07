/**
 * Pure server-side HTTP proxy logic.
 *
 * Validates the input, performs the outbound request, and returns
 * a structured result the route handler can serialize.
 */

const METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const MAX_OUTBOUND_BODY = 2 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024;
const DEFAULT_PROXY_TIMEOUT_MS = 30_000;
const MIN_PROXY_TIMEOUT_MS = 1_000;
const MAX_PROXY_TIMEOUT_MS = 120_000;

export type ProxySuccessBody = {
  ok: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyBytes: number;
  truncated: boolean;
  /** Wall time from start of outbound fetch until response body finished reading. */
  durationMs: number;
  /** Time until response status + headers are available (first byte from target). */
  ttfbMs: number;
  /** Time to read the response body after headers. */
  downloadMs: number;
};

export type ProxyFailureBody = {
  ok: false;
  error: string;
  durationMs?: number;
};

export type ProxyResponseBody = ProxySuccessBody | ProxyFailureBody;

export type ProxyResult = {
  httpStatus: 200 | 400 | 502;
  body: ProxyResponseBody;
};

const clientErr = (error: string): ProxyResult => ({
  httpStatus: 400,
  body: { ok: false, error },
});

const fetchErr = (error: string, durationMs: number): ProxyResult => ({
  httpStatus: 502,
  body: { ok: false, error, durationMs },
});

export async function runProxy(payload: unknown): Promise<ProxyResult> {
  if (!payload || typeof payload !== "object") {
    return clientErr("Body must be a JSON object");
  }

  const {
    url: rawUrl,
    method: rawMethod,
    headers: rawHeaders,
    body: rawBody,
  } = payload as Record<string, unknown>;

  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return clientErr("`url` must be a non-empty string");
  }

  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    return clientErr("Invalid URL");
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return clientErr("Only http and https URLs are allowed");
  }

  // Intentionally allow private / loopback hosts (localhost, 127.0.0.1, RFC1918, etc.)
  // so the UI can exercise APIs running on the developer machine or LAN.

  let timeoutMs = DEFAULT_PROXY_TIMEOUT_MS;
  const rawTimeout = (payload as Record<string, unknown>).timeoutMs;
  if (typeof rawTimeout === "number" && Number.isFinite(rawTimeout)) {
    timeoutMs = Math.min(
      MAX_PROXY_TIMEOUT_MS,
      Math.max(MIN_PROXY_TIMEOUT_MS, Math.floor(rawTimeout)),
    );
  }

  const rawRedirect = (payload as Record<string, unknown>).redirect;
  const redirect = rawRedirect === "manual" ? "manual" : "follow";

  const method = (typeof rawMethod === "string" ? rawMethod : "GET").toUpperCase();
  if (!METHODS.has(method)) {
    return clientErr(`Unsupported method: ${method}`);
  }

  const headers = new Headers();
  if (rawHeaders && typeof rawHeaders === "object" && !Array.isArray(rawHeaders)) {
    for (const [k, v] of Object.entries(rawHeaders as Record<string, unknown>)) {
      if (!k || typeof v !== "string") continue;
      if (HOP_BY_HOP.has(k.toLowerCase())) continue;
      headers.set(k, v);
    }
  }

  let outboundBody: string | undefined;
  if (
    method !== "GET" &&
    method !== "HEAD" &&
    rawBody !== undefined &&
    rawBody !== null
  ) {
    outboundBody = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
    if (outboundBody.length > MAX_OUTBOUND_BODY) {
      return clientErr("Request body exceeds 2 MiB limit");
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();

  try {
    const res = await fetch(target.toString(), {
      method,
      headers,
      body: outboundBody,
      redirect,
      signal: controller.signal,
    });

    const afterHeaders = Date.now();
    const ttfbMs = afterHeaders - started;

    const buf = await res.arrayBuffer();
    const afterBody = Date.now();
    const downloadMs = afterBody - afterHeaders;

    const truncated = buf.byteLength > MAX_RESPONSE_BYTES;
    const slice =
      buf.byteLength > MAX_RESPONSE_BYTES ? buf.slice(0, MAX_RESPONSE_BYTES) : buf;
    const text = new TextDecoder().decode(slice);

    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      httpStatus: 200,
      body: {
        ok: true,
        status: res.status,
        statusText: res.statusText,
        headers: responseHeaders,
        body: text,
        bodyBytes: buf.byteLength,
        truncated,
        durationMs: afterBody - started,
        ttfbMs,
        downloadMs,
      },
    };
  } catch (err) {
    const durationMs = Date.now() - started;
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "Request timed out"
          : err.message
        : String(err);
    return fetchErr(message, durationMs);
  } finally {
    clearTimeout(timer);
  }
}
