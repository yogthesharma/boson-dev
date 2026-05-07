import { GripVertical } from "lucide-react";
import type * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/lib/utils";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return (
    <Group
      data-slot="resizable-panel-group"
      className={cn("h-full w-full min-h-0 min-w-0", className)}
      {...props}
    />
  );
}

function ResizablePanel({ className, ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel data-slot="resizable-panel" className={cn("min-h-0 min-w-0", className)} {...props} />;
}

function ResizableHandle({
  withHandle,
  hitArea = "horizontal",
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
  /**
   * Match the parent `Group` orientation:
   * - `horizontal` — panels sit in a row; drag handle is a vertical bar (default).
   * - `vertical` — panels stack; drag handle is a horizontal bar.
   */
  hitArea?: "horizontal" | "vertical";
}) {
  const isVertical = hitArea === "vertical";
  return (
    <Separator
      data-slot="resizable-handle"
      className={cn(
        "bg-border focus-visible:ring-ring relative flex shrink-0 items-center justify-center transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1",
        isVertical
          ? "h-2 w-full min-h-[6px] after:absolute after:inset-x-0 after:top-1/2 after:h-4 after:w-full after:-translate-y-1/2"
          : "w-px after:absolute after:inset-y-0 after:left-1/2 after:w-4 after:-translate-x-1/2",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div
          className={cn(
            "bg-muted z-10 flex items-center justify-center rounded-sm border shadow-sm",
            isVertical ? "h-4 w-8" : "h-7 w-4",
          )}
        >
          <GripVertical className={cn("size-3.5 text-muted-foreground", isVertical && "rotate-90")} />
        </div>
      ) : null}
    </Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
