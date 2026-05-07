/**
 * Thin React wrapper around the Monaco editor.
 *
 * This is the *only* place the rest of the app imports Monaco. Callers stay
 * decoupled from `monaco-editor` and `@monaco-editor/react`, which makes it
 * easy to swap implementations or extend behaviour later (custom themes,
 * snippets, multi-model state, etc.).
 *
 * Designed to plug into our flex layout: keep the parent `min-h-0 flex-1` and
 * the editor will fill it.
 */
import Editor, { type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { useCallback, useRef } from "react";

import { MONACO_THEME } from "@/lib/monaco";
import { cn } from "@/lib/utils";

export type CodeEditorLanguage =
  | "json"
  | "plaintext"
  | "javascript"
  | "typescript"
  | "html"
  | "xml"
  | "yaml"
  | "markdown";

export type CodeEditorRef = monaco.editor.IStandaloneCodeEditor;

export type CodeEditorProps = {
  value: string;
  language?: CodeEditorLanguage;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
  /** Tailwind classes for the wrapping `<div>` (sets the editor's bounds). */
  wrapperClassName?: string;
  /** Forwarded to Monaco; defaults to `"100%"` so the parent bounds the size. */
  height?: string | number;
  /** Override or extend the default Monaco options for this instance. */
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  /** Forwarded so callers can grab the editor instance for imperative APIs. */
  onMount?: (editor: CodeEditorRef, m: typeof monaco) => void;
};

const DEFAULT_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontSize: 12,
  fontFamily:
    'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  fontLigatures: false,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  automaticLayout: true,
  tabSize: 2,
  renderLineHighlight: "line",
  renderWhitespace: "none",
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    alwaysConsumeMouseWheel: false,
  },
  guides: {
    indentation: false,
  },
  padding: { top: 8, bottom: 8 },
  lineNumbersMinChars: 3,
  glyphMargin: false,
  folding: true,
  contextmenu: false,
  wordWrap: "off",
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  overviewRulerBorder: false,
  fixedOverflowWidgets: true,
};

export default function CodeEditorImpl({
  value,
  language = "plaintext",
  onChange,
  readOnly = false,
  className,
  wrapperClassName,
  height = "100%",
  options,
  onMount,
}: CodeEditorProps) {
  const editorRef = useRef<CodeEditorRef | null>(null);

  const handleMount: OnMount = useCallback(
    (editor, m) => {
      editorRef.current = editor;
      onMount?.(editor, m);
    },
    [onMount],
  );

  const merged: monaco.editor.IStandaloneEditorConstructionOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    readOnly,
  };

  return (
    <div className={cn("h-full w-full overflow-hidden", wrapperClassName)}>
      <Editor
        value={value}
        defaultLanguage={language}
        language={language}
        onChange={(v) => onChange?.(v ?? "")}
        onMount={handleMount}
        theme={MONACO_THEME}
        height={height}
        loading={
          <span className="text-muted-foreground p-3 text-xs">Loading editor…</span>
        }
        options={merged}
        className={className}
      />
    </div>
  );
}
