import { Check, ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HTTP_METHODS, METHOD_COLORS, type HttpMethod } from "@/lib/http";
import { cn } from "@/lib/utils";

export function MethodSelect({
  value,
  onChange,
}: {
  value: HttpMethod;
  onChange: (method: HttpMethod) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="HTTP method"
        className={cn(
          "inline-flex h-full shrink-0 items-center gap-1.5 px-3 font-sans text-xs font-bold tracking-wider outline-none",
          "hover:bg-accent/40 data-[state=open]:bg-accent/40 transition-colors",
          METHOD_COLORS[value],
        )}
      >
        {value}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="min-w-[160px]">
        {HTTP_METHODS.map((m) => (
          <DropdownMenuItem
            key={m}
            onSelect={() => onChange(m)}
            className="font-sans"
          >
            <span
              className={cn(
                "text-xs font-bold tracking-wider",
                METHOD_COLORS[m],
              )}
            >
              {m}
            </span>
            {m === value ? (
              <Check className="text-muted-foreground ml-auto size-3.5" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
