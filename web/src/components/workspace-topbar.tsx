import { LoaderCircleIcon, SendIcon } from "lucide-react";

import { MethodBadge } from "@/components/method-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface WorkspaceTopbarProps {
  method: string;
  name: string;
  hasDraft: boolean;
  running: boolean;
  canRun: boolean;
  onRun: () => void;
}

export function WorkspaceTopbar({
  method,
  name,
  hasDraft,
  running,
  canRun,
  onRun,
}: WorkspaceTopbarProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MethodBadge method={method} />
        <h2 className="truncate text-sm font-medium">
          {name || "Untitled request"}
        </h2>
        {hasDraft ? (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            draft
          </Badge>
        ) : null}
      </div>
      <Button size="sm" onClick={onRun} disabled={running || !canRun}>
        {running ? (
          <>
            <LoaderCircleIcon className="size-4 animate-spin" />
            Running...
          </>
        ) : (
          <>
            <SendIcon className="size-4" />
            Run
          </>
        )}
      </Button>
    </header>
  );
}
