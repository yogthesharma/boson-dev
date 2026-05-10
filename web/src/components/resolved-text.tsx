import { useMemo } from "react";
import {
  AlertTriangleIcon,
  KeyRoundIcon,
  MonitorIcon,
  VariableIcon,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { resolve, type ProjectVariables, type VariableRef } from "@/lib/variables";

interface ResolvedTextProps {
  value: string;
  variables: ProjectVariables;
  /** Wrap each variable chip in a tooltip showing kind + resolved value. */
  withTooltips?: boolean;
  className?: string;
  /** Optional prefix label, e.g. an icon-and-text indicator. */
  leading?: React.ReactNode;
}

/**
 * Renders a value with each `{{ref}}` swapped out for a small inline chip.
 * Text segments render verbatim. Used under the URL bar and elsewhere we want
 * the user to see "what will actually get sent" at a glance.
 */
export function ResolvedText({
  value,
  variables,
  withTooltips = true,
  className,
  leading,
}: ResolvedTextProps) {
  const resolved = useMemo(
    () => resolve(value, variables),
    [value, variables],
  );

  const hasRefs = resolved.segments.some((segment) => segment.kind === "ref");
  if (!value) return null;

  return (
    <div
      className={cn(
        "flex min-h-5 items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground",
        className,
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-wrap items-center gap-y-0.5 font-mono">
        {resolved.segments.map((segment, index) => {
          if (segment.kind === "text") {
            return (
              <span key={index} className="whitespace-pre-wrap break-all">
                {segment.value}
              </span>
            );
          }
          const ref = segment.ref;
          const chip = <RefChip ref={ref} />;
          if (!withTooltips) return <span key={index}>{chip}</span>;
          return (
            <Tooltip key={index} delayDuration={250}>
              <TooltipTrigger asChild>
                <span>{chip}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs font-sans">
                <RefTooltipBody refEntry={ref} />
              </TooltipContent>
            </Tooltip>
          );
        })}
      </span>
      {!hasRefs ? null : resolved.missing.length > 0 ? (
        <span className="ml-1 inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
          <AlertTriangleIcon className="size-3" />
          {resolved.missing.length} unset
        </span>
      ) : null}
    </div>
  );
}

function RefChip({ ref }: { ref: VariableRef }) {
  const tone = chipTone(ref);
  const Icon = chipIcon(ref);
  return (
    <span
      className={cn(
        "mx-0.5 inline-flex items-center gap-1 rounded-sm border px-1 py-px text-[10px] font-medium leading-none",
        tone,
      )}
    >
      <Icon className="size-2.5" />
      {ref.name}
    </span>
  );
}

function RefTooltipBody({ refEntry }: { refEntry: VariableRef }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">
        {kindWord(refEntry)}
      </div>
      <div className="font-mono text-xs">{refEntry.name}</div>
      {refEntry.kind === "env" && refEntry.value !== null ? (
        <div className="rounded bg-background/20 px-1.5 py-1 font-mono text-[11px]">
          {refEntry.value || "(empty)"}
        </div>
      ) : null}
      {refEntry.kind === "secret" ? (
        <p className="text-[11px] opacity-80">
          Encrypted secret — substituted at run time.
        </p>
      ) : null}
      {refEntry.kind === "host" ? (
        <p className="text-[11px] opacity-80">
          Read from the Boson server's process environment.
        </p>
      ) : null}
      {refEntry.kind === "unknown" ? (
        <p className="text-[11px] opacity-80">
          Not defined in the current environment.
        </p>
      ) : null}
    </div>
  );
}

function chipTone(ref: VariableRef): string {
  switch (ref.kind) {
    case "env":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "secret":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "host":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
    case "unknown":
      return "border-destructive/40 bg-destructive/10 text-destructive";
  }
}

function chipIcon(ref: VariableRef) {
  switch (ref.kind) {
    case "env":
      return VariableIcon;
    case "secret":
      return KeyRoundIcon;
    case "host":
      return MonitorIcon;
    case "unknown":
      return AlertTriangleIcon;
  }
}

function kindWord(ref: VariableRef): string {
  switch (ref.kind) {
    case "env":
      return "env variable";
    case "secret":
      return "secret";
    case "host":
      return "host env";
    case "unknown":
      return "unset variable";
  }
}
