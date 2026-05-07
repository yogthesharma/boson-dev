import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: { title: string; url: string }[];
};

export function NavMain({ items, label = "Platform" }: { items: NavItem[]; label?: string }) {
  return (
    <div className="flex flex-col gap-1 px-2 py-2">
      <p className="text-sidebar-foreground/60 px-2 pb-1 pt-2 text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.title}>
            {item.items?.length ? (
              <Collapsible defaultOpen={item.isActive} className="group/coll">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      item.isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                  >
                    {item.icon ? <item.icon className="size-4 opacity-70" /> : null}
                    <span className="flex-1 truncate">{item.title}</span>
                    <ChevronRight className="size-4 opacity-60 transition-transform group-data-[state=open]/coll:rotate-90" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                  <ul className="ml-4 mt-0.5 flex flex-col gap-0.5 pl-2">
                    {item.items.map((sub) => (
                      <li key={sub.title}>
                        <a
                          href={sub.url}
                          className="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80 block rounded-md px-2 py-1 text-sm transition-colors"
                        >
                          {sub.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <a
                href={item.url}
                className={cn(
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  item.isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                {item.icon ? <item.icon className="size-4 opacity-70" /> : null}
                <span className="truncate">{item.title}</span>
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
