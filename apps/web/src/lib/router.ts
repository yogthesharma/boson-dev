import { useEffect, useState } from "react";

/**
 * Tiny path-based router.
 *
 * The web app has only two top-level routes (`/login` and everything else),
 * so a full router is overkill. This module owns programmatic navigation
 * and a hook that components can subscribe to.
 *
 * `navigate("/login")` pushes a history entry and dispatches `popstate` so
 * subscribers re-render. nginx + Vite both fall back to `index.html`, so
 * deep-linking and refreshing on `/login` work in dev and prod.
 */

const NAV_EVENT = "boson:navigate";

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  if (opts.replace) {
    window.history.replaceState({}, "", path);
  } else {
    window.history.pushState({}, "", path);
  }
  window.dispatchEvent(new Event(NAV_EVENT));
}

export function useLocationPath(): string {
  const [path, setPath] = useState<string>(() =>
    typeof window === "undefined" ? "/" : window.location.pathname,
  );

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onChange);
    window.addEventListener(NAV_EVENT, onChange);
    return () => {
      window.removeEventListener("popstate", onChange);
      window.removeEventListener(NAV_EVENT, onChange);
    };
  }, []);

  return path;
}
