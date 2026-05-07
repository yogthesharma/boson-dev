import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ListTree, Search } from "lucide-react";

export function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const [filter, setFilter] = useState("");
  const entries = useMemo(() => Object.entries(headers), [headers]);
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q),
    );
  }, [entries, filter]);

  if (!entries.length) {
    return (
      <EmptyState icon={ListTree} title="No headers" description="The response had no headers." />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="relative shrink-0">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${entries.length} headers…`}
          className="h-8 pl-8 text-xs"
        />
      </div>
      <div className="border-border/60 min-h-0 flex-1 overflow-auto rounded-md border">
        <table className="w-full table-fixed text-left text-xs">
          <colgroup>
            <col className="w-[35%]" />
            <col />
          </colgroup>
          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
            <tr className="border-border/60 border-b text-[10px] tracking-wide uppercase">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="border-border/60 border-l px-3 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([key, value], idx) => (
              <tr
                key={key}
                className={cn(
                  "hover:bg-accent/30 transition-colors",
                  idx > 0 ? "border-border/60 border-t" : "",
                )}
              >
                <td className="text-foreground px-3 py-1.5 font-sans align-top break-all">
                  {key}
                </td>
                <td className="text-muted-foreground border-border/60 border-l px-3 py-1.5 font-sans break-all">
                  {value}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-muted-foreground px-3 py-6 text-center">
                  No headers match “{filter}”.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
