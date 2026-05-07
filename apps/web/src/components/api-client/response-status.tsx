import { cn } from "@/lib/utils";
import type { ProxyResponse } from "@/lib/api";
import { statusTone } from "@/lib/http";

const TONE_TEXT = {
  info: "text-sky-400",
  success: "text-emerald-400",
  redirect: "text-amber-400",
  client: "text-orange-400",
  server: "text-rose-400",
  neutral: "text-muted-foreground",
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Compact, text-only status display. Designed to live inside a tab strip's
 * trailing slot — no badges, no boxes, just colored numbers.
 */
export function ResponseStatus({ response }: { response: ProxyResponse | null }) {
  if (!response) return null;

  if (!response.ok) {
    return (
      <div className="flex items-center gap-2 font-sans text-xs">
        <span className="font-semibold text-rose-400">ERROR</span>
        {response.durationMs != null ? (
          <span className="text-muted-foreground tabular-nums">
            {response.durationMs}ms
          </span>
        ) : null}
      </div>
    );
  }

  const tone = statusTone(response.status);

  return (
    <div className="flex items-center gap-3 font-sans text-xs tabular-nums">
      <span className={cn("font-semibold", TONE_TEXT[tone])}>
        {response.status} {response.statusText || ""}
      </span>
      <span className="text-muted-foreground">{response.durationMs}ms</span>
      <span className="text-muted-foreground">
        {formatBytes(response.bodyBytes)}
        {response.truncated ? "*" : ""}
      </span>
    </div>
  );
}
