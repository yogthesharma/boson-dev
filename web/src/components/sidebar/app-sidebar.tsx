import { useMemo } from "react";
import { KeyRoundIcon } from "lucide-react";

import { RequestFolderGroup } from "@/components/sidebar/request-folder-group";
import { ThemeToggleButton } from "@/components/sidebar/theme-toggle-button";
import { groupRequestsByFolder } from "@/components/sidebar/utils";
import { WorkspaceSwitcher } from "@/components/sidebar/workspace-switcher";
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
import type { Draft, HistoryItem, ProjectView } from "@/types";

interface AppSidebarProps {
  project: ProjectView | null;
  history: HistoryItem[];
  selectedRequestId: string;
  selectedEnvironmentId: string;
  onSelectRequest: (id: string) => void;
  onSelectEnvironment: (id: string) => void;
  onManageSecrets?: () => void;
}

export function AppSidebar({
  project,
  history,
  selectedRequestId,
  selectedEnvironmentId,
  onSelectRequest,
  onSelectEnvironment,
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

  const lastRunById = useMemo(() => {
    const map = new Map<string, HistoryItem>();
    for (const item of history) {
      if (!map.has(item.request_id)) map.set(item.request_id, item);
    }
    return map;
  }, [history]);

  const staleSet = useMemo(
    () => new Set(project?.stale_drafts ?? []),
    [project?.stale_drafts],
  );

  const currentEnv =
    project?.environments.find((env) => env.id === selectedEnvironmentId) ??
    null;
  const secretsCount = project?.secret_names?.length ?? 0;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <WorkspaceSwitcher
              project={project}
              currentEnv={currentEnv}
              onSelectEnvironment={onSelectEnvironment}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {folders.length === 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Requests</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-2 py-2 text-xs text-muted-foreground">
                No requests yet. Add one to{" "}
                <code className="font-mono">boson/requests.yml</code>.
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          folders.map((folder) => (
            <RequestFolderGroup
              key={folder.key}
              folder={folder}
              selectedRequestId={selectedRequestId}
              draftsById={draftsById}
              staleSet={staleSet}
              lastRunById={lastRunById}
              onSelectRequest={onSelectRequest}
            />
          ))
        )}
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
