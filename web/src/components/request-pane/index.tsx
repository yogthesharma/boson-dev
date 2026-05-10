import { useMemo } from "react";

import { ParamsTab } from "@/components/request-pane/params-tab";
import { HeadersTab } from "@/components/request-pane/headers-tab";
import { BodyTab } from "@/components/request-pane/body-tab";
import { AuthTab } from "@/components/request-pane/auth-tab";
import { OptionsTab } from "@/components/request-pane/options-tab";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  activeRowCount,
  type AuthForm,
  type BodyForm,
  type KvRow,
  type OptionsForm,
  REQUEST_FORM_DEFAULTS,
} from "@/lib/request-form";

interface RequestPaneProps {
  query: KvRow[];
  headers: KvRow[];
  body: BodyForm;
  auth: AuthForm;
  options: OptionsForm;
  onQueryChange: (rows: KvRow[]) => void;
  onHeadersChange: (rows: KvRow[]) => void;
  onBodyChange: (body: BodyForm) => void;
  onAuthChange: (auth: AuthForm) => void;
  onOptionsChange: (options: OptionsForm) => void;
}

export function RequestPane({
  query,
  headers,
  body,
  auth,
  options,
  onQueryChange,
  onHeadersChange,
  onBodyChange,
  onAuthChange,
  onOptionsChange,
}: RequestPaneProps) {
  const queryCount = useMemo(() => activeRowCount(query), [query]);
  const headerCount = useMemo(() => activeRowCount(headers), [headers]);
  const bodyLabel = bodyKindLabel(body);
  const authLabel = authKindLabel(auth);
  const optionsDirty = isOptionsDirty(options);

  return (
    <Tabs defaultValue="params" className="flex h-full min-h-0 flex-col gap-0">
      <div className="border-b px-3 pb-1 pt-2">
        <TabsList variant="line" className="h-9 gap-1 bg-transparent p-0">
          <TabTrigger value="params" label="Params" badge={queryCount} />
          <TabTrigger value="headers" label="Headers" badge={headerCount} />
          <TabTrigger value="body" label="Body" badge={bodyLabel} />
          <TabTrigger value="auth" label="Auth" badge={authLabel} />
          <TabTrigger
            value="options"
            label="Options"
            badge={optionsDirty ? "•" : undefined}
          />
        </TabsList>
      </div>

      <TabsContent value="params" className="min-h-0 overflow-auto p-4">
        <ParamsTab rows={query} onChange={onQueryChange} />
      </TabsContent>
      <TabsContent value="headers" className="min-h-0 overflow-auto p-4">
        <HeadersTab rows={headers} onChange={onHeadersChange} />
      </TabsContent>
      <TabsContent
        value="body"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <BodyTab body={body} onChange={onBodyChange} />
      </TabsContent>
      <TabsContent value="auth" className="min-h-0 overflow-auto p-4">
        <AuthTab auth={auth} onChange={onAuthChange} />
      </TabsContent>
      <TabsContent value="options" className="min-h-0 overflow-auto p-4">
        <OptionsTab options={options} onChange={onOptionsChange} />
      </TabsContent>
    </Tabs>
  );
}

function TabTrigger({
  value,
  label,
  badge,
}: {
  value: string;
  label: string;
  badge?: number | string;
}) {
  const showBadge =
    badge !== undefined &&
    badge !== null &&
    !(typeof badge === "number" && badge === 0) &&
    !(typeof badge === "string" && badge.length === 0);
  return (
    <TabsTrigger value={value} className="h-8 gap-1.5 px-2.5 text-xs">
      {label}
      {showBadge ? (
        <Badge
          variant="secondary"
          className={cn(
            "h-4 min-w-4 rounded-sm px-1 text-[10px] font-medium leading-none",
          )}
        >
          {badge}
        </Badge>
      ) : null}
    </TabsTrigger>
  );
}

function bodyKindLabel(body: BodyForm): string | undefined {
  switch (body.kind) {
    case "none":
      return undefined;
    case "text":
      return "text";
    case "json":
      return "json";
    case "form":
      return "form";
    case "multipart":
      return "multipart";
    default:
      return undefined;
  }
}

function authKindLabel(auth: AuthForm): string | undefined {
  switch (auth.kind) {
    case "none":
      return undefined;
    case "bearer":
      return "bearer";
    case "basic":
      return "basic";
    case "api_key":
      return "api-key";
    case "oauth2":
      return "oauth2";
    default:
      return undefined;
  }
}

function isOptionsDirty(options: OptionsForm): boolean {
  return (
    options.timeoutMs !== REQUEST_FORM_DEFAULTS.timeoutMs ||
    options.followRedirects !== REQUEST_FORM_DEFAULTS.followRedirects ||
    options.maxRedirects !== REQUEST_FORM_DEFAULTS.maxRedirects ||
    options.maxResponseBytes !== REQUEST_FORM_DEFAULTS.maxResponseBytes ||
    options.cookies !== REQUEST_FORM_DEFAULTS.cookies
  );
}
