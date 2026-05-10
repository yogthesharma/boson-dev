import { KvEditor } from "@/components/kv-editor";
import type { KvRow } from "@/lib/request-form";

export function ParamsTab({
  rows,
  onChange,
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Query string parameters appended to the URL. Variables like
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          {"{{base_url}}"}
        </code>
        are interpolated at run time.
      </p>
      <KvEditor
        rows={rows}
        onChange={onChange}
        keyPlaceholder="Parameter"
        valuePlaceholder="Value"
        emptyHint="No query parameters yet."
      />
    </div>
  );
}
