import { LoaderCircleIcon, SendIcon } from "lucide-react";

import { VariableInput } from "@/components/variable-input";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ProjectVariables } from "@/lib/variables";

const HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

const METHOD_TEXT_COLORS: Record<string, string> = {
  GET: "text-emerald-600 dark:text-emerald-400",
  POST: "text-amber-600 dark:text-amber-400",
  PUT: "text-sky-600 dark:text-sky-400",
  PATCH: "text-violet-600 dark:text-violet-400",
  DELETE: "text-rose-600 dark:text-rose-400",
  HEAD: "text-muted-foreground",
  OPTIONS: "text-muted-foreground",
};

interface RequestBarProps {
  method: string;
  url: string;
  running: boolean;
  canRun: boolean;
  variables: ProjectVariables;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
  onRun: () => void;
}

/**
 * Pure invocation surface: method + URL + Send. The YAML file is the source
 * of truth for everything *about* the request (name, folder, headers, body,
 * auth). The UI deliberately doesn't expose name editing, drafts, or
 * save-to-YAML controls here — those mutations belong in the user's editor.
 *
 * URL and method stay editable because they're useful for ad-hoc runtime
 * tweaks (try a different path, switch GET → POST). Those edits are scoped
 * to the running session and the file watcher takes care of bringing the
 * canonical request back in sync.
 */
export function RequestBar({
  method,
  url,
  running,
  canRun,
  variables,
  onMethodChange,
  onUrlChange,
  onRun,
}: RequestBarProps) {
  const upperMethod = (method || "GET").toUpperCase();
  const methodColor =
    METHOD_TEXT_COLORS[upperMethod] ?? "text-muted-foreground";

  return (
    <div className="bg-background px-4 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
          <Select value={upperMethod} onValueChange={onMethodChange}>
            <SelectTrigger
              className={cn(
                "h-9 w-[112px] rounded-none border-0 border-r bg-transparent font-sans text-xs font-semibold shadow-none focus-visible:ring-0",
                methodColor,
              )}
              aria-label="HTTP method"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_METHODS.map((entry) => (
                <SelectItem
                  key={entry}
                  value={entry}
                  className={cn(
                    "font-mono text-xs font-semibold",
                    METHOD_TEXT_COLORS[entry],
                  )}
                >
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <VariableInput
            value={url}
            onChange={onUrlChange}
            variables={variables}
            placeholder="{{base_url}}/path/to/resource"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                if (canRun && !running) onRun();
              }
            }}
            className="h-9 flex-1 rounded-none border-0 bg-transparent font-sans tracking-wide text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
          />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="sm"
              onClick={onRun}
              disabled={running || !canRun}
              className="h-9 min-w-[92px] gap-1.5"
            >
              {running ? (
                <>
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <SendIcon className="size-4" />
                  Send
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Send request <Kbd className="ml-1">⌘↵</Kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
