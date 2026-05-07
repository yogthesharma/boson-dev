import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/auth-context";
import { getHealth } from "@/lib/api";
import {
  getStoredEnvironmentName,
  pickInitialEnvironment,
  saveEnvironmentName,
} from "@/lib/environments";
import { navigate } from "@/lib/router";
import { getWorkspaceMerged } from "@/lib/workspace-api";
import type {
  Environment,
  MergedRequest,
  MergedWorkspaceView,
} from "@/lib/workspace";

type LoadState = "loading" | "ready" | "error";

type WorkspaceValue = {
  loadState: LoadState;
  loadError: string | null;
  /** Full merged view from `GET /v1/workspace` (canonical + draft + overrides). */
  merged: MergedWorkspaceView | null;
  needsLogin: boolean;

  environments: Environment[];
  activeEnv: Environment | null;
  setActiveEnv: (env: Environment) => void;

  requests: MergedRequest[];
  userRequests: MergedRequest[];
  selectedRequestId: string | null;
  selectRequest: (id: string | null) => void;
  selectedRequest: MergedRequest | null;

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
  const { authHeaders, logout } = useAuth();
  const [merged, setMerged] = useState<MergedWorkspaceView | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  const [activeEnv, setActiveEnvState] = useState<Environment | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [serverOk, setServerOk] = useState<boolean | null>(null);

  const refreshWorkspace = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    setNeedsLogin(false);
    try {
      const ws = await getWorkspaceMerged(authHeaders);
      setMerged(ws);
      const envs = ws?.environments ?? [];
      const next = pickInitialEnvironment(envs, getStoredEnvironmentName());
      setActiveEnvState((prev) => {
        if (prev && envs.find((e) => e.name === prev.name)) return prev;
        if (next) saveEnvironmentName(next.name);
        return next;
      });
      const allReqs = [...(ws?.requests ?? []), ...(ws?.userRequests ?? [])];
      setSelectedRequestId((prev) => {
        if (prev && allReqs.find((r) => r.id === prev)) return prev;
        return ws?.requests[0]?.id ?? ws?.userRequests[0]?.id ?? null;
      });
      setLoadState("ready");
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        logout();
        setNeedsLogin(true);
        setLoadError("Sign in to load this workspace.");
        navigate("/login", { replace: true });
      } else {
        setLoadError(err instanceof Error ? err.message : String(err));
      }
      setLoadState("error");
    }
  }, [authHeaders, logout]);

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
    const requests = merged?.requests ?? [];
    const userRequests = merged?.userRequests ?? [];
    const environments = merged?.environments ?? [];
    const selectedRequest =
      requests.find((r) => r.id === selectedRequestId) ??
      userRequests.find((r) => r.id === selectedRequestId) ??
      null;
    return {
      loadState,
      loadError,
      merged,
      needsLogin,
      environments,
      activeEnv: activeEnv ?? (environments[0] ?? FALLBACK_ENV),
      setActiveEnv,
      requests,
      userRequests,
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
    merged,
    needsLogin,
    refreshHealth,
    refreshWorkspace,
    selectRequest,
    selectedRequestId,
    serverOk,
    setActiveEnv,
  ]);

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
