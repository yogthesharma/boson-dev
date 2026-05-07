import { Braces, ChevronDown, FileText } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ResponseFormat = "json" | "raw";

const ITEMS: {
  id: ResponseFormat;
  label: string;
  icon: typeof Braces;
}[] = [
  { id: "json", label: "JSON", icon: Braces },
  { id: "raw", label: "Raw", icon: FileText },
];

export function ResponseFormatSelect({
  value,
  onChange,
  disabled,
}: {
  value: ResponseFormat;
  onChange: (next: ResponseFormat) => void;
  disabled?: boolean;
}) {
  const active = ITEMS.find((i) => i.id === value) ?? ITEMS[0];
  const Icon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "border-border/60 inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium",
          "hover:bg-accent/40 cursor-pointer transition-colors",
          "data-[state=open]:bg-accent/40",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        aria-label="Response format"
      >
        <Icon className="size-3.5 opacity-80" />
        {active.label}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[140px]">
        {ITEMS.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => onChange(item.id)}
            className="text-xs"
          >
            <item.icon className="size-3.5 opacity-70" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
