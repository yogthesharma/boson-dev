import { Folder, Forward, MoreHorizontal, Trash2, type LucideIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Project = {
  name: string;
  url: string;
  icon: LucideIcon;
};

export function NavProjects({ projects }: { projects: Project[] }) {
  return (
    <div className="flex flex-col gap-1 px-2 py-2">
      <p className="text-sidebar-foreground/60 px-2 pb-1 pt-2 text-xs font-medium tracking-wide uppercase">
        Projects
      </p>
      <ul className="flex flex-col gap-0.5">
        {projects.map((p) => (
          <li
            key={p.name}
            className="group hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative flex items-center rounded-md transition-colors"
          >
            <a href={p.url} className="flex flex-1 items-center gap-2 px-2 py-1.5 text-sm">
              <p.icon className="size-4 opacity-70" />
              <span className="truncate">{p.name}</span>
            </a>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More"
                  className="hover:bg-sidebar-accent/80 mr-1 flex size-6 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 rounded-lg" side="right" align="start">
                <DropdownMenuItem>
                  <Folder /> View Project
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Forward /> Share Project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <Trash2 /> Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            <MoreHorizontal className="size-4 opacity-70" />
            More
          </button>
        </li>
      </ul>
    </div>
  );
}
