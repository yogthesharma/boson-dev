export const apiPrefix = import.meta.env.VITE_API_PREFIX ?? "/api";

export type ProxySuccess = {
  ok: true;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  bodyBytes: number;
  truncated: boolean;
  durationMs: number;
  ttfbMs: number;
  downloadMs: number;
};

export type ProxyFailure = {
  ok: false;
  error: string;
  durationMs?: number;
};

export type ProxyResponse = ProxySuccess | ProxyFailure;

export type ProxyPayload = {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  /** Outbound timeout (ms). Server clamps to 1000–120000. */
  timeoutMs?: number;
  /** Passed to the server outbound `fetch` redirect mode. */
  redirect?: "follow" | "manual";
};

export async function callProxy(
  payload: ProxyPayload,
  signal?: AbortSignal,
): Promise<ProxyResponse> {
  const res = await fetch(`${apiPrefix}/proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  try {
    return (await res.json()) as ProxyResponse;
  } catch {
    return { ok: false, error: "Could not parse proxy response as JSON" };
  }
}

export async function getHealth(signal?: AbortSignal): Promise<{ status: string }> {
  const res = await fetch(`${apiPrefix}/health`, { signal });
  return (await res.json()) as { status: string };
}
