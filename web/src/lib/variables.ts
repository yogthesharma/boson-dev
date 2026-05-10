// Variable interpolation grammar, mirrored from `src/runner/resolve.rs`.
//
// The Rust resolver supports three reference shapes inside `{{ ... }}`:
//
//   {{name}}            → workspace env variable (empty string if missing)
//   {{secret:NAME}}     → encrypted secret (must exist or runner errors)
//   {{env:NAME}}        → host process env on the server (UI can't preview)
//
// Whitespace inside the braces is trimmed.
//
// This module is pure and shared between every UI surface that needs to
// understand or render `{{...}}` references (URL bar, KV cells, body fields,
// resolved-text previews, Monaco language services).

export interface ProjectVariables {
  /** Resolved variable values from the currently selected environment. */
  env: Map<string, string>;
  /** Known secret names. Values are never available client-side. */
  secrets: Set<string>;
  /** Display name of the selected environment, or null if none. */
  environmentName: string | null;
  /** Stable id of the selected environment, or null if none. */
  environmentId: string | null;
}

export const EMPTY_VARIABLES: ProjectVariables = {
  env: new Map(),
  secrets: new Set(),
  environmentName: null,
  environmentId: null,
};

export type RefKind =
  | "env" // {{name}} → workspace env var
  | "secret" // {{secret:NAME}} → encrypted secret
  | "host" // {{env:NAME}} → host process env on the server
  | "unknown"; // {{xyz}} but not present in env / not a known prefix

export interface VariableRef {
  /** Display name (after the optional prefix). */
  name: string;
  /** Raw token text between the braces, with whitespace trimmed. */
  raw: string;
  kind: RefKind;
  /**
   * Resolved value if known. `null` means we deliberately can't preview
   * (secrets, host env) or the variable is unknown.
   */
  value: string | null;
  /** Inclusive start offset of `{{`. */
  start: number;
  /** Exclusive end offset just past `}}`. */
  end: number;
}

export type Segment =
  | { kind: "text"; value: string }
  | { kind: "ref"; ref: VariableRef };

export interface ResolvedText {
  /**
   * The fully substituted text. Unknown / unpreviewable references are
   * left as the literal `{{ref}}` so the user sees what's missing.
   */
  text: string;
  /** Tokenised view, useful for rich rendering with chips. */
  segments: Segment[];
  /** References that couldn't be resolved (excludes secrets / host env). */
  missing: VariableRef[];
}

const REF_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function classify(token: string, vars: ProjectVariables): VariableRef {
  // Note: callers populate `start`/`end`; this helper only fills in semantics.
  if (token.startsWith("secret:")) {
    const name = token.slice("secret:".length).trim();
    const known = vars.secrets.has(name);
    return {
      name,
      raw: token,
      kind: "secret",
      // We never preview secret values from the UI even when known.
      value: known ? null : null,
      start: 0,
      end: 0,
    };
  }
  if (token.startsWith("env:")) {
    const name = token.slice("env:".length).trim();
    return {
      name,
      raw: token,
      kind: "host",
      value: null,
      start: 0,
      end: 0,
    };
  }
  const value = vars.env.get(token);
  return {
    name: token,
    raw: token,
    kind: value === undefined ? "unknown" : "env",
    value: value ?? null,
    start: 0,
    end: 0,
  };
}

/**
 * Tokenise an arbitrary string into text + variable references. Useful for
 * components that want to render chips inline.
 */
export function tokenize(input: string, vars: ProjectVariables): Segment[] {
  if (!input) return [];
  const segments: Segment[] = [];
  REF_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_RE.exec(input)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: "text", value: input.slice(cursor, match.index) });
    }
    const token = match[1].trim();
    const ref = classify(token, vars);
    ref.start = match.index;
    ref.end = match.index + match[0].length;
    segments.push({ kind: "ref", ref });
    cursor = ref.end;
  }
  if (cursor < input.length) {
    segments.push({ kind: "text", value: input.slice(cursor) });
  }
  return segments;
}

/**
 * Substitute references in `input` using `vars`. Mirrors `Resolver::resolve`
 * in Rust as closely as possible, with two differences:
 *
 * 1. The Rust resolver errors if a secret is missing; here we leave the raw
 *    `{{secret:NAME}}` so the preview shows "this will be filled at run".
 * 2. The Rust resolver can read host env (`{{env:NAME}}`); we don't have
 *    access to that from the browser, so it stays as-is.
 */
export function resolve(input: string, vars: ProjectVariables): ResolvedText {
  const segments = tokenize(input, vars);
  let text = "";
  const missing: VariableRef[] = [];
  for (const segment of segments) {
    if (segment.kind === "text") {
      text += segment.value;
      continue;
    }
    const ref = segment.ref;
    if (ref.kind === "env" && ref.value !== null) {
      text += ref.value;
    } else if (ref.kind === "unknown") {
      // Match the Rust behaviour for missing env vars: empty substitution
      // would be silently confusing, so keep the literal in the preview but
      // also report it as missing so callers can surface it.
      text += `{{${ref.raw}}}`;
      missing.push(ref);
    } else {
      // secret + host: leave the literal so the user knows it's deferred.
      text += `{{${ref.raw}}}`;
    }
  }
  return { text, segments, missing };
}

/**
 * Helper for inline autocomplete: if the caret is inside an unclosed
 * `{{...` token, return its starting offset and current query. Otherwise
 * return null.
 *
 * Example: `"GET {{ba|"` (caret after `ba`) → `{ start: 4, query: "ba" }`.
 *          `"GET {{base}}"` (caret at end) → null.
 */
export function activeReferenceQuery(
  input: string,
  caret: number,
): { start: number; query: string } | null {
  const head = input.slice(0, caret);
  const open = head.lastIndexOf("{{");
  if (open === -1) return null;
  const between = head.slice(open + 2);
  if (between.includes("}}")) return null;
  // Don't trigger on multiline / weird cases — keep the query single-token.
  if (/[\n\r]/.test(between)) return null;
  return { start: open, query: between.trim() };
}

/**
 * Splice a variable reference into `input`, replacing the active `{{query`
 * tail at `start` with `{{name}}` and returning the new text + the caret
 * position that should follow.
 */
export function insertReference(
  input: string,
  /** Start offset of the leading `{{`. */
  start: number,
  /** Caret position when the user picked the completion. */
  caret: number,
  /** Variable token to insert (e.g. `base_url` or `secret:DEMO_TOKEN`). */
  token: string,
): { text: string; caret: number } {
  const before = input.slice(0, start);
  // If the user already typed `}}` after the caret, swallow it so we don't
  // end up with `{{name}}}}`.
  const rest = input.slice(caret);
  const trimmedRest = rest.startsWith("}}") ? rest.slice(2) : rest;
  const inserted = `{{${token}}}`;
  return {
    text: `${before}${inserted}${trimmedRest}`,
    caret: before.length + inserted.length,
  };
}

export function refKindLabel(kind: RefKind): string {
  switch (kind) {
    case "env":
      return "env";
    case "secret":
      return "secret";
    case "host":
      return "host env";
    case "unknown":
      return "unset";
  }
}
