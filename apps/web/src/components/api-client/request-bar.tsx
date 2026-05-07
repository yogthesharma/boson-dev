import { Loader2, Send, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HttpMethod } from "@/lib/http";
import { cn } from "@/lib/utils";

import { MethodSelect } from "./method-select";

export function RequestBar({
  method,
  onMethodChange,
  url,
  onUrlChange,
  loading,
  onSend,
  onCancel,
}: {
  method: HttpMethod;
  onMethodChange: (m: HttpMethod) => void;
  url: string;
  onUrlChange: (s: string) => void;
  loading: boolean;
  onSend: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={cn(
        "bg-muted/30 flex h-10 items-stretch overflow-hidden rounded-md",
        "focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-[3px]",
        "transition-shadow",
      )}
    >
      <MethodSelect value={method} onChange={onMethodChange} />

      <div className="bg-border w-px self-stretch shrink-0" aria-hidden />

      <input
        type="text"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !loading) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Enter URL or paste a cURL request"
        aria-label="Request URL"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className={cn(
          "min-w-0 flex-1 bg-transparent px-3 font-sans text-sm outline-none",
          "placeholder:text-muted-foreground/60",
        )}
      />

      {loading ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-full shrink-0 rounded-none border-y-0 border-r-0 px-5 shadow-none"
        >
          <Loader2 className="size-3.5 animate-spin" />
          <Square className="size-3 fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={onSend}
          className="h-full shrink-0 rounded-none border-0 px-5 shadow-none"
        >
          <Send className="size-3.5" />
          Send
        </Button>
      )}
    </div>
  );
}
