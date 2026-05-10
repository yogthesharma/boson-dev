import { useMemo } from "react";
import { FileTextIcon, PlusIcon, SparklesIcon, XIcon } from "lucide-react";

import { KvEditor } from "@/components/kv-editor";
import { VariableInput } from "@/components/variable-input";
import {
  CodeEditor,
  languageFromContentType,
} from "@/components/ui/code-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  BodyForm,
  BodyKind,
  KvRow,
  MultipartUiField,
} from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

const BODY_OPTIONS: { value: BodyKind; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "no request body" },
  { value: "text", label: "Raw", hint: "raw text with explicit content-type" },
  { value: "json", label: "JSON", hint: "JSON body, validated and pretty-printed" },
  { value: "form", label: "Form", hint: "application/x-www-form-urlencoded" },
  { value: "multipart", label: "Multipart", hint: "multipart/form-data with files" },
];

const COMMON_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "application/xml",
  "text/plain",
  "text/html",
  "text/yaml",
];

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
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Select
          value={body.kind}
          onValueChange={(value) =>
            onChange({ ...body, kind: value as BodyKind })
          }
        >
          <SelectTrigger className="h-8 min-w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BODY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex flex-col items-start">
                  <span className="text-sm">{option.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {option.hint}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {body.kind === "text" ? (
          <ContentTypeInput
            value={body.text.contentType}
            onChange={(contentType) =>
              onChange({
                ...body,
                text: { ...body.text, contentType },
              })
            }
          />
        ) : null}

        {body.kind === "json" ? (
          <JsonToolbar body={body} onChange={onChange} />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {body.kind === "none" ? <NoneState /> : null}
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
        {body.kind === "json" ? (
          <CodeEditor
            language="json"
            value={body.json.rawText}
            onChange={(rawText) =>
              onChange({ ...body, json: { rawText } })
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
    </div>
  );
}

function NoneState() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
      <div className="text-center">
        <FileTextIcon className="mx-auto mb-2 size-6 opacity-60" />
        <p>This request has no body.</p>
        <p className="text-xs opacity-80">
          Pick a body type from the menu to add one.
        </p>
      </div>
    </div>
  );
}

function ContentTypeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
        content-type
      </span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list="boson-content-types"
        placeholder="text/plain"
        className="h-8 w-56 font-mono text-xs"
      />
      <datalist id="boson-content-types">
        {COMMON_CONTENT_TYPES.map((type) => (
          <option key={type} value={type} />
        ))}
      </datalist>
    </div>
  );
}

function JsonToolbar({
  body,
  onChange,
}: {
  body: BodyForm;
  onChange: (body: BodyForm) => void;
}) {
  const validation = useMemo(() => {
    const trimmed = body.json.rawText.trim();
    if (!trimmed) return { kind: "empty" as const };
    try {
      JSON.parse(trimmed);
      return { kind: "ok" as const };
    } catch (error) {
      return {
        kind: "error" as const,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }, [body.json.rawText]);

  function format() {
    const trimmed = body.json.rawText.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      onChange({
        ...body,
        json: { rawText: JSON.stringify(parsed, null, 2) },
      });
    } catch {
      // Leave invalid JSON alone — surfaced via the badge.
    }
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      {validation.kind === "ok" ? (
        <Badge
          variant="secondary"
          className="h-6 border-emerald-500/40 bg-emerald-500/10 px-2 text-[11px] text-emerald-700 dark:text-emerald-300"
        >
          valid
        </Badge>
      ) : null}
      {validation.kind === "error" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="h-6 cursor-help border-rose-500/40 bg-rose-500/10 px-2 text-[11px] text-rose-700 dark:text-rose-300"
            >
              invalid
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {validation.message}
          </TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={format}
            disabled={validation.kind !== "ok"}
            aria-label="Format JSON"
          >
            <SparklesIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Format JSON</TooltipContent>
      </Tooltip>
    </div>
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
    <div className="flex flex-col gap-3 overflow-auto p-4">
      <p className="text-xs text-muted-foreground">
        Sent as
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          application/x-www-form-urlencoded
        </code>
        — values are URL-encoded automatically.
      </p>
      <KvEditor
        rows={rows}
        onChange={onChange}
        variables={variables}
        keyPlaceholder="Field"
        valuePlaceholder="Value"
        emptyHint="No form fields yet."
      />
    </div>
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
      <p className="text-xs text-muted-foreground">
        Sent as
        <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
          multipart/form-data
        </code>
        — file paths are resolved relative to your project root at run time.
      </p>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
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
                  className="h-7 flex-1 font-mono text-xs"
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
                    className="h-8 font-mono text-xs"
                  />
                ) : (
                  <div className="grid gap-2 md:grid-cols-3">
                    <VariableInput
                      value={field.path}
                      onChange={(path) => update(field.id, { path })}
                      variables={variables}
                      placeholder="./path/to/file.png"
                      className="h-8 font-mono text-xs md:col-span-3"
                    />
                    <Input
                      value={field.fileName}
                      onChange={(event) =>
                        update(field.id, { fileName: event.target.value })
                      }
                      placeholder="file name (optional)"
                      className="h-8 font-mono text-xs"
                    />
                    <Input
                      value={field.contentType}
                      onChange={(event) =>
                        update(field.id, { contentType: event.target.value })
                      }
                      placeholder="content-type (optional)"
                      className="h-8 font-mono text-xs md:col-span-2"
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
