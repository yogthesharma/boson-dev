import { useState, type FormEvent } from "react";

import { useAuth } from "@/context/auth-context";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

/**
 * Full-screen `/login` page.
 *
 * Toggles between sign-in and sign-up. On success, replaces history with `/`
 * so the back button can't bring the user back to the login screen.
 */
export function LoginPage() {
  const { login, register, token } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate("/", { replace: true });
    } catch (caught) {
      setErr(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-background text-foreground flex min-h-dvh items-center justify-center px-4">
      <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-sm">
        <div className="mb-5 flex flex-col items-center gap-1">
          <span className="bg-primary text-primary-foreground inline-flex size-9 items-center justify-center rounded-md text-sm font-bold">
            B
          </span>
          <h1 className="text-foreground text-lg font-semibold tracking-tight">
            {mode === "login" ? "Sign in to Boson" : "Create your Boson account"}
          </h1>
          <p className="text-muted-foreground text-xs">
            {mode === "login"
              ? "Use the email + password you registered with."
              : "An API token will be saved in your browser."}
          </p>
        </div>

        {token ? (
          <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            You're already signed in.{" "}
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="underline underline-offset-2 hover:opacity-90"
            >
              Continue to workspace
            </button>
          </div>
        ) : null}

        <div className="bg-muted/40 mb-4 grid grid-cols-2 gap-1 rounded-md p-0.5 text-xs">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setErr(null);
              }}
              className={cn(
                "rounded-sm px-2 py-1.5 font-medium transition-colors",
                mode === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "login" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-foreground text-xs font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-1"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-foreground text-xs font-medium"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-1"
              placeholder="••••••••"
            />
          </div>

          {err ? (
            <p className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-xs text-rose-300">
              {err}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground hover:opacity-90 w-full rounded-md py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          >
            {busy
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="text-muted-foreground mt-4 text-center text-[11px]">
          Local dev? Run the server with{" "}
          <code className="bg-muted/60 text-foreground rounded px-1 py-0.5">
            BOSON_AUTH_DISABLED=1
          </code>{" "}
          and skip this screen.
        </p>
      </div>
    </div>
  );
}
