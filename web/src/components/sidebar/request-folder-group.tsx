import { ChevronRightIcon } from "lucide-react";

import { RequestMenuItem } from "@/components/sidebar/request-menu-item";
import type { FolderGroup } from "@/components/sidebar/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from "@/components/ui/sidebar";
import type { Draft } from "@/types";

interface RequestFolderGroupProps {
  folder: FolderGroup;
  selectedRequestId: string;
  draftsById: Map<string, Draft>;
  staleSet: Set<string>;
  onSelectRequest: (id: string) => void;
}

/**
 * Postman-style collection row: a collapsible menu item with the chevron on
 * the left and the folder name in default weight. The folder icon was
 * intentionally removed — the chevron is already the "expandable" affordance,
 * and a second icon doubles the visual weight without adding information.
 */
export function RequestFolderGroup({
  folder,
  selectedRequestId,
  draftsById,
  staleSet,
  onSelectRequest,
}: RequestFolderGroupProps) {
  return (
    <Collapsible defaultOpen asChild className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={folder.label}>
            <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/collapsible:rotate-90" />
            <span className="truncate">{folder.label}</span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {folder.requests.map((request) => (
              <RequestMenuItem
                key={request.id}
                request={request}
                isActive={request.id === selectedRequestId}
                draft={draftsById.get(request.id)}
                isStale={staleSet.has(request.id)}
                onSelect={onSelectRequest}
              />
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
