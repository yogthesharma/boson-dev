import { cn } from "@/lib/utils";

const METHOD_STYLES: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  POST: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  PUT: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  PATCH: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  DELETE: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  HEAD: "bg-muted text-muted-foreground",
  OPTIONS: "bg-muted text-muted-foreground",
};

export function MethodBadge({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const upper = method.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center justify-center rounded px-1.5 font-mono text-[10px] font-semibold leading-none tracking-wide",
        METHOD_STYLES[upper] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {upper}
    </span>
  );
}
