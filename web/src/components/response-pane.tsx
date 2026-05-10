import { useMemo, useState } from "react";
import {
  CopyIcon,
  DatabaseIcon,
  DownloadIcon,
  Maximize2Icon,
} from "lucide-react";

import { MethodBadge } from "@/components/method-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CodeEditor,
  languageFromBody,
  languageFromContentType,
} from "@/components/ui/code-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs } from "@/components/ui/vercel-tabs";
import { cn } from "@/lib/utils";
import type { HistoryItem } from "@/types";

type ResponseTabId = "response" | "headers" | "timeline" | "tests";
type BodyFormat = "json" | "raw";

const BODY_FORMAT_LABELS: Record<BodyFormat, string> = {
  json: "JSON",
  raw: "Raw",
};

export function ResponsePane({ item }: { item: HistoryItem | undefined }) {
  if (!item) {
    return <EmptyState />;
  }
  return <PopulatedPane item={item} />;
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 items-center gap-2 bg-background px-4 text-xs text-muted-foreground">
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
  const [activeTab, setActiveTab] = useState<ResponseTabId>("response");
  const [bodyFormat, setBodyFormat] = useState<BodyFormat>("json");
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
  const status = item.status ?? 0;
  const responseTabs = useMemo(
    () => [
      { id: "response", label: "Response" },
      { id: "headers", label: `Headers ${headerCount}` },
      { id: "timeline", label: "Timeline" },
      { id: "tests", label: "Tests" },
    ],
    [headerCount],
  );
  const bodyValue = bodyFormat === "json" ? prettyBody : item.response_body;
  const bodyLanguage = bodyFormat === "json" ? prettyLanguage : "plaintext";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-3 bg-background px-4">
        <Tabs
          tabs={responseTabs}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as ResponseTabId)}
        />

        <div className="ml-auto flex items-center gap-3">
          {activeTab === "response" ? (
            <Select
              value={bodyFormat}
              onValueChange={(value) => setBodyFormat(value as BodyFormat)}
            >
              <SelectTrigger className="h-6 w-[72px] rounded-md border-border/60 bg-transparent px-2 font-mono text-[10px] uppercase tracking-wide shadow-none focus-visible:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {Object.entries(BODY_FORMAT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <div className="flex items-center gap-2.5 text-[11px]">
            <span
              className={cn(
                "font-mono text-xs font-semibold tabular-nums",
                statusToTextClass(status),
              )}
            >
              {statusLabel(status)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {item.duration_ms}ms
            </span>
            <span className="text-muted-foreground tabular-nums">
              {sizeLabel}
            </span>
            {item.response_truncated ? (
              <Badge
                variant="secondary"
                className="h-5 border-amber-500/40 bg-amber-500/10 px-1.5 text-[10px] text-amber-700 dark:text-amber-300"
              >
                truncated
              </Badge>
            ) : null}
          </div>

          <div className="h-4 w-px bg-border/80" aria-hidden />

          <ResponseActions
            body={item.response_body ?? ""}
            url={item.url}
            activeTab={activeTab}
            headers={item.response_headers ?? {}}
          />
        </div>
      </div>

      {item.error ? (
        <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {item.error}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {activeTab === "response" ? (
          bodyValue ? (
            <CodeEditor
              value={bodyValue}
              language={bodyLanguage}
              readOnly
              embedded
              minimal={bodyFormat === "raw"}
              className="flex-1 border-0"
            />
          ) : (
            <ResponseEmpty />
          )
        ) : null}

        {activeTab === "headers" ? (
          <HeadersTable headers={item.response_headers ?? {}} />
        ) : null}

        {activeTab === "timeline" ? (
          <TimelineView item={item} status={status} />
        ) : null}

        {activeTab === "tests" ? <TestsView /> : null}
      </div>
    </div>
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
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        No headers were returned.
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="m-3 ml-7 overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[240px]">Name</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map(([key, value]) => (
              <TableRow key={key}>
                <TableCell className="whitespace-normal break-all text-muted-foreground">
                  {key}
                </TableCell>
                <TableCell className="whitespace-normal break-all">
                  {value}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TimelineView({ item, status }: { item: HistoryItem; status: number }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="m-3 ml-7 overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[80px]">Method</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[140px]">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell
                className={cn(
                  "font-semibold tabular-nums",
                  statusToTextClass(status),
                )}
              >
                {statusLabel(status)}
              </TableCell>
              <TableCell>
                <MethodBadge method={item.method} variant="text" />
              </TableCell>
              <TableCell className="whitespace-normal break-all">
                {item.url}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {relativeTime(item.created_at)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function TestsView() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      No tests found
    </div>
  );
}

function ResponseActions({
  body,
  url,
  activeTab,
  headers,
}: {
  body: string;
  url: string;
  activeTab: ResponseTabId;
  headers: Record<string, string>;
}) {
  const copyValue =
    activeTab === "headers" ? JSON.stringify(headers, null, 2) : body || url;
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Copy response"
        onClick={() => void navigator.clipboard?.writeText(copyValue)}
      >
        <CopyIcon className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Download response"
        onClick={() => downloadText(copyValue, "boson-response.txt")}
      >
        <DownloadIcon className="size-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        aria-label="Open response tools"
        disabled
      >
        <Maximize2Icon className="size-3" />
      </Button>
    </div>
  );
}

function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function statusLabel(status: number): string {
  if (!status) return "ERR";
  return `${status} ${statusText(status)}`;
}

function statusText(status: number): string {
  const labels: Record<number, string> = {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    301: "Moved",
    302: "Found",
    304: "Not Modified",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    409: "Conflict",
    422: "Unprocessable",
    429: "Too Many Requests",
    500: "Server Error",
    502: "Bad Gateway",
    503: "Unavailable",
    504: "Timeout",
  };
  return labels[status] ?? (status >= 200 && status < 300 ? "OK" : "");
}

function statusToTextClass(status: number): string {
  if (status >= 500) return "text-destructive";
  if (status >= 400) return "text-amber-600 dark:text-amber-400";
  if (status >= 200) return "text-emerald-600 dark:text-emerald-400";
  return "text-muted-foreground";
}

function relativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
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
