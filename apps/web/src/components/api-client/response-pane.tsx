import { Inbox, TestTube2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import type { CodeEditorRef } from "@/components/ui/code-editor";
import type { ProxyResponse } from "@/lib/api";

import { HeaderTable } from "./header-table";
import { RequestHistoryView } from "./request-history-view";
import { ResponseActions } from "./response-actions";
import {
  ResponseFormatSelect,
  type ResponseFormat,
} from "./response-format-select";
import { ResponseBodyView, isJsonBody } from "./response-body-view";
import { ResponseStatus } from "./response-status";
import type { HistoryEntry } from "./use-request-history";

type ResponseTab = "response" | "headers" | "timeline" | "tests";

export function ResponsePane({
  response,
  history,
  onClearHistory,
  onReplay,
}: {
  response: ProxyResponse | null;
  history: HistoryEntry[];
  onClearHistory: () => void;
  onReplay?: (entry: HistoryEntry) => void;
}) {
  const [tab, setTab] = useState<ResponseTab>("response");
  const [format, setFormat] = useState<ResponseFormat>("json");
  const [wrap, setWrap] = useState(false);
  const editorRef = useRef<CodeEditorRef | null>(null);

  const handleEditorMount = useCallback(
    (editor: CodeEditorRef) => {
      editorRef.current = editor;
      editor.updateOptions({ wordWrap: wrap ? "on" : "off" });
    },
    [wrap],
  );

  const setWrapAndApply = (next: boolean) => {
    setWrap(next);
    editorRef.current?.updateOptions({ wordWrap: next ? "on" : "off" });
  };

  const headerCount =
    response && response.ok ? Object.keys(response.headers).length : undefined;

  const tabs: TabItem<ResponseTab>[] = [
    { id: "response", label: "Response" },
    { id: "headers", label: "Headers", count: headerCount },
    { id: "timeline", label: "Timeline", count: history.length },
    { id: "tests", label: "Tests" },
  ];

  const okBody = response && response.ok ? response.body : "";
  const isJson = response && response.ok ? isJsonBody(response.body) : false;

  const trailing = (() => {
    if (tab === "timeline") {
      return (
        <div className="flex items-center gap-3">
          <ResponseStatus response={response} />
          {history.length > 0 ? (
            <button
              type="button"
              onClick={onClearHistory}
              className="text-muted-foreground hover:text-destructive cursor-pointer text-xs font-medium transition-colors"
            >
              Clear Timeline
            </button>
          ) : null}
        </div>
      );
    }
    if (response == null) return null;
    return (
      <div className="flex items-center gap-2">
        {tab === "response" && response.ok ? (
          <ResponseFormatSelect
            value={format}
            onChange={setFormat}
            disabled={!isJson}
          />
        ) : null}
        <ResponseStatus response={response} />
        {response.ok ? (
          <ResponseActions
            body={okBody}
            wrap={wrap}
            onWrapChange={setWrapAndApply}
          />
        ) : null}
      </div>
    );
  })();

  const renderBody = () => {
    if (tab === "timeline") {
      return (
        <div className="min-h-0 flex-1 overflow-auto">
          <RequestHistoryView entries={history} onReplay={onReplay} />
        </div>
      );
    }

    if (tab === "tests") {
      return (
        <EmptyState
          icon={TestTube2}
          title="Tests"
          description="Post-response checks and scripts will run here. Reserved for a future release (assertions on status, JSON path, headers)."
        />
      );
    }

    if (!response) {
      return (
        <EmptyState
          icon={Inbox}
          title="No response yet"
          description="Configure your request and hit Send to see the response here."
        />
      );
    }

    if (!response.ok) {
      if (tab === "headers") {
        return (
          <EmptyState
            title="No response headers"
            description="The request failed before a complete HTTP exchange."
          />
        );
      }
      return (
        <pre className="text-destructive font-sans text-sm whitespace-pre-wrap px-4 pt-3 sm:px-5">
          {response.error}
          {response.durationMs != null ? `\n(${response.durationMs} ms)` : ""}
        </pre>
      );
    }

    if (tab === "headers") {
      return (
        <div className="min-h-0 flex-1 overflow-hidden px-4 pt-3 pb-4 sm:px-5">
          <HeaderTable headers={response.headers} />
        </div>
      );
    }

    return (
      <div className="min-h-0 flex-1 overflow-hidden">
        <ResponseBodyView
          body={response.body}
          format={format}
          wrap={wrap}
          onMount={handleEditorMount}
        />
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        items={tabs}
        active={tab}
        onChange={setTab}
        trailing={trailing}
        className="px-3 sm:px-4"
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {renderBody()}
      </div>
    </div>
  );
}
