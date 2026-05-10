import {
  AtomIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  PlusIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { Environment, ProjectView } from "@/types";

interface WorkspaceSwitcherProps {
  project: ProjectView | null;
  currentEnv: Environment | null;
  onSelectEnvironment: (id: string) => void;
}

export function WorkspaceSwitcher({
  project,
  currentEnv,
  onSelectEnvironment,
}: WorkspaceSwitcherProps) {
  const envs = project?.environments ?? [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          tooltip={project?.name ?? "Boson"}
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
        >
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AtomIcon className="size-4" />
          </div>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate font-semibold">
              {project?.name ?? "Boson"}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {currentEnv?.name ?? "No environment"}
            </span>
          </div>
          <ChevronsUpDownIcon className="ml-auto size-4 opacity-60" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="bottom"
        align="start"
        sideOffset={4}
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel>Environments</DropdownMenuLabel>
        {envs.length === 0 ? (
          <DropdownMenuItem disabled>
            <CircleAlertIcon className="size-4" />
            No environments defined
          </DropdownMenuItem>
        ) : (
          envs.map((env) => (
            <DropdownMenuItem
              key={env.id}
              onSelect={() => onSelectEnvironment(env.id)}
              className={cn(
                env.id === currentEnv?.id && "bg-accent text-accent-foreground",
              )}
            >
              <span className="truncate">{env.name}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
                {env.id}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <PlusIcon className="size-4" />
          Add environment (edit YAML)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
