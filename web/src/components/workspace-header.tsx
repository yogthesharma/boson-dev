import {
  AlertTriangleIcon,
  EllipsisIcon,
  FilePenIcon,
  TrashIcon,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WorkspaceHeaderProps {
  workspaceName: string;
  folder: string | null;
  requestName: string;
  hasDraft: boolean;
  isStale: boolean;
  hasUnsavedChanges: boolean;
  canAct: boolean;
  onNameChange: (name: string) => void;
  onSaveToYaml: () => void;
  onDiscardDraft: () => void;
}

export function WorkspaceHeader({
  workspaceName,
  folder,
  requestName,
  hasDraft,
  isStale,
  hasUnsavedChanges,
  canAct,
  onNameChange,
  onSaveToYaml,
  onDiscardDraft,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink className="text-xs text-muted-foreground">
              {workspaceName || "Boson"}
            </BreadcrumbLink>
          </BreadcrumbItem>
          {folder ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink className="text-xs text-muted-foreground">
                  {folder}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          ) : null}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Input
              value={requestName}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Untitled request"
              disabled={!canAct}
              spellCheck={false}
              className="h-7 max-w-[320px] border-transparent bg-transparent px-1.5 text-xs font-medium text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-input focus-visible:bg-background"
            />
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1.5">
        {hasUnsavedChanges ? (
          <Badge
            variant="secondary"
            className="h-5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
          >
            unsaved
          </Badge>
        ) : hasDraft ? (
          <Badge
            variant="secondary"
            className="h-5 border-sky-500/40 bg-sky-500/10 px-1.5 text-[10px] text-sky-700 dark:text-sky-300"
          >
            draft
          </Badge>
        ) : null}

        {isStale ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="h-5 cursor-help gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
              >
                <AlertTriangleIcon className="size-3" />
                stale
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              The YAML source for this request changed since the draft was
              saved. Re-saving will overwrite the file.
            </TooltipContent>
          </Tooltip>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label="Request actions"
            >
              <EllipsisIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onSaveToYaml} disabled={!canAct}>
              <FilePenIcon className="size-3.5" />
              Save to YAML…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDiscardDraft}
              disabled={!canAct || !hasDraft}
              variant="destructive"
            >
              <TrashIcon className="size-3.5" />
              Discard draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
