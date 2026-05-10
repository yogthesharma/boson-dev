import type { ApiRequest } from "@/types";

const UNGROUPED_KEY = "__ungrouped__";

export interface FolderGroup {
  key: string;
  label: string;
  requests: ApiRequest[];
}

export function groupRequestsByFolder(requests: ApiRequest[]): FolderGroup[] {
  const map = new Map<string, FolderGroup>();
  for (const request of requests) {
    const label = (request.folder ?? "").trim();
    const key = label === "" ? UNGROUPED_KEY : label;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        label: key === UNGROUPED_KEY ? "Workspace" : label,
        requests: [],
      };
      map.set(key, group);
    }
    group.requests.push(request);
  }
  return [...map.values()].sort((a, b) => {
    if (a.key === UNGROUPED_KEY) return -1;
    if (b.key === UNGROUPED_KEY) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function statusToClasses(status: number): string {
  if (status >= 500)
    return "bg-destructive/15 text-destructive border-destructive/30";
  if (status >= 400)
    return "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-300";
  if (status >= 200)
    return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
  return "bg-muted text-muted-foreground";
}
