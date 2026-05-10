import { MethodBadge } from "@/components/method-badge";
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ApiRequest, Draft } from "@/types";

interface RequestMenuItemProps {
  request: ApiRequest;
  isActive: boolean;
  draft: Draft | undefined;
  isStale: boolean;
  onSelect: (id: string) => void;
}

/**
 * A single request row, nested inside `SidebarMenuSub`. We deliberately keep
 * only two pieces of decoration here: the colored method label (info) and a
 * tiny draft dot (action: there are unsaved changes). The last-response
 * status code is intentionally not shown — it would be redundant with the
 * response panel and would add per-row visual weight for no real signal.
 */
export function RequestMenuItem({
  request,
  isActive,
  draft,
  isStale,
  onSelect,
}: RequestMenuItemProps) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton asChild isActive={isActive} title={request.name}>
        <button
          type="button"
          onClick={() => onSelect(request.id)}
          className="w-full"
        >
          <MethodBadge method={request.method} />
          <span className="min-w-0 flex-1 truncate text-left">
            {request.name}
          </span>
          {draft ? (
            <span
              aria-label={isStale ? "Draft is stale" : "Has unsaved draft"}
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                isStale ? "bg-amber-500" : "bg-emerald-500",
              )}
            />
          ) : null}
        </button>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  );
}
