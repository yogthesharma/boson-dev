import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center gap-2 p-6 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="bg-muted/60 text-muted-foreground inline-flex size-10 items-center justify-center rounded-full">
          <Icon className="size-5" />
        </div>
      ) : null}
      <p className="text-foreground text-sm font-medium">{title}</p>
      {description ? (
        <p className="text-muted-foreground max-w-sm text-xs">{description}</p>
      ) : null}
    </div>
  );
}
