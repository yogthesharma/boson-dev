import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Moon, Send, Sun } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ProjectView {
  name: string;
  schema_version: number;
  environments: Environment[];
  requests: ApiRequest[];
  drafts: Draft[];
  secret_names?: string[];
  stale_drafts?: string[];
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
  body?: unknown;
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

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

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
  const [bodyText, setBodyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

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
      .catch((e: unknown) => setBootstrapError(errorMessage(e)))
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

  const isStaleDraft = useMemo(() => {
    if (!project || !selectedRequestId) return false;
    return (project.stale_drafts ?? []).includes(selectedRequestId);
  }, [project, selectedRequestId]);

  useEffect(() => {
    const next = selectedDraft?.request ?? selectedCanonical ?? emptyRequest;
    setForm(next);
    setHeadersText(headersToText(next.headers));
    setBodyText(bodyToText(next.body));
  }, [selectedCanonical, selectedDraft]);

  async function saveDraft() {
    if (!selectedRequestId) return;
    try {
      await postJson(`/api/drafts/${selectedRequestId}`, draftRequest());
      await refresh();
      toast.success("Draft saved to SQLite");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  }

  async function saveToYaml() {
    if (!selectedRequestId) return;
    try {
      await postJson(`/api/drafts/${selectedRequestId}`, draftRequest());
      await postJson(`/api/drafts/${selectedRequestId}/save`, {});
      await refresh();
      toast.success("Saved to YAML source files");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  }

  async function discardDraft() {
    if (!selectedRequestId) return;
    try {
      await fetch(`/api/drafts/${selectedRequestId}`, { method: "DELETE" });
      await refresh();
      toast("Draft discarded");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    }
  }

  async function runSelectedRequest() {
    if (!selectedRequestId) return;
    setRunning(true);
    try {
      await postJson(`/api/requests/${selectedRequestId}/run`, {
        environment_id: selectedEnvironmentId || null,
      });
      await refresh();
      toast.success("Request complete");
    } catch (e: unknown) {
      toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  function draftRequest(): ApiRequest {
    return {
      ...form,
      headers: textToHeaders(headersText),
      body: bodyText,
    };
  }

  if (loading) {
    return (
      <main className="flex h-full items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          <span>Loading Boson project...</span>
        </div>
      </main>
    );
  }

  if (bootstrapError && !project) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-3 text-4xl font-semibold tracking-tight">Boson</h1>
        <Card className="mb-4">
          <CardContent className="p-6">
            <p className="text-destructive">{bootstrapError}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run <code className="font-mono">boson init</code> in this project,
              then restart the server.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="grid h-full grid-rows-[auto_1fr] bg-background text-foreground md:grid-cols-[300px_1fr] md:grid-rows-1">
      <Sidebar
        project={project}
        history={history}
        selectedRequestId={selectedRequestId}
        selectedEnvironmentId={selectedEnvironmentId}
        onSelectRequest={setSelectedRequestId}
        onSelectEnvironment={setSelectedEnvironmentId}
      />

      <section className="flex min-w-0 flex-col gap-4 overflow-auto p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Request
            </p>
            <h2 className="mt-0.5 text-2xl font-semibold tracking-tight">
              {form.name || "Untitled request"}
            </h2>
          </div>
          <Button
            disabled={running || !selectedRequestId}
            onClick={runSelectedRequest}
          >
            {running ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Send className="size-4" />
                Run
              </>
            )}
          </Button>
        </header>

        {isStaleDraft ? (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="p-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                The YAML source for this request has changed since the draft was
                saved. Re-saving will overwrite the file.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_180px]">
              <div className="grid gap-2">
                <Label htmlFor="request-name">Name</Label>
                <Input
                  id="request-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label>Method</Label>
                <Select
                  value={form.method}
                  onValueChange={(method) => setForm({ ...form, method })}
                >
                  <SelectTrigger aria-label="HTTP method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HTTP_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="request-url">URL</Label>
              <Input
                id="request-url"
                value={form.url}
                onChange={(event) => setForm({ ...form, url: event.target.value })}
                placeholder="{{base_url}}/todos"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="request-headers">
                Headers (one per line: key: value)
              </Label>
              <Textarea
                id="request-headers"
                rows={5}
                value={headersText}
                onChange={(event) => setHeadersText(event.target.value)}
                className="font-mono"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="request-body">Body</Label>
              <Textarea
                id="request-body"
                rows={8}
                value={bodyText}
                onChange={(event) => setBodyText(event.target.value)}
                className="font-mono"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" onClick={saveDraft}>
                Save draft
              </Button>
              <Button variant="secondary" onClick={saveToYaml}>
                Save to YAML
              </Button>
              <Button
                variant="ghost"
                disabled={!selectedDraft}
                onClick={discardDraft}
              >
                Discard draft
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 px-6 py-4">
            <CardTitle className="text-lg">Latest response</CardTitle>
            <span className="text-xs text-muted-foreground">
              {history[0] ? formatTimestamp(history[0].created_at) : "No runs yet"}
            </span>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            {history[0] ? (
              <ResponseView item={history[0]} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a request to capture response history in SQLite.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function Sidebar({
  project,
  history,
  selectedRequestId,
  selectedEnvironmentId,
  onSelectRequest,
  onSelectEnvironment,
}: {
  project: ProjectView | null;
  history: HistoryItem[];
  selectedRequestId: string;
  selectedEnvironmentId: string;
  onSelectRequest: (id: string) => void;
  onSelectEnvironment: (id: string) => void;
}) {
  const draftsById = useMemo(() => {
    const map = new Map<string, Draft>();
    for (const draft of project?.drafts ?? []) {
      map.set(draft.request_id, draft);
    }
    return map;
  }, [project?.drafts]);

  const lastRunById = useMemo(() => {
    const map = new Map<string, HistoryItem>();
    for (const item of history) {
      if (!map.has(item.request_id)) map.set(item.request_id, item);
    }
    return map;
  }, [history]);

  const staleSet = useMemo(
    () => new Set(project?.stale_drafts ?? []),
    [project?.stale_drafts],
  );

  return (
    <aside className="flex min-h-0 flex-col border-b bg-muted/40 p-5 md:border-b-0 md:border-r">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Boson</h1>
          <p className="text-sm text-muted-foreground">
            {project?.name ?? "No project"}
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="mb-5 grid gap-2">
        <Label>Environment</Label>
        <Select
          value={selectedEnvironmentId}
          onValueChange={onSelectEnvironment}
        >
          <SelectTrigger aria-label="Environment">
            <SelectValue placeholder="No environment" />
          </SelectTrigger>
          <SelectContent>
            {(project?.environments ?? []).map((environment) => (
              <SelectItem key={environment.id} value={environment.id}>
                {environment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Requests
      </p>
      <nav
        aria-label="Requests"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-1"
      >
        {(project?.requests ?? []).map((request) => {
          const draft = draftsById.get(request.id);
          const stale = staleSet.has(request.id);
          const lastRun = lastRunById.get(request.id);
          const isActive = request.id === selectedRequestId;
          return (
            <button
              key={request.id}
              type="button"
              onClick={() => onSelectRequest(request.id)}
              className={[
                "rounded-lg border px-3 py-2 text-left transition-colors",
                isActive
                  ? "border-primary bg-background text-foreground shadow-sm"
                  : "border-transparent text-foreground hover:bg-background/70",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{request.name}</span>
                <Badge variant="outline" className="font-mono">
                  {request.method}
                </Badge>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                {draft ? (
                  <Badge variant={stale ? "warning" : "success"}>
                    {stale ? "draft stale" : "draft"}
                  </Badge>
                ) : null}
                {lastRun?.status ? (
                  <Badge variant={statusBadgeVariant(lastRun.status)}>
                    {lastRun.status}
                  </Badge>
                ) : null}
              </div>
            </button>
          );
        })}
        {(!project?.requests || project.requests.length === 0) && (
          <p className="text-sm text-muted-foreground">
            No requests yet. Add one to{" "}
            <code className="font-mono">boson/requests.yml</code>.
          </p>
        )}
      </nav>
    </aside>
  );
}

function ResponseView({ item }: { item: HistoryItem }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-mono">
          {item.method}
        </Badge>
        <Badge variant={statusBadgeVariant(item.status ?? 0)}>
          {item.status ?? "ERR"}
        </Badge>
        <span>{item.duration_ms}ms</span>
        <span className="truncate">{item.url}</span>
      </div>
      {item.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {item.error}
        </p>
      ) : null}
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {item.response_body || "(empty response)"}
      </pre>
    </div>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState<boolean>(() =>
    typeof document === "undefined"
      ? false
      : document.documentElement.classList.contains("dark"),
  );

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("boson-theme", next ? "dark" : "light");
    } catch {
      // ignore storage errors
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Toggle theme"
    >
      {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
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
  return response.status === 204
    ? (undefined as T)
    : ((await response.json()) as T);
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

function bodyToText(body: unknown) {
  if (body == null) return "";
  if (typeof body === "string") return body;
  return JSON.stringify(body, null, 2);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function statusBadgeVariant(
  status: number,
): "success" | "warning" | "destructive" | "secondary" {
  if (status >= 500) return "destructive";
  if (status >= 400) return "warning";
  if (status >= 200) return "success";
  return "secondary";
}

function formatTimestamp(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
