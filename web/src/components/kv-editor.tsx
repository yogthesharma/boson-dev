import { PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { newKvRow, type KvRow } from "@/lib/request-form";

interface KvEditorProps {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyHint?: string;
  /** Hide the value column (useful for, e.g., flag-style rows). */
  hideValue?: boolean;
  className?: string;
}

export function KvEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  emptyHint = "No rows yet — click Add row to start.",
  hideValue = false,
  className,
}: KvEditorProps) {
  function update(id: string, patch: Partial<KvRow>) {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  function add() {
    onChange([...rows, newKvRow()]);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          {emptyHint}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="w-9 px-3 py-2 text-left"></th>
                <th
                  className={cn(
                    "px-3 py-2 text-left",
                    hideValue ? "" : "w-[40%]",
                  )}
                >
                  {keyPlaceholder}
                </th>
                {hideValue ? null : (
                  <th className="px-3 py-2 text-left">{valuePlaceholder}</th>
                )}
                <th className="w-9 px-3 py-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-muted/30",
                    index !== rows.length - 1 ? "border-b" : "",
                    !row.enabled ? "opacity-50" : "",
                  )}
                >
                  <td className="px-3 py-1.5 align-middle">
                    <Checkbox
                      checked={row.enabled}
                      onCheckedChange={(checked) =>
                        update(row.id, { enabled: checked === true })
                      }
                      aria-label={`Enable ${keyPlaceholder.toLowerCase()}`}
                    />
                  </td>
                  <td className="px-2 py-1 align-middle">
                    <Input
                      value={row.key}
                      onChange={(event) =>
                        update(row.id, { key: event.target.value })
                      }
                      placeholder={keyPlaceholder}
                      className="h-8 border-transparent bg-transparent font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background"
                    />
                  </td>
                  {hideValue ? null : (
                    <td className="px-2 py-1 align-middle">
                      <Input
                        value={row.value}
                        onChange={(event) =>
                          update(row.id, { value: event.target.value })
                        }
                        placeholder={valuePlaceholder}
                        className="h-8 border-transparent bg-transparent font-mono text-xs shadow-none focus-visible:border-input focus-visible:bg-background"
                      />
                    </td>
                  )}
                  <td className="px-2 py-1 text-right align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => remove(row.id)}
                      aria-label="Remove row"
                    >
                      <XIcon className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          className="h-8 gap-1.5 text-xs"
        >
          <PlusIcon className="size-3.5" />
          Add row
        </Button>
      </div>
    </div>
  );
}
