import { useEffect, useRef } from "react";

import { Editor, loader, type OnChange, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

// Monaco reads its environment from `window.MonacoEnvironment` in the browser.
// We wire up bundled workers below so Boson stays fully offline-capable.
let monacoConfigured = false;

function configureMonacoOnce() {
  if (monacoConfigured) return;
  monacoConfigured = true;

  window.MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      switch (label) {
        case "json":
          return new jsonWorker();
        case "css":
        case "scss":
        case "less":
          return new cssWorker();
        case "html":
        case "handlebars":
        case "razor":
          return new htmlWorker();
        case "typescript":
        case "javascript":
          return new tsWorker();
        default:
          return new editorWorker();
      }
    },
  };

  loader.config({ monaco });
}

configureMonacoOnce();

export type CodeEditorLanguage =
  | "json"
  | "javascript"
  | "typescript"
  | "html"
  | "css"
  | "yaml"
  | "xml"
  | "markdown"
  | "shell"
  | "plaintext";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: CodeEditorLanguage;
  readOnly?: boolean;
  className?: string;
  height?: number | string;
  /** Hide the gutter line numbers / minimap for a more inline feel. */
  minimal?: boolean;
  /** Render without a focus ring or border (useful inside its own container). */
  embedded?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = "plaintext",
  readOnly = false,
  className,
  height = "100%",
  minimal = false,
  embedded = false,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const handleChange: OnChange = (next) => {
    onChange?.(next ?? "");
  };

  // Keep the layout responsive when the surrounding container resizes.
  useEffect(() => {
    const resize = () => editorRef.current?.layout();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const theme = resolvedTheme === "dark" ? "vs-dark" : "light";

  return (
    <div
      className={cn(
        "min-h-0 overflow-hidden",
        embedded ? "" : "rounded-md border bg-card",
        className,
      )}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme={theme}
        onMount={handleMount}
        onChange={handleChange}
        options={{
          readOnly,
          fontSize: 13,
          lineHeight: 20,
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          minimap: { enabled: !minimal },
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          tabSize: 2,
          automaticLayout: true,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          renderLineHighlight: "line",
          lineNumbers: minimal ? "off" : "on",
          glyphMargin: false,
          folding: !minimal,
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          guides: { indentation: false },
        }}
      />
    </div>
  );
}

/** Heuristic: pick a Monaco language from a Content-Type header. */
export function languageFromContentType(
  contentType: string | undefined,
): CodeEditorLanguage {
  if (!contentType) return "plaintext";
  const lower = contentType.toLowerCase();
  if (lower.includes("json")) return "json";
  if (lower.includes("xml") || lower.includes("svg")) return "xml";
  if (lower.includes("html")) return "html";
  if (lower.includes("css")) return "css";
  if (lower.includes("yaml")) return "yaml";
  if (lower.includes("javascript")) return "javascript";
  if (lower.includes("typescript")) return "typescript";
  if (lower.includes("markdown")) return "markdown";
  if (lower.includes("shellscript") || lower.includes("x-sh")) return "shell";
  return "plaintext";
}

/** Sniff JSON/XML/HTML from the first non-whitespace bytes of a body. */
export function languageFromBody(body: string): CodeEditorLanguage {
  const trimmed = body.trimStart();
  if (!trimmed) return "plaintext";
  const first = trimmed[0];
  if (first === "{" || first === "[") return "json";
  if (first === "<") {
    if (/^<\?xml/i.test(trimmed)) return "xml";
    if (/^<!doctype html/i.test(trimmed) || /^<html/i.test(trimmed))
      return "html";
    return "xml";
  }
  return "plaintext";
}
