import { Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { newKvRow, type KvRow } from "@/lib/kv";
import { cn } from "@/lib/utils";

function isEmptyRow(r: KvRow): boolean {
  return !r.key.trim() && !r.value.trim();
}

/**
 * Bruno/Postman-style key-value table editor.
 *
 * UX rules:
 *   - There is always exactly one trailing empty "placeholder" row at the
 *     bottom (no checkbox, no trash, just placeholder text).
 *   - Typing into the placeholder promotes it to a real row and a fresh
 *     placeholder appears below.
 *   - Real rows show a checkbox (enable / disable) and a trash button.
 */
export function KvEditor({
  rows,
  onChange,
  title,
  keyPlaceholder = "Name",
  valuePlaceholder = "Value",
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  title?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const ensureTrailingEmpty = (next: KvRow[]): KvRow[] => {
    if (next.length === 0 || !isEmptyRow(next[next.length - 1])) {
      return [...next, newKvRow()];
    }
    return next;
  };

  const update = (id: string, patch: Partial<KvRow>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    onChange(ensureTrailingEmpty(next));
  };

  const remove = (id: string) => {
    onChange(ensureTrailingEmpty(rows.filter((r) => r.id !== id)));
  };

  const cellBorder =
    "border-border border-r border-b last:border-r-0 align-middle";

  return (
    <div className={cn(title ? "space-y-2" : "")}>
      {title ? (
        <h3 className="text-muted-foreground text-xs font-medium">{title}</h3>
      ) : null}

      <div className="bg-background overflow-hidden rounded-md border border-border">
        <Table className="border-collapse">
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead
                className={cn(
                  "bg-muted/40 text-muted-foreground h-7 w-8 px-0 text-[11px]",
                  cellBorder,
                )}
              />
              <TableHead
                className={cn(
                  "bg-muted/40 text-muted-foreground h-7 w-[38%] px-2 text-[11px]",
                  cellBorder,
                )}
              >
                Name
              </TableHead>
              <TableHead
                className={cn(
                  "bg-muted/40 text-muted-foreground h-7 px-2 text-[11px]",
                  cellBorder,
                )}
              >
                Value
              </TableHead>
              <TableHead
                className={cn(
                  "bg-muted/40 text-muted-foreground h-7 w-8 px-0 text-[11px]",
                  cellBorder,
                )}
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => {
              const isLast = i === rows.length - 1;
              const isPlaceholder = isLast && isEmptyRow(row);
              const dim = !isPlaceholder && !row.enabled;

              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    "border-0",
                    isPlaceholder ? "hover:bg-transparent" : "hover:bg-muted/25",
                  )}
                >
                <TableCell
                  className={cn(
                    "p-0 text-center",
                    cellBorder,
                    isLast && isPlaceholder && "border-b-0",
                  )}
                >
                  {!isPlaceholder ? (
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        update(row.id, { enabled: e.target.checked })
                      }
                      className="accent-primary size-3 cursor-pointer"
                      aria-label="Enable row"
                    />
                  ) : null}
                </TableCell>

                <TableCell
                  className={cn(
                    "p-0",
                    cellBorder,
                    isLast && isPlaceholder && "border-b-0",
                  )}
                >
                  <input
                    value={row.key}
                    onChange={(e) => update(row.id, { key: e.target.value })}
                    placeholder={keyPlaceholder}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    className={cn(
                      "h-7 w-full bg-transparent px-2 font-sans text-[13px] outline-none",
                      "placeholder:text-muted-foreground/60",
                      dim && "opacity-50",
                    )}
                  />
                </TableCell>

                <TableCell
                  className={cn(
                    "p-0",
                    cellBorder,
                    isLast && isPlaceholder && "border-b-0",
                  )}
                >
                  <input
                    value={row.value}
                    onChange={(e) => update(row.id, { value: e.target.value })}
                    placeholder={valuePlaceholder}
                    spellCheck={false}
                    autoComplete="off"
                    autoCapitalize="off"
                    className={cn(
                      "h-7 w-full bg-transparent px-2 font-sans text-[13px] outline-none",
                      "placeholder:text-muted-foreground/60",
                      dim && "opacity-50",
                    )}
                  />
                </TableCell>

                <TableCell
                  className={cn(
                    "p-0 text-center",
                    cellBorder,
                    isLast && isPlaceholder && "border-b-0",
                  )}
                >
                  {!isPlaceholder ? (
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      aria-label="Remove row"
                      className="text-muted-foreground hover:text-destructive inline-flex size-6 cursor-pointer items-center justify-center rounded-md transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
