import { ChevronsUpDown, Globe2, LogIn, LogOut, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { useWorkspace } from "@/context/workspace-context";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

export function TopBar() {
  const {
    merged,
    environments,
    activeEnv,
    setActiveEnv,
    serverOk,
    selectedRequest,
  } = useWorkspace();
  const { token, logout } = useAuth();

  const workspaceLabel = merged?.workspace ?? "Boson";

  return (
    <header className="bg-background/80 flex h-12 shrink-0 items-center gap-3 px-5 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="text-foreground truncate font-medium">
          {workspaceLabel}
        </span>
        {selectedRequest ? (
          <>
            <Slash />
            <span className="text-foreground truncate">
              {selectedRequest.name}
            </span>
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <ServerDot ok={serverOk} />

        {token ? (
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
            className="text-muted-foreground hover:text-foreground hover:bg-accent hidden h-8 items-center gap-1 rounded-md border px-2 text-xs sm:inline-flex"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="text-muted-foreground hover:text-foreground hover:bg-accent hidden h-8 items-center gap-1 rounded-md border px-2 text-xs sm:inline-flex"
            title="Sign in"
          >
            <LogIn className="size-3.5" />
            Sign in
          </button>
        )}

        {environments.length > 0 && activeEnv ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent flex h-8 items-center gap-2 rounded-md border px-2 text-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <Globe2 className="size-3.5 opacity-70" />
                <span className="hidden sm:inline">{activeEnv.name}</span>
                <Badge variant="secondary" className="font-sans text-[10px]">
                  {shortHost(activeEnv.baseUrl)}
                </Badge>
                <ChevronsUpDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-64">
              <DropdownMenuLabel className="text-muted-foreground text-xs">
                Environments
              </DropdownMenuLabel>
              {environments.map((e) => (
                <DropdownMenuItem
                  key={e.name}
                  className="flex items-start gap-2"
                  onSelect={() => setActiveEnv(e)}
                >
                  <Globe2 className="mt-0.5 size-3.5 opacity-60" />
                  <div className="flex flex-1 flex-col">
                    <span className="text-sm">{e.name}</span>
                    <span className="text-muted-foreground font-sans text-xs">
                      {e.baseUrl}
                    </span>
                  </div>
                  {e.name === activeEnv.name ? (
                    <span className="text-muted-foreground text-xs">
                      active
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>
                <Plus className="size-3.5" />
                <span>Manage environments</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  soon
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="text-muted-foreground text-xs">No environment</span>
        )}
      </div>
    </header>
  );
}

function Slash() {
  return (
    <span className="text-muted-foreground/50 select-none text-xs">/</span>
  );
}

function ServerDot({ ok }: { ok: boolean | null }) {
  const tone =
    ok === null
      ? "bg-muted-foreground/40"
      : ok
        ? "bg-emerald-500"
        : "bg-rose-500";
  const label = ok === null ? "Checking" : ok ? "API up" : "API down";
  return (
    <span
      title={label}
      className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:inline-flex"
    >
      <span
        className={cn(
          "size-2 rounded-full",
          tone,
          ok && "shadow-[0_0_0_3px] shadow-emerald-500/15",
        )}
      />
      <span>{label}</span>
    </span>
  );
}

function shortHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
