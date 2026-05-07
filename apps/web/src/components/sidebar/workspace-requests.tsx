import { Inbox } from "lucide-react";

import { useWorkspace } from "@/context/workspace-context";
import { METHOD_COLORS } from "@/lib/http";
import { cn } from "@/lib/utils";

/**
 * Sidebar group rendering the canonical request list.
 *
 * Loading / error / empty states all show inline so the rest of the sidebar
 * (team switcher, user) keeps rendering. Click a request → it loads into the
 * main pane via the workspace context.
 */
export function WorkspaceRequests() {
  const {
    loadState,
    loadError,
    requests,
    selectedRequestId,
    selectRequest,
    refreshWorkspace,
  } = useWorkspace();

  const heading = (
    <p className="text-sidebar-foreground/60 px-2 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">
      Requests
    </p>
  );

  if (loadState === "loading") {
    return (
      <div className="px-2 pb-2">
        {heading}
        <ul className="flex flex-col gap-1 px-2 py-1">
          {Array.from({ length: 4 }, (_, i) => (
            <li
              key={i}
              className="bg-sidebar-accent/40 h-7 animate-pulse rounded-md"
            />
          ))}
        </ul>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="px-2 pb-2">
        {heading}
        <div className="text-muted-foreground space-y-2 px-2 py-2 text-xs">
          <p className="text-rose-400">Couldn't load workspace.</p>
          {loadError ? <p className="break-words">{loadError}</p> : null}
          <button
            type="button"
            onClick={() => refreshWorkspace()}
            className="hover:bg-sidebar-accent rounded-md px-2 py-1 text-xs"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="px-2 pb-2">
        {heading}
        <div className="text-muted-foreground flex flex-col items-start gap-2 px-2 py-2 text-xs">
          <Inbox className="text-muted-foreground/70 size-4" />
          <p className="text-foreground text-sm font-medium">No requests yet</p>
          <p>
            Run{" "}
            <code className="text-foreground bg-muted/40 rounded px-1 py-0.5">
              boson push
            </code>{" "}
            to sync your <code>boson.yml</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-2">
      {heading}
      <ul className="flex flex-col gap-0.5 px-1">
        {requests.map((req) => {
          const active = req.id === selectedRequestId;
          return (
            <li key={req.id}>
              <button
                type="button"
                onClick={() => selectRequest(req.id)}
                title={req.url}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-bold tracking-wider uppercase tabular-nums",
                    METHOD_COLORS[req.method],
                  )}
                >
                  {req.method}
                </span>
                <span className="min-w-0 flex-1 truncate">{req.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
