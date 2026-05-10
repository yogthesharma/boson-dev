import { ChevronRightIcon, FolderIcon } from "lucide-react";

import { RequestMenuItem } from "@/components/sidebar/request-menu-item";
import type { FolderGroup } from "@/components/sidebar/utils";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import type { Draft, HistoryItem } from "@/types";

interface RequestFolderGroupProps {
  folder: FolderGroup;
  selectedRequestId: string;
  draftsById: Map<string, Draft>;
  staleSet: Set<string>;
  lastRunById: Map<string, HistoryItem>;
  onSelectRequest: (id: string) => void;
}

export function RequestFolderGroup({
  folder,
  selectedRequestId,
  draftsById,
  staleSet,
  lastRunById,
  onSelectRequest,
}: RequestFolderGroupProps) {
  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="flex w-full items-center gap-2">
            <FolderIcon className="size-3.5 text-muted-foreground" />
            <span className="truncate">{folder.label}</span>
            <Badge
              variant="secondary"
              className="ml-auto h-4 px-1.5 text-[10px] leading-none"
            >
              {folder.requests.length}
            </Badge>
            <ChevronRightIcon className="size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {folder.requests.map((request) => (
                <RequestMenuItem
                  key={request.id}
                  request={request}
                  isActive={request.id === selectedRequestId}
                  draft={draftsById.get(request.id)}
                  isStale={staleSet.has(request.id)}
                  lastRun={lastRunById.get(request.id)}
                  onSelect={onSelectRequest}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
