import { KvEditor } from "@/components/kv-editor";
import type { KvRow } from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

export function HeadersTab({
  rows,
  onChange,
  variables,
}: {
  rows: KvRow[];
  onChange: (rows: KvRow[]) => void;
  variables: ProjectVariables;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Headers sent with the request. Common ones:
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          accept
        </code>
        ,
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          content-type
        </code>
        ,
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          authorization
        </code>
        .
      </p>
      <KvEditor
        rows={rows}
        onChange={onChange}
        variables={variables}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        emptyHint="No headers yet."
      />
    </div>
  );
}
