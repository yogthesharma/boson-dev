import { useState } from "react";

import { ParamsTab } from "@/components/request-pane/params-tab";
import { HeadersTab } from "@/components/request-pane/headers-tab";
import { BodyTab } from "@/components/request-pane/body-tab";
import { AuthTab } from "@/components/request-pane/auth-tab";
import { OptionsTab } from "@/components/request-pane/options-tab";
import { Tabs } from "@/components/ui/vercel-tabs";
import type {
  AuthForm,
  BodyForm,
  KvRow,
  OptionsForm,
} from "@/lib/request-form";
import type { ProjectVariables } from "@/lib/variables";

type TabId = "params" | "headers" | "body" | "auth" | "options";

const TABS: { id: TabId; label: string }[] = [
  { id: "params", label: "Params" },
  { id: "headers", label: "Headers" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "options", label: "Options" },
];

interface RequestPaneProps {
  query: KvRow[];
  headers: KvRow[];
  body: BodyForm;
  auth: AuthForm;
  options: OptionsForm;
  variables: ProjectVariables;
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
  variables,
  onQueryChange,
  onHeadersChange,
  onBodyChange,
  onAuthChange,
  onOptionsChange,
}: RequestPaneProps) {
  const [activeTab, setActiveTab] = useState<TabId>("params");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center px-4">
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {activeTab === "params" ? (
          <div className="p-4">
            <ParamsTab
              rows={query}
              onChange={onQueryChange}
              variables={variables}
            />
          </div>
        ) : null}

        {activeTab === "headers" ? (
          <div className="p-4">
            <HeadersTab
              rows={headers}
              onChange={onHeadersChange}
              variables={variables}
            />
          </div>
        ) : null}

        {activeTab === "body" ? (
          <div className="flex h-full min-h-0 flex-col">
            <BodyTab
              body={body}
              onChange={onBodyChange}
              variables={variables}
            />
          </div>
        ) : null}

        {activeTab === "auth" ? (
          <div className="p-4">
            <AuthTab
              auth={auth}
              onChange={onAuthChange}
              variables={variables}
            />
          </div>
        ) : null}

        {activeTab === "options" ? (
          <div className="p-4">
            <OptionsTab options={options} onChange={onOptionsChange} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
