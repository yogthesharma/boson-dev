import { useMemo } from "react";
import { ClockIcon, DatabaseIcon } from "lucide-react";

import { MethodBadge } from "@/components/method-badge";
import { StatusPill } from "@/components/status-pill";
import { Badge } from "@/components/ui/badge";
import {
  CodeEditor,
  languageFromBody,
  languageFromContentType,
} from "@/components/ui/code-editor";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/lib/format";
import type { HistoryItem } from "@/types";

export function ResponsePane({ item }: { item: HistoryItem | undefined }) {
  if (!item) {
    return <EmptyState />;
  }
  return <PopulatedPane item={item} />;
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center gap-2 border-b bg-background px-4 text-xs text-muted-foreground">
        <span>Response</span>
      </div>
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        <div className="text-center">
          <DatabaseIcon className="mx-auto mb-3 size-7 opacity-60" />
          <p>No response yet.</p>
          <p className="text-xs opacity-80">
            Send the request to capture history in SQLite.
          </p>
        </div>
      </div>
    </div>
  );
}

function PopulatedPane({ item }: { item: HistoryItem }) {
  const headerCount = useMemo(
    () => Object.keys(item.response_headers ?? {}).length,
    [item.response_headers],
  );
  const contentType = item.response_headers?.["content-type"];
  const prettyLanguage = useMemo(() => {
    const fromHeader = languageFromContentType(contentType);
    if (fromHeader !== "plaintext") return fromHeader;
    return languageFromBody(item.response_body ?? "");
  }, [contentType, item.response_body]);

  const prettyBody = useMemo(() => {
    if (!item.response_body) return "";
    if (prettyLanguage === "json") {
      try {
        return JSON.stringify(JSON.parse(item.response_body), null, 2);
      } catch {
        return item.response_body;
      }
    }
    return item.response_body;
  }, [item.response_body, prettyLanguage]);

  const sizeLabel = useMemo(
    () => formatBytes(byteSize(item.response_body ?? "")),
    [item.response_body],
  );

  return (
    <Tabs defaultValue="pretty" className="flex h-full min-h-0 flex-col gap-0">
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2">
        <TabsList variant="line" className="h-9 gap-1 bg-transparent p-0">
          <TabsTrigger value="pretty" className="h-8 gap-1.5 px-2.5 text-xs">
            Pretty
          </TabsTrigger>
          <TabsTrigger value="raw" className="h-8 gap-1.5 px-2.5 text-xs">
            Raw
          </TabsTrigger>
          <TabsTrigger value="headers" className="h-8 gap-1.5 px-2.5 text-xs">
            Headers
            {headerCount > 0 ? (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 rounded-sm px-1 text-[10px]"
              >
                {headerCount}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <div className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <MethodBadge method={item.method} />
          <StatusPill status={item.status ?? 0} />
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-3" />
            {item.duration_ms} ms
          </span>
          <span>{sizeLabel}</span>
          {item.response_truncated ? (
            <Badge
              variant="secondary"
              className="h-5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
            >
              truncated
            </Badge>
          ) : null}
        </div>
      </div>

      {item.error ? (
        <div className="border-b bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {item.error}
        </div>
      ) : null}

      <TabsContent
        value="pretty"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {prettyBody ? (
          <CodeEditor
            value={prettyBody}
            language={prettyLanguage}
            readOnly
            embedded
            className="flex-1 border-0"
          />
        ) : (
          <ResponseEmpty />
        )}
      </TabsContent>

      <TabsContent
        value="raw"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {item.response_body ? (
          <CodeEditor
            value={item.response_body}
            language="plaintext"
            readOnly
            embedded
            minimal
            className="flex-1 border-0"
          />
        ) : (
          <ResponseEmpty />
        )}
      </TabsContent>

      <TabsContent
        value="headers"
        className="min-h-0 flex-1 overflow-auto p-4"
      >
        <HeadersTable headers={item.response_headers ?? {}} />
        <p className="mt-4 text-[11px] text-muted-foreground">
          Captured {formatTimestamp(item.created_at)} ·
          <span className="ml-1 font-mono">{item.url}</span>
        </p>
      </TabsContent>
    </Tabs>
  );
}

function ResponseEmpty() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      (empty response)
    </div>
  );
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
        No headers were returned.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border bg-card">
      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="w-[35%] px-3 py-2 text-left">Header</th>
            <th className="px-3 py-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value], index) => (
            <tr
              key={key}
              className={cn(
                "transition-colors hover:bg-muted/30",
                index !== entries.length - 1 ? "border-b" : "",
              )}
            >
              <td className="break-all px-3 py-1.5 align-middle font-mono text-xs">
                {key}
              </td>
              <td className="break-all px-3 py-1.5 align-middle font-mono text-xs">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function byteSize(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).byteLength;
  }
  return text.length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
