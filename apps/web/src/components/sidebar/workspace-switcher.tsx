import { Boxes, ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type WorkspaceOption = {
  slug: string;
};

/**
 * Sidebar header control: switches between workspaces (same shell as the old
 * “team” switcher). Today only one canonical workspace exists per server; the
 * menu still matches that pattern so multi-workspace can drop in later.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeSlug,
  onSelect,
}: {
  workspaces: WorkspaceOption[];
  activeSlug: string | null;
  onSelect?: (slug: string) => void;
}) {
  const active =
    workspaces.find((w) => w.slug === activeSlug) ?? workspaces[0] ?? null;
  const title = active?.slug ?? "No workspace";
  const subtitle = active
    ? "Synced from YAML"
    : "Run `boson push` to connect";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
            <Boxes className="size-4" />
          </div>
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">{title}</span>
            <span className="text-muted-foreground truncate text-xs">
              {subtitle}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
        align="start"
        side="right"
        sideOffset={4}
      >
        <DropdownMenuLabel className="text-muted-foreground text-xs">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.length === 0 ? (
          <DropdownMenuItem disabled className="text-muted-foreground text-xs">
            None synced yet
          </DropdownMenuItem>
        ) : (
          workspaces.map((w) => (
            <DropdownMenuItem
              key={w.slug}
              className="gap-2 p-2"
              onSelect={() => onSelect?.(w.slug)}
            >
              <div className="flex size-6 items-center justify-center rounded-md border">
                <Boxes className="size-3.5 shrink-0 opacity-70" />
              </div>
              <span className="truncate">{w.slug}</span>
              {w.slug === active?.slug ? (
                <span className="text-muted-foreground ml-auto text-xs">
                  active
                </span>
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 p-2">
          <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
            <Plus className="size-4" />
          </div>
          <span className="text-muted-foreground font-medium">
            Add workspace
          </span>
          <span className="text-muted-foreground ml-auto text-xs">soon</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
