import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  discardDraft as apiDiscardDraft,
  promoteDraftToYaml,
  runRequest,
  saveDraft as apiSaveDraft,
} from "@/lib/api";
import { errorMessage } from "@/lib/format";
import type { ApiRequest } from "@/types";

interface UseRequestActionsArgs {
  selectedRequestId: string;
  selectedEnvironmentId: string;
  draftRequest: () => ApiRequest;
  refresh: () => Promise<void>;
}

export interface UseRequestActionsResult {
  running: boolean;
  saveDraft: () => Promise<void>;
  saveToYaml: () => Promise<void>;
  discardDraft: () => Promise<void>;
  runSelectedRequest: () => Promise<void>;
}

export function useRequestActions({
  selectedRequestId,
  selectedEnvironmentId,
  draftRequest,
  refresh,
}: UseRequestActionsArgs): UseRequestActionsResult {
  const [running, setRunning] = useState(false);

  const saveDraft = useCallback(async () => {
    if (!selectedRequestId) return;
    try {
      await apiSaveDraft(selectedRequestId, draftRequest());
      await refresh();
      toast.success("Draft saved to SQLite");
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  }, [selectedRequestId, draftRequest, refresh]);

  const saveToYaml = useCallback(async () => {
    if (!selectedRequestId) return;
    try {
      await apiSaveDraft(selectedRequestId, draftRequest());
      await promoteDraftToYaml(selectedRequestId);
      await refresh();
      toast.success("Saved to YAML source files");
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  }, [selectedRequestId, draftRequest, refresh]);

  const discardDraft = useCallback(async () => {
    if (!selectedRequestId) return;
    try {
      await apiDiscardDraft(selectedRequestId);
      await refresh();
      toast("Draft discarded");
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  }, [selectedRequestId, refresh]);

  const runSelectedRequest = useCallback(async () => {
    if (!selectedRequestId) return;
    setRunning(true);
    try {
      await runRequest(selectedRequestId, selectedEnvironmentId || null);
      await refresh();
      toast.success("Request complete");
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setRunning(false);
    }
  }, [selectedRequestId, selectedEnvironmentId, refresh]);

  return {
    running,
    saveDraft,
    saveToYaml,
    discardDraft,
    runSelectedRequest,
  };
}
