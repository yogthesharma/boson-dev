import { useEffect, useState } from "react";

interface HealthResponse {
  status: string;
  version: string;
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(async (res) => {
        if (!res.ok) throw new Error(`http ${res.status}`);
        return (await res.json()) as HealthResponse;
      })
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="app">
      <header>
        <h1>Boson</h1>
        <p className="subtitle">Rust CLI &middot; Vite + React UI</p>
      </header>

      <section className="card">
        <h2>Server status</h2>
        {error ? (
          <p className="error">failed to reach /api/health: {error}</p>
        ) : health ? (
          <dl>
            <dt>status</dt>
            <dd>{health.status}</dd>
            <dt>version</dt>
            <dd>{health.version}</dd>
          </dl>
        ) : (
          <p className="muted">checking…</p>
        )}
      </section>
    </main>
  );
}
