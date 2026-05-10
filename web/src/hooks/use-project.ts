import { useCallback, useEffect, useState } from "react";

import { fetchHistory, fetchProject } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { HistoryItem, ProjectView } from "@/types";

export interface UseProjectResult {
  project: ProjectView | null;
  history: HistoryItem[];
  loading: boolean;
  bootstrapError: string | null;
  selectedRequestId: string;
  selectedEnvironmentId: string;
  setSelectedRequestId: (id: string) => void;
  setSelectedEnvironmentId: (id: string) => void;
  refresh: () => Promise<void>;
}

export function useProject(): UseProjectResult {
  const [project, setProject] = useState<ProjectView | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [projectData, historyData] = await Promise.all([
      fetchProject(),
      fetchHistory(),
    ]);
    setProject(projectData);
    setHistory(historyData);

    setSelectedRequestId((current) =>
      current || projectData.requests[0]?.id || "",
    );
    setSelectedEnvironmentId((current) =>
      current || projectData.environments[0]?.id || "",
    );
  }, []);

  useEffect(() => {
    refresh()
      .catch((error: unknown) => setBootstrapError(errorMessage(error)))
      .finally(() => setLoading(false));
  }, [refresh]);

  return {
    project,
    history,
    loading,
    bootstrapError,
    selectedRequestId,
    selectedEnvironmentId,
    setSelectedRequestId,
    setSelectedEnvironmentId,
    refresh,
  };
}
