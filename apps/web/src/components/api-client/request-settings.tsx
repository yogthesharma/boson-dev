import { Tag, X } from "lucide-react";
import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/**
 * One labelled row in the settings list. The title + description sit on the
 * left, the control (Switch / Input / etc.) is right-aligned.
 */
function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  clearable,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  clearable?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="relative w-20">
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          let next = Math.floor(n);
          if (typeof min === "number") next = Math.max(min, next);
          if (typeof max === "number") next = Math.min(max, next);
          onChange(next);
        }}
        className={cn(
          "h-8 w-20 px-2 text-right text-xs tabular-nums",
          clearable && "pr-7",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      {clearable && value !== 0 ? (
        <button
          type="button"
          onClick={() => onChange(0)}
          aria-label="Clear value"
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 transition-colors"
        >
          <X className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

export function RequestSettings({
  tags,
  onTagsChange,
  urlEncode,
  onUrlEncodeChange,
  followRedirects,
  onFollowRedirectsChange,
  maxRedirects,
  onMaxRedirectsChange,
  proxyTimeoutMs,
  onProxyTimeoutMsChange,
}: {
  tags: string;
  onTagsChange: (s: string) => void;
  urlEncode: boolean;
  onUrlEncodeChange: (v: boolean) => void;
  followRedirects: boolean;
  onFollowRedirectsChange: (v: boolean) => void;
  maxRedirects: number;
  onMaxRedirectsChange: (n: number) => void;
  proxyTimeoutMs: number;
  onProxyTimeoutMsChange: (ms: number) => void;
}) {
  return (
    <div className="w-full space-y-4">
      <p className="text-muted-foreground text-sm">
        Configure request settings for this item.
      </p>

      <section className="space-y-2 pt-2">
        <div className="text-foreground flex items-center gap-2 text-sm font-medium">
          <Tag className="text-muted-foreground size-3.5" />
          Tags
        </div>
        <Input
          value={tags}
          onChange={(e) => onTagsChange(e.target.value)}
          placeholder="e.g., smoke, regression"
          className="h-9 text-sm"
        />
      </section>

      <div className="border-border/60 divide-border/60 divide-y border-t pt-2">
        <SettingRow
          title="URL Encoding"
          description="Automatically encode query parameters in the URL"
          control={
            <Switch
              checked={urlEncode}
              onCheckedChange={onUrlEncodeChange}
              aria-label="URL Encoding"
            />
          }
        />

        <SettingRow
          title="Automatically Follow Redirects"
          description="Follow HTTP redirects automatically"
          control={
            <Switch
              checked={followRedirects}
              onCheckedChange={onFollowRedirectsChange}
              aria-label="Automatically Follow Redirects"
            />
          }
        />

        <SettingRow
          title="Max Redirects"
          description="Set a limit for the number of redirects to follow"
          control={
            <NumberInput
              value={maxRedirects}
              min={0}
              max={50}
              onChange={onMaxRedirectsChange}
              ariaLabel="Max redirects"
            />
          }
        />

        <SettingRow
          title="Timeout (ms)"
          description="Set maximum time to wait before aborting the request"
          control={
            <NumberInput
              value={proxyTimeoutMs}
              min={0}
              max={120_000}
              clearable
              onChange={onProxyTimeoutMsChange}
              ariaLabel="Timeout in milliseconds"
            />
          }
        />
      </div>
    </div>
  );
}
