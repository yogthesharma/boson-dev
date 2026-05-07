import { Inbox, Plus } from "lucide-react";

import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { METHOD_COLORS } from "@/lib/http";
import type { MergedRequest } from "@/lib/workspace";
import { createUserRequest } from "@/lib/workspace-api";
import { cn } from "@/lib/utils";

/**
 * Sidebar: canonical (+ merged) requests, personal user requests, new CTA.
 */
export function WorkspaceRequests() {
  const {
    loadState,
    loadError,
    requests,
    userRequests,
    selectedRequestId,
    selectRequest,
    refreshWorkspace,
    activeEnv,
  } = useWorkspace();
  const { authHeaders } = useAuth();

  const heading = (label: string) => (
    <p className="text-sidebar-foreground/60 px-2 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">
      {label}
    </p>
  );

  if (loadState === "loading") {
    return (
      <div className="px-2 pb-2">
        <p className="text-sidebar-foreground/60 px-2 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">
          Requests
        </p>
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
        <p className="text-sidebar-foreground/60 px-2 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">
          Requests
        </p>
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

  if (requests.length === 0 && userRequests.length === 0) {
    return (
      <div className="px-2 pb-2">
        <p className="text-sidebar-foreground/60 px-2 pt-3 pb-1 text-xs font-medium tracking-wide uppercase">
          Requests
        </p>
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

  const renderRow = (req: MergedRequest) => {
    const active = req.id === selectedRequestId;
    const modified = req.overridden_fields.length > 0;
    const draft = req.source === "draft";
    const personal = req.source === "user";
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
          {draft ? (
            <span className="text-muted-foreground shrink-0 rounded border px-1 py-0 text-[9px] font-semibold tracking-wide uppercase">
              Draft
            </span>
          ) : null}
          {personal ? (
            <span className="text-muted-foreground shrink-0 text-[9px]">You</span>
          ) : null}
          {modified ? (
            <span
              className="bg-amber-500/90 size-1.5 shrink-0 rounded-full"
              title="Has local overrides"
            />
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div className="px-2 pb-2">
      <div className="flex items-center justify-between gap-2 px-2 pt-3 pb-1">
        <p className="text-sidebar-foreground/60 text-xs font-medium tracking-wide uppercase">
          Requests
        </p>
        <button
          type="button"
          title="New personal request"
          onClick={async () => {
            const base = (activeEnv?.baseUrl ?? "https://example.com").replace(
              /\/$/,
              "",
            );
            try {
              const id = await createUserRequest(
                {
                  name: "New request",
                  method: "GET",
                  url: `${base}/`,
                  headers: {},
                  body: { type: "none" },
                },
                authHeaders,
              );
              await refreshWorkspace();
              selectRequest(id);
            } catch (e) {
              console.error(e);
            }
          }}
          className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <ul className="flex flex-col gap-0.5 px-1">{requests.map(renderRow)}</ul>

      {userRequests.length > 0 ? (
        <>
          {heading("Personal")}
          <ul className="flex flex-col gap-0.5 px-1">
            {userRequests.map(renderRow)}
          </ul>
        </>
      ) : null}
    </div>
  );
}
