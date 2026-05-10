import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { OptionsForm } from "@/lib/request-form";

export function OptionsTab({
  options,
  onChange,
}: {
  options: OptionsForm;
  onChange: (options: OptionsForm) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <NumberField
        label="Timeout (ms)"
        hint="Abort the request after this many milliseconds."
        value={options.timeoutMs}
        min={0}
        step={1000}
        onChange={(timeoutMs) => onChange({ ...options, timeoutMs })}
      />
      <NumberField
        label="Max response (bytes)"
        hint="Larger responses are truncated and flagged."
        value={options.maxResponseBytes}
        min={0}
        step={1024}
        onChange={(maxResponseBytes) =>
          onChange({ ...options, maxResponseBytes })
        }
      />

      <ToggleField
        label="Follow redirects"
        hint="Automatically follow 3xx redirects."
        checked={options.followRedirects}
        onChange={(followRedirects) =>
          onChange({ ...options, followRedirects })
        }
      />
      <NumberField
        label="Max redirects"
        hint="Caps how many hops are followed."
        value={options.maxRedirects}
        min={0}
        step={1}
        disabled={!options.followRedirects}
        onChange={(maxRedirects) => onChange({ ...options, maxRedirects })}
      />

      <ToggleField
        label="Persist cookies"
        hint="Use a per-run cookie jar (off by default)."
        checked={options.cookies}
        onChange={(cookies) => onChange({ ...options, cookies })}
      />
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  min,
  step,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
        className="h-9 max-w-[220px] font-mono text-sm"
      />
      {hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-1" />
      <div className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint ? (
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
