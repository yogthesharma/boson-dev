import { useEffect, useMemo, useState } from "react";

interface ProjectView {
  name: string;
  schema_version: number;
  environments: Environment[];
  requests: ApiRequest[];
  drafts: Draft[];
}

interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

interface ApiRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string | null;
}

interface Draft {
  request_id: string;
  request: ApiRequest;
  updated_at: string;
}

interface HistoryItem {
  id: number;
  request_id: string;
  environment_id?: string | null;
  method: string;
  url: string;
  status?: number | null;
  duration_ms: number;
  response_headers: Record<string, string>;
  response_body: string;
  error?: string | null;
  created_at: string;
}

const emptyRequest: ApiRequest = {
  id: "",
  name: "",
  method: "GET",
  url: "",
  headers: {},
  body: "",
};

export function App() {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [form, setForm] = useState<ApiRequest>(emptyRequest);
  const [headersText, setHeadersText] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [projectData, historyData] = await Promise.all([
      getJson<ProjectView>("/api/project"),
      getJson<HistoryItem[]>("/api/history"),
    ]);
    setProject(projectData);
    setHistory(historyData);

    if (!selectedRequestId && projectData.requests[0]) {
      setSelectedRequestId(projectData.requests[0].id);
    }
    if (!selectedEnvironmentId && projectData.environments[0]) {
      setSelectedEnvironmentId(projectData.environments[0].id);
    }
  }

  useEffect(() => {
    refresh()
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
    // We only want the initial load here; later refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDraft = useMemo(
    () => project?.drafts.find((draft) => draft.request_id === selectedRequestId),
    [project?.drafts, selectedRequestId],
  );

  const selectedCanonical = useMemo(
    () => project?.requests.find((request) => request.id === selectedRequestId),
    [project?.requests, selectedRequestId],
  );

  useEffect(() => {
    const next = selectedDraft?.request ?? selectedCanonical ?? emptyRequest;
    setForm(next);
    setHeadersText(headersToText(next.headers));
  }, [selectedCanonical, selectedDraft]);

  async function saveDraft() {
    if (!selectedRequestId) return;
    setMessage(null);
    setError(null);
    const request = { ...form, headers: textToHeaders(headersText) };
    await postJson(`/api/drafts/${selectedRequestId}`, request);
    await refresh();
    setMessage("Draft saved to SQLite.");
  }

  async function saveToYaml() {
    if (!selectedRequestId) return;
    setMessage(null);
    setError(null);
    await saveDraft();
    await postJson(`/api/drafts/${selectedRequestId}/save`, {});
    await refresh();
    setMessage("Saved to YAML source files.");
  }

  async function discardDraft() {
    if (!selectedRequestId) return;
    setMessage(null);
    setError(null);
    await fetch(`/api/drafts/${selectedRequestId}`, { method: "DELETE" });
    await refresh();
    setMessage("Draft discarded.");
  }

  async function runSelectedRequest() {
    if (!selectedRequestId) return;
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      await postJson(`/api/requests/${selectedRequestId}/run`, {
        environment_id: selectedEnvironmentId || null,
      });
      await refresh();
      setMessage("Request complete.");
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return <main className="app loading">Loading Boson project...</main>;
  }

  if (error && !project) {
    return (
      <main className="app loading">
        <h1>Boson</h1>
        <p className="error">{error}</p>
        <p className="muted">Run `boson init` in this project, then restart the server.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <h1>Boson</h1>
          <p>{project?.name ?? "No project"}</p>
        </div>

        <label className="field">
          <span>Environment</span>
          <select
            value={selectedEnvironmentId}
            onChange={(event) => setSelectedEnvironmentId(event.target.value)}
          >
            {project?.environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.name}
              </option>
            ))}
          </select>
        </label>

        <nav className="request-list" aria-label="Requests">
          {project?.requests.map((request) => {
            const hasDraft = project.drafts.some((draft) => draft.request_id === request.id);
            return (
              <button
                key={request.id}
                className={request.id === selectedRequestId ? "active" : ""}
                onClick={() => setSelectedRequestId(request.id)}
              >
                <span>{request.name}</span>
                <code>{request.method}</code>
                {hasDraft ? <small>draft</small> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Request</p>
            <h2>{form.name || "Untitled request"}</h2>
          </div>
          <button className="primary" onClick={runSelectedRequest} disabled={running}>
            {running ? "Running..." : "Run"}
          </button>
        </header>

        {message ? <p className="notice">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <section className="editor-card">
          <div className="grid two">
            <label className="field">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Method</span>
              <select
                value={form.method}
                onChange={(event) => setForm({ ...form, method: event.target.value })}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>URL</span>
            <input
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="{{base_url}}/get"
            />
          </label>

          <label className="field">
            <span>Headers (one per line: key: value)</span>
            <textarea
              rows={5}
              value={headersText}
              onChange={(event) => setHeadersText(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Body</span>
            <textarea
              rows={8}
              value={form.body ?? ""}
              onChange={(event) => setForm({ ...form, body: event.target.value })}
            />
          </label>

          <div className="actions">
            <button onClick={saveDraft}>Save draft</button>
            <button onClick={saveToYaml}>Save to YAML</button>
            <button onClick={discardDraft} disabled={!selectedDraft}>
              Discard draft
            </button>
          </div>
        </section>

        <section className="response-card">
          <div className="section-header">
            <h3>Latest response</h3>
            <span>{history[0] ? history[0].created_at : "No runs yet"}</span>
          </div>
          {history[0] ? (
            <ResponseView item={history[0]} />
          ) : (
            <p className="muted">Run a request to capture response history in SQLite.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function ResponseView({ item }: { item: HistoryItem }) {
  return (
    <div className="response">
      <div className="response-meta">
        <code>{item.method}</code>
        <span>{item.status ?? "ERR"}</span>
        <span>{item.duration_ms}ms</span>
        <span>{item.url}</span>
      </div>
      {item.error ? <p className="error">{item.error}</p> : null}
      <pre>{item.response_body || "(empty response)"}</pre>
    </div>
  );
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} failed with HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${url} failed with HTTP ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function headersToText(headers: Record<string, string>) {
  return Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}

function textToHeaders(text: string) {
  return Object.fromEntries(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(":");
        if (separator === -1) return [line, ""];
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
