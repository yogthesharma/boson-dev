import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: number }) {
  const className =
    status >= 500
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : status >= 400
        ? "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-300"
        : status >= 200
          ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300"
          : "";
  return (
    <Badge variant="secondary" className={cn("font-mono", className)}>
      {status || "ERR"}
    </Badge>
  );
}
