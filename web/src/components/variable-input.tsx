import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { KeyRoundIcon, MonitorIcon, VariableIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  activeReferenceQuery,
  insertReference,
  resolve,
  type ProjectVariables,
} from "@/lib/variables";

type InputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange">;

interface VariableInputProps extends InputProps {
  value: string;
  onChange: (value: string) => void;
  variables: ProjectVariables;
  /**
   * When true (default), shows a small "resolved" preview below the input
   * if the value contains references that aren't pure plaintext. Set this
   * to false for dense rows (KV editor cells) where space is tight.
   */
  showResolvedHint?: boolean;
}

interface Suggestion {
  /** Token to insert (`base_url` or `secret:NAME`). */
  token: string;
  label: string;
  kind: "env" | "secret";
  detail: string;
}

const MAX_SUGGESTIONS = 8;

/**
 * `<Input>` with `{{...}}` autocomplete + a resolved-value preview line.
 *
 * Typing `{{` opens a popover anchored to the input with a filtered list of
 * env variables and secret names from `variables`. Arrow keys / Enter pick a
 * suggestion; Escape dismisses. The selected token is spliced in via
 * `insertReference()` so the caret lands at a sensible position.
 */
export function VariableInput({
  value,
  onChange,
  variables,
  className,
  showResolvedHint = false,
  onKeyDown,
  ...rest
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [completion, setCompletion] = useState<{
    start: number;
    query: string;
  } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const popoverId = useId();

  const suggestions = useMemo(
    () => buildSuggestions(completion?.query ?? "", variables),
    [completion?.query, variables],
  );

  // Keep the highlight in range when the suggestion list shrinks.
  useEffect(() => {
    setHighlight((current) => {
      if (suggestions.length === 0) return 0;
      return Math.min(current, suggestions.length - 1);
    });
  }, [suggestions.length]);

  const refreshCompletion = useCallback(() => {
    const input = inputRef.current;
    if (!input) {
      setCompletion(null);
      return;
    }
    const caret = input.selectionStart ?? input.value.length;
    const next = activeReferenceQuery(input.value, caret);
    setCompletion(next);
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onChange(event.target.value);
    // The caret has already moved by this point.
    refreshCompletion();
  }

  function applySuggestion(suggestion: Suggestion) {
    const input = inputRef.current;
    if (!input || !completion) return;
    const caret = input.selectionStart ?? input.value.length;
    const result = insertReference(
      input.value,
      completion.start,
      caret,
      suggestion.token,
    );
    onChange(result.text);
    setCompletion(null);
    // Restore caret after React flushes the new value.
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      el.setSelectionRange(result.caret, result.caret);
      el.focus();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (completion && suggestions.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((i) => (i + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((i) =>
          i <= 0 ? suggestions.length - 1 : i - 1,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applySuggestion(suggestions[highlight]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setCompletion(null);
        return;
      }
    }
    onKeyDown?.(event);
  }

  const popoverOpen = completion !== null && suggestions.length > 0;

  return (
    <div className="relative flex w-full flex-col gap-1">
      <Popover open={popoverOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={refreshCompletion}
            onBlur={() => {
              // Defer so a click inside the popover can land first.
              setTimeout(() => setCompletion(null), 120);
            }}
            aria-controls={popoverOpen ? popoverId : undefined}
            aria-expanded={popoverOpen}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className={cn(className)}
            {...rest}
          />
        </PopoverAnchor>
        <PopoverContent
          id={popoverId}
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="w-72 p-1"
        >
          <SuggestionList
            suggestions={suggestions}
            highlight={highlight}
            onHover={setHighlight}
            onPick={applySuggestion}
          />
        </PopoverContent>
      </Popover>

      {showResolvedHint ? (
        <ResolvedPreviewLine value={value} variables={variables} />
      ) : null}
    </div>
  );
}

function buildSuggestions(
  query: string,
  variables: ProjectVariables,
): Suggestion[] {
  const items: Suggestion[] = [];
  for (const [name, value] of variables.env) {
    items.push({
      token: name,
      label: name,
      kind: "env",
      detail: previewValue(value),
    });
  }
  for (const name of variables.secrets) {
    items.push({
      token: `secret:${name}`,
      label: `secret:${name}`,
      kind: "secret",
      detail: "encrypted",
    });
  }
  if (!query) return items.slice(0, MAX_SUGGESTIONS);
  const needle = query.toLowerCase();
  const scored = items
    .map((item) => ({ item, score: fuzzyScore(item.label.toLowerCase(), needle) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX_SUGGESTIONS);
  return scored.map((entry) => entry.item);
}

/**
 * Tiny fuzzy scorer: returns the position of the last matched character
 * (lower is better), or -1 if the needle isn't a subsequence of haystack.
 * Exact prefix matches get a bonus so they sort to the top.
 */
function fuzzyScore(haystack: string, needle: string): number {
  if (haystack.startsWith(needle)) return 0;
  let h = 0;
  let n = 0;
  let lastIndex = -1;
  while (h < haystack.length && n < needle.length) {
    if (haystack[h] === needle[n]) {
      lastIndex = h;
      n += 1;
    }
    h += 1;
  }
  if (n < needle.length) return -1;
  return lastIndex + 1;
}

function previewValue(value: string): string {
  const single = value.replace(/\s+/g, " ").trim();
  if (!single) return "(empty)";
  return single.length > 64 ? `${single.slice(0, 61)}…` : single;
}

function SuggestionList({
  suggestions,
  highlight,
  onHover,
  onPick,
}: {
  suggestions: Suggestion[];
  highlight: number;
  onHover: (index: number) => void;
  onPick: (suggestion: Suggestion) => void;
}) {
  // Scroll the highlighted row into view as the user navigates with arrows.
  const listRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  return (
    <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1">
      {suggestions.map((suggestion, index) => {
        const isActive = index === highlight;
        const Icon = suggestion.kind === "secret" ? KeyRoundIcon : VariableIcon;
        return (
          <button
            key={`${suggestion.kind}:${suggestion.token}`}
            type="button"
            data-index={index}
            data-active={isActive ? "" : undefined}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(suggestion);
            }}
            onMouseEnter={() => onHover(index)}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            <Icon
              className={cn(
                "size-3.5 shrink-0",
                suggestion.kind === "secret"
                  ? "text-amber-500"
                  : "text-sky-500",
              )}
            />
            <span className="truncate font-mono text-xs">
              {suggestion.label}
            </span>
            <span className="ml-auto max-w-[40%] truncate text-[11px] text-muted-foreground">
              {suggestion.detail}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ResolvedPreviewLine({
  value,
  variables,
}: {
  value: string;
  variables: ProjectVariables;
}) {
  const resolved = useMemo(
    () => resolve(value, variables),
    [value, variables],
  );
  const hasRefs = resolved.segments.some((segment) => segment.kind === "ref");
  if (!hasRefs) return null;
  return (
    <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
      <MonitorIcon className="size-3 opacity-60" />
      <span className="truncate font-mono">{resolved.text}</span>
    </div>
  );
}
