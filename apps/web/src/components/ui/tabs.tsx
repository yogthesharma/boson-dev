import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type TabItem<T extends string> = {
  id: T;
  label: string;
  /** Render a small numeric badge after the label (only shown when > 0). */
  count?: number;
  /** Render a small dot indicator after the label. */
  dot?: boolean;
};

export function Tabs<T extends string>({
  items,
  active,
  onChange,
  className,
  trailing,
}: {
  items: readonly TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  trailing?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-border/60 flex items-center gap-0 border-b",
        className,
      )}
      role="tablist"
    >
      <div className="flex min-w-0 flex-1 items-center gap-0">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(item.id)}
              className={cn(
                "text-muted-foreground -mb-px inline-flex items-center gap-1.5",
                "border-b-2 border-transparent px-3 py-2 text-sm transition-colors",
                "hover:text-foreground hover:bg-accent/40 cursor-pointer",
                "focus-visible:outline-ring/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px]",
                isActive && "text-foreground border-primary font-medium",
              )}
            >
              <span>{item.label}</span>
              {item.count != null && item.count > 0 ? (
                <span
                  className={cn(
                    "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {item.count}
                </span>
              ) : item.dot ? (
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    isActive ? "bg-primary" : "bg-muted-foreground/60",
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {trailing ? (
        <div className="ml-auto flex shrink-0 items-center gap-1 pl-2">{trailing}</div>
      ) : null}
    </div>
  );
}
