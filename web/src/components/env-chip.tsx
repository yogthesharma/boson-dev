import {
  CheckIcon,
  ChevronsUpDownIcon,
  CircleAlertIcon,
  GlobeIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Environment } from "@/types";

interface EnvChipProps {
  environments: Environment[];
  currentId: string;
  onSelect: (id: string) => void;
}

/**
 * Compact environment switcher meant for the workspace header. Visually it
 * reads as `🌐 local ▾` and opens a tidy menu of available environments with
 * a peek at how many variables each one defines.
 */
export function EnvChip({ environments, currentId, onSelect }: EnvChipProps) {
  const current = environments.find((env) => env.id === currentId) ?? null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-7 gap-1.5 px-2 text-xs font-medium",
            "border-dashed",
          )}
        >
          <GlobeIcon className="size-3.5 text-muted-foreground" />
          <span className="truncate">{current?.name ?? "No env"}</span>
          <ChevronsUpDownIcon className="size-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel>Environment</DropdownMenuLabel>
        {environments.length === 0 ? (
          <DropdownMenuItem disabled>
            <CircleAlertIcon className="size-4" />
            No environments defined
          </DropdownMenuItem>
        ) : (
          environments.map((env) => {
            const active = env.id === currentId;
            const varCount = Object.keys(env.variables).length;
            return (
              <DropdownMenuItem
                key={env.id}
                onSelect={() => onSelect(env.id)}
                className={cn(active ? "bg-accent" : "")}
              >
                <CheckIcon
                  className={cn(
                    "size-3.5",
                    active ? "text-foreground" : "text-transparent",
                  )}
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{env.name}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {env.id} · {varCount} {varCount === 1 ? "var" : "vars"}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="text-[11px]">
          Edit YAML to add environments
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
