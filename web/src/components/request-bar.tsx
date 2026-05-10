import { LoaderCircleIcon, SaveIcon, SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  hasDraft: boolean;
  hasUnsavedChanges: boolean;
  onMethodChange: (method: string) => void;
  onUrlChange: (url: string) => void;
  onRun: () => void;
  onSaveDraft: () => void;
}

export function RequestBar({
  method,
  url,
  running,
  canRun,
  hasDraft,
  hasUnsavedChanges,
  onMethodChange,
  onUrlChange,
  onRun,
  onSaveDraft,
}: RequestBarProps) {
  const upperMethod = (method || "GET").toUpperCase();
  const methodColor =
    METHOD_TEXT_COLORS[upperMethod] ?? "text-muted-foreground";

  return (
    <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5">
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden rounded-md border bg-card shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
        <Select value={upperMethod} onValueChange={onMethodChange}>
          <SelectTrigger
            className={cn(
              "h-9 w-[112px] rounded-none border-0 border-r bg-transparent font-mono text-xs font-semibold shadow-none focus-visible:ring-0",
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
        <Input
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="{{base_url}}/path/to/resource"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              if (canRun && !running) onRun();
            }
          }}
          className="h-9 flex-1 rounded-none border-0 bg-transparent font-mono text-sm shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0"
        />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            disabled={!canRun}
            className="h-9 gap-1.5"
          >
            <SaveIcon className="size-3.5" />
            <span className="hidden md:inline">Save</span>
            {hasUnsavedChanges ? (
              <span
                className="ml-0.5 size-1.5 rounded-full bg-amber-500"
                aria-label="unsaved changes"
              />
            ) : hasDraft ? (
              <span
                className="ml-0.5 size-1.5 rounded-full bg-sky-500"
                aria-label="draft"
              />
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Save draft <Kbd className="ml-1">⌘S</Kbd>
        </TooltipContent>
      </Tooltip>

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
  );
}
