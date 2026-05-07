/**
 * Centralized Monaco bootstrap.
 *
 * - Wires up Monaco's web workers so they are bundled with the app
 *   (no CDN dependency — important for offline / Docker).
 * - Tells `@monaco-editor/react` to use our local Monaco instance.
 * - Defines the `boson-dark` theme. Colors are read from the live CSS custom
 *   properties (`--background`, `--foreground`, …) so the editor automatically
 *   matches the rest of the app — change a token, the editor follows.
 *
 * To customize later:
 *   - Add language workers to `getWorker` (e.g. typescript, html, css).
 *   - Tweak the syntax `rules` below.
 *   - After mutating CSS variables (e.g. theme switch), call
 *     `refreshMonacoTheme()` to re-sync the editor.
 */
import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

if (typeof self !== "undefined") {
  self.MonacoEnvironment = {
    getWorker(_workerId, label) {
      if (label === "json") return new jsonWorker();
      return new editorWorker();
    },
  };
}

loader.config({ monaco });

export const MONACO_THEME = "boson-dark";

function toHex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, "0");
}

/** Resolve a CSS color expression (e.g. `var(--background)`) to `#rrggbb[aa]`. */
function probeColor(expr: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const probe = document.createElement("span");
  probe.style.color = expr;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);

  const match = computed.match(/^rgba?\(([^)]+)\)$/);
  if (!match) return fallback;
  const parts = match[1].split(",").map((s) => s.trim());
  if (parts.length < 3) return fallback;
  const [r, g, b] = parts.slice(0, 3).map(Number);
  if (parts.length >= 4) {
    const a = Number.parseFloat(parts[3]);
    if (Number.isFinite(a) && a < 1) {
      return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}${toHex2(a * 255)}`;
    }
  }
  return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/** Mix two `#rrggbb` colors. `t` = 0 → a, 1 → b. */
function mix(a: string, b: string, t: number): string {
  const ah = a.replace(/^#/, "").slice(0, 6);
  const bh = b.replace(/^#/, "").slice(0, 6);
  if (ah.length !== 6 || bh.length !== 6) return a;
  const ar = parseInt(ah.slice(0, 2), 16);
  const ag = parseInt(ah.slice(2, 4), 16);
  const ab = parseInt(ah.slice(4, 6), 16);
  const br = parseInt(bh.slice(0, 2), 16);
  const bg = parseInt(bh.slice(2, 4), 16);
  const bb = parseInt(bh.slice(4, 6), 16);
  const r = ar + (br - ar) * t;
  const g = ag + (bg - ag) * t;
  const blue = ab + (bb - ab) * t;
  return `#${toHex2(r)}${toHex2(g)}${toHex2(blue)}`;
}

function buildTheme(): monaco.editor.IStandaloneThemeData {
  const bg = probeColor("var(--background)", "#0a0a0a");
  const fg = probeColor("var(--foreground)", "#fafafa");
  const card = probeColor("var(--card)", "#171717");
  const popover = probeColor("var(--popover)", card);
  const accent = probeColor("var(--accent)", "#262626");

  return {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "737373", fontStyle: "italic" },
      { token: "keyword", foreground: "c4b5fd" },
      { token: "string", foreground: "86efac" },
      { token: "string.key.json", foreground: "fafafa" },
      { token: "string.value.json", foreground: "86efac" },
      { token: "number", foreground: "fbbf24" },
      { token: "type", foreground: "7dd3fc" },
      { token: "delimiter", foreground: "a1a1aa" },
    ],
    colors: {
      "editor.background": bg,
      "editor.foreground": fg,
      "editorGutter.background": bg,
      "editorLineNumber.foreground": mix(bg, fg, 0.35),
      "editorLineNumber.activeForeground": mix(bg, fg, 0.7),
      "editor.lineHighlightBackground": mix(bg, fg, 0.04),
      "editor.lineHighlightBorder": "#00000000",
      "editor.selectionBackground": mix(bg, fg, 0.18),
      "editor.inactiveSelectionBackground": mix(bg, fg, 0.12),
      "editorCursor.foreground": fg,
      "editorWhitespace.foreground": mix(bg, fg, 0.15),
      "editorIndentGuide.background1": mix(bg, fg, 0.08),
      "editorIndentGuide.activeBackground1": mix(bg, fg, 0.2),
      "editorWidget.background": popover,
      "editorWidget.border": mix(bg, fg, 0.12),
      "editorSuggestWidget.background": popover,
      "editorSuggestWidget.border": mix(bg, fg, 0.12),
      "editorSuggestWidget.selectedBackground": accent,
      "editorHoverWidget.background": popover,
      "editorHoverWidget.border": mix(bg, fg, 0.12),
      "scrollbarSlider.background": mix(bg, fg, 0.1),
      "scrollbarSlider.hoverBackground": mix(bg, fg, 0.2),
      "scrollbarSlider.activeBackground": mix(bg, fg, 0.3),
      "editorOverviewRuler.border": "#00000000",
      "minimap.background": bg,
    },
  };
}

monaco.editor.defineTheme(MONACO_THEME, buildTheme());

/**
 * Re-read CSS variables and rebuild the Monaco theme. Call this after toggling
 * a global theme class so existing editors update without a reload.
 */
export function refreshMonacoTheme(): void {
  monaco.editor.defineTheme(MONACO_THEME, buildTheme());
  monaco.editor.setTheme(MONACO_THEME);
}

/** Resolves once Monaco's loader has finished initialising. */
export const monacoReady: Promise<typeof monaco> = loader.init();
