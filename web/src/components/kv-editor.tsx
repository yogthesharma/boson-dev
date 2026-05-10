import { useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";

import { VariableInput } from "@/components/variable-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { newKvRow, type KvRow } from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

const GHOST_ID = "__ghost__";

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
 * Inline-editable key/value editor backed by the shadcn `Table` primitives.
 * A persistent empty "ghost" row trails the real rows — typing into it
 * commits a real `KvRow` and a fresh ghost regenerates. Focus is preserved
 * across the promotion via the `data-kv-row` / `data-kv-field` selectors.
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    id: string;
    field: "key" | "value";
  } | null>(null);

  useEffect(() => {
    if (!focusTarget) return;
    const node = containerRef.current?.querySelector<HTMLInputElement>(
      `input[data-kv-row="${focusTarget.id}"][data-kv-field="${focusTarget.field}"]`,
    );
    if (node) {
      node.focus();
      const len = node.value.length;
      node.setSelectionRange(len, len);
    }
    setFocusTarget(null);
  }, [focusTarget, rows]);

  function update(id: string, patch: Partial<KvRow>) {
    if (id === GHOST_ID) {
      const newRow: KvRow = { ...newKvRow(), ...patch };
      onChange([...rows, newRow]);
      const field: "key" | "value" =
        patch.key !== undefined ? "key" : "value";
      setFocusTarget({ id: newRow.id, field });
      return;
    }
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function remove(id: string) {
    onChange(rows.filter((row) => row.id !== id));
  }

  const ghost: KvRow = {
    id: GHOST_ID,
    enabled: true,
    key: "",
    value: "",
  };
  const displayRows = [...rows, ghost];

  return (
    <div
      ref={containerRef}
      className={cn("my-3 mr-3 ml-7 overflow-hidden rounded-md border", className)}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 border-r" />
            <TableHead className="w-[240px] border-r">
              {keyPlaceholder}
            </TableHead>
            {hideValue ? null : (
              <TableHead className="border-r">{valuePlaceholder}</TableHead>
            )}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRows.map((row) => {
            const isGhost = row.id === GHOST_ID;
            return (
              <TableRow
                key={row.id}
                className={cn(
                  "group",
                  !isGhost && !row.enabled && "opacity-50",
                )}
              >
                <TableCell className="border-r text-center">
                  {isGhost ? null : (
                    <Checkbox
                      checked={row.enabled}
                      onCheckedChange={(checked) =>
                        update(row.id, { enabled: checked === true })
                      }
                      aria-label={`Enable ${keyPlaceholder.toLowerCase()}`}
                    />
                  )}
                </TableCell>
                <TableCell className="border-r">
                  <Input
                    data-kv-row={row.id}
                    data-kv-field="key"
                    value={row.key}
                    onChange={(event) =>
                      update(row.id, { key: event.target.value })
                    }
                    placeholder={keyPlaceholder}
                    className="h-7 border-0 !bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                  />
                </TableCell>
                {hideValue ? null : (
                  <TableCell className="border-r">
                    {variables ? (
                      <VariableInput
                        data-kv-row={row.id}
                        data-kv-field="value"
                        value={row.value}
                        onChange={(value) => update(row.id, { value })}
                        variables={variables}
                        placeholder={valuePlaceholder}
                        className="h-7 border-0 !bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                      />
                    ) : (
                      <Input
                        data-kv-row={row.id}
                        data-kv-field="value"
                        value={row.value}
                        onChange={(event) =>
                          update(row.id, { value: event.target.value })
                        }
                        placeholder={valuePlaceholder}
                        className="h-7 border-0 !bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="text-center">
                  {isGhost ? null : (
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
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
