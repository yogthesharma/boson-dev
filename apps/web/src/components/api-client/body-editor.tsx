import { Binary, FormInput } from "lucide-react";

import { CodeEditor } from "@/components/ui/code-editor";
import { EmptyState } from "@/components/ui/empty-state";
import {
  bodyModeIsRaw,
  bodyModeLanguage,
  type BodyMode,
} from "@/lib/http";
import type { KvRow } from "@/lib/kv";

import { KvEditor } from "./kv-editor";

/**
 * Body tab content. The mode picker + Prettify action live in the parent
 * tab strip's trailing slot; this component only renders the editor surface
 * for the currently active mode.
 */
export function BodyEditor({
  mode,
  rawValue,
  onRawChange,
  formRows,
  onFormRowsChange,
}: {
  mode: BodyMode;
  rawValue: string;
  onRawChange: (value: string) => void;
  formRows: KvRow[];
  onFormRowsChange: (rows: KvRow[]) => void;
}) {
  if (mode === "none") {
    return (
      <p className="text-muted-foreground px-4 pt-3 text-sm sm:px-5">No Body</p>
    );
  }

  if (bodyModeIsRaw(mode)) {
    return (
      <CodeEditor
        value={rawValue}
        onChange={onRawChange}
        language={bodyModeLanguage(mode)}
        options={{
          lineNumbers: "on",
          folding: mode === "json" || mode === "xml",
          wordWrap: mode === "text" || mode === "sparql" ? "on" : "off",
        }}
      />
    );
  }

  if (mode === "form-urlencoded") {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-4 pt-3 pb-4 sm:px-5">
        <KvEditor rows={formRows} onChange={onFormRowsChange} />
      </div>
    );
  }

  if (mode === "multipart") {
    return (
      <EmptyState
        icon={FormInput}
        title="Multipart Form"
        description="File-aware multipart bodies are not wired through the proxy yet. Use Form URL Encoded for now."
      />
    );
  }

  return (
    <EmptyState
      icon={Binary}
      title="File / Binary"
      description="Binary uploads will be supported in a future release."
    />
  );
}
