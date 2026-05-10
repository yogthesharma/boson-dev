import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiRequest } from "@/types";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

interface RequestEditorProps {
  form: ApiRequest;
  onFormChange: (request: ApiRequest) => void;
  headersText: string;
  onHeadersTextChange: (text: string) => void;
  bodyText: string;
  onBodyTextChange: (text: string) => void;
  hasDraft: boolean;
  onSaveDraft: () => void;
  onSaveToYaml: () => void;
  onDiscardDraft: () => void;
}

export function RequestEditor({
  form,
  onFormChange,
  headersText,
  onHeadersTextChange,
  bodyText,
  onBodyTextChange,
  hasDraft,
  onSaveDraft,
  onSaveToYaml,
  onDiscardDraft,
}: RequestEditorProps) {
  return (
    <Card>
      <CardContent className="grid gap-4 p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="grid gap-2">
            <Label htmlFor="request-name">Name</Label>
            <Input
              id="request-name"
              value={form.name}
              onChange={(event) =>
                onFormChange({ ...form, name: event.target.value })
              }
            />
          </div>

          <div className="grid gap-2">
            <Label>Method</Label>
            <Select
              value={form.method}
              onValueChange={(method) => onFormChange({ ...form, method })}
            >
              <SelectTrigger aria-label="HTTP method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HTTP_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="request-url">URL</Label>
          <Input
            id="request-url"
            value={form.url}
            onChange={(event) =>
              onFormChange({ ...form, url: event.target.value })
            }
            placeholder="{{base_url}}/todos"
            className="font-mono text-sm"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="request-headers">
            Headers (one per line: key: value)
          </Label>
          <Textarea
            id="request-headers"
            rows={5}
            value={headersText}
            onChange={(event) => onHeadersTextChange(event.target.value)}
            className="font-mono text-sm"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="request-body">Body</Label>
          <Textarea
            id="request-body"
            rows={8}
            value={bodyText}
            onChange={(event) => onBodyTextChange(event.target.value)}
            className="font-mono text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="secondary" onClick={onSaveDraft}>
            Save draft
          </Button>
          <Button variant="secondary" onClick={onSaveToYaml}>
            Save to YAML
          </Button>
          <Button variant="ghost" disabled={!hasDraft} onClick={onDiscardDraft}>
            Discard draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
