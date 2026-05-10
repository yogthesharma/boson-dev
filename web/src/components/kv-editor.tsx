import { PlusIcon, XIcon } from "lucide-react";

import { VariableInput } from "@/components/variable-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { newKvRow, type KvRow } from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

interface KvEditorProps {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** Hide the value column (useful for, e.g., flag-style rows). */
  hideValue?: boolean;
  /**
   * When provided, the value column gains `{{var}}` autocomplete and the
   * key column accepts references too. Pass `undefined` to render plain
   * inputs (useful for purely structural rows).
   */
  variables?: ProjectVariables;
  className?: string;
}

/**
 * Flush, table-based key/value editor that visually mirrors the response
 * pane's Headers / Timeline tables. Columns:
 *
 *   ┌──── checkbox (pl-8 from panel edge)
 *   │  ┌── name (fixed width)
 *   │  │              ┌── value (fluid)
 *   │  │              │           ┌── delete on hover (pr-4 from edge)
 *   │  │              │           │
 *   [✓] name          value       [x]
 *
 * The component owns no outer padding; the wrapping tab supplies a section
 * header (with optional `Bulk Edit` link) above the table.
 */
export function KvEditor({
  rows,
  onChange,
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  hideValue = false,
  variables,
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

  const columnCount = hideValue ? 3 : 4;

  return (
    <div className={cn("flex flex-col", className)}>
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-10" />
          <col className={hideValue ? undefined : "w-[240px]"} />
          {hideValue ? null : <col />}
          <col className="w-10" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b text-[11px] font-medium text-muted-foreground">
            <th className="py-2 pl-8 pr-2 text-left font-medium" />
            <th className="py-2 pr-4 text-left font-medium">
              {keyPlaceholder}
            </th>
            {hideValue ? null : (
              <th className="py-2 pr-4 text-left font-medium">
                {valuePlaceholder}
              </th>
            )}
            <th className="py-2 pr-4" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columnCount}
                className="py-6 pl-8 pr-4 text-left text-xs text-muted-foreground"
              >
                No rows yet — click <span className="font-medium">Add row</span>{" "}
                to start.
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "group border-b border-border/40 last:border-b-0 hover:bg-muted/30",
                !row.enabled && "opacity-50",
              )}
            >
              <td className="py-1 pl-8 pr-2 align-middle">
                <Checkbox
                  checked={row.enabled}
                  onCheckedChange={(checked) =>
                    update(row.id, { enabled: checked === true })
                  }
                  aria-label={`Enable ${keyPlaceholder.toLowerCase()}`}
                />
              </td>
              <td className="py-1 pr-4 align-middle">
                <Input
                  value={row.key}
                  onChange={(event) =>
                    update(row.id, { key: event.target.value })
                  }
                  placeholder={keyPlaceholder}
                  className="h-7 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:bg-muted/30 focus-visible:ring-0"
                />
              </td>
              {hideValue ? null : (
                <td className="py-1 pr-4 align-middle">
                  {variables ? (
                    <VariableInput
                      value={row.value}
                      onChange={(value) => update(row.id, { value })}
                      variables={variables}
                      placeholder={valuePlaceholder}
                      className="h-7 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:bg-muted/30 focus-visible:ring-0"
                    />
                  ) : (
                    <Input
                      value={row.value}
                      onChange={(event) =>
                        update(row.id, { value: event.target.value })
                      }
                      placeholder={valuePlaceholder}
                      className="h-7 border-0 bg-transparent font-mono text-xs shadow-none focus-visible:bg-muted/30 focus-visible:ring-0"
                    />
                  )}
                </td>
              )}
              <td className="py-1 pr-4 text-right align-middle">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => remove(row.id)}
                  aria-label="Remove row"
                >
                  <XIcon className="size-3" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pl-8 pr-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={add}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <PlusIcon className="size-3" />
          Add row
        </Button>
      </div>
    </div>
  );
}
