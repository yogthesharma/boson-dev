import {
  Binary,
  Braces,
  Check,
  ChevronDown,
  Code2,
  Database,
  FileText,
  FormInput,
  Link2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BODY_MODE_LABELS, type BodyMode } from "@/lib/http";
import { cn } from "@/lib/utils";

type Group = {
  label: string;
  items: { id: BodyMode; icon: LucideIcon }[];
};

const GROUPS: Group[] = [
  {
    label: "Form",
    items: [
      { id: "multipart", icon: FormInput },
      { id: "form-urlencoded", icon: Link2 },
    ],
  },
  {
    label: "Raw",
    items: [
      { id: "json", icon: Braces },
      { id: "xml", icon: Code2 },
      { id: "text", icon: FileText },
      { id: "sparql", icon: Database },
    ],
  },
  {
    label: "Other",
    items: [
      { id: "file", icon: Binary },
      { id: "none", icon: XCircle },
    ],
  },
];

export function BodySelect({
  value,
  onChange,
}: {
  value: BodyMode;
  onChange: (mode: BodyMode) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Body type"
        className={cn(
          "text-foreground inline-flex h-7 cursor-pointer items-center gap-1 px-1 text-xs font-medium",
          "hover:bg-accent/40 data-[state=open]:bg-accent/40 rounded-md transition-colors",
          "outline-none",
        )}
      >
        {BODY_MODE_LABELS[value]}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-[200px]">
        {GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel className="text-muted-foreground px-2 py-1 text-[10px] font-semibold tracking-wider uppercase">
              {group.label}
            </DropdownMenuLabel>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.id === value;
              return (
                <DropdownMenuItem
                  key={item.id}
                  onSelect={() => onChange(item.id)}
                  className="text-xs"
                >
                  <Icon className="size-3.5 opacity-70" />
                  {BODY_MODE_LABELS[item.id]}
                  {active ? (
                    <Check className="text-muted-foreground ml-auto size-3.5" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
