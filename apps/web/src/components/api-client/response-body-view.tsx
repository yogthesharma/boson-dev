import { useMemo } from "react";

import { CodeEditor, type CodeEditorRef } from "@/components/ui/code-editor";

import type { ResponseFormat } from "./response-format-select";

export function isJsonBody(body: string): boolean {
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

function tryPretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/**
 * Read-only Monaco view of a response body. The toolbar (format dropdown,
 * status, copy/download/wrap) lives in the parent tab strip; this component
 * is purely the editor.
 */
export function ResponseBodyView({
  body,
  format,
  wrap,
  onMount,
}: {
  body: string;
  format: ResponseFormat;
  wrap: boolean;
  onMount?: (editor: CodeEditorRef) => void;
}) {
  const isJson = useMemo(() => isJsonBody(body), [body]);
  const display = useMemo(
    () => (format === "json" && isJson ? tryPretty(body) : body),
    [body, format, isJson],
  );
  const language = format === "json" && isJson ? "json" : "plaintext";

  return (
    <CodeEditor
      value={display}
      language={language}
      readOnly
      onMount={onMount}
      options={{ wordWrap: wrap ? "on" : "off" }}
    />
  );
}
