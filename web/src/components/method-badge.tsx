import { cn } from "@/lib/utils";

/**
 * Color = information, no background. We deliberately keep the chip-style
 * variant available for places that need denser emphasis (e.g. the request
 * header bar), but the sidebar uses `variant="text"` so each row reads at
 * the same visual weight as plain navigation links.
 */
const METHOD_COLORS: Record<string, string> = {
  GET: "text-emerald-600 dark:text-emerald-400",
  POST: "text-amber-600 dark:text-amber-400",
  PUT: "text-sky-600 dark:text-sky-400",
  PATCH: "text-violet-600 dark:text-violet-400",
  DELETE: "text-rose-600 dark:text-rose-400",
  HEAD: "text-muted-foreground",
  OPTIONS: "text-muted-foreground",
};

const METHOD_CHIP_BG: Record<string, string> = {
  GET: "bg-emerald-500/15",
  POST: "bg-amber-500/15",
  PUT: "bg-sky-500/15",
  PATCH: "bg-violet-500/15",
  DELETE: "bg-rose-500/15",
  HEAD: "bg-muted",
  OPTIONS: "bg-muted",
};

export interface MethodBadgeProps {
  method: string;
  className?: string;
  /**
   * `text`: colored mono text only (minimal, for nav lists).
   * `chip`: colored pill with background (denser, for header bars).
   */
  variant?: "text" | "chip";
}

export function MethodBadge({
  method,
  className,
  variant = "text",
}: MethodBadgeProps) {
  const upper = method.toUpperCase();
  const color = METHOD_COLORS[upper] ?? "text-muted-foreground";

  if (variant === "chip") {
    const bg = METHOD_CHIP_BG[upper] ?? "bg-muted";
    return (
      <span
        className={cn(
          "inline-flex h-5 shrink-0 items-center justify-center rounded px-1.5 font-mono text-[10px] font-semibold leading-none tracking-wide",
          bg,
          color,
          className,
        )}
      >
        {upper}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "w-10 shrink-0 text-left font-mono text-[10px] font-semibold uppercase leading-none tracking-wide",
        color,
        className,
      )}
    >
      {upper}
    </span>
  );
}
