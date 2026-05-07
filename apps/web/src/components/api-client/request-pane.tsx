import { useState, type ReactNode } from "react";

import { Tabs, type TabItem } from "@/components/ui/tabs";
import {
  bodyModeIsRaw,
  type BodyMode,
  type HttpMethod,
} from "@/lib/http";
import type { KvRow } from "@/lib/kv";

import { BodyEditor } from "./body-editor";
import { BodySelect } from "./body-select";
import { KvEditor } from "./kv-editor";
import { RequestHeader } from "./request-header";
import { RequestSettings } from "./request-settings";

type RequestTab = "params" | "body" | "headers" | "settings";

function activeRowCount(rows: KvRow[]): number {
  return rows.filter((r) => r.enabled && r.key.trim()).length;
}

function bodyHasContent(
  mode: BodyMode,
  rawBody: string,
  formBody: KvRow[],
): boolean {
  if (mode === "none") return false;
  if (bodyModeIsRaw(mode)) return rawBody.trim().length > 0;
  if (mode === "form-urlencoded" || mode === "multipart") {
    return activeRowCount(formBody) > 0;
  }
  return false;
}

function prettifyJson(input: string): string {
  try {
    return JSON.stringify(JSON.parse(input), null, 2);
  } catch {
    return input;
  }
}

export function RequestPane({
  method,
  onMethodChange,
  url,
  onUrlChange,
  loading,
  onSend,
  onCancel,
  params,
  onParamsChange,
  headers,
  onHeadersChange,
  bodyMode,
  onBodyModeChange,
  rawBody,
  onRawBodyChange,
  formBody,
  onFormBodyChange,
  tags,
  onTagsChange,
  urlEncode,
  onUrlEncodeChange,
  followRedirects,
  onFollowRedirectsChange,
  maxRedirects,
  onMaxRedirectsChange,
  proxyTimeoutMs,
  onProxyTimeoutMsChange,
}: {
  method: HttpMethod;
  onMethodChange: (m: HttpMethod) => void;
  url: string;
  onUrlChange: (s: string) => void;
  loading: boolean;
  onSend: () => void;
  onCancel: () => void;
  params: KvRow[];
  onParamsChange: (rows: KvRow[]) => void;
  headers: KvRow[];
  onHeadersChange: (rows: KvRow[]) => void;
  bodyMode: BodyMode;
  onBodyModeChange: (m: BodyMode) => void;
  rawBody: string;
  onRawBodyChange: (s: string) => void;
  formBody: KvRow[];
  onFormBodyChange: (rows: KvRow[]) => void;
  tags: string;
  onTagsChange: (s: string) => void;
  urlEncode: boolean;
  onUrlEncodeChange: (v: boolean) => void;
  followRedirects: boolean;
  onFollowRedirectsChange: (v: boolean) => void;
  maxRedirects: number;
  onMaxRedirectsChange: (n: number) => void;
  proxyTimeoutMs: number;
  onProxyTimeoutMsChange: (ms: number) => void;
}) {
  const [tab, setTab] = useState<RequestTab>("params");

  const tabs: TabItem<RequestTab>[] = [
    { id: "params", label: "Params", count: activeRowCount(params) },
    {
      id: "body",
      label: "Body",
      dot: bodyHasContent(bodyMode, rawBody, formBody),
    },
    { id: "headers", label: "Headers", count: activeRowCount(headers) },
    { id: "settings", label: "Settings" },
  ];

  const trailing: ReactNode = (() => {
    if (tab !== "body") return null;
    return (
      <div className="flex items-center gap-1">
        {bodyMode === "json" && rawBody.trim().length > 0 ? (
          <button
            type="button"
            onClick={() => onRawBodyChange(prettifyJson(rawBody))}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/40 inline-flex h-7 cursor-pointer items-center rounded-md px-2 text-xs font-medium transition-colors"
          >
            Prettify
          </button>
        ) : null}
        <BodySelect value={bodyMode} onChange={onBodyModeChange} />
      </div>
    );
  })();

  const renderBody = () => {
    if (tab === "params") {
      return (
        <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-4 sm:px-5">
          <KvEditor rows={params} onChange={onParamsChange} />
        </div>
      );
    }
    if (tab === "headers") {
      return (
        <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-4 sm:px-5">
          <KvEditor
            rows={headers}
            onChange={onHeadersChange}
            keyPlaceholder="Header-Name"
          />
        </div>
      );
    }
    if (tab === "settings") {
      return (
        <div className="min-h-0 flex-1 overflow-auto px-4 pt-4 pb-6 sm:px-6">
          <RequestSettings
            tags={tags}
            onTagsChange={onTagsChange}
            urlEncode={urlEncode}
            onUrlEncodeChange={onUrlEncodeChange}
            followRedirects={followRedirects}
            onFollowRedirectsChange={onFollowRedirectsChange}
            maxRedirects={maxRedirects}
            onMaxRedirectsChange={onMaxRedirectsChange}
            proxyTimeoutMs={proxyTimeoutMs}
            onProxyTimeoutMsChange={onProxyTimeoutMsChange}
          />
        </div>
      );
    }
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <BodyEditor
          mode={bodyMode}
          rawValue={rawBody}
          onRawChange={onRawBodyChange}
          formRows={formBody}
          onFormRowsChange={onFormBodyChange}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <RequestHeader
        method={method}
        onMethodChange={onMethodChange}
        url={url}
        onUrlChange={onUrlChange}
        loading={loading}
        onSend={onSend}
        onCancel={onCancel}
      />

      <div className="border-border flex min-h-0 flex-1 flex-col border-t">
        <Tabs
          items={tabs}
          active={tab}
          onChange={setTab}
          trailing={trailing}
          className="shrink-0 px-3 sm:px-4"
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {renderBody()}
        </div>
      </div>
    </div>
  );
}
