/**
 * Public entry for the Monaco-based code editor.
 *
 * Exposes the same React-style API as the implementation, but defers loading
 * the Monaco bundle until the editor first renders. This keeps the initial
 * JS payload small — Monaco only joins the party when you actually mount one.
 */
import { Suspense, lazy } from "react";

import type { CodeEditorProps } from "./code-editor-impl";

export type {
  CodeEditorLanguage,
  CodeEditorProps,
  CodeEditorRef,
} from "./code-editor-impl";

const Lazy = lazy(() => import("./code-editor-impl"));

export function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="text-muted-foreground bg-muted/20 flex h-full w-full items-center justify-center text-xs">
          Loading editor…
        </div>
      }
    >
      <Lazy {...props} />
    </Suspense>
  );
}
