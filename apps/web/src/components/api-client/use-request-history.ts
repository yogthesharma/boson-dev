import { useCallback, useState } from "react";

import type { HttpMethod } from "@/lib/http";

export type HistoryEntry = {
  id: string;
  method: HttpMethod;
  /** The fully-resolved URL that hit the wire (post env + params merge). */
  url: string;
  /** True iff the proxy completed an HTTP exchange (any status code). */
  ok: boolean;
  status?: number;
  statusText?: string;
  durationMs?: number;
  bodyBytes?: number;
  error?: string;
  timestamp: number;
};

const MAX_ENTRIES = 100;

/**
 * Tracks the most recent requests sent during this session. Lives in memory
 * for now; can be promoted to localStorage / server-backed history later.
 */
export function useRequestHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const push = useCallback(
    (entry: Omit<HistoryEntry, "id" | "timestamp">) => {
      setEntries((prev) => {
        const next: HistoryEntry[] = [
          {
            ...entry,
            id:
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            timestamp: Date.now(),
          },
          ...prev,
        ];
        return next.slice(0, MAX_ENTRIES);
      });
    },
    [],
  );

  const clear = useCallback(() => setEntries([]), []);

  return { entries, push, clear };
}

export type UseRequestHistory = ReturnType<typeof useRequestHistory>;
