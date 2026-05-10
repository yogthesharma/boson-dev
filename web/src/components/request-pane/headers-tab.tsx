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
    <KvEditor
      rows={rows}
      onChange={onChange}
      variables={variables}
      keyPlaceholder="Name"
      valuePlaceholder="Value"
    />
  );
}
