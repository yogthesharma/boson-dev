import { MethodBadge } from "@/components/method-badge";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimestamp } from "@/lib/format";
import type { HistoryItem } from "@/types";

export function ResponsePanel({ item }: { item: HistoryItem | undefined }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 px-6 py-4">
        <CardTitle className="text-lg">Latest response</CardTitle>
        <span className="text-xs text-muted-foreground">
          {item ? formatTimestamp(item.created_at) : "No runs yet"}
        </span>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        {item ? (
          <ResponseView item={item} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Run a request to capture response history in SQLite.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ResponseView({ item }: { item: HistoryItem }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <MethodBadge method={item.method} />
        <StatusPill status={item.status ?? 0} />
        <span>{item.duration_ms}ms</span>
        <span className="truncate">{item.url}</span>
      </div>
      {item.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {item.error}
        </p>
      ) : null}
      <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
        {item.response_body || "(empty response)"}
      </pre>
    </div>
  );
}
