import { Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useWorkspace } from "@/context/workspace-context";
import { interpolate } from "@/lib/environments";
import {
  bodyModeContentType,
  bodyModeIsRaw,
  methodHasBody,
  type BodyMode,
  type HttpMethod,
} from "@/lib/http";
import {
  mergeQueryParams,
  newKvRow,
  rowsToHeaders,
  type KvRow,
} from "@/lib/kv";
import {
  loadFollowRedirects,
  loadMaxRedirects,
  loadProxyTimeoutMs,
  loadUrlEncode,
  saveFollowRedirects,
  saveMaxRedirects,
  saveProxyTimeoutMs,
  saveUrlEncode,
} from "@/lib/request-preferences";

import { snapshotFromCanonical } from "./apply-canonical";
import { RequestPane } from "./request-pane";
import { ResponsePane } from "./response-pane";
import { useProxyRequest } from "./use-proxy-request";
import {
  useRequestHistory,
  type HistoryEntry,
} from "./use-request-history";

export function ApiClient() {
  const { activeEnv, selectedRequest, loadState } = useWorkspace();

  const [method, setMethod] = useState<HttpMethod>("GET");
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<KvRow[]>(() => [newKvRow()]);
  const [headers, setHeaders] = useState<KvRow[]>(() => [newKvRow()]);
  const [bodyMode, setBodyMode] = useState<BodyMode>("none");
  const [rawBody, setRawBody] = useState("");
  const [formBody, setFormBody] = useState<KvRow[]>(() => [newKvRow()]);

  const [proxyTimeoutMs, setProxyTimeoutMs] = useState(loadProxyTimeoutMs);
  const [followRedirects, setFollowRedirects] = useState(loadFollowRedirects);
  const [urlEncode, setUrlEncode] = useState(loadUrlEncode);
  const [maxRedirects, setMaxRedirects] = useState(loadMaxRedirects);
  const [tags, setTags] = useState("");

  useEffect(() => {
    saveProxyTimeoutMs(proxyTimeoutMs);
  }, [proxyTimeoutMs]);

  useEffect(() => {
    saveFollowRedirects(followRedirects);
  }, [followRedirects]);

  useEffect(() => {
    saveUrlEncode(urlEncode);
  }, [urlEncode]);

  useEffect(() => {
    saveMaxRedirects(maxRedirects);
  }, [maxRedirects]);

  /**
   * When the selected canonical request changes, snapshot it into local UI
   * state. Anything the user typed into the previous request is dropped —
   * canonical wins on switch. Once Slice C lands we'll layer the user's
   * override on top instead of replacing.
   */
  useEffect(() => {
    if (!selectedRequest) return;
    const snap = snapshotFromCanonical(selectedRequest);
    setMethod(snap.method);
    setUrl(snap.url);
    setParams(snap.params);
    setHeaders(snap.headers);
    setBodyMode(snap.body.bodyMode);
    setRawBody(snap.body.rawBody);
    setFormBody(snap.body.formBody);
  }, [selectedRequest]);

  const { response, loading, send, cancel } = useProxyRequest();
  const { entries: history, push: pushHistory, clear: clearHistory } =
    useRequestHistory();

  const vars = useMemo(
    () => ({
      ...(activeEnv?.vars ?? {}),
      baseUrl: (activeEnv?.baseUrl ?? "").replace(/\/$/, ""),
    }),
    [activeEnv?.baseUrl, activeEnv?.vars],
  );

  const handleSend = useCallback(async () => {
    const interpolated = interpolate(url.trim(), vars);
    const finalUrl = mergeQueryParams(interpolated, params);
    const headerMap = rowsToHeaders(headers);

    const includeBody = methodHasBody(method) && bodyMode !== "none";

    let body: string | null = null;
    if (includeBody) {
      if (bodyModeIsRaw(bodyMode)) {
        body = rawBody;
      } else if (bodyMode === "form-urlencoded") {
        const search = new URLSearchParams();
        for (const r of formBody) {
          if (!r.enabled) continue;
          const k = r.key.trim();
          if (!k) continue;
          search.append(k, r.value);
        }
        body = search.toString();
      }
    }

    const inferred = bodyModeContentType(bodyMode);
    if (includeBody && body != null && body.length > 0 && inferred) {
      const hasContentType = Object.keys(headerMap).some(
        (k) => k.toLowerCase() === "content-type",
      );
      if (!hasContentType) headerMap["Content-Type"] = inferred;
    }

    const data = await send({
      method,
      url: finalUrl,
      headers: headerMap,
      body,
      timeoutMs: proxyTimeoutMs,
      redirect: followRedirects ? "follow" : "manual",
    });

    pushHistory({
      method,
      url: finalUrl,
      ok: data.ok,
      status: data.ok ? data.status : undefined,
      statusText: data.ok ? data.statusText : undefined,
      durationMs: data.durationMs,
      bodyBytes: data.ok ? data.bodyBytes : undefined,
      error: data.ok ? undefined : data.error,
    });
  }, [
    bodyMode,
    followRedirects,
    formBody,
    headers,
    method,
    params,
    proxyTimeoutMs,
    pushHistory,
    rawBody,
    send,
    url,
    vars,
  ]);

  const handleReplay = useCallback((entry: HistoryEntry) => {
    setMethod(entry.method);
    setUrl(entry.url);
  }, []);

  if (loadState === "loading") {
    return <EmptyState title="Loading workspace…" />;
  }

  if (!selectedRequest) {
    return (
      <EmptyState
        icon={Inbox}
        title="No request selected"
        description="Pick a request from the sidebar, or run `boson push` to populate this workspace."
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ResizablePanelGroup
        orientation="vertical"
        id="api-client"
        className="h-full min-h-0"
      >
        <ResizablePanel
          id="request-pane"
          defaultSize="42%"
          minSize="28%"
          className="min-h-0"
        >
          <RequestPane
            method={method}
            onMethodChange={setMethod}
            url={url}
            onUrlChange={setUrl}
            loading={loading}
            onSend={handleSend}
            onCancel={cancel}
            params={params}
            onParamsChange={setParams}
            headers={headers}
            onHeadersChange={setHeaders}
            bodyMode={bodyMode}
            onBodyModeChange={setBodyMode}
            rawBody={rawBody}
            onRawBodyChange={setRawBody}
            formBody={formBody}
            onFormBodyChange={setFormBody}
            tags={tags}
            onTagsChange={setTags}
            urlEncode={urlEncode}
            onUrlEncodeChange={setUrlEncode}
            followRedirects={followRedirects}
            onFollowRedirectsChange={setFollowRedirects}
            maxRedirects={maxRedirects}
            onMaxRedirectsChange={setMaxRedirects}
            proxyTimeoutMs={proxyTimeoutMs}
            onProxyTimeoutMsChange={setProxyTimeoutMs}
          />
        </ResizablePanel>

        <ResizablePanel
          id="response-pane"
          defaultSize="58%"
          minSize="25%"
          className="min-h-0 border-t"
        >
          <ResponsePane
            response={response}
            history={history}
            onClearHistory={clearHistory}
            onReplay={handleReplay}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
