import { useEffect, useLayoutEffect, useRef } from "react";

import {
  Editor,
  loader,
  type OnChange,
  type OnMount,
} from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";
import {
  EMPTY_VARIABLES,
  activeReferenceQuery,
  classify,
  refKindLabel,
  type ProjectVariables,
} from "@/lib/variables";

// Monaco reads its environment from `window.MonacoEnvironment` in the browser.
// We wire up bundled workers below so Boson stays fully offline-capable.
let monacoConfigured = false;

// Module-level snapshot kept in sync with `useVariables()`. Monaco completion
// and hover providers read from this — they're registered once at module load
// and can't take per-mount props.
let currentVariables: ProjectVariables = EMPTY_VARIABLES;

/**
 * Update the snapshot of variables that Monaco's completion + hover providers
 * use. Called from `useVariables()`; should not need to be called directly.
 */
export function setMonacoVariables(next: ProjectVariables): void {
  currentVariables = next;
}

const VARIABLE_LANGUAGES = [
  "plaintext",
  "json",
  "yaml",
  "xml",
  "html",
  "css",
  "javascript",
  "typescript",
  "markdown",
  "shell",
] as const;

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

  registerVariableProviders();
}

configureMonacoOnce();

/** Resolve a `var(--name)` background to a concrete color Monaco accepts (e.g. `rgb()`). */
function resolveCssBackgroundVariable(variableName: string): string {
  if (typeof document === "undefined") return "#ffffff";
  const el = document.createElement("div");
  el.style.position = "absolute";
  el.style.left = "-9999px";
  el.style.visibility = "hidden";
  el.style.backgroundColor = `var(${variableName})`;
  document.documentElement.appendChild(el);
  const resolved = getComputedStyle(el).backgroundColor;
  document.documentElement.removeChild(el);
  return resolved || "#ffffff";
}

/**
 * Monaco only accepts #hex / rgb(a); browsers may return `oklch(...)` from getComputedStyle.
 */
function normalizeCssColorForMonaco(cssColor: string): string {
  const c = cssColor.trim();
  if (!c || c === "transparent") return "#ffffff";
  if (/^#[\da-f]{3,8}$/i.test(c)) return c;
  if (/^rgba?\(/i.test(c)) return c;

  if (typeof document !== "undefined") {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      try {
        ctx.fillStyle = c;
        const out = String(ctx.fillStyle);
        if (/^rgba?\(/i.test(out) || /^#[\da-f]{3,8}$/i.test(out)) return out;
      } catch {
        /* ignore */
      }
    }
  }

  // Neutral `--background` tokens are grayscale oklch(L 0 0); approximate gray from L alone.
  const oklch = /^oklch\(\s*([\d.]+)/i.exec(c);
  if (oklch) {
    const L = parseFloat(oklch[1]);
    if (!Number.isNaN(L)) {
      const v = Math.round(Math.min(255, Math.max(0, L * 255)));
      const h = (n: number) => n.toString(16).padStart(2, "0");
      return `#${h(v)}${h(v)}${h(v)}`;
    }
  }

  return "#ffffff";
}

function applyBosonMonacoTheme(resolvedTheme: string | undefined): void {
  const isDark = resolvedTheme === "dark";
  const bg = normalizeCssColorForMonaco(
    resolveCssBackgroundVariable("--background"),
  );
  // Surface keys that otherwise keep vs/vs-dark gray defaults next to our canvas.
  const colors: Record<string, string> = {
    "editor.background": bg,
    "editorGutter.background": bg,
    "minimap.background": bg,
    "editorStickyScroll.background": bg,
    "editorWidget.background": bg,
    "editorSuggestWidget.background": bg,
    "peekViewEditor.background": bg,
    "peekViewResult.background": bg,
    "peekViewTitle.background": bg,
  };
  monaco.editor.defineTheme("boson", {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors,
  });
  monaco.editor.setTheme("boson");
}

function registerVariableProviders() {
  for (const language of VARIABLE_LANGUAGES) {
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ["{", ":"],
      provideCompletionItems(model, position) {
        const text = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const active = activeReferenceQuery(text, text.length);
        if (!active) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        // Adjust the replace range so accepting the completion overwrites
        // whatever the user has typed since the opening `{{`.
        const startColumn = Math.min(active.start + 3, position.column);
        const range = new monaco.Range(
          position.lineNumber,
          startColumn,
          position.lineNumber,
          word.endColumn,
        );

        const suggestions: monaco.languages.CompletionItem[] = [];

        for (const [name, value] of currentVariables.env) {
          suggestions.push({
            label: name,
            kind: monaco.languages.CompletionItemKind.Variable,
            detail: previewValue(value),
            insertText: `${name}}}`,
            range,
          });
        }

        for (const name of currentVariables.secrets) {
          suggestions.push({
            label: `secret:${name}`,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: "(encrypted)",
            insertText: `secret:${name}}}`,
            range,
          });
        }

        return { suggestions };
      },
    });

    monaco.languages.registerHoverProvider(language, {
      provideHover(model, position) {
        const line = model.getLineContent(position.lineNumber);
        // Walk back from the position to find an enclosing `{{...}}`.
        const before = line.slice(0, position.column - 1);
        const open = before.lastIndexOf("{{");
        if (open === -1) return null;
        const after = line.slice(open);
        const close = after.indexOf("}}");
        if (close === -1) return null;
        const refEnd = open + close + 2;
        if (position.column - 1 > refEnd) return null;

        const token = after.slice(2, close).trim();
        const ref = classify(token, currentVariables);
        const range = new monaco.Range(
          position.lineNumber,
          open + 1,
          position.lineNumber,
          refEnd + 1,
        );

        const contents: monaco.IMarkdownString[] = [
          { value: `**${ref.name}** — _${refKindLabel(ref.kind)}_` },
        ];
        if (ref.kind === "env" && ref.value !== null) {
          contents.push({ value: "```\n" + ref.value + "\n```" });
        } else if (ref.kind === "secret") {
          contents.push({ value: "_encrypted; resolved at run time_" });
        } else if (ref.kind === "host") {
          contents.push({ value: "_host process env; resolved at run time_" });
        } else {
          contents.push({
            value: "_not defined in the current environment_",
          });
        }

        return { range, contents };
      },
    });
  }
}

function previewValue(value: string): string {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length > 80 ? `${single.slice(0, 77)}…` : single;
}

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
    applyBosonMonacoTheme(resolvedTheme);
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

  useLayoutEffect(() => {
    applyBosonMonacoTheme(resolvedTheme);
  }, [resolvedTheme]);

  return (
    <div
      className={cn(
        "min-h-0 overflow-hidden bg-background",
        embedded ? "" : "rounded-md border",
        className,
      )}
    >
      <Editor
        height={height}
        language={language}
        value={value}
        theme="boson"
        onMount={handleMount}
        onChange={handleChange}
        options={{
          readOnly,
          fontSize: 13,
          lineHeight: 20,
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
          minimap: { enabled: false },
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
