import { useWorkspace } from "@/context/workspace-context";

import { NavUser } from "./nav-user";
import { sidebarData } from "./sidebar-data";
import { WorkspaceRequests } from "./workspace-requests";
import { WorkspaceSwitcher } from "./workspace-switcher";

/**
 * Left sidebar.
 *
 * Top: workspace switcher (canonical slug from server). Middle: requests.
 * Bottom: user. Sign-in lives on the standalone `/login` page.
 */
export function Sidebar() {
  const { merged } = useWorkspace();
  const slug = merged?.workspace ?? null;
  const workspaces = slug ? [{ slug }] : [];

  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full min-h-0 flex-col">
      <div className="p-2">
        <WorkspaceSwitcher workspaces={workspaces} activeSlug={slug} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <WorkspaceRequests />
      </div>

      <div className="p-2">
        <NavUser user={sidebarData.user} />
      </div>
    </div>
  );
}
