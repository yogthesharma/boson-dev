const KEY = "boson.jwt";

export function getStoredToken(): string | null {
  try {
    const t = localStorage.getItem(KEY);
    return t && t.trim() ? t.trim() : null;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (!token) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, token);
  } catch {
    /* ignore */
  }
}
