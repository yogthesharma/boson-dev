/**
 * Environment helpers.
 *
 * Environments themselves now come from the server (`lib/workspace.ts`); this
 * file only owns the small shared persistence + interpolation pieces.
 */

import type { Environment } from "./workspace";

export const ENV_STORAGE_KEY = "boson.env";

export type { Environment } from "./workspace";

export function getStoredEnvironmentName(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ENV_STORAGE_KEY);
}

export function saveEnvironmentName(name: string) {
  localStorage.setItem(ENV_STORAGE_KEY, name);
}

export function clearStoredEnvironmentName() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(ENV_STORAGE_KEY);
}

/**
 * Pick which environment should be active when the workspace loads.
 *
 * Prefer a stored name only if it still exists on the server. Otherwise clear
 * stale keys (e.g. old hardcoded "Development" from before server-driven envs).
 *
 * Default preference: `jsonplaceholder` by name, else first HTTPS URL, else the
 * first listed env — so out-of-the-box requests hit a real API instead of
 * `localhost:8080` when nothing is running there.
 */
export function pickInitialEnvironment(
  envs: Environment[],
  storedName: string | null,
): Environment | null {
  if (envs.length === 0) return null;

  if (storedName) {
    const hit = envs.find((e) => e.name === storedName);
    if (hit) return hit;
    clearStoredEnvironmentName();
  }

  return (
    envs.find((e) => e.name.toLowerCase() === "jsonplaceholder") ??
    envs.find((e) => e.baseUrl.trim().toLowerCase().startsWith("https://")) ??
    envs[0]
  );
}

/** Replace `{{var}}` placeholders. Unknown keys stay as-is. */
export function interpolate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const v = vars[key.trim()];
    return v !== undefined ? v : match;
  });
}
