import { useMemo } from "react";
import { KeyRoundIcon } from "lucide-react";

import { RequestFolderGroup } from "@/components/sidebar/request-folder-group";
import { SidebarBrand } from "@/components/sidebar/sidebar-brand";
import { ThemeToggleButton } from "@/components/sidebar/theme-toggle-button";
import { groupRequestsByFolder } from "@/components/sidebar/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Draft, ProjectView } from "@/types";

interface AppSidebarProps {
  project: ProjectView | null;
  version: string | null;
  selectedRequestId: string;
  onSelectRequest: (id: string) => void;
  onManageSecrets?: () => void;
}

export function AppSidebar({
  project,
  version,
  selectedRequestId,
  onSelectRequest,
  onManageSecrets,
}: AppSidebarProps) {
  const folders = useMemo(
    () => groupRequestsByFolder(project?.requests ?? []),
    [project?.requests],
  );

  const draftsById = useMemo(() => {
    const map = new Map<string, Draft>();
    for (const draft of project?.drafts ?? []) {
      map.set(draft.request_id, draft);
    }
    return map;
  }, [project?.drafts]);

  const staleSet = useMemo(
    () => new Set(project?.stale_drafts ?? []),
    [project?.stale_drafts],
  );

  const secretsCount = project?.secret_names?.length ?? 0;

  return (
    <Sidebar collapsible="offcanvas" className="border-none">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarBrand version={version} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Collections</SidebarGroupLabel>
          <SidebarGroupContent>
            {folders.length === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No requests yet. Add one to{" "}
                <code className="font-mono">boson/requests.yml</code>.
              </p>
            ) : (
              <SidebarMenu>
                {folders.map((folder) => (
                  <RequestFolderGroup
                    key={folder.key}
                    folder={folder}
                    selectedRequestId={selectedRequestId}
                    draftsById={draftsById}
                    staleSet={staleSet}
                    onSelectRequest={onSelectRequest}
                  />
                ))}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onManageSecrets}
              tooltip="Secrets"
              disabled={!onManageSecrets}
            >
              <KeyRoundIcon />
              <span>Secrets</span>
            </SidebarMenuButton>
            {secretsCount > 0 ? (
              <SidebarMenuBadge>{secretsCount}</SidebarMenuBadge>
            ) : null}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <ThemeToggleButton />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
