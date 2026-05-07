import { Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useAuth } from "@/context/auth-context";
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

import {
  deleteOverrideField,
  deleteRequestOverride,
  patchRequestOverride,
  patchUserRequest,
  deleteUserRequest,
} from "@/lib/workspace-api";

import { snapshotFromCanonical } from "./apply-canonical";
import { buildOverridePatch } from "./override-helpers";
import { RequestPane } from "./request-pane";
import { ResponsePane } from "./response-pane";
import { useProxyRequest } from "./use-proxy-request";
import {
  useRequestHistory,
  type HistoryEntry,
} from "./use-request-history";

export function ApiClient() {
  const { activeEnv, selectedRequest, loadState, refreshWorkspace } =
    useWorkspace();
  const { authHeaders } = useAuth();

  const [syncBusy, setSyncBusy] = useState(false);

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
   * When the selected request changes, snapshot merged server state into the
   * local editor (draft / overrides already applied in the payload).
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

  const handleSaveToServer = useCallback(async () => {
    if (!selectedRequest) return;
    const patch = buildOverridePatch(
      selectedRequest,
      method,
      url,
      headers,
      bodyMode,
      rawBody,
      formBody,
    );
    if (!patch) return;
    setSyncBusy(true);
    try {
      if (selectedRequest.source === "user") {
        await patchUserRequest(selectedRequest.id, patch, authHeaders);
      } else {
        await patchRequestOverride(selectedRequest.id, patch, authHeaders);
      }
      await refreshWorkspace();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncBusy(false);
    }
  }, [
    authHeaders,
    bodyMode,
    formBody,
    headers,
    method,
    rawBody,
    refreshWorkspace,
    selectedRequest,
    url,
  ]);

  const handleResetOverrides = useCallback(async () => {
    if (!selectedRequest || selectedRequest.source === "user") return;
    setSyncBusy(true);
    try {
      await deleteRequestOverride(selectedRequest.id, authHeaders);
      await refreshWorkspace();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncBusy(false);
    }
  }, [authHeaders, refreshWorkspace, selectedRequest]);

  const handleDeleteUserRequest = useCallback(async () => {
    if (!selectedRequest || selectedRequest.source !== "user") return;
    setSyncBusy(true);
    try {
      await deleteUserRequest(selectedRequest.id, authHeaders);
      await refreshWorkspace();
    } catch (e) {
      console.error(e);
    } finally {
      setSyncBusy(false);
    }
  }, [authHeaders, refreshWorkspace, selectedRequest]);

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
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <button
          type="button"
          disabled={syncBusy}
          onClick={() => handleSaveToServer()}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50"
        >
          {syncBusy ? "Saving…" : "Save to server"}
        </button>
        {selectedRequest.source !== "user" &&
        selectedRequest.overridden_fields.length > 0 ? (
          <button
            type="button"
            disabled={syncBusy}
            onClick={() => handleResetOverrides()}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-xs disabled:opacity-50"
          >
            Reset overrides
          </button>
        ) : null}
        {selectedRequest.source !== "user" &&
        selectedRequest.overridden_fields.includes("url") ? (
          <button
            type="button"
            disabled={syncBusy}
            onClick={async () => {
              setSyncBusy(true);
              try {
                await deleteOverrideField(
                  selectedRequest.id,
                  "url",
                  authHeaders,
                );
                await refreshWorkspace();
              } catch (e) {
                console.error(e);
              } finally {
                setSyncBusy(false);
              }
            }}
            className="text-muted-foreground hover:text-foreground rounded-md px-2 py-1 text-xs disabled:opacity-50"
          >
            Revert URL
          </button>
        ) : null}
        {selectedRequest.source === "user" ? (
          <button
            type="button"
            disabled={syncBusy}
            onClick={() => handleDeleteUserRequest()}
            className="text-rose-500 hover:text-rose-400 ml-auto rounded-md px-2 py-1 text-xs disabled:opacity-50"
          >
            Delete request
          </button>
        ) : null}
      </div>
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
