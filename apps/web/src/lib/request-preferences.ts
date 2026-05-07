const TIMEOUT_KEY = "boson.request.timeoutMs";
const REDIRECT_KEY = "boson.request.followRedirects";
const URL_ENCODE_KEY = "boson.request.urlEncode";
const MAX_REDIRECTS_KEY = "boson.request.maxRedirects";

const TIMEOUT_MIN = 1_000;
const TIMEOUT_MAX = 120_000;
const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_REDIRECTS = 5;

export function loadProxyTimeoutMs(): number {
  if (typeof localStorage === "undefined") return DEFAULT_TIMEOUT;
  const n = Number(localStorage.getItem(TIMEOUT_KEY));
  if (!Number.isFinite(n)) return DEFAULT_TIMEOUT;
  return Math.min(TIMEOUT_MAX, Math.max(TIMEOUT_MIN, Math.floor(n)));
}

export function saveProxyTimeoutMs(ms: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TIMEOUT_KEY, String(ms));
}

export function loadFollowRedirects(): boolean {
  if (typeof localStorage === "undefined") return true;
  const v = localStorage.getItem(REDIRECT_KEY);
  if (v === null) return true;
  return v !== "0";
}

export function saveFollowRedirects(follow: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(REDIRECT_KEY, follow ? "1" : "0");
}

export function loadUrlEncode(): boolean {
  if (typeof localStorage === "undefined") return true;
  const v = localStorage.getItem(URL_ENCODE_KEY);
  if (v === null) return true;
  return v !== "0";
}

export function saveUrlEncode(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(URL_ENCODE_KEY, enabled ? "1" : "0");
}

export function loadMaxRedirects(): number {
  if (typeof localStorage === "undefined") return DEFAULT_MAX_REDIRECTS;
  const n = Number(localStorage.getItem(MAX_REDIRECTS_KEY));
  if (!Number.isFinite(n)) return DEFAULT_MAX_REDIRECTS;
  return Math.max(0, Math.min(50, Math.floor(n)));
}

export function saveMaxRedirects(n: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(MAX_REDIRECTS_KEY, String(n));
}
