import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { getHealth } from "@/lib/api";
import {
  getStoredEnvironmentName,
  pickInitialEnvironment,
  saveEnvironmentName,
} from "@/lib/environments";
import {
  getWorkspace,
  type CanonicalRequest,
  type Environment,
  type WorkspacePayload,
} from "@/lib/workspace";

type LoadState = "loading" | "ready" | "error";

type WorkspaceValue = {
  loadState: LoadState;
  loadError: string | null;
  workspace: WorkspacePayload | null;

  environments: Environment[];
  activeEnv: Environment | null;
  setActiveEnv: (env: Environment) => void;

  requests: CanonicalRequest[];
  selectedRequestId: string | null;
  selectRequest: (id: string | null) => void;
  selectedRequest: CanonicalRequest | null;

  /** null = still checking */
  serverOk: boolean | null;
  refreshHealth: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

const HEALTH_INTERVAL_MS = 20_000;
const FALLBACK_ENV: Environment = {
  name: "jsonplaceholder",
  baseUrl: "https://jsonplaceholder.typicode.com",
  vars: {},
};

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeEnv, setActiveEnvState] = useState<Environment | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  const refreshWorkspace = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const ws = await getWorkspace();
      setWorkspace(ws);
      const envs = ws?.environments ?? [];
      const next = pickInitialEnvironment(envs, getStoredEnvironmentName());
      setActiveEnvState((prev) => {
        if (prev && envs.find((e) => e.name === prev.name)) return prev;
        if (next) saveEnvironmentName(next.name);
        return next;
      });
      setSelectedRequestId((prev) => {
        const reqs = ws?.requests ?? [];
        if (prev && reqs.find((r) => r.id === prev)) return prev;
        return reqs[0]?.id ?? null;
      });
      setLoadState("ready");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setLoadState("error");
    }
  }, []);

  const setActiveEnv = useCallback((env: Environment) => {
    setActiveEnvState(env);
    saveEnvironmentName(env.name);
  }, []);

  const selectRequest = useCallback((id: string | null) => {
    setSelectedRequestId(id);
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const data = await getHealth();
      setServerOk(data.status === "ok");
    } catch {
      setServerOk(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace();
  }, [refreshWorkspace]);

  useEffect(() => {
    refreshHealth();
    const id = window.setInterval(refreshHealth, HEALTH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refreshHealth]);

  const value = useMemo<WorkspaceValue>(() => {
    const requests = workspace?.requests ?? [];
    const environments = workspace?.environments ?? [];
    const selectedRequest =
      requests.find((r) => r.id === selectedRequestId) ?? null;
    return {
      loadState,
      loadError,
      workspace,
      environments,
      activeEnv: activeEnv ?? (environments[0] ?? FALLBACK_ENV),
      setActiveEnv,
      requests,
      selectedRequestId,
      selectRequest,
      selectedRequest,
      serverOk,
      refreshHealth,
      refreshWorkspace,
    };
  }, [
    activeEnv,
    loadError,
    loadState,
    refreshHealth,
    refreshWorkspace,
    selectRequest,
    selectedRequestId,
    serverOk,
    setActiveEnv,
    workspace,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
