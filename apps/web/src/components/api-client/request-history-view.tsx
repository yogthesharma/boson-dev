import { History } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { METHOD_COLORS, statusTone } from "@/lib/http";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

import type { HistoryEntry } from "./use-request-history";

const STATUS_TEXT = {
  info: "text-sky-400",
  success: "text-emerald-400",
  redirect: "text-amber-400",
  client: "text-orange-400",
  server: "text-rose-400",
  neutral: "text-muted-foreground",
} as const;

function HistoryRow({
  entry,
  onClick,
}: {
  entry: HistoryEntry;
  onClick?: (entry: HistoryEntry) => void;
}) {
  const tone = entry.status != null ? statusTone(entry.status) : "neutral";
  const statusLabel = !entry.ok
    ? "ERROR"
    : entry.status != null
      ? `${entry.status} ${entry.statusText ?? ""}`.trim()
      : "—";

  const Wrapper: React.ElementType = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick ? () => onClick(entry) : undefined}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2 text-left sm:px-5",
        "border-border/60 border-b last:border-b-0",
        onClick ? "hover:bg-accent/30 cursor-pointer transition-colors" : "",
      )}
    >
      <span
        className={cn(
          "shrink-0 font-sans text-xs font-semibold tabular-nums",
          !entry.ok ? STATUS_TEXT.server : STATUS_TEXT[tone],
        )}
        title={entry.error ?? undefined}
      >
        {statusLabel}
      </span>

      <span
        className={cn(
          "shrink-0 font-sans text-[11px] font-bold tracking-wider uppercase",
          METHOD_COLORS[entry.method],
        )}
      >
        {entry.method}
      </span>

      <span className="text-foreground/90 min-w-0 flex-1 truncate font-sans text-xs">
        {entry.url}
      </span>

      {entry.durationMs != null ? (
        <span className="text-muted-foreground hidden shrink-0 font-sans text-[11px] tabular-nums sm:inline">
          {entry.durationMs}ms
        </span>
      ) : null}

      <span className="text-muted-foreground shrink-0 text-[11px]">
        {relativeTime(entry.timestamp)}
      </span>
    </Wrapper>
  );
}

export function RequestHistoryView({
  entries,
  onReplay,
}: {
  entries: HistoryEntry[];
  onReplay?: (entry: HistoryEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No requests yet"
        description="Sent requests appear here. Pick one to load it back into the request bar."
      />
    );
  }

  return (
    <div className="border-border/60 flex flex-col">
      {entries.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} onClick={onReplay} />
      ))}
    </div>
  );
}
