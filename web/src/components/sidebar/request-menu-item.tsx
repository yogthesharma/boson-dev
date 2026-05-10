import { MethodBadge } from "@/components/method-badge";
import { statusToClasses } from "@/components/sidebar/utils";
import {
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ApiRequest, Draft, HistoryItem } from "@/types";

interface RequestMenuItemProps {
  request: ApiRequest;
  isActive: boolean;
  draft: Draft | undefined;
  isStale: boolean;
  lastRun: HistoryItem | undefined;
  onSelect: (id: string) => void;
}

export function RequestMenuItem({
  request,
  isActive,
  draft,
  isStale,
  lastRun,
  onSelect,
}: RequestMenuItemProps) {
  const status = lastRun?.status;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={request.name}
        onClick={() => onSelect(request.id)}
      >
        <MethodBadge method={request.method} />
        <span className="truncate">{request.name}</span>
      </SidebarMenuButton>
      {draft ? (
        <SidebarMenuAction
          aria-label={isStale ? "Draft is stale" : "Has unsaved draft"}
          asChild
        >
          <span
            className={cn(
              "pointer-events-none inline-flex size-2 rounded-full",
              isStale ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
        </SidebarMenuAction>
      ) : null}
      {status ? (
        <SidebarMenuBadge
          className={cn(
            "font-mono text-[10px]",
            statusToClasses(status),
            draft ? "right-7" : "",
          )}
        >
          {status}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
}
