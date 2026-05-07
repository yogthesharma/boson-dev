import { Check, Copy, Download, WrapText } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

function IconAction({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-accent/40 inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer",
        active ? "text-foreground bg-accent/40" : "",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function ResponseActions({
  body,
  filenameHint,
  wrap,
  onWrapChange,
}: {
  body: string;
  filenameHint?: string;
  wrap: boolean;
  onWrapChange: (wrap: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const download = () => {
    const blob = new Blob([body], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filenameHint ?? `response-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center">
      <button
        type="button"
        onClick={copy}
        title={copied ? "Copied" : "Copy"}
        aria-label="Copy response body"
        className={cn(
          "text-muted-foreground hover:text-foreground hover:bg-accent/40 inline-flex size-7 items-center justify-center rounded-md transition-colors cursor-pointer",
          copied ? "text-emerald-400" : "",
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <IconAction icon={Download} title="Download body" onClick={download} />
      <IconAction
        icon={WrapText}
        title={wrap ? "Disable line wrap" : "Enable line wrap"}
        active={wrap}
        onClick={() => onWrapChange(!wrap)}
      />
    </div>
  );
}
