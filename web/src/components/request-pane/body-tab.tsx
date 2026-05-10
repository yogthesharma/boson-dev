import { useMemo } from "react";
import { PlusIcon, XIcon } from "lucide-react";

import { KvEditor } from "@/components/kv-editor";
import { VariableInput } from "@/components/variable-input";
import {
  CodeEditor,
  languageFromContentType,
} from "@/components/ui/code-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  BodyForm,
  BodyKind,
  KvRow,
  MultipartUiField,
} from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

const BODY_KIND_LABELS: Record<BodyKind, string> = {
  none: "No Body",
  text: "Text",
  json: "JSON",
  form: "Form URL Encoded",
  multipart: "Multipart Form",
};

/**
 * Right-aligned toolbar surface for the Body tab. Lives in the request
 * pane's tab strip so it sits inline with the tabs (Params / Body / …),
 * not below them — matches Bruno's compact "actions on the right" layout.
 */
export function BodyTabToolbar({
  body,
  onChange,
}: {
  body: BodyForm;
  onChange: (body: BodyForm) => void;
}) {
  function prettifyJson() {
    const trimmed = body.json.rawText.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      onChange({ ...body, json: { rawText: JSON.stringify(parsed, null, 2) } });
    } catch {
      // ignore — invalid JSON is left as-is
    }
  }

  const jsonIsValid = useMemo(() => {
    const trimmed = body.json.rawText.trim();
    if (!trimmed) return true;
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      return false;
    }
  }, [body.json.rawText]);

  return (
    <div className="flex items-center gap-3">
      {body.kind === "json" ? (
        <button
          type="button"
          onClick={prettifyJson}
          disabled={!jsonIsValid}
          className="text-xs text-primary hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
        >
          Prettify
        </button>
      ) : null}

      <Select
        value={body.kind}
        onValueChange={(value) =>
          onChange({ ...body, kind: value as BodyKind })
        }
      >
        <SelectTrigger className="h-7 gap-1.5 border-0 bg-transparent px-1.5 text-xs font-medium text-primary shadow-none focus-visible:ring-0 [&_svg]:text-primary">
          <SelectValue>{BODY_KIND_LABELS[body.kind]}</SelectValue>
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            <SelectLabel>Form</SelectLabel>
            <SelectItem value="multipart">Multipart Form</SelectItem>
            <SelectItem value="form">Form URL Encoded</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Raw</SelectLabel>
            <SelectItem value="json">JSON</SelectItem>
            <SelectItem value="text">Text</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Other</SelectLabel>
            <SelectItem value="none">No Body</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function BodyTab({
  body,
  onChange,
  variables,
}: {
  body: BodyForm;
  onChange: (body: BodyForm) => void;
  variables: ProjectVariables;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {body.kind === "none" ? <NoBodyState /> : null}
      {body.kind === "json" ? (
        <CodeEditor
          language="json"
          value={body.json.rawText}
          onChange={(rawText) => onChange({ ...body, json: { rawText } })}
          embedded
          className="flex-1 border-0"
        />
      ) : null}
      {body.kind === "text" ? (
        <CodeEditor
          language={languageFromContentType(body.text.contentType)}
          value={body.text.value}
          onChange={(value) =>
            onChange({ ...body, text: { ...body.text, value } })
          }
          embedded
          className="flex-1 border-0"
        />
      ) : null}
      {body.kind === "form" ? (
        <FormBody
          rows={body.form}
          variables={variables}
          onChange={(form) => onChange({ ...body, form })}
        />
      ) : null}
      {body.kind === "multipart" ? (
        <MultipartBody
          fields={body.multipart}
          variables={variables}
          onChange={(multipart) => onChange({ ...body, multipart })}
        />
      ) : null}
    </div>
  );
}

function NoBodyState() {
  return (
    <div className="px-7 py-3 text-xs text-muted-foreground">No Body</div>
  );
}

function FormBody({
  rows,
  variables,
  onChange,
}: {
  rows: KvRow[];
  variables: ProjectVariables;
  onChange: (rows: KvRow[]) => void;
}) {
  return (
    <KvEditor
      rows={rows}
      onChange={onChange}
      variables={variables}
      keyPlaceholder="Field"
      valuePlaceholder="Value"
    />
  );
}

function MultipartBody({
  fields,
  variables,
  onChange,
}: {
  fields: MultipartUiField[];
  variables: ProjectVariables;
  onChange: (fields: MultipartUiField[]) => void;
}) {
  function addText() {
    onChange([
      ...fields,
      {
        id: rid(),
        enabled: true,
        name: "",
        kind: "text",
        value: "",
        path: "",
        contentType: "",
        fileName: "",
      },
    ]);
  }

  function addFile() {
    onChange([
      ...fields,
      {
        id: rid(),
        enabled: true,
        name: "",
        kind: "file",
        value: "",
        path: "",
        contentType: "",
        fileName: "",
      },
    ]);
  }

  function update(id: string, patch: Partial<MultipartUiField>) {
    onChange(
      fields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  }

  function remove(id: string) {
    onChange(fields.filter((field) => field.id !== id));
  }

  return (
    <div className="flex flex-col gap-3 overflow-auto p-4">
      {fields.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No fields yet — add a text or file field below.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {fields.map((field) => (
            <div
              key={field.id}
              className={cn(
                "rounded-md border bg-card p-3 transition-colors",
                !field.enabled ? "opacity-60" : "",
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.enabled}
                  onChange={(event) =>
                    update(field.id, { enabled: event.target.checked })
                  }
                  className="size-3.5 rounded border-input"
                  aria-label="Enable field"
                />
                <Select
                  value={field.kind}
                  onValueChange={(kind) =>
                    update(field.id, { kind: kind as "text" | "file" })
                  }
                >
                  <SelectTrigger className="h-7 w-[88px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="file">File</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={field.name}
                  placeholder="field name"
                  onChange={(event) =>
                    update(field.id, { name: event.target.value })
                  }
                  className="h-7 flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground"
                  onClick={() => remove(field.id)}
                  aria-label="Remove field"
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
              <div className="mt-2 grid gap-2">
                {field.kind === "text" ? (
                  <VariableInput
                    value={field.value}
                    onChange={(value) => update(field.id, { value })}
                    variables={variables}
                    placeholder="Value"
                    className="h-8 text-xs"
                  />
                ) : (
                  <div className="grid gap-2 md:grid-cols-3">
                    <VariableInput
                      value={field.path}
                      onChange={(path) => update(field.id, { path })}
                      variables={variables}
                      placeholder="./path/to/file.png"
                      className="h-8 text-xs md:col-span-3"
                    />
                    <Input
                      value={field.fileName}
                      onChange={(event) =>
                        update(field.id, { fileName: event.target.value })
                      }
                      placeholder="file name (optional)"
                      className="h-8 text-xs"
                    />
                    <Input
                      value={field.contentType}
                      onChange={(event) =>
                        update(field.id, { contentType: event.target.value })
                      }
                      placeholder="content-type (optional)"
                      className="h-8 text-xs md:col-span-2"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={addText}
        >
          <PlusIcon className="size-3.5" />
          Text field
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={addFile}
        >
          <PlusIcon className="size-3.5" />
          File field
        </Button>
      </div>
    </div>
  );
}

function rid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}
