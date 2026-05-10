import { KvEditor } from "@/components/kv-editor";
import type { KvRow } from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

export function ParamsTab({
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
        Query string parameters appended to the URL. Type
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          {"{{"}
        </code>
        in any value to pull from the current environment or secrets.
      </p>
      <KvEditor
        rows={rows}
        onChange={onChange}
        variables={variables}
        keyPlaceholder="Parameter"
        valuePlaceholder="Value"
        emptyHint="No query parameters yet."
      />
    </div>
  );
}
